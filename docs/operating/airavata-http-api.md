---
title: Airavata HTTP API
toc_max_heading_level: 3
description: Every /api/v1 route of Airavata's session and batch servers, with its authentication, request, response and error codes.
---

# Airavata HTTP API

Every HTTP route Airavata serves, with its credential, request body, response and errors. Neither route family is
stable; [Compatibility](./compatibility.md) names the clients that must follow a change.

| To find | Read |
|---|---|
| Who may call a route, and with what | [Route families](#route-families); the session [routes](#routes) and [authentication](#authentication); the batch [authentication](#authentication-1) and [authorization](#authorization) |
| How to sign a user in | [Sign-in](#sign-in) |
| The order of calls for a session or a batch run | [Sessions](#sessions); [Process launch example](#process-launch-example) |
| What to do with a refusal, and what is safe to retry | [Idempotency and retries](#idempotency-and-retries); [Session API errors](#session-api-errors); [Batch API errors](#batch-api-errors) |
| Which routes return secrets, and what is left unprotected | [Routes](#routes) (token routes), `attach`, `access`; [Known gaps](#known-gaps) |

## Route families

Two binaries serve two route families with disjoint paths: the session API runs interactive sessions on a user's own
cluster account; the batch API holds a catalogue of clusters, applications and data, and launches batch processes.

| Aspect | Session API | Batch API |
|---|---|---|
| Binary | `cs serve` | `airavata-server` |
| Listens on | `--listen`, default `127.0.0.1:8045`, behind a TLS proxy at `--public-url` | `:$SERVER_PORT`, default `:9095`, all interfaces, plain HTTP |
| Credential | CILogon ID token (JWT), verified locally against the JWKS | CILogon access token, verified by RFC 7662 introspection; or the root token |
| Principal | `sub`, under tenant `cilogon` | `username`, else `preferred_username`, else `sub`; `http://cilogon.org/.../<n>` becomes `cilogon:<n>` |
| Anonymous request | `401`, except sign-in and token routes | Allowed; each route decides |
| Error body | `{"error": {"code", "message"}}` | `{"status", "error", "message", "fieldErrors"?}` |
| Unknown JSON fields | `400 invalid_json` | Ignored |

The session API serves the paths `oauth`, `hosts`, `keys/ssh`, `devtunnels`, `sessions` and `runs`. The batch API
serves `users`, `groups`, `ssh-keys`, `slurm-clusters`, `slurm-cluster-configs`, `application-templates`,
`slurm-deployments`, `scp-data-storages`, `data-products` and `processes`, and `/health`.

Neither server forwards to the other or links a session principal to a batch principal; a deployment serving both
routes by path in its proxy. A client of both families obtains its batch access token from CILogon separately, since
the session sign-in routes return no access token.

| Server | Check | Consequence |
|---|---|---|
| Session | Verifies the ID token's signature locally | No CILogon call per request; a token is good until its `exp` and cannot be revoked |
| Batch | Asks CILogon about each opaque access token | A token CILogon no longer reports active is refused at once; a CILogon outage answers `502` |

## Session API conventions

Paths are relative to `--public-url`. The session examples on this page use:

```bash
API=https://api.example.edu
TOKEN='<ID token from the sign-in routes>'
```

### Routes

Each route accepts only the credential shown; any other path or method is `404` or `405`.

| Route | Methods | Credential |
|---|---|---|
| `/api/v1/oauth/config` | `GET` | None; `Origin` required |
| `/api/v1/oauth/exchange` | `POST` | None; `Origin` required |
| `/api/v1/oauth/refresh` | `POST` | None |
| `/api/v1/oauth/device` | `POST` | None |
| `/api/v1/oauth/device/poll` | `POST` | None |
| `/api/v1/keys/ssh` | `GET`, `POST` | Bearer |
| `/api/v1/keys/ssh/{id}` | `DELETE` | Bearer |
| `/api/v1/hosts` | `GET`, `POST` | Bearer |
| `/api/v1/hosts/{alias}` | `PUT`, `DELETE` | Bearer |
| `/api/v1/hosts/{alias}/health` | `GET` | Bearer |
| `/api/v1/hosts/{alias}/slurm` | `GET` | Bearer |
| `/api/v1/hosts/{alias}/ssh` (WebSocket) | `GET` | Bearer subprotocol |
| `/api/v1/devtunnels` | `GET`, `DELETE` | Bearer |
| `/api/v1/devtunnels/authorizations` | `POST` | Bearer |
| `/api/v1/devtunnels/authorizations/{handle}/poll` | `POST` | Bearer |
| `/api/v1/sessions` | `GET`, `POST` | Bearer |
| `/api/v1/sessions/validate` | `POST` | Bearer |
| `/api/v1/sessions/{id}` | `GET`, `DELETE` | Bearer |
| `/api/v1/sessions/{id}/start` | `POST` | Bearer |
| `/api/v1/sessions/{id}/attach` | `POST` | Bearer |
| `/api/v1/sessions/{id}/stop` | `POST` | Bearer |
| `/api/v1/sessions/{id}/access` | `GET` | Bearer |
| `/api/v1/sessions/{id}/ssh` | `POST` | Bearer |
| `/api/v1/sessions/{id}/usage` | `GET` | Bearer |
| `/api/v1/runs` | `GET` | Bearer |
| `/api/v1/sessions/{id}/forward/{port}` (WebSocket) | `GET` | Jupyter token subprotocol |
| `/api/v1/sessions/{id}/jupyter/{path}` | any | Jupyter token |
| `/api/v1/sessions/{id}/link` (WebSocket, Linkspan) | `GET` | Link token subprotocol |

The last three are **token routes**: they check only the `Origin` and their own per-run token, because their callers
(Jupyter clients, Linkspan in a job) hold no bearer. A per-run token opens one run and stops working when it ends.

### Authentication

Every route except the sign-in routes and the token routes requires exactly one header:

```http
Authorization: Bearer <OIDC ID token>
```

The ID token is validated against the issuer's discovery document and JWKS:

| Check | Rule |
|---|---|
| Format | Three-part JWS; `alg` `RS256`; `kid` required; `typ` empty or `JWT` |
| Key | RSA, at least 2048 bits, odd exponent at least 3, from the JWKS (`use` `sig` or empty; `alg` `RS256` or empty) |
| `iss` | Equals the discovery document's issuer |
| `aud` | Equals the client ID; must be a JSON string |
| `exp`, `nbf` | `exp` required and in the future; `nbf` honoured |
| `sub` | `^[A-Za-z0-9._:@/,-]{1,256}$` |

Discovery is cached for five minutes. An unknown `kid` forces at most one JWKS refresh every 30 seconds. Any failed
check is `401 unauthorized` with `WWW-Authenticate: Bearer`; the client then calls `oauth/refresh`, and signs in again
if that is refused. Every record is scoped to the token's `sub`; there is no administrator role.

The SSH authentication WebSocket carries the credential as exactly two subprotocols, in any order, and negotiates
`cybershuttle.v1`:

```text
cybershuttle.v1
bearer.<unpadded base64url of the ID token>
```

Any other protocol set is `400 invalid_websocket_auth`; a missing, oversized or non-canonical token is `401`. No
other bearer route accepts subprotocol authentication.

### Origins

`--allowed-origin` lists exact HTTPS or loopback HTTP origins.

| Request | Answer |
|---|---|
| `Origin` outside the list, any route | `403 origin_not_allowed` |
| No `Origin` (a native client) | Passes; the bearer or token authenticates it |
| No `Origin` on `oauth/config` or `oauth/exchange` | `403 origin_required` |
| Allowed `Origin`, not a token route | `Access-Control-Allow-Origin`, `Vary: Origin`, `Access-Control-Expose-Headers: ETag, Location` |
| `Access-Control-Request-Method` and `Origin` on an `OPTIONS` preflight, not a token route | `204` with the path's methods |
| Preflight requesting a header beyond `Authorization`, `Content-Type`, `If-None-Match` (only `Content-Type` on sign-in routes) | `403 preflight_not_allowed` |
| Preflight for an unknown path, or a method the path lacks | `404 not_found`, `405 method_not_allowed` |

### Requests and responses

| Rule | Answer |
|---|---|
| Created SSH host, SSH key or session | `201` with `Location` |
| Successful `DELETE` | `204`, no body |
| Unknown path | `404 not_found` |
| Method the path lacks | `405 method_not_allowed` with a sorted `Allow` |
| Request body | JSON, at most 64 KiB (1 KiB for `attach`); unknown fields or trailing data are `400 invalid_json` |
| JSON response | `Cache-Control: no-store` |

### Idempotency and retries

Only `POST /api/v1/sessions` takes an idempotency key. After a lost response:

| Request | Repeated |
|---|---|
| Any `GET` except the WebSockets | Safe; none changes stored state |
| `POST /sessions` | The same `idempotencyKey` and fields answer the existing session with `200`; different fields are `409 idempotency_conflict` |
| `POST /sessions/validate` | Safe; records no session |
| `POST /sessions/{id}/start`, `attach` | Not repeatable: each takes a new `seq`. While a run is live a second call is `409 session_running`; read the session before retrying |
| `POST /sessions/{id}/stop` | Safe; a terminal session is answered unchanged |
| `POST /sessions/{id}/ssh` | Safe; one server per public key |
| `POST /hosts`, `POST /keys/ssh` | `409 ssh_host_exists`, `409 ssh_key_exists`; the first call took effect |
| `DELETE` of an SSH host or session | `404`; the first call took effect |
| `DELETE /keys/ssh/{id}` | `500 internal_error` (see [Known gaps](#known-gaps)); the first call took effect |
| `DELETE /devtunnels` | Safe |

## Sign-in

These routes complete the CILogon grant and add the OIDC client secret, which only the session server holds: the
authorization-code flow with PKCE for browsers, the device grant for other clients. Upstream failures are
`502 upstream_unavailable` or `502 upstream_invalid`.

The browser flow:

```mermaid
sequenceDiagram
  participant B as Browser
  participant P as Airavata
  participant I as CILogon
  B->>P: GET oauth/config
  P-->>B: issuer, client ID, scope
  B->>I: authorize with PKCE
  I-->>B: redirect with code
  B->>P: POST oauth/exchange
  P->>I: code, verifier, secret
  P-->>B: ID and refresh tokens
```

A native client uses the device grant:

```bash
curl -s -X POST "$API/api/v1/oauth/device"
# open verificationUriComplete, then poll every intervalSeconds:
curl -s -X POST "$API/api/v1/oauth/device/poll" \
  -H 'Content-Type: application/json' -d '{"deviceCode":"<deviceCode>"}'
```

### `GET /api/v1/oauth/config` → 200

```json
{
  "issuer": "https://cilogon.org",
  "authorizationEndpoint": "https://cilogon.org/authorize",
  "clientId": "cilogon:/client_id/...",
  "scope": "openid email profile offline_access"
}
```

The browser sends the user to `authorizationEndpoint` with `response_type=code`, `client_id`, `scope`, a
`redirect_uri` on an allowed origin, a `state` and an S256 `code_challenge`. An unreachable discovery document is
`502 upstream_unavailable`.

### `POST /api/v1/oauth/exchange` → 200

```json title="Request"
{ "code": "...", "codeVerifier": "...", "redirectUri": "https://jupyter.example.edu/lab/index.html" }
```

```json title="Response"
{ "idToken": "...", "refreshToken": "...", "expiresInSeconds": 900 }
```

`refreshToken` is present when the issuer granted `offline_access`; `expiresInSeconds` is between 1 and 86400. A
missing field, a `redirectUri` off the allowed origins, or a rejected code is `400 invalid_grant`.

### `POST /api/v1/oauth/refresh` → 200

```json
{ "refreshToken": "..." }
```

Answers `exchange`'s shape, with a rotated `refreshToken` when the issuer rotates it. An empty token is
`invalid_json`; a refused one is `400 invalid_grant`.

### `POST /api/v1/oauth/device` → 200

No body. Answers `deviceCode`, `userCode`, `verificationUriComplete` and `intervalSeconds` (at least 5). The device code is
safe with the client, since redeeming it needs the client secret. An issuer failure is `502 upstream_unavailable`.

### `POST /api/v1/oauth/device/poll` → 200

```json
{ "deviceCode": "..." }
```

| Outcome | Answer |
|---|---|
| Not yet approved (including the issuer's `slow_down`) | `{ "status": "pending", "intervalSeconds": 5 }` |
| Approved | `{ "status": "complete", "idToken": "...", "refreshToken": "...", "expiresInSeconds": 900 }` |

A missing `deviceCode` is `invalid_json`; a denied or expired grant is `400 invalid_grant`.

## SSH keys

SSH keys are per caller and never returned; see [key storage](./airavata-ssh-hosts-and-keys.md#key-storage). A
passphrase-protected key is accepted.

```bash
jq -n --rawfile key ~/.ssh/id_ed25519 '{id: "delta-key", privateKey: $key}' |
  curl -s -X POST "$API/api/v1/keys/ssh" -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' --data-binary @-
```

### `GET /api/v1/keys/ssh` → 200

```json
{ "keys": [{ "id": "delta-key", "type": "ssh-ed25519", "fingerprint": "SHA256:..." }] }
```

### `POST /api/v1/keys/ssh` → 201

```json
{ "id": "delta-key", "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n..." }
```

| Field | Rule | Error |
|---|---|---|
| `id` | `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`, not ending in `.pub`; new | `invalid_ssh_key_id`, `409 ssh_key_exists` |
| `privateKey` | A private key | `invalid_ssh_key` |

Answers the key's metadata with `Location: /api/v1/keys/ssh/<id>`.

### `DELETE /api/v1/keys/ssh/{id}` → 204

Deletes the key and unassigns it from every SSH host. An unknown ID answers `500 internal_error`, not
`404 ssh_key_not_found`; see [Known gaps](#known-gaps).

## SSH hosts

SSH hosts are per caller; two callers may use the same alias. See [Airavata SSH hosts and keys](./airavata-ssh-hosts-and-keys.md) for parsing and rendering.

```bash
curl -s -X POST "$API/api/v1/hosts" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"alias":"delta","command":"ssh -J bastion alice@login.delta.example.edu","keyId":"delta-key"}'
```

### `GET /api/v1/hosts` → 200

```json
{
  "hosts": [
    {
      "alias": "delta",
      "hostname": "login.delta.example.edu",
      "user": "alice",
      "port": 22,
      "keyId": "delta-key",
      "extraDirectives": ["ProxyJump bastion"],
      "managed": true
    }
  ]
}
```

`port` defaults to 22; `user` and `keyId` are omitted when unset; `managed` is always `true`. An SSH host with `keyId`
authenticates with that key only (`IdentitiesOnly yes`); the key's path is never returned.

### `POST /api/v1/hosts` → 201

```json
{ "alias": "delta", "command": "ssh -J bastion alice@login.delta.example.edu", "keyId": "delta-key" }
```

| Field | Rule | Error |
|---|---|---|
| `alias` | `^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`; unique per caller, ignoring case | `invalid_ssh_alias`, `409 ssh_host_exists` |
| `command` | An `ssh` command line; see [host parsing](./airavata-ssh-hosts-and-keys.md#host-parsing) | `invalid_ssh_command` |
| `keyId` | Optional; a stored key | `404 ssh_key_not_found` |

Answers the SSH host with `Location: /api/v1/hosts/<alias>`.

### `PUT /api/v1/hosts/{alias}` → 200

```json
{ "command": "ssh -p 2222 -J bastion alice@login2.delta.example.edu", "keyId": "delta-key" }
```

Replaces the SSH host under the same alias, parsed as for `POST`; an absent `keyId` unassigns the key. An unknown
alias is `404 ssh_host_not_found`.

### `DELETE /api/v1/hosts/{alias}` → 204

An unknown alias is `404 ssh_host_not_found`.

### `GET /api/v1/hosts/{alias}/health` → 200

```json
{ "alias": "delta", "ok": true, "message": "Listening at login.delta.example.edu:22." }
```

Opens a TCP connection to the first hop without authenticating; see
[host parsing](./airavata-ssh-hosts-and-keys.md#host-parsing). A closed port or a non-public address answers `200` with
`ok: false` and `Nothing accepted a connection at <address>.`
An unknown alias is `404 ssh_host_not_found`.

### `GET /api/v1/hosts/{alias}/slurm` → 200

```json
{
  "alias": "delta",
  "accounts": ["project-a"],
  "partitions": [
    { "name": "gpuA100", "cpuCount": 64, "memoryMb": 243200, "gres": [{ "name": "gpu:a100", "count": 4 }] }
  ],
  "homeDir": "/home/alice"
}
```

The remote user's Slurm accounts, `sinfo` partitions and home directory. A partition appears once per node
configuration, so a name can repeat; a session must fit one entry. A GRES entry without a count is left out.

| Refusal | Code |
|---|---|
| Unknown alias | `404 ssh_host_not_found` |
| Non-interactive SSH authentication fails | `409 ssh_authentication_required` |
| Discovery script fails | `502 slurm_discovery_failed` |

### `GET /api/v1/hosts/{alias}/ssh` (WebSocket)

Interactive SSH authentication, establishing the [control master](./airavata-ssh-hosts-and-keys.md#interactive-authentication).
A client opens it after `409 ssh_authentication_required` and repeats its request after `ready`, which comes at once
when a healthy master exists.

| Refusal | Code |
|---|---|
| No `Upgrade` header | `426 upgrade_required` |
| Another authentication in flight for the SSH host | `409 ssh_authentication_in_progress` |
| Service stopping | `503 service_stopping` |

| Direction | Binary frames | Text frames |
|---|---|---|
| Airavata → client | PTY output, including password and second-factor prompts | `ready`, then `exit` with code `0`; on failure, `exit` with a nonzero code and a message |
| Client → Airavata | Keystrokes, at most 32 KiB each | `resize` with columns and rows |

The text frames in full:

```json
{"type":"ready"}
{"type":"exit","code":0}
{"type":"exit","code":<n>,"message":"..."}
{"type":"resize","cols":100,"rows":30}
```

On failure `code` is ssh's exit status when it has one, and `message` is one of a fixed set: `failed to prepare SSH`,
`failed to start SSH`, `SSH authentication failed`, `SSH control master exited before becoming ready`,
`SSH authentication service is stopping`. Remote diagnostics are never sent. Resize honours `cols` 20–500 and
`rows` 5–200. Frames are capped at 64 KiB; the session server pings every 20 seconds; the PTY starts at 100×30.

## Dev Tunnels account

An optional Microsoft or GitHub account, with which the session server makes a Dev Tunnel for each run using the
`devtunnel` transport. The credential is sealed under the caller's principal and never returned. See
[Dev Tunnels](./airavata-sessions-and-runs.md#dev-tunnels).

```bash
HANDLE=$(curl -s -X POST "$API/api/v1/devtunnels/authorizations" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"provider":"github"}' | jq -r .handle)
# enter userCode at verificationUri, then poll every intervalSeconds:
curl -s -X POST "$API/api/v1/devtunnels/authorizations/$HANDLE/poll" -H "Authorization: Bearer $TOKEN"
```

### `GET /api/v1/devtunnels` → 200

```json
{ "connected": true, "provider": "github", "account": "octocat", "connectedAt": "2026-09-17T10:00:00Z" }
```

`{ "connected": false }` when none is connected. `provider` is `microsoft` or `github`; `account` is the Microsoft
username or GitHub login when known.

### `DELETE /api/v1/devtunnels` → 204

Disconnects the account and forgets its credential; idempotent.

### `POST /api/v1/devtunnels/authorizations` → 200

```json title="Request"
{ "provider": "github" }
```

```json title="Response"
{
  "handle": "<43-character opaque handle>",
  "userCode": "ABCD-EFGH",
  "verificationUri": "https://github.com/login/device",
  "expiresInSeconds": 900,
  "intervalSeconds": 5
}
```

Starts a device-code authorization with the provider's Dev Tunnels client. `handle` is the session server's
reference; the device code never reaches the client.

| Refusal | Code |
|---|---|
| Other provider | `400 unknown_provider` |
| More than one start per second per caller | `429 rate_limited` |
| 256 authorizations already pending | `503 broker_capacity` |
| Provider unreachable, refused, malformed | `502 upstream_unavailable`, `upstream_failure`, `upstream_invalid` |

### `POST /api/v1/devtunnels/authorizations/{handle}/poll` → 200

| Outcome | Answer |
|---|---|
| Pending | `{ "status": "pending", "intervalSeconds": 5, "connected": false }` |
| Connected | `{ "status": "connected", "connected": true, "provider": "microsoft", "account": "someone@outlook.com", "connectedAt": "..." }` |

A provider `slow_down` lengthens `intervalSeconds`, up to 60.

| Refusal | Code |
|---|---|
| Unknown handle, or another caller's | `404 not_found` |
| Poll sooner than `intervalSeconds` | `429 rate_limited` |
| Denied | `403 authorization_denied` |
| Expired | `410 authorization_expired` |
| Provider unreachable, refused, malformed | `502 upstream_unavailable`, `upstream_failure`, `upstream_invalid` |

The handle is discarded on any terminal outcome.

## Sessions

On every bearer route below, an unknown `{id}` is `404 session_not_found` and another principal's is
`403 session_owner_mismatch`. States, transitions and identifiers are in
[Airavata sessions and runs](./airavata-sessions-and-runs.md).

| Step | Route |
|---|---|
| Check a request | `POST /api/v1/sessions/validate` |
| Define a session | `POST /api/v1/sessions` |
| Start it | `POST /api/v1/sessions/{id}/start`, or `attach` for a job the client submits |
| Reach it | `GET /api/v1/sessions/{id}/access`, then the Jupyter proxy or a forward; `POST /api/v1/sessions/{id}/ssh` for an SSH server |
| End the run | `POST /api/v1/sessions/{id}/stop` |
| Delete it | `DELETE /api/v1/sessions/{id}` |

Defining touches no cluster; each start is a new run of the same definition. Only `access` and `attach` return a
session's secrets.

```bash
BODY='{"idempotencyKey":"5f2b0d0a-3f14-4a9c-9a1e-6c2b0f7d51ab","alias":"delta","partition":"cpu",
       "rootFolder":"$HOME/project","resources":{"cores":2,"memoryMb":4096,"wallMinutes":60}}'
H=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
curl -s -X POST "$API/api/v1/sessions/validate" "${H[@]}" -d "$BODY"
ID=$(curl -s -X POST "$API/api/v1/sessions" "${H[@]}" -d "$BODY" | jq -r .id)
curl -s -X POST "$API/api/v1/sessions/$ID/start" "${H[@]}"
curl -s "$API/api/v1/sessions/$ID/access" "${H[@]}"   # once state is READY
curl -s -X POST "$API/api/v1/sessions/$ID/stop" "${H[@]}"
```

### Session record

`GET /api/v1/sessions/{id}` → 200 answers the record; `POST /api/v1/sessions`, `start` and `stop` answer it too.

```json
{
  "id": "s-012345abcdef",
  "seq": 1,
  "state": "READY",
  "platform": "jupyterlab",
  "alias": "delta",
  "account": "project-a",
  "partition": "cpu",
  "rootFolder": "$HOME/project",
  "resources": { "cores": 2, "memoryMb": 4096, "wallMinutes": 60 },
  "tunnelModes": ["link"],
  "createdAt": "2030-01-01T00:00:00Z",
  "startedAt": "2030-01-01T00:00:30Z",
  "updatedAt": "2030-01-01T00:01:00Z"
}
```

| Field | Meaning |
|---|---|
| `id` | `s-` and 12 hex characters, derived from the caller and the `idempotencyKey` |
| `seq` | 0 before the first run, then the current run; `start` and `attach` increment it |
| `state` | `SUBMITTING`, `QUEUED`, `STARTING`, `READY`, `STOPPING`, `STOPPED` or `FAILED` |
| `platform` | Launcher of the latest run: `jupyterlab` (`start`, and the default) or `vscode` (`attach`) |
| `tunnelModes` | The run's transports, sorted: `link`, `devtunnel` or both |
| `startedAt` | First Slurm `RUNNING` or link, whichever is earlier; with `wallMinutes`, the deadline |

`account`, `error` and `startedAt` are omitted when empty. `READY` means the run is reachable; see
[transitions](./airavata-sessions-and-runs.md#states).

### `POST /api/v1/sessions/validate` → 200

```json
{
  "idempotencyKey": "5f2b0d0a-3f14-4a9c-9a1e-6c2b0f7d51ab",
  "alias": "delta",
  "account": "project-a",
  "partition": "cpu",
  "rootFolder": "$HOME/project",
  "resources": { "cores": 2, "memoryMb": 4096, "wallMinutes": 60, "gpuType": "a100", "gpuCount": 1 },
  "tunnelModes": ["link", "devtunnel"]
}
```

| Field | Rule | Error |
|---|---|---|
| `idempotencyKey` | Required, at most 128 bytes, no NUL, CR or LF | `invalid_idempotency_key` |
| `alias` | `^[A-Za-z0-9][A-Za-z0-9_.-]*$`, at most 128 characters; a configured SSH host | `invalid_ssh_alias`; `404 ssh_host_not_found` at discovery |
| `account` | Optional; same pattern, at most 64 characters; a discovered account | `invalid_account` |
| `partition` | Same pattern, at most 64 characters; a discovered partition | `invalid_partition` |
| `cores` | 2 to 4096 | `invalid_resources` |
| `memoryMb` | 4096 to 100000000 | `invalid_resources` |
| `wallMinutes` | 1 to 525600 | `invalid_resources` |
| `gpuType`, `gpuCount` | Both or neither, `gpuCount` at least 1; available on the partition | `invalid_gpu` |
| All resources | Fit one discovered partition entry; CPU-only requests match only partitions without GPU GRES | `invalid_resource` |
| `rootFolder` | See [root folder](./airavata-sessions-and-runs.md#root-folder) | `invalid_root_folder` |
| `tunnelModes` | Optional, default `["link"]`; distinct values from `link` and `devtunnel` | `invalid_tunnel_modes` |
| `devtunnel` in `tunnelModes` | A connected Dev Tunnels account | `409 devtunnels_account_required` |

```json title="Response"
{
  "sessionId": "s-012345abcdef",
  "script": "#!/bin/bash\n#SBATCH --nodes=1\n...",
  "status": "PASSED",
  "message": "Slurm accepted the job script."
}
```

Runs `sbatch --test-only` on the job script `start` would submit, differing only in its log path. A Slurm rejection is
`200` with `status: "FAILED"`; a failed SSH call is an error (`409 ssh_authentication_required`,
`502 slurm_discovery_failed`). `stdout` and `stderr` carry `sbatch`'s output and are omitted when empty.

### `POST /api/v1/sessions` → 201 or 200

Takes `validate`'s body, checked for shape only, and records a `STOPPED` session at `seq` 0 without touching the SSH
host or checking the Dev Tunnels account. A new session is `201` with `Location`; a replay with the same fields is
`200`; the same key with different fields is `409 idempotency_conflict`. Answers the session record.

### `GET /api/v1/sessions` → 200 or 304

```json
{
  "sessions": [],
  "logs": [
    {
      "sessionId": "s-012345abcdef",
      "lines": [
        { "stream": "status", "text": "Preparing the session environment", "at": "2030-01-01T00:00:05Z" },
        { "stream": "stdout", "text": "Installing collected packages", "at": "2030-01-01T00:00:07Z" }
      ]
    }
  ]
}
```

The caller's session records and log tails; it never waits on SSH. `stream` is `status` (the session server's narration), `stdout` or `stderr` (the job's startup output);
`at` is when the session server first saw the line. Bounds, redaction and the move to run history are in
[logs](./airavata-sessions-and-runs.md#logs).

The response carries a strong `ETag` (SHA-256 of the body). `If-None-Match` accepts `*`, lists and weak validators; a
match is `304` with no body.

### `POST /api/v1/sessions/{id}/start` → 200

Validates as `validate` does, then starts the next run through Slurm with new per-run tokens and, for `devtunnel`, a
new Dev Tunnel; see the [start sequence](./airavata-sessions-and-runs.md#start-sequence). Answers the session record
with `platform: "jupyterlab"`, normally `QUEUED`. A conclusive submission failure leaves the session `FAILED` at the
new `seq`.

| Refusal | Code |
|---|---|
| Session not terminal, or another `start` is launching it | `409 session_running` |
| Slurm rejects the script | `400 slurm_validation_failed` |
| `devtunnel` without a connected Dev Tunnels account | `409 devtunnels_account_required` |
| Another start is preparing the same SSH host for this caller | `409 session_provisioning_in_progress` |
| SSH host preparation fails | `502` or `504 session_provisioning_failed` |
| SSH authentication fails non-interactively | `409 ssh_authentication_required` |
| Dev Tunnels credential refresh fails | `502 upstream_unavailable` |
| Service stopping | `503 service_stopping` |

### `POST /api/v1/sessions/{id}/attach` → 200

```json
{
  "session": { "id": "s-012345abcdef", "seq": 2, "state": "QUEUED", "platform": "vscode", "...": "..." },
  "port": 31337,
  "link": { "url": "wss://api.example.edu/api/v1/sessions/s-012345abcdef/link", "token": "<43-character token>" },
  "devtunnel": { "id": "s-012345abcdef-2", "cluster": "usw3", "hostToken": "<host token>" }
}
```

Admits a job the client, such as CS Bridge, submits itself. The optional body `{ "tunnelModes": [...] }` (at
most 1 KiB) is validated as for `validate` and replaces the session's transports; without it they are kept.

`attach` freezes the previous run, takes the next `seq` and new per-run tokens, creates a Dev Tunnel only for
`devtunnel`, and persists the session `QUEUED` with `platform: "vscode"`. `link` is present only with the `link`
transport and `devtunnel` only with `devtunnel`; no other route returns the host token.

The client then runs Linkspan with:

| Transport | Flags | Environment |
|---|---|---|
| Any | `--port <port> --tunnel-enable --tunnel-mode <transports>` | |
| `link` | `--tunnel-link-args "--url <url>"` | `LINKSPAN_LINK_TOKEN`, the link token |
| `devtunnel` | `--tunnel-devtunnel-args "--id <id> --cluster <cluster>"` | `LINKSPAN_TUNNEL_HOST_TOKEN`, the host token |

The link, or Linkspan answering through the Dev Tunnel, moves the session to `READY`. Refusals are
`409 session_running`, `409 devtunnels_account_required` and `502 upstream_unavailable`, as for `start`. A client
that cancels the job without calling `stop` leaves the run `READY`.

### `GET /api/v1/sessions/{id}/access` → 200

```json
{
  "sessionId": "s-012345abcdef",
  "seq": 1,
  "expiresAt": "2030-01-01T01:00:00Z",
  "jupyter": {
    "uri": "https://api.example.edu/api/v1/sessions/s-012345abcdef/jupyter/",
    "token": "<43-character token>"
  }
}
```

With `attach`, the only session route that returns a secret. `token` is Jupyter Server's token and the credential
every forward offers. `expiresAt` is `startedAt + wallMinutes`, or now plus the walltime without `startedAt`. A
session that is not `READY`, has no stored tokens, or has neither a link nor a Dev Tunnel is
`409 session_access_unavailable`, with the reason in the message.

### `/api/v1/sessions/{id}/jupyter/{path}`

Proxies any method, WebSockets included, to `{path}` on the session's Jupyter Server. The Jupyter token goes in
`Authorization: token <token>` or a `token` query parameter; the header wins when both are present. Jupyter Server
answers a CORS preflight without a token, but the session must still be `READY`.

| Refusal | Code |
|---|---|
| Foreign `Origin` | `403 origin_not_allowed` |
| Wrong token, or session not `READY` | `401` |
| Jupyter Server unreachable | `502 upstream_unavailable` |

### `GET /api/v1/sessions/{id}/forward/{port}` → 101

A WebSocket carrying one TCP connection, as binary frames, to a port Linkspan serves in the session: an SSH server,
Jupyter Server, the control port, or any other task's port. It takes no bearer. The client offers exactly
`cybershuttle.v1` and `capability.<token>`, in either order, with `token` from `/access`; that token suffices because
it already grants code execution as the user in that run.

| Refusal | Code |
|---|---|
| Foreign `Origin` | `403 origin_not_allowed` |
| Other subprotocols, wrong token, unknown session, not `READY` | `401`, checked before the port |
| Malformed or zero port | `404 not_found` |
| Port unreachable | `502 upstream_unavailable` |

### `POST /api/v1/sessions/{id}/ssh` → 200

```json title="Request"
{ "publicKey": "ssh-ed25519 ..." }
```

```json title="Response"
{ "port": 2222 }
```

Starts an SSH server in the owner's `READY` session that authorizes `publicKey`, and answers the port to reach
through `forward/{port}`. Idempotent per key: each key's server is named `ssh-<16 hex of sha256(key)>`.

| Refusal | Code |
|---|---|
| Linkspan refuses the key | `400 invalid_ssh_key` |
| Session unreachable | `409 session_access_unavailable` |
| Other Linkspan failure | `502 upstream_failure` |

### `GET /api/v1/sessions/{id}/usage` → 200

```json
{
  "sessionId": "s-012345abcdef",
  "samples": [
    {
      "at": "2030-01-01T00:05:00Z",
      "memBytes": 2147483648,
      "cpuUsageUsec": 295339339,
      "gpus": [{ "index": 0, "utilPct": 40, "memUsedMiB": 1024, "memTotalMiB": 40960 }]
    }
  ]
}
```

Up to the last 20 samples, taken from Linkspan every five seconds while the session is `READY`; `null` when there are
none. Every figure is optional: an unreadable counter is absent, not zero. `at` is when the session server took the
sample, so consecutive `cpuUsageUsec` values give a rate.

### `POST /api/v1/sessions/{id}/stop` → 200

Marks the session `STOPPING`, drops its link, releases its Dev Tunnel and per-run tokens, and asks Slurm to cancel
the job. A `vscode` run is marked `STOPPED` without Slurm; its client cancels the job. Stopping a terminal session
answers it unchanged.

### `DELETE /api/v1/sessions/{id}` → 204

Deletes a terminal session's record and per-run tokens; its runs stay in run history. A session that is not terminal
is `409 session_not_stopped`.

### `GET /api/v1/sessions/{id}/link` → 101

The WebSocket a session's Linkspan dials and holds; no other client calls it. Linkspan offers exactly
`cybershuttle.v1` and `link.<token>`, in either order, with the per-run link token from its environment or from
`attach`. Any other offer, an unknown session or a terminal session is `401`. A link for the current run moves a
`QUEUED` or `STARTING` session to `READY`. See [the link protocol](/batch/linkspan-architecture#the-link).

## Run history

`GET /api/v1/runs` → 200 answers the caller's finished runs, newest first, one per `(sessionId, seq)`.

```bash
curl -s "$API/api/v1/runs" -H "Authorization: Bearer $TOKEN"
```

```json
{
  "runs": [
    {
      "sessionId": "s-012345abcdef",
      "seq": 1,
      "platform": "jupyterlab",
      "alias": "delta",
      "partition": "cpu",
      "rootFolder": "$HOME/project",
      "resources": { "cores": 2, "memoryMb": 4096, "wallMinutes": 60 },
      "tunnelModes": ["link"],
      "finalState": "STOPPED",
      "startedAt": "2030-01-01T00:00:30Z",
      "endedAt": "2030-01-01T01:00:30Z",
      "stats": {
        "cores": 2,
        "requestedMemory": "4.0 GB",
        "elapsedSeconds": 3600,
        "maxRss": "2.0 GB",
        "cpuEfficiencyPct": 50,
        "memoryEfficiencyPct": 50
      },
      "logs": [{ "stream": "status", "text": "Session is running", "at": "2030-01-01T00:00:05Z" }]
    }
  ]
}
```

A run is [frozen](./airavata-sessions-and-runs.md#run-history) with its log tail and last usage samples when it
ends. It survives the next start and the deletion of its session; the newest 200 runs across all callers are kept.
`stats` is Slurm accounting, fetched only for `jupyterlab` runs and absent until it arrives. `platform`, `account`,
`error`, `startedAt`, `stats`, `samples` and `logs` are omitted when empty.

## Session API errors

Every refusal is one envelope:

```json
{ "error": { "code": "session_not_found", "message": "session not found" } }
```

A client branches on `code`; `message` is for people. An unclassified failure is `500 internal_error`; its detail is
neither returned nor logged.

| Status | Codes |
|---|---|
| 400 | `invalid_json`, `invalid_websocket_auth`, `invalid_ssh_alias`, `invalid_ssh_command`, `invalid_ssh_key_id`, `invalid_ssh_key`, `invalid_root_folder`, `invalid_partition`, `invalid_account`, `invalid_gpu`, `invalid_resource`, `invalid_resources`, `invalid_idempotency_key`, `invalid_session_id`, `invalid_tunnel_modes`, `slurm_validation_failed`, `invalid_grant`, `unknown_provider` |
| 401 | `unauthorized` |
| 403 | `session_owner_mismatch`, `origin_required`, `origin_not_allowed`, `preflight_not_allowed`, `authorization_denied` |
| 404 | `not_found`, `session_not_found`, `ssh_host_not_found`, `ssh_key_not_found` |
| 405 | `method_not_allowed` |
| 409 | `session_running`, `session_not_stopped`, `idempotency_conflict`, `session_provisioning_in_progress`, `session_access_unavailable`, `ssh_host_exists`, `ssh_key_exists`, `ssh_authentication_required`, `ssh_authentication_in_progress`, `devtunnels_account_required` |
| 410 | `authorization_expired` |
| 426 | `upgrade_required` |
| 429 | `rate_limited` |
| 500 | `internal_error` |
| 502 | `session_provisioning_failed` (504 on timeout), `slurm_discovery_failed`, `upstream_unavailable`, `upstream_invalid`, `upstream_failure` |
| 503 | `service_stopping`, `broker_capacity` |

Refusals that are not the client's mistake:

| Code | Client action |
|---|---|
| `401 unauthorized` | Refresh the ID token; sign in again if refused |
| `409 ssh_authentication_required` | Open the SSH authentication WebSocket, then repeat the request |
| `409 session_provisioning_in_progress`, `503 service_stopping`, `503 broker_capacity` | Repeat later |
| `429 rate_limited` | Wait `intervalSeconds`, or a second after a refused start |
| `502`, `504` | The cluster, CILogon or the Dev Tunnels provider failed. Repeat a read; after `start`, read the session first, since a run may have been claimed |

## Batch API conventions

Paths are relative to the `airavata-server` address, `http://localhost:9095` by default. `GET /health` answers
`{"status":"UP"}` without a token.

```bash
BATCH=http://localhost:9095
TOKEN='<CILogon access token, or the root token printed at startup>'
```

### Authentication

`Authorization: Bearer <token>` is optional; the scheme is matched without regard to case. A request without a token
is anonymous and each route decides. A `Bearer` token that is present but invalid is always `401`. A header with another scheme is ignored, and the request
is anonymous.

| Token | Result |
|---|---|
| Absent | Anonymous; a route that needs a caller answers `401` |
| The root token | Principal `root` with `SUPER_ADMIN`; compared in constant time before any network call |
| Introspection says `active: true` | Principal from the claims; authorities from `user_roles`, or `USER` when it has no rows |
| Introspection answers non-200 or `active: false` | `401` with `WWW-Authenticate: Bearer error="invalid_token"` |
| Introspection unreachable or malformed | `502`, message `Unable to validate bearer token` |

Authorities never come from the token. No route writes `user_roles`; to make an administrator, insert a row in the
database. The root token is enabled by default; disable it in production.

Every self-service create (group, SSH key, cluster config, SCP data storage, data product, process) needs a `users`
row whose `userId` is the principal name; without one the create is `404`, naming the principal. A super admin
creates the row with `POST /api/v1/users`; the root token's row is created at startup.

### Authorization

| Rule | Who passes | Refusal |
|---|---|---|
| Open | Anyone, token or not | |
| Authenticated | Any principal | `401` |
| Admin | `ADMIN` or `SUPER_ADMIN` | `401` anonymous, `403` otherwise |
| Super admin | `SUPER_ADMIN` | as above |
| Owner | The record's owner only; admins do not pass | `403` |
| Owner or admin | The owner, or an admin | `403` |
| `READ`, `WRITE` | The owner, an admin, or a user share or `ACTIVE` group-membership share granting at least that permission; `WRITE` implies `READ` | `403` |

### Requests and responses

No batch route takes an idempotency key: a client that lost a response lists before repeating. A second `launch` of a process is `409`.

| Rule | Answer |
|---|---|
| Request body | JSON; unknown fields ignored; malformed JSON is `400` `Malformed JSON request body` |
| Created record | `201` with the record, no `Location`; `POST /api/v1/users` answers `200` |
| Successful `DELETE` | `204`, no body |
| IDs | Server-generated UUIDs, except `userId` |
| Timestamps | Epoch milliseconds (`createdAt`, `timestamp`) |
| `OPTIONS` | `204`, before authentication |

An allowed `Origin` is echoed with `Access-Control-Allow-Credentials: true`,
`Access-Control-Allow-Headers: Authorization, Content-Type` and
`Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`; with the default `*`, every origin is allowed.

## Users

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/users` | Admin | `200`, array |
| `POST /api/v1/users` | Super admin | `200`, the user |
| `GET /api/v1/users/{userId}` | The user or an admin | `200` |
| `POST /api/v1/users/{userId}` | The user or a super admin | `200`; updates `email`, `firstName`, `lastName` only |

| Field | Rule |
|---|---|
| `userId` | Required, not blank; the principal name, such as `cilogon:12345` |
| `email` | Optional; must contain `@` with text on both sides and no space or tab |
| `firstName`, `lastName` | Required, not blank |
| `authMethod` | Optional, `CILOGON` or `SYSTEM`; not validated |

A user answers `userId`, `status` (`ACTIVE` on registration), `firstName`, `lastName` and `createdAt`; `email` is not
returned.

## Groups

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/groups` | Admin | `200`, every group |
| `GET /api/v1/groups/me` | Authenticated | `200`, groups the caller owns or belongs to, suspended memberships included |
| `POST /api/v1/groups` | Authenticated, with a `users` row | `201`; the creator becomes an `ACTIVE` `ADMIN` member |
| `GET /api/v1/groups/{groupId}` | Reader | `200` |
| `PUT /api/v1/groups/{groupId}` | Group owner | `200`, renamed |
| `DELETE /api/v1/groups/{groupId}` | Group owner | `204`; memberships go with it |
| `GET /api/v1/groups/{groupId}/members` | Reader | `200` |
| `POST /api/v1/groups/{groupId}/members` | Manager | `201`; `409` if already a member |
| `GET /api/v1/groups/{groupId}/members/{userId}` | Reader | `200` |
| `PUT /api/v1/groups/{groupId}/members/{userId}` | Manager | `200`; omitted fields unchanged |
| `DELETE /api/v1/groups/{groupId}/members/{userId}` | Manager, or the member themselves | `204`; `409` for the owner's membership |

| Standing | Holders |
|---|---|
| Reader | The owner, any `ACTIVE` member, admins. Anyone else gets `404`, not `403` |
| Manager | The owner, `ACTIVE` members with group role `ADMIN` or `MODERATOR`, admins |
| Group owner | The owner and admins |

Bodies: a group takes `groupName` (required). A member takes `userId` (required, a registered user), `groupRole`
(`ADMIN`, `MODERATOR` or `MEMBER`, default `MEMBER`) and `groupMemberStatus` (`ACTIVE` or `INACTIVE`, default
`ACTIVE`); `PUT` takes the last two. Only the owner or an admin may change the owner's membership.

## Batch SSH keys

A key belongs to whoever registered it; it has no shares, and admins are not treated as owners.

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/ssh-keys` | Authenticated | `200`, the caller's keys |
| `POST /api/v1/ssh-keys` | Authenticated, with a `users` row | `201` |
| `GET /api/v1/ssh-keys/{sshKeyId}` | Owner | `200` |
| `PUT /api/v1/ssh-keys/{sshKeyId}` | Owner | `200`; an omitted `privateKey` keeps the stored one |
| `DELETE /api/v1/ssh-keys/{sshKeyId}` | Owner | `204`; `409` while a cluster config or SCP data storage presents it |

| Field | Rule |
|---|---|
| `sshKeyName`, `publicKey` | Required, not blank |
| `privateKey` | Required on create; write-only |
| `passphrase` | Optional; write-only |

A key answers `sshKeyId`, `sshKeyName`, `publicKey` and `ownerId`. Putting a key on a cluster config or SCP data
storage requires owning it (`403` otherwise), unless the record already holds that key.

## Slurm clusters

A cluster describes a machine; how a person logs in to it is a [cluster config](#slurm-cluster-configs).

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/slurm-clusters` | Open | `200`, clusters with partitions inline |
| `POST /api/v1/slurm-clusters` | Admin | `201`; inline `partitions` are written in the same transaction |
| `GET /api/v1/slurm-clusters/{slurmClusterId}` | Open | `200` |
| `PUT /api/v1/slurm-clusters/{slurmClusterId}` | Admin | `200`; `400` with non-empty `partitions` in the body |
| `DELETE /api/v1/slurm-clusters/{slurmClusterId}` | Admin | `204`, partitions included; `409` while a cluster config uses it |
| `GET /api/v1/slurm-clusters/{slurmClusterId}/partitions` | Open | `200` |
| `POST /api/v1/slurm-clusters/{slurmClusterId}/partitions` | Admin | `201` |
| `GET /api/v1/slurm-clusters/{slurmClusterId}/partitions/{partitionId}` | Open | `200`; `404` for another cluster's partition |
| `PUT /api/v1/slurm-clusters/{slurmClusterId}/partitions/{partitionId}` | Admin | `200` |
| `DELETE /api/v1/slurm-clusters/{slurmClusterId}/partitions/{partitionId}` | Admin | `204` |

| Cluster field | Rule |
|---|---|
| `clusterName`, `headnodeHost` | Required, not blank |
| `headnodePort` | Required, 1–65535 |
| `clusterDescription`, `slurmHome`, `dataHost` | Optional |
| `dataPort` | Optional, 1–65535 |
| `partitions` | Optional, create only |

A partition takes `name` (required) and the optional `description`, `maxRunTime`, `maxNodes`, `maxProcessors`,
`maxJobsInQueue`, `maxMemory`, `cpuPerNode`, `defaultNodeCount`, `defaultCpuCount`, `defaultWalltime`, `gres`,
`nodes`, `isDefaultQueue` and `isCheckpointable`. Responses add `slurmClusterId`, and `partitionId` and `clusterId` per
partition.

## Slurm cluster configs

A config is one way of logging in to a cluster: an account, an SSH key and a work root. It belongs to whoever
registered it; others reach it through [sharing](#sharing).

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/slurm-cluster-configs` | Admin | `200`, every config |
| `GET /api/v1/slurm-cluster-configs/me` | Authenticated | `200`, the caller's |
| `GET /api/v1/slurm-cluster-configs/shared-with-me` | Authenticated | `200`, shared with the caller |
| `POST /api/v1/slurm-cluster-configs` | Authenticated, with a `users` row | `201` |
| `GET /api/v1/slurm-cluster-configs/{slurmClusterConfigId}` | `READ` | `200` |
| `PUT /api/v1/slurm-cluster-configs/{slurmClusterConfigId}` | `WRITE` | `200`; owner unchanged |
| `DELETE /api/v1/slurm-cluster-configs/{slurmClusterConfigId}` | Owner or admin | `204`; shares go with it |

| Field | Rule |
|---|---|
| `slurmClusterId` | Required; an existing cluster (`404` otherwise) |
| `loginUser`, `workRoot` | Required, not blank |
| `sshKeyId` | Required; a key the caller owns (`404` unknown, `403` another's) |
| `name`, `description` | Optional |

A config answers its fields plus `slurmClusterConfigId`, `ownerId`, the cluster inline as `slurmCluster`, the key's
public summary as `sshKey`, and `permission`, what the caller may do with it (absent from the admin and `/me`
lists). A process may submit under a config with `READ`.

## Application templates

A template declares an application's inputs and outputs, independent of where it runs.

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/application-templates` | Open | `200` |
| `POST /api/v1/application-templates` | Admin | `201` |
| `GET /api/v1/application-templates/{templateId}` | Open | `200` |
| `PUT /api/v1/application-templates/{templateId}` | Admin | `200`; inputs and outputs recreated with new IDs |
| `DELETE /api/v1/application-templates/{templateId}` | Admin | `204`; `409` while a deployment uses it |

| Field | Rule |
|---|---|
| `templateName` | Required, not blank |
| `templateDescription` | Optional |
| `inputs[].inputName` | Required, unique within the template |
| `inputs[].inputType` | Required: `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `FILE`, `FILE_LIST` or `DIRECTORY` |
| `inputs[].required` | Boolean |
| `inputs[].displayName`, `inputDescription`, `defaultValue` | Optional; `defaultValue` is a string holding JSON, such as `"{\"value\":\"monomer\"}"` |
| `outputs[].outputName` | Required |
| `outputs[].outputType` | Required: `FILE`, `FILE_LIST` or `DIRECTORY` |
| `outputs[].displayName`, `outputDescription` | Optional |

Responses add `templateId`, and `inputId` or `outputId` per declaration; process mappings name those IDs.

## Slurm deployments

A deployment binds a template to a cluster with a run script section and default resources.

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/slurm-deployments` | Open | `200`; `?templateId=` filters |
| `POST /api/v1/slurm-deployments` | Admin | `201` |
| `GET /api/v1/slurm-deployments/{deploymentId}` | Open | `200` |
| `PUT /api/v1/slurm-deployments/{deploymentId}` | Admin | `200` |
| `DELETE /api/v1/slurm-deployments/{deploymentId}` | Admin | `204` |

| Field | Rule |
|---|---|
| `templateId` | Required; an existing template (`404` otherwise) |
| `slurmClusterId` | Optional; when present, an existing cluster (`404` otherwise) |
| `slurmRunSection` | Required, not blank |
| `defaultBatchJobConfig` | Required: `wallTimeMinutes` (positive) and `allocation` (not blank) required; `cpus`, `mem`, `memPerCpu`, `ntasksPerNode`, `cpusPerTask`, `nodes`, `ntasks`, `gres`, `gpus`, `memPerGpu`, `cpusPerGpu`, `gpusPerNode`, `constraints` optional |
| `defaultPartition` | Optional, a partition name |

Responses add `deploymentId` and `defaultBatchJobConfig.batchJobConfigId`.

## SCP data storages

A storage is a host, login account and SSH key that datasets are staged through. It belongs to whoever registered it;
others reach it through [sharing](#sharing).

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/scp-data-storages` | Admin | `200`, every storage |
| `GET /api/v1/scp-data-storages/me` | Authenticated | `200` |
| `GET /api/v1/scp-data-storages/shared-with-me` | Authenticated | `200` |
| `POST /api/v1/scp-data-storages` | Authenticated, with a `users` row | `201` |
| `GET /api/v1/scp-data-storages/{dataStorageId}` | `READ` | `200` |
| `PUT /api/v1/scp-data-storages/{dataStorageId}` | `WRITE` | `200` |
| `DELETE /api/v1/scp-data-storages/{dataStorageId}` | Owner or admin | `204`; `409` while data products are registered on it |

| Field | Rule |
|---|---|
| `dataName`, `hostName`, `loginUser` | Required, not blank |
| `port` | Optional, 1–65535, default 22; an update without it resets it to 22 |
| `sshKeyId` | Required; a key the caller owns |

Responses add `dataId`, `ownerId`, the key's public summary as `sshKey`, and `permission` (absent from the admin and
`/me` lists).

## Data products

A data product is a registered path on an SCP data storage. It belongs to whoever registered it; others reach it
through [sharing](#sharing).

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/data-products` | Admin | `200`, every product |
| `GET /api/v1/data-products/me` | Authenticated | `200` |
| `GET /api/v1/data-products/shared-with-me` | Authenticated | `200` |
| `POST /api/v1/data-products` | Authenticated, with a `users` row, and `READ` on the storage | `201` |
| `GET /api/v1/data-products/{dataProductId}` | `READ` | `200` |
| `PUT /api/v1/data-products/{dataProductId}` | `WRITE`, and `READ` on the storage named | `200` |
| `DELETE /api/v1/data-products/{dataProductId}` | Owner or admin | `204`; shares go with it |

| Field | Rule |
|---|---|
| `dataName`, `path` | Required, not blank |
| `isFile` | Required; `false` for a directory |
| `dataStorageId` | Required; unknown is `404`, unreachable is `403` |
| `dataStorageType` | Optional, `SCP` (the default) or `HPC` |
| `dataDescription` | Optional |

Responses add `dataId`, `provisionStatus` (`REGISTERD` on create, spelled as in code), `ownerId`, `createdAt` and
`permission` (absent from the admin and `/me` lists). Registering a product does not touch the host.

## Sharing

Cluster configs, SCP data storages and data products share one pattern. `{base}` is
`/api/v1/slurm-cluster-configs/{slurmClusterConfigId}`, `/api/v1/scp-data-storages/{dataStorageId}` or
`/api/v1/data-products/{dataProductId}`. Every sharing route, reads included, is owner or admin.

| Route | Answer |
|---|---|
| `GET {base}/user-shares`, `GET {base}/group-shares` | `200`, array |
| `POST {base}/user-shares` with `userId`, `POST {base}/group-shares` with `groupId` | `201` |
| `PUT {base}/user-shares/{sharingId}`, `PUT {base}/group-shares/{sharingId}` | `200`; body `permission`, required |
| `DELETE {base}/user-shares/{sharingId}`, `DELETE {base}/group-shares/{sharingId}` | `204` |

`permission` is `READ` or `WRITE`, default `READ` on create. `userId` or `groupId` must exist (`404`). Sharing twice
with the same user or group, or with the owner, is `409`. A `sharingId` of another record is `404`. A group share
reaches only `ACTIVE` members. The response's ID field is named for its kind, such as
`slurmClusterConfigUserSharingId`, `dataStorageGroupSharingId` or `dataProductUserSharingId`.

```bash
curl -s -X POST "$BATCH/api/v1/slurm-cluster-configs/$CONFIG/group-shares" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"groupId":"'"$GROUP"'","permission":"READ"}'
```

## Processes

A process is one run. A `BATCH_JOB` process carries its deployment, cluster config, resources and input and output
values in a `batchProcess` section; there is no separate batch-process route.

### Process routes

| Route | Authorization | Answer |
|---|---|---|
| `GET /api/v1/processes` | Admin | `200`, every process |
| `GET /api/v1/processes?deploymentId=` | Open | `200`, that deployment's runs |
| `POST /api/v1/processes` | Authenticated, with a `users` row, and `READ` on the cluster config | `201`; first status `CREATED` in the same transaction |
| `GET /api/v1/processes/{processId}` | Open | `200` |
| `PUT /api/v1/processes/{processId}` | Admin | `200`, mappings replaced; `409` on a changed `processType` |
| `DELETE /api/v1/processes/{processId}` | Admin | `204`; batch section, statuses, mappings and tasks go with it |
| `POST /api/v1/processes/{processId}/launch` | Owner or admin | `202`, the process; no body |
| `GET /api/v1/processes/{processId}/statuses` | Open | `200`, oldest first |
| `GET /api/v1/processes/{processId}/statuses/{statusId}` | Open | `200`; `404` for another process's status |

### Process body

| Field | Rule |
|---|---|
| `processType` | Required: `BATCH_JOB` or `CLOUD_JOB` |
| `batchProcess` | Required for `BATCH_JOB`, refused otherwise; holds the fields below |
| `.deploymentId` | Required |
| `.slurmClusterConfigId` | Required; `404` unknown, `403` without `READ` |
| `.batchJobConfig` | Required; the shape of a deployment's `defaultBatchJobConfig` |
| `.baseWorkDir` | Optional; the run works in `<baseWorkDir>/<processId>`, or under the config's `workRoot` when absent |
| `.jobId` | Optional |
| `.inputMappings[]` | `templateInputId` (required) and `value` |
| `.outputMappings[]` | `templateOutputId` (required) and `value` |

A mapping `value` is a string. For a `STRING`, `INTEGER`, `FLOAT` or `BOOLEAN` declaration it holds JSON,
`{"value": "..."}` or `{"values": [...]}`; for a `FILE`, `FILE_LIST` or `DIRECTORY` declaration it is a data
product's `dataId`.

A process answers `processId`, `userId`, `processType`, `lastStatusId` and `batchProcess`. The batch section echoes
the request with `batchProcessId`, the `batchJobConfigId` and each mapping's ID, and adds `batchJobStatuses` and
`latestBatchJobStatus`: Slurm states from job e-mail (`SUBMITTED`, `BEGIN`, `END`, `FAIL`, `TIME_LIMIT`, …) with
`updatedAt` in epoch milliseconds.

A status answers `processStatusId`, `processId`, `status` (`CREATED`, `SUBMITTED`, `RUNNING`, `COMPLETED` or
`FAILED`), `log` and `timestamp`; statuses are never accepted from a client.

### Launch tasks

Launch refuses a process that already has staging or submission tasks with `409`. For a `BATCH_JOB` it then records
these tasks and starts the submission workflow:

| Task | Count | `taskOrder` | `onFailure`, `retryCount` |
|---|---|---|---|
| Stage in: product storage → `<workingDir>/<inputName>` | One per `FILE` input | 0 | `RETRY`, 3 |
| Job submission, with `workingDir` | One | 1 | `EXIT`, 1 |
| Job monitoring | One | 3 | `RETRY`, 10 |
| Stage out: `<workingDir>/<outputName>` → product storage | One per `FILE` output | 4 | `RETRY`, 3 |

A stage-in task's destination is type `HPC` with the cluster config's ID. `FILE_LIST` and `DIRECTORY` mappings get no
staging task. A deployment without a template or cluster, or a batch section without a deployment, is `409`.

## Process tasks

Four task collections sit under a process, each with the same five routes. Every route is owner or admin; `processId`
comes from the path only.

| Collection | Own fields |
|---|---|
| `data-staging-tasks` | `sourcePath`, `destinationPath` (required); `sourceDataStorageId`, `destinationDataStorageId`; `sourceDataStorageType`, `destinationDataStorageType` (`SCP` or `HPC`) |
| `job-submission-tasks` | `jobId`, `workingDir` |
| `job-monitoring-tasks` | `jobId` |
| `interactive-command-tasks` | `command` (required), `output` |

| Route | Answer |
|---|---|
| `GET /api/v1/processes/{processId}/{collection}` | `200`, by `taskOrder`, unordered tasks last |
| `POST /api/v1/processes/{processId}/{collection}` | `201` |
| `GET /api/v1/processes/{processId}/{collection}/{taskId}` | `200`; `404` for another process's task |
| `PUT /api/v1/processes/{processId}/{collection}/{taskId}` | `200` |
| `DELETE /api/v1/processes/{processId}/{collection}/{taskId}` | `204` |

Every kind also takes `onFailure` (`RETRY`, `SKIP` or `EXIT`), `retryCount` and `taskOrder` (both not negative), and
answers `taskId` and `processId`.

## Process launch example

This example uses the root token, which is `SUPER_ADMIN` and has a `users` row, so one token registers the catalogue
and owns the run. It assumes the key's public half is installed for `alice` on the cluster.

```bash
api() { curl -s -X "$1" "$BATCH$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' ${3:+-d "$3"}; }

KEY=$(api POST /api/v1/ssh-keys "$(jq -nc --rawfile k ~/.ssh/id_ed25519 --rawfile p ~/.ssh/id_ed25519.pub \
  '{sshKeyName: "expanse-key", privateKey: $k, publicKey: $p}')" | jq -r .sshKeyId)

CLUSTER=$(api POST /api/v1/slurm-clusters '{"clusterName":"expanse","headnodeHost":"login.expanse.sdsc.edu",
  "headnodePort":22,"partitions":[{"name":"compute"}]}' | jq -r .slurmClusterId)

CONFIG=$(api POST /api/v1/slurm-cluster-configs "$(jq -nc --arg c "$CLUSTER" --arg k "$KEY" \
  '{slurmClusterId: $c, loginUser: "alice", workRoot: "/expanse/lustre/scratch/alice", sshKeyId: $k}')" \
  | jq -r .slurmClusterConfigId)

TEMPLATE=$(api POST /api/v1/application-templates '{"templateName":"word-count",
  "inputs":[{"inputName":"text","inputType":"FILE","required":true}],
  "outputs":[{"outputName":"counts","outputType":"FILE"}]}')

DEPLOYMENT=$(api POST /api/v1/slurm-deployments "$(jq -nc --arg t "$(jq -r .templateId <<<"$TEMPLATE")" --arg c "$CLUSTER" \
  '{templateId: $t, slurmClusterId: $c, slurmRunSection: "wc -w text > counts",
    defaultBatchJobConfig: {wallTimeMinutes: 10, allocation: "abc123"}, defaultPartition: "compute"}')" \
  | jq -r .deploymentId)

STORAGE=$(api POST /api/v1/scp-data-storages "$(jq -nc --arg k "$KEY" \
  '{dataName: "expanse-home", hostName: "login.expanse.sdsc.edu", loginUser: "alice", sshKeyId: $k}')" | jq -r .dataId)

product() { api POST /api/v1/data-products "$(jq -nc --arg s "$STORAGE" --arg n "$1" --arg p "$2" \
  '{dataName: $n, isFile: true, path: $p, dataStorageId: $s}')" | jq -r .dataId; }
IN=$(product input /home/alice/input.txt)
OUT=$(product output /home/alice/counts.txt)

PROCESS=$(api POST /api/v1/processes "$(jq -nc --argjson t "$TEMPLATE" --arg d "$DEPLOYMENT" --arg c "$CONFIG" \
  --arg in "$IN" --arg out "$OUT" \
  '{processType: "BATCH_JOB", batchProcess: {deploymentId: $d, slurmClusterConfigId: $c,
    batchJobConfig: {wallTimeMinutes: 10, allocation: "abc123"},
    inputMappings: [{templateInputId: $t.inputs[0].inputId, value: $in}],
    outputMappings: [{templateOutputId: $t.outputs[0].outputId, value: $out}]}}')" | jq -r .processId)

api POST "/api/v1/processes/$PROCESS/launch"           # 202
api GET "/api/v1/processes/$PROCESS/statuses"
api GET "/api/v1/processes/$PROCESS/job-submission-tasks"
```

```json title="Statuses after create"
[
  {
    "processStatusId": "9f8e7d6c-5b4a-4392-8172-6a5b4c3d2e1f",
    "processId": "a1b2c3d4-e5f6-4708-9a1b-2c3d4e5f6a7b",
    "status": "CREATED",
    "log": null,
    "timestamp": 1790000000000
  }
]
```

## Batch API errors

Every JSON refusal is one envelope:

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "fieldErrors": [{ "field": "clusterName", "message": "Cluster name cannot be blank" }]
}
```

`fieldErrors` appears only on validation failures and names JSON paths such as
`batchProcess.inputMappings[0].templateInputId`. A client branches on `status` and shows `message`.

| Status | When |
|---|---|
| `400` | Malformed JSON, or a body that fails its constraints |
| `401` | No token where a route needs a caller, a token introspection rejects, or an active token with no user name |
| `403` | Authenticated, but lacking the authority, ownership or share |
| `404` | No such record, no `users` row for the caller, or a group the caller has no standing in |
| `405` | A method the path lacks, such as `POST` on `statuses` |
| `409` | Collides with existing state: a referenced record, a duplicate share or membership, a second launch |
| `500` | Any unclassified failure, as `Internal server error`; the detail is logged |
| `502` | Token introspection could not be completed |

Unknown paths (`404`) and missing methods (`405`) are answered by Go's router as plain text, not the JSON envelope.

## Known gaps

| Area | Behaviour |
|---|---|
| Anonymous reads | `GET /api/v1/processes/{processId}`, `?deploymentId=` listings and both status routes need no token, so any caller holding a process or deployment ID can read the run, including its config ID and work directory |
| Launch errors | An unknown or unreadable data product, a cluster config the owner can no longer read, no work directory, a missing `processType`, or a `BATCH_JOB` without a batch section answers `500`, not `404`, `403` or `409` |
| Launch atomicity | Tasks are saved one by one outside a transaction. A launch that fails part-way keeps the tasks already saved, and a retry is then `409` |
| Launch workflow | A failure to start the submission workflow is not reported; the response is still `202` |
| Staging | `FILE_LIST` and `DIRECTORY` mappings are not staged |
| Deletes behind foreign keys | These deletes fail on a `RESTRICT` foreign key and answer `500`, not `409`: a cluster config or deployment a process references, a cluster a deployment references, a group holding any share |
| Template updates | `PUT` recreates inputs and outputs with new IDs, and cascades away every process mapping that named the old ones |
| Task storage type | A bad `sourceDataStorageType` is reported as `must be one of SCP, S3`; the accepted values are `SCP` and `HPC` |
| Roles | `ADMIN` and `SUPER_ADMIN` come only from `user_roles` rows, which no route writes |
| Key storage | `ssh_keys.private_key` and `passphrase` are stored unencrypted; see [Persistence](./airavata-persistence.md#batch-tables) |
| Session key delete | `DELETE /api/v1/keys/ssh/{id}` with an unknown ID answers `500 internal_error`, not `404 ssh_key_not_found` |

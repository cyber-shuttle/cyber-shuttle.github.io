---
title: Airavata configuration
description: Requirements, deployment layout, settings, commands, startup and shutdown of Airavata's session server and batch server.
---

# Airavata configuration

This page is the reference for an administrator who runs Apache Airavata: requirements, settings, commands, and
startup and shutdown of its two programs. The steps are in [Hosting Airavata](./hosting-airavata.md); the routes are in
the [HTTP API](../operating/airavata-http-api.md).

| Program | Serves |
|---|---|
| Session server, `cs serve` | Session API: sign-in, SSH hosts and keys, Dev Tunnels account, sessions, runs; for [CS Jupyter](/jupyter/architecture) and [CS Bridge](/vscode/architecture) |
| Batch server, `airavata-server` | The batch API behind CS Batch: users, groups, SSH keys, Slurm clusters, templates, deployments, data, processes |

The session server is built from `main.go` in `cyber-shuttle/cs-plane` and deployed by cs-infra's `deployment-csvm` or
by hand. The batch server is built from `cmd/airavata-server/main.go` in `apache/airavata` and deployed by hand; see
Airavata's [`INSTALL.md`](https://github.com/apache/airavata/blob/master/INSTALL.md).

Neither binary has commands for the resources it serves. Beyond starting and stopping a program, administration goes
through its HTTP API or its database.

## Session server

### Requirements

| Requirement | Detail |
|---|---|
| Build machine | Go 1.26 or newer; there are no binaries |
| Host | Linux or macOS with an OpenSSH client on `PATH`, run for every cluster command; CI covers Linux only |
| OIDC client | CILogon or an equivalent issuer, with PKCE and the device flow; ID token `aud` a JSON string, compared with the client ID |
| PostgreSQL | A schema the server's role owns, named through `search_path`; the server creates its tables there |
| TLS reverse proxy | Terminates TLS at `--public-url`, since the server listens on loopback in plain HTTP; passes WebSocket upgrades; accepts headers over 8 KiB |
| Slurm cluster | Reachable over SSH; see [Requirements](../planning/requirements.md#login-node) |

The proxy carries WebSockets for the link, port forwards, the Jupyter proxy and SSH authentication. The SSH
authentication WebSocket sends the bearer token in `Sec-WebSocket-Protocol`, hence the header size. cs-infra's nginx
sets `large_client_header_buffers 4 64k` and `proxy_read_timeout 3600s`.

Outbound access from the server host is HTTPS, apart from SSH to each login node. A firewall that restricts egress
admits:

| To | For |
|---|---|
| The OIDC issuer | Discovery, JWKS, token grants |
| `*.rel.tunnels.api.visualstudio.com`, `*.devtunnels.ms` | Dev Tunnel management and fallback dial |
| `login.microsoftonline.com`, or `github.com` and `api.github.com` | Connecting a user's Dev Tunnels account |

Compute nodes reach the server at `--public-url`; the cluster's other destinations are in
[Requirements](../planning/requirements.md#network-egress). What the server leaves on the cluster is listed in
[Preparing the cluster](./preparing-the-cluster.md#home-directory-space).

### Layout of `deployment-csvm`

What [cs-infra](./hosting-airavata.md#with-cs-infra) puts on the VM; also a model for a deployment by hand.

| Part | Value |
|---|---|
| Operating system | Ubuntu 24.04, x86-64; user `ubuntu` with passwordless sudo; ports 80 and 443 open |
| API host name | nginx → `127.0.0.1:8045`, with WebSocket upgrades and `proxy_buffering off` |
| Site host name | nginx serves the built CS Jupyter site from `/var/www/<site>` |
| TLS | One certbot certificate, `csvm`, for both names; issued with the nginx plugin when missing |
| Service | `cs-plane.service`: `/usr/local/bin/cs serve` as `ubuntu`, `Restart=always`, after `postgresql.service` |
| Secrets | `/etc/default/cs-plane`, mode `0640`, `root:ubuntu`; holds `CS_OIDC_CLIENT_SECRET` |
| Database | Ubuntu's PostgreSQL; database `cybershuttle` owned by `ubuntu`, schema `cs_plane`; local socket, peer authentication, no password |
| State directory | `/home/ubuntu/.cybershuttle/control`: SSH configurations, uploaded keys, per-run tokens, sealed Dev Tunnels accounts |

```ini title="/etc/systemd/system/cs-plane.service (excerpt)"
User=ubuntu
EnvironmentFile=/etc/default/cs-plane
Environment=CS_DATABASE_URL=postgres:///cybershuttle?host=/var/run/postgresql&search_path=cs_plane
ExecStart=/usr/local/bin/cs serve --listen 127.0.0.1:8045 \
  --oidc-client-id cilogon:oa4mp,2012:/client_id/<id> \
  --public-url https://jupyterapi.cybershuttle.org \
  --allowed-origin https://jupyter.cybershuttle.org \
  --allowed-origin http://127.0.0.1
```

### Configuration

Global flags precede `serve`. A flag beats its environment variable, which beats the default.

| Flag or variable | Default | Rule |
|---|---|---|
| `serve --listen` | `127.0.0.1:8045` | Loopback IP literal; `localhost` refused |
| `serve --oidc-issuer` | `https://cilogon.org` | HTTPS; equals its discovery document's `issuer` |
| `serve --oidc-client-id` | Required | Matches the pattern below; pinned as ID token audience |
| `serve --public-url` | Required | HTTPS; no credentials, query or fragment; trailing `/` trimmed |
| `serve --allowed-origin` | Required, repeatable | Exact HTTPS origin, or HTTP on loopback or `localhost`; no path, no `*` |
| `CS_OIDC_CLIENT_SECRET` | Required | Sent only to the issuer's token and device endpoints |
| `CS_DATABASE_URL` | Required | PostgreSQL URL whose `search_path` names the schema |
| `--linkspan`, `CS_LINKSPAN` | `$HOME/.cybershuttle/bin/linkspan` | Absolute or `$HOME/`-anchored remote path; other values fall back to the default |
| `--devtunnel-management-url`, `CS_DEVTUNNEL_MANAGEMENT_URL` | The global endpoint | The global or a regional endpoint, below; HTTPS, no path or query |

The client ID must match `^[A-Za-z0-9._:@/,-]{1,256}$`. The global Dev Tunnels endpoint is
`https://global.rel.tunnels.api.visualstudio.com`; a regional one is `https://<region>.rel.tunnels.api.visualstudio.com`.

Each setting is set or changed in these cases:

| Setting | Set or change it |
|---|---|
| `--listen` | When port 8045 is taken; the proxy's upstream must match |
| `--oidc-issuer` | For an issuer other than CILogon |
| `--oidc-client-id`, `CS_OIDC_CLIENT_SECRET` | From the [client registration](./hosting-airavata.md#register-the-cilogon-client); the secret is read only from the environment, keeping it out of the unit and the process arguments |
| `--public-url` | The API host name, where browsers and session jobs reach the server; written into every session job; equals the site's `cybershuttlePlaneApiUrl` without `/api/v1` |
| `--allowed-origin` | Once per origin that serves the Jupyter site; a browser on any other origin is refused |
| `--linkspan` | To run Linkspan from another path, resolved against each SSH host's home; a missing binary is installed there when a session starts |
| `--devtunnel-management-url` | To a regional endpoint when the global region's quota is exhausted |

Not configurable: the state directory (`~/.cybershuttle/control` of the user running `cs`, or `.cs-plane` in the
working directory when the home directory is unknown), the 20-second SSH and upstream timeouts, and `ssh` from `PATH`.

### Commands \{#cs\}

```text
cs [--linkspan PATH] [--devtunnel-management-url URL] serve --oidc-client-id ID --public-url URL --allowed-origin ORIGIN [--allowed-origin ORIGIN ...] [--listen ADDR] [--oidc-issuer URL]
cs help
cs version
```

| Command | Does |
|---|---|
| `serve` | Runs the session API until `SIGINT` or `SIGTERM` |
| `help`, `-h`, `--help` | Prints the usage to stderr; exits `0` |
| `version` | Prints the version, for example `0.4.2`; an extra argument is a usage error |

A missing or unknown command prints the usage and exits `1`. Any error is printed as `cs: <error>` on stderr and exits
`1`. `cs serve -h` prints the flag help and exits `0`; an argument after the flags fails with `unexpected arguments`.

### Startup and shutdown

`serve` checks its configuration in this order and exits at the first failure, before it listens:

1. The Dev Tunnels management URL, the flags and positional arguments.
2. The loopback listen address, the client ID, the public URL, the client secret and the database URL.
3. The origins, the issuer URL and client-ID format.
4. The state directory, which it creates at mode `0700`.
5. PostgreSQL and the schema, as in [Database schema](#database-schema).

It does not contact the OIDC issuer at startup; an unreachable issuer shows only at the first sign-in, as
`502 upstream_unavailable`. A failed check appears in the journal as
`cs: <error>`; under the cs-infra unit's `Restart=always`, it repeats every three seconds until the setting is
corrected.

On `SIGINT` or `SIGTERM`, `serve` stops accepting connections, drains for up to 25 seconds, ends its SSH control
masters and closes the database. A restart leaves running session jobs untouched but ends every login-node connection;
a Jupyter user whose login needs a password or MFA answers the prompt again.

### Database schema

At each start the server checks the schema that `search_path` names:

| Schema at startup | Result |
|---|---|
| `search_path` names no existing schema | Refused: "the database URL's search_path names no existing schema" |
| Empty | `schema_meta` and every table created in one transaction; format `sql-v1` recorded |
| `schema_meta.format = 'sql-v1'` | Used |
| Anything else | Refused: "unsupported state database format", before any credential file is written |

Nothing is migrated. When a release's CHANGELOG gives upgrade steps, stop the server and apply them before starting the
new release; see [Persistence](../operating/airavata-persistence.md).

## Batch server

### Requirements \{#batch-prerequisites\}

| Requirement | Detail |
|---|---|
| Build machine | Go 1.25 or newer (`go.mod`) |
| PostgreSQL | 14 or newer; a database the server's role owns; tables in `public` |
| CILogon client | ID and secret allowed to call the introspection endpoint, which validates every bearer token; optional while the root account is enabled |
| Gmail account | IMAP on, with a Google app password; receives Slurm job mail. The mail host is fixed at `imap.gmail.com` |
| Slurm cluster | Login node with public-key SSH, `sbatch` (or `<slurmHome>/sbatch`), `scp`, `mkdir`; job mail delivered to the Gmail address |
| TLS reverse proxy | The server speaks plain HTTP |

The batch server may share a host with the session server but not a schema: both define a table `ssh_keys`.

### Configuration \{#batch-server-configuration\}

Every setting is an environment variable; there are no flags. An empty value counts as unset, and a boolean that does
not parse keeps its default. The defaults match the development database in the repository's compose file, so an
unconfigured server starts against it; the Meaning column says what a production deployment changes.

| Variable | Default | Meaning |
|---|---|---|
| `SERVER_PORT` | `9095` | Listen port, on every interface; the address cannot be restricted, so firewall it |
| `AIRAVATA_CORS_ALLOWED_ORIGINS` | `*` | Comma-separated origins; `*` echoes any caller's origin. In production, list the portal origins |
| `AIRAVATA_DB_DSN` | Built from the next six | Full PostgreSQL URL; overrides them. Use it for a managed database or extra TLS options |
| `AIRAVATA_DB_HOST`, `AIRAVATA_DB_PORT` | `localhost`, `15432` | The compose file's port; PostgreSQL's own is `5432` |
| `AIRAVATA_DB_NAME`, `AIRAVATA_DB_USER` | `airavata`, `airavata` | |
| `AIRAVATA_DB_PASSWORD` | `123456` | Change outside development |
| `AIRAVATA_DB_SSLMODE` | `disable` | libpq `sslmode`; `require` or stricter off loopback |
| `AIRAVATA_DB_AUTO_MIGRATE` | `true` | Adds missing tables, columns and indexes at startup; drops nothing. In production set `false` and run `migrate up`, so schema changes are a recorded step |
| `CILOGON_CLIENT_ID`, `CILOGON_CLIENT_SECRET` | Empty | Introspection credentials; required once the root account is disabled |
| `CILOGON_INTROSPECTION_URI` | CILogon's, below | RFC 7662 endpoint for every bearer token |
| `CILOGON_USERINFO_URI` | CILogon's, below | Profile claims; a failure is logged and ignored |
| `AIRAVATA_ROOT_ACCOUNT_ENABLED` | `true` | Enables the bootstrap `SUPER_ADMIN` token, a way in before any CILogon user has a role. Set `false` once an administrator exists |
| `AIRAVATA_ROOT_ACCOUNT_TOKEN` | New UUID each start | Pins that token, so that it survives a restart during setup |
| `AIRAVATA_EMAIL_MONITOR_ADDRESS` | Empty | Gmail address polled for job mail, and each job's `--mail-user`. Without it no job state is read |
| `AIRAVATA_EMAIL_MONITOR_APP_PASSWORD` | Empty | Its app password |
| `AIRAVATA_WORKFLOW_BACKEND_TYPE` | `sqlite` | Only accepted value |
| `AIRAVATA_WORKFLOW_BACKEND_SQLITE_PATH` | Under `/tmp`, below | Workflow state. Move it to a directory that survives a reboot |

The default DSN is `postgres://airavata:123456@localhost:15432/airavata?sslmode=disable`, the default URIs are
`https://cilogon.org/oauth2/introspect` and `https://cilogon.org/oauth2/userinfo`, and the default SQLite path is
`/tmp/airavataorchestrator.sqlite`. Startup fails with
`no authentication configured` when the root account is disabled and `CILOGON_CLIENT_ID` is unset, and with
`no workflow backend configured` for any workflow backend other than `sqlite`.

Before exposing the batch server, read its [known gaps](../planning/security-model.md#batch-known-gaps).

### Commands \{#airavata-server\}

```text
airavata-server
airavata-server migrate [up | status]
```

| Invocation | Does |
|---|---|
| `airavata-server` | Runs the batch API until `SIGINT` or `SIGTERM`; arguments other than `migrate` are ignored |
| `airavata-server migrate`, `migrate up` | Applies each pending file in `internal/db/migrations/` in its own transaction, logs each version (or `no pending migrations`), and exits |
| `airavata-server migrate status` | Prints `<version>  <description> applied at <RFC 3339>` or `pending` per migration, and exits |

`migrate` with another action fails with `unknown migrate subcommand`; `migrate` never starts the HTTP server. It
reads the same `AIRAVATA_DB_*` variables as the server and records each applied version in the `schema_migrations`
table. Any error is logged as `server failed` and exits `1`.

### Startup and shutdown \{#batch-startup-and-shutdown\}

At startup the server:

1. Opens PostgreSQL with at most 20 open and 2 idle connections, each kept 30 minutes.
2. With `AIRAVATA_DB_AUTO_MIGRATE`, brings the schema up to the entity model, without recording it in
   `schema_migrations`.
3. With the root account enabled, prints the token under `ROOT ACCOUNT TOKEN (Super Admin):` between two rules of `=`,
   and creates the `root` user if missing.
4. Opens the workflow backend, listens, and starts the e-mail monitor. Without both e-mail variables the monitor logs
   `Failed to start email monitor` and stays off; with them it reads unseen mail at `imap.gmail.com:993` every
   20 seconds.

On `SIGINT` or `SIGTERM` the server drains for up to 20 seconds.

A local run against the development database shows the sequence:

```bash
docker compose -f dev-tools/compose/compose.yml up -d postgres
go build -o bin/airavata-server ./cmd/airavata-server
./bin/airavata-server migrate up
AIRAVATA_DB_AUTO_MIGRATE=false ./bin/airavata-server
curl -s localhost:9095/health    # {"status":"UP"}
```

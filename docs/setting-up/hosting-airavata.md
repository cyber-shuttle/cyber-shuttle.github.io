---
title: Hosting Airavata
description: How an HPC centre runs its own instance of Apache Airavata instead of the public one, and points the Cybershuttle clients at it.
---

# Hosting Airavata

This page takes a system administrator through running the centre's own instance of Apache Airavata and
pointing the Cybershuttle clients at it. Hosting is optional: a centre that uses the public instance needs
only [Preparing the cluster](./preparing-the-cluster.md). The page assumes working knowledge of Linux, systemd,
PostgreSQL, nginx and OAuth. Requirements, the deployment layout and every setting are in
[Airavata configuration](./airavata-configuration.md).

Airavata signs researchers in, logs in to the cluster for them and submits their jobs. It is two programs, built
from source with Go; both are :status[development]. A centre may run either or both:

| Program | Serves | Source |
|---|---|---|
| Session server, `cs serve` | Jupyter sessions; CS Bridge's experimental link transport | [`cyber-shuttle/cs-plane`](https://github.com/cyber-shuttle/cs-plane) |
| Batch server, `airavata-server` | [CS Batch](/batch/cs-batch), through the batch API | [`apache/airavata`](https://github.com/apache/airavata) `master` |

## When to host your own

The public instance, at `https://jupyterapi.cybershuttle.org`, serves every cluster. Hosting your own
keeps what that instance holds on your infrastructure:

| Airavata holds | Hosted by you |
|---|---|
| Each Jupyter user's uploaded SSH private key and authenticated login-node connection | The keys stay on your host |
| The TLS termination point of Jupyter traffic over the link, where it is readable | The traffic stays on your network |
| Each batch cluster configuration's SSH private key, in plain text in PostgreSQL | The database and backups are yours to protect |
| The OIDC client secret | You own the CILogon client |

In exchange you build each release, apply its CHANGELOG upgrade steps, and handle backups, secret rotation, TLS
certificates and user support; see [Running in production](../operating/running-in-production.md). What Airavata
can do with what it holds is in [Cluster security](../planning/cluster-security.md#airavata).

## Architecture

A session-server deployment is one VM. nginx is the only external listener: it terminates TLS for an API host name
and a site host name, and everything behind it listens on loopback in plain HTTP. The session server needs no root
privilege, reaches each cluster only by `ssh` to the login node as the researcher, and never connects to a compute
node.

The diagram shows the session-server VM; arrows point from the side that opens the connection.

```mermaid
flowchart TB
  B["Browser"] -- "HTTPS" --> N["nginx :443"]
  L["Linkspan in the job"] -- "link" --> N
  N -- "site name" --> W[("Static site")]
  N -- "API name" --> S["cs serve<br/>127.0.0.1:8045"]
  S --> P[("PostgreSQL")]
  S --> F[("State directory")]
  S -- "ssh" --> H["Login node"]
  S -- "OIDC" --> I(["CILogon"])
```

The [layout](./airavata-configuration.md#layout-of-deployment-csvm) gives each part's path, unit and schema as cs-infra
installs it. The batch server has its own PostgreSQL database and may share the VM.

[Dev Tunnels](../overview/glossary.md) need no server-side account: each user connects a Microsoft or GitHub account.

## Register the CILogon client

The session server is the CILogon OAuth client and does not start without its client ID and secret. Decide the
site's host name first: the redirect URI depends on it.

| Setting | Value | Reason |
|---|---|---|
| Client type | Confidential | The session server brokers every grant; the browser and CS Bridge never hold the secret |
| Grants | Authorisation code with PKCE; device authorisation | The first for the Jupyter site, the second for CS Bridge |
| Scopes | `openid email profile offline_access` | Requested by the server; `offline_access` yields the refresh token |
| Redirect URI | The site's `lab/index.html`, such as `https://<site>/lab/index.html` | The site sends its own page URL, without query or fragment |
| ID token audience | A JSON string, not an array | The server reads `aud` as one string equal to the client ID |
| Client ID | Such as `cilogon:/client_id/<id>` | `--oidc-client-id` takes it verbatim |

The batch server also needs a CILogon client ID and secret, allowed to call the introspection endpoint, which it uses
to validate every bearer token.

## Deploy the session server

### With cs-infra

`deployment-csvm` in [cs-infra](https://github.com/cyber-shuttle/cs-infra) installs the session server, PostgreSQL,
nginx and the CS Jupyter site onto a bare Ubuntu VM dedicated to Cybershuttle, from your workstation. Its
files hold the public instance's host names as literals, so you adapt a copy.

Prerequisites:

- A VM as in the [layout](./airavata-configuration.md#layout-of-deployment-csvm). Your workstation reaches it as
  the SSH destination `cs-api`, or the one in `CSVM_HOST`, logging in as `ubuntu` with passwordless sudo.
- DNS records for your API and site host names pointing at the VM, and ports 80 and 443 open for certbot.
- On your workstation: Go 1.26, Bun, uv (the site build runs `uv run`), rsync, age, and checkouts named `cs-infra`,
  `cs-plane` and `cs-jupyter` side by side (`CS_PLANE` and `CS_JUPYTER` override the last two).
- The CILogon client ID and secret.

1. Replace every occurrence of the public instance's host names, client ID and paths in your copy. The unit and nginx
   files are under `root/etc/`, the unit in `systemd/system/`:

   | File | Change |
   |---|---|
   | `cs-plane.service` | `--oidc-client-id`, `--public-url`, `--allowed-origin`; drop `http://127.0.0.1` unless the site is served from loopback |
   | `nginx/conf.d/*.conf` | `server_name`, `root`, and the file names |
   | `install.sh` | The `certbot -d` names, `/var/www/<site>`, and the two URLs it checks |
   | `up.sh` | The `cybershuttlePlaneApiUrl` it writes: `https://<api name>/api/v1` |
   | `down.sh` | The nginx file names and `/var/www/<site>` |

2. Create an age key. `up.sh` decrypts the secrets with the key at `~/.config/cybershuttle/sops.key` or the path in
   `CS_INFRA_KEY`. Keep a copy of the key elsewhere; nothing else decrypts the secrets.

   ```bash
   mkdir -p ~/.config/cybershuttle
   age-keygen -o ~/.config/cybershuttle/sops.key
   ```

   The command prints the key's public half.
3. Encrypt the OIDC client secret. Put the output, one line of base64, after `CS_OIDC_CLIENT_SECRET=` in
   `secrets/cs-plane.env`, replacing the existing value. Only the value is encrypted:

   ```bash
   key=~/.config/cybershuttle/sops.key
   printf %s 'the client secret' | age -r "$(age-keygen -y "$key")" | base64 | tr -d '\n'
   ```

4. Run `./up.sh` from `deployment-csvm`. It works in this order:

   1. Decrypts every secret locally.
   2. Builds `cs` for `linux/amd64` and the Jupyter site, and copies both to the VM.
   3. Writes the secrets to `/etc/default/cs-plane`.
   4. Runs `install.sh` as root: installs packages; creates the role, database and schema; issues the certificate if
      missing; installs the nginx sites, binary and site; restarts `cs-plane.service`.

   It ends with one line per URL:

   ```text
   ok https://jupyter.example.edu/lab/index.html
   ok https://jupyterapi.example.edu/api/v1/oauth/config
   ```

   A URL that keeps failing prints curl's error and stops the script. If the server did not start, `journalctl -u cs-plane` on the VM gives the reason as `cs: <error>`.

`up.sh` is safe to rerun: it keeps the certificate, database and state directory, and redeploys whatever the
checkouts hold. To upgrade, apply any upgrade steps in the new release's CHANGELOG, check out the release and run
`./up.sh`. To stop or remove the deployment:

| Command | Effect |
|---|---|
| `./down.sh` | Disables `cs-plane` and PostgreSQL and removes the nginx sites; data, secrets and software stay |
| `./down.sh --purge` | Also deletes the certificate, PostgreSQL and its data, the unit, binary, `/etc/default/cs-plane`, the site, `/home/ubuntu/.cybershuttle` and the control sockets under `/tmp/cs-<uid of ubuntu>`; nginx and certbot stay |

### By hand

Use this on another distribution or behind an existing proxy. The server refuses a non-loopback `--listen`, so a TLS
proxy that meets the [requirements](./airavata-configuration.md#requirements) sits in front. The host needs an OpenSSH
client on `PATH`.

1. Build:

   ```bash
   git clone https://github.com/cyber-shuttle/cs-plane.git
   cd cs-plane
   go build -o cs .
   ```

2. Create a PostgreSQL schema owned by the server's role; the server creates its tables there at first start.
   cs-infra runs the server as `ubuntu` over the local socket with peer authentication:

   ```sql
   CREATE ROLE ubuntu LOGIN;
   CREATE DATABASE cybershuttle OWNER ubuntu;
   \connect cybershuttle
   CREATE SCHEMA cs_plane AUTHORIZATION ubuntu;
   ```

3. Run the server behind your proxy, under a unit like the
   [cs-infra one](./airavata-configuration.md#layout-of-deployment-csvm). Keep `CS_OIDC_CLIENT_SECRET` out of the
   unit, in an `EnvironmentFile` that only root and the service user's group can read:

   ```bash
   export CS_OIDC_CLIENT_SECRET=...
   export CS_DATABASE_URL='postgres:///cybershuttle?host=/var/run/postgresql&search_path=cs_plane'
   cs serve \
     --listen 127.0.0.1:8045 \
     --oidc-client-id cilogon:/client_id/<id> \
     --public-url https://jupyterapi.example.edu \
     --allowed-origin https://jupyter.example.edu
   ```

   A configuration error exits at once with `cs: <error>`. Once it is running,
   `curl -si http://127.0.0.1:8045/api/v1/sessions | head -1` prints `HTTP/1.1 401 Unauthorized`.
4. Deploy the Jupyter site as in [Hosting the Jupyter site](./hosting-the-jupyter-site.md).

## Deploy the batch server

No unit, proxy configuration or package ships for the batch server; those below are examples. Prerequisites are in
[Requirements](./airavata-configuration.md#batch-prerequisites), and
[job e-mail](./preparing-the-cluster.md#job-e-mail-for-batch-runs) must work on each cluster. Read the batch server's
[known gaps](../planning/security-model.md#batch-known-gaps) before exposing it in step 6.

1. Build, and copy the binary to `/usr/local/bin/airavata-server`. Create a system user `airavata` for the unit:

   ```bash
   git clone https://github.com/apache/airavata.git
   cd airavata
   GOOS=linux GOARCH=amd64 go build -o bin/airavata-server ./cmd/airavata-server
   ```

2. Create the database and its owner:

   ```sql
   CREATE USER airavata WITH PASSWORD 'a-strong-password';
   CREATE DATABASE airavata OWNER airavata ENCODING 'UTF8';
   ```

3. Write the environment file, readable only by root and the service user.
   [Configuration](./airavata-configuration.md#batch-server-configuration) describes every variable; the less obvious
   lines:

   | Line | Reason |
   |---|---|
   | `AIRAVATA_DB_AUTO_MIGRATE=false` | The schema changes only when you run `migrate`, in the next step |
   | `AIRAVATA_CORS_ALLOWED_ORIGINS` | The default answers a browser on any origin |
   | `AIRAVATA_ROOT_ACCOUNT_TOKEN` | Pinned for the first start; otherwise each start generates a new token. Step 8 removes it |
   | `AIRAVATA_EMAIL_MONITOR_*` | Without both, job states are never read |
   | `AIRAVATA_WORKFLOW_BACKEND_SQLITE_PATH` | The default is under `/tmp`, which the host may clear |

   ```bash title="/etc/default/airavata-server"
   AIRAVATA_DB_DSN=postgres://airavata:a-strong-password@127.0.0.1:5432/airavata?sslmode=disable
   AIRAVATA_DB_AUTO_MIGRATE=false
   AIRAVATA_CORS_ALLOWED_ORIGINS=https://portal.example.edu
   CILOGON_CLIENT_ID=cilogon:/client_id/0123456789abcdef
   CILOGON_CLIENT_SECRET=the-client-secret
   AIRAVATA_ROOT_ACCOUNT_TOKEN=3f1c9a52-7d0e-4b8a-9c61-2e5f4d7a8b90
   AIRAVATA_EMAIL_MONITOR_ADDRESS=cybershuttle-jobs@gmail.com
   AIRAVATA_EMAIL_MONITOR_APP_PASSWORD=the-app-password
   AIRAVATA_WORKFLOW_BACKEND_SQLITE_PATH=/var/lib/airavata/airavataorchestrator.sqlite
   ```

4. Apply the schema as a user that can read the environment file:

   ```bash
   set -a; . /etc/default/airavata-server; set +a
   airavata-server migrate up
   airavata-server migrate status
   ```

   Every migration is listed as applied.
5. Install a unit and start it:

   ```ini title="/etc/systemd/system/airavata-server.service (example)"
   [Unit]
   Description=airavata-server
   After=postgresql.service

   [Service]
   User=airavata
   EnvironmentFile=/etc/default/airavata-server
   StateDirectory=airavata
   ExecStart=/usr/local/bin/airavata-server
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now airavata-server
   curl -s localhost:9095/health
   ```

   The last command prints `{"status":"UP"}`.

6. Put TLS in front. The server listens in plain HTTP on `:9095` on every interface, so firewall that port to the
   proxy. Afterwards
   `curl -s https://airavata.example.edu/health` prints the same `{"status":"UP"}`.

   ```nginx title="/etc/nginx/conf.d/airavata.example.edu.conf (example)"
   server {
       listen 443 ssl;
       server_name airavata.example.edu;
       ssl_certificate /etc/letsencrypt/live/airavata/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/airavata/privkey.pem;
       location / {
           proxy_pass http://127.0.0.1:9095;
           proxy_set_header Host $host;
       }
   }
   ```

7. Make the first administrator: register the user with the root token, then grant the role in SQL. Roles are read
   only from the `user_roles` table, which no endpoint writes.

   `user_id` is the first present of the token's `username`, `preferred_username` and `sub` claims; a CILogon URI
   such as `http://cilogon.org/serverE/users/12345` becomes `cilogon:12345`. The roles are `SUPER_ADMIN`, `ADMIN` and
   `USER`; a user with no row is a `USER`.

   ```bash
   curl -s -X POST https://airavata.example.edu/api/v1/users \
     -H "Authorization: Bearer $ROOT_TOKEN" -H 'Content-Type: application/json' \
     -d '{"userId":"cilogon:12345","firstName":"Ada","lastName":"Lovelace","email":"ada@example.edu","authMethod":"CILOGON"}'
   ```

   ```sql
   INSERT INTO user_roles (user_id, role) VALUES ('cilogon:12345', 'SUPER_ADMIN');
   ```

8. Disable the root account: set `AIRAVATA_ROOT_ACCOUNT_ENABLED=false`, remove `AIRAVATA_ROOT_ACCOUNT_TOKEN`, and
   restart. While enabled, its token authenticates as `SUPER_ADMIN` without CILogon and is printed to the journal at
   every start. Afterwards the old token is answered `401`.

## Point the clients

Only the Jupyter site and batch API callers can be pointed at a centre's instance without a rebuild:

| Client | Airavata URL | Action |
|---|---|---|
| CS Jupyter | `cybershuttlePlaneApiUrl` in the served site | `deployment-csvm` sets it; otherwise see [Hosting the Jupyter site](./hosting-the-jupyter-site.md) |
| CS Bridge | `PLANE_URL` in `src/plane.ts`, fixed to the public instance | None for its default Dev Tunnel transport, which does not use Airavata; for the experimental link transport, change the constant and build the extension from source |
| Batch API callers, including CS Batch | The batch server's public URL | Add each browser origin to `AIRAVATA_CORS_ALLOWED_ORIGINS` |

## Verify the deployment

Run the checks in order. The first five cover the session server, the last two the batch server.

| Check | Expected result |
|---|---|
| `systemctl is-active cs-plane postgresql nginx` | `active` three times |
| `curl -si http://127.0.0.1:8045/api/v1/sessions \| head -1` on the VM | `HTTP/1.1 401 Unauthorized` |
| `curl -fsS -H 'Origin: https://jupyter.example.edu' https://jupyterapi.example.edu/api/v1/oauth/config` | JSON with `issuer`, `authorizationEndpoint`, `clientId`, `scope`; `502 upstream_unavailable` means CILogon discovery is unreachable |
| Open the site and sign in | After CILogon, the Launcher's **Sessions** section loads; a CORS error means `--allowed-origin` lacks the origin |
| Add an SSH host and start a small session | The session reaches `READY`: the job reached the API host name over the link |
| `curl -s localhost:9095/health` on the batch host | `{"status":"UP"}` |
| `journalctl -u airavata-server \| grep 'email monitor'` | `Starting email monitor` with `intervalSeconds=20`; `Failed to start email monitor` means the address or app password is missing |

Next: [Running in production](../operating/running-in-production.md) for health checks, backups, upgrades and incident
response, and [Connecting Custos](./connecting-custos.md) for the security component.

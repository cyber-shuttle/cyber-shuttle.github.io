---
title: Running in production
description: Health checks, logs, backups, upgrades, secret rotation, capacity and incident response for a centre that operates its own Airavata instance.
---

# Running in production

For the operators of an Airavata instance (session server `cs serve`, batch server `airavata-server`). A centre whose
researchers use an Airavata instance elsewhere needs only [Visibility and control](./visibility-and-control.md). The
security component (Custos) is covered in [Running Custos](./running-custos.md).

The page assumes a deployment made as in [Hosting Airavata](../setting-up/hosting-airavata.md):
`cs-plane.service` running as `ubuntu`, database `cybershuttle`, schema `cs_plane`, and state under
`/home/ubuntu/.cybershuttle/control`. Adjust names for a deployment made by hand.

## Health checks

Run these after every deployment or restart, and first when users report failures. Each row proves one part.

| Check | Command | Covers |
|---|---|---|
| Session server | `curl -si http://127.0.0.1:8045/api/v1/sessions` → `401` | The process and its bearer check |
| Session server, end to end | `curl -fsS -H 'Origin: https://<site>' https://<api>/api/v1/oauth/config` → `200` | DNS, TLS, nginx, the origin allowlist, CILogon discovery (`502 upstream_unavailable`; cached five minutes) |
| Jupyter site | `curl -fsS https://<site>/lab/index.html` | nginx and the static files, not `cybershuttlePlaneApiUrl` |
| PostgreSQL | `systemctl is-active postgresql` or `pg_isready` | Every session, SSH host and SSH key request |
| Batch server | `curl -s localhost:9095/health` → `{"status":"UP"}` | The HTTP listener only; the answer is constant |
| Mail monitor | `journalctl -u airavata-server`, for `Failed to read unread emails` | IMAP access to the Gmail inbox, every 20 seconds; not Slurm's delivery |
| TLS certificates | `certbot certificates`, `certbot renew --dry-run` | Renewal, which `install.sh` leaves to certbot |

Neither session check reaches PostgreSQL; a running server without it answers `500 internal_error` to every request
that reads stored state. All signed-in users receiving `401` while the second check answers `502` points at CILogon,
not at their tokens.

Airavata does not check clusters itself; a user checks a login node with
[`GET /api/v1/hosts/{alias}/health`](./airavata-ssh-hosts-and-keys.md#host-parsing).

Neither server exposes metrics (no Prometheus endpoint, `expvar` or `pprof`); monitoring rests on these checks and
the journal.

## Logs

The session server logs three lines only; the journal shows that something failed, the session record shows what.

| Journal line | Meaning | Look next at |
|---|---|---|
| `cs: <error>` | The server refused to start: a missing setting, an unreachable database, or `unsupported state database format`. The unit restarts it every three seconds | The message; [Session restarts](./airavata-persistence.md#session-restarts) |
| `session reconciliation failed` | A reconciliation pass could not read or write the session tables. An unreachable cluster is not logged; it is recorded in each session's `error` | PostgreSQL |
| `request failed with an unclassified error` | One request was answered `500 internal_error`. The line carries no detail and no user | The `500` at the same time in the nginx access log, for the route |

| Source | Content | Read with |
|---|---|---|
| `cs-plane.service` | The three lines above | `journalctl -u cs-plane` |
| `airavata-server` | `slog` lines: startup, migrations, staging tasks, each Slurm mail, workflow failures, the mail monitor; on standard output, the root token banner when the root account is enabled | `journalctl -u airavata-server` |
| nginx | Access and error logs of both host names; links appear as `GET /api/v1/sessions/<id>/link` | `/var/log/nginx/` |
| Session [log tail](./airavata-sessions-and-runs.md#logs) | Preparation steps, node assignment, and the redacted tail of the job's `.out` and `.err` | The client; lost on restart, frozen with each run in run history |

To read every stored session with its owner's CILogon subject, cluster job and last error:

```bash
psql -d cybershuttle -c "SELECT id, payload::json->'owner'->>'subject' AS subject, payload::json->>'alias' AS host,
  payload::json->>'state' AS state, payload::json->>'jobId' AS job, payload::json->>'node' AS node,
  payload::json->>'error' AS error FROM cs_plane.sessions"
```

On the cluster, nothing prunes the files; see [Job identification](./visibility-and-control.md#job-identification) for the paths. A Jupyter run's workflow is
`~/.cybershuttle/sessions/<session id>/workflow.yaml`; a batch process keeps its `script.slurm`.

## Capacity

| Load | Source |
|---|---|
| One SSH round per user and SSH host every 30 seconds | Reconciliation: `scancel`, `squeue --me`, `sacct`; one pass at a time, 60-second timeout |
| One HTTP request per `READY` session every 5 seconds | Usage polling of Linkspan |
| One `sacct` per ended Jupyter run every 5 seconds | Up to ten minutes after the run ends, until `MaxRSS` appears |
| All interactive traffic of link-transport sessions | Proxied through nginx and the server; size the VM's bandwidth for it |
| One PostgreSQL connection | Every session change rewrites all sessions and runs in one transaction under a file lock |
| One `ssh` control master per user and SSH host | Its socket is under `$TMPDIR/cs-<uid>/` or `/tmp/cs-<uid>/`; it persists up to ten idle minutes |
| Up to 256 pending Dev Tunnels sign-ins | In memory; Dev Tunnels quotas fall on each user's own account |
| Batch: up to 20 PostgreSQL connections | 2 idle, 30-minute lifetime |
| Batch: file staging | Each `FILE` input and output passes through `/tmp` on the batch host, which must hold every file in flight |
| Batch: one IMAP pass every 20 seconds | `imap.gmail.com:993` |

On the cluster, each user's `~/.cybershuttle/logs` grows by two files per run.

## Backups and restore

### Session server

The session server holds no research data. Without its session records running jobs continue, but the server can
no longer reach or stop them. Relative paths are under `~/.cybershuttle/control/`.

| Data | Location | Needed for |
|---|---|---|
| Sessions, runs, SSH hosts, SSH key metadata | Schema `cs_plane` of database `cybershuttle` | Everything |
| SSH private keys, rendered SSH configurations | `hosts/<principal>/` | Reaching clusters; key rows are useless without them |
| Sealed Dev Tunnels accounts | `devtunnels-account` in `hosts/<principal>/` | Connected Dev Tunnels accounts |
| Their sealing key | `devtunnels-account.key` | Opening the sealed accounts |
| Per-run tokens | `credentials/` | Live runs only |
| `/etc/default/cs-plane`, the unit, the nginx files | `cs-infra` and its age key | Rebuilding the host; `up.sh` rewrites them |

Back up both while the server is stopped, so the dump and the archive agree. Running jobs are unaffected.

1. Stop the server: `sudo systemctl stop cs-plane`.
2. As `ubuntu`, dump the schema and archive the state directory:

   ```bash
   pg_dump -d cybershuttle -n cs_plane -Fc -f cs_plane.dump
   tar -C ~/.cybershuttle -czpf control.tgz control
   ```

3. Start it: `sudo systemctl start cs-plane`.
4. Encrypt both files before they leave the host; the archive holds every user's private SSH keys.

To restore, stop the server, then as `ubuntu`:

```bash
psql -d cybershuttle -c 'DROP SCHEMA cs_plane CASCADE'
pg_restore -d cybershuttle cs_plane.dump
rm -rf ~/.cybershuttle/control && tar -C ~/.cybershuttle -xzpf control.tgz
```

`tar -p` keeps the modes the server requires. Start the server and run the health checks. Reconciliation retires
restored sessions whose jobs ended after the backup.

### Batch server

| Data | Location |
|---|---|
| Users, groups, clusters, configurations, templates, deployments, data products, processes | `public` schema of its database |
| Batch SSH private keys and passphrases | `ssh_keys.private_key`, `ssh_keys.passphrase`, plain text in the same database |
| Launched workflow state | SQLite file `AIRAVATA_WORKFLOW_BACKEND_SQLITE_PATH`, default `/tmp/airavataorchestrator.sqlite` |

The example assumes database `airavata` and the SQLite path set to `/var/lib/airavata/airavataorchestrator.sqlite`:

```bash
pg_dump -d airavata -Fc -f airavata.dump
sudo systemctl stop airavata-server
cp /var/lib/airavata/airavataorchestrator.sqlite airavataorchestrator.sqlite.bak
sudo systemctl start airavata-server
```

The dump contains every batch user's cluster key; protect it as the keys. A SQLite store left at the `/tmp` default
is lost, with in-flight submissions, when the host clears `/tmp`.

## Upgrades

### Session server and Jupyter site

Releases are `vX.Y.Z` tags with a CHANGELOG. Nothing is migrated automatically, and the server refuses to start on a
schema it does not recognise (`cs: unsupported state database format`). Before upgrading, read the CHANGELOG entry of
every release between yours and the target, and take a [backup](#backups-and-restore).

1. Check out the release (`git checkout v0.4.2`) and the Jupyter site revision to deploy with it.
2. If the CHANGELOG gives upgrade steps, stop the server, then apply them, running SQL with `psql -d cybershuttle`.
3. Run `./up.sh`. It rebuilds both from the checkouts, redeploys, restarts `cs-plane.service`, and prints
   `ok <url>` for each public name that answers. `cs version` on the host prints the installed release.

A restart drains requests for up to 25 seconds; see [Session restarts](./airavata-persistence.md#session-restarts).
Manual steps can be heavy: 0.3.0 to 0.4.0 required deleting all rows and having users add their SSH hosts, keys and
Dev Tunnels accounts again.

### Batch server

1. Build the new revision and replace the binary.
2. Only on a database managed by versioned migrations, run `airavata-server migrate status`, then
   `airavata-server migrate up`, with the new binary. With `AIRAVATA_DB_AUTO_MIGRATE=true`, the default, skip this
   step; see [Batch migrations](./airavata-persistence.md#batch-migrations).
3. Restart the unit. It drains for up to 20 seconds.

Linkspan upgrades itself on the cluster at each session start; see
[Linkspan installation](./airavata-sessions-and-runs.md#linkspan-installation). Version requirements are in
[Compatibility](./compatibility.md).

## Secret rotation

Relative paths are under the state directory, `~/.cybershuttle/control/`.

| Secret | Held in | To rotate, and the effect on users |
|---|---|---|
| OIDC client secret | `/etc/default/cs-plane`, from `secrets/cs-plane.env` | Issue a new secret at CILogon, encrypt it into `secrets/cs-plane.env`, run `up.sh`. Effect: sign-in and refresh fail between revoking the old secret and restarting |
| age key for `cs-infra` secrets | `~/.config/cybershuttle/sops.key` on the deploying workstation | Re-encrypt each value with the new key; replace the key file. Effect: none |
| Dev Tunnels sealing key | `devtunnels-account.key` | Stop the server, delete the key and every `hosts/*/devtunnels-account`, start. Effect: every user reconnects their Dev Tunnels account |
| Per-run tokens | `credentials/<session id>-<seq>.token`, the job environment | Automatic, per run. Effect: none |
| Session SSH keys | `hosts/<principal>/keys/<id>` | The user uploads a new key, assigns it, deletes the old one. Effect: owner-driven |
| Batch root token | `AIRAVATA_ROOT_ACCOUNT_TOKEN`, or random at each start | Change or remove it and restart; or set `AIRAVATA_ROOT_ACCOUNT_ENABLED=false`. Effect: old token rejected at once |
| Batch CILogon client secret | `CILOGON_CLIENT_SECRET` | Replace and restart. Effect: `401` while CILogon refuses the old secret |
| Mail monitor app password | `AIRAVATA_EMAIL_MONITOR_APP_PASSWORD` | Create a Google app password, replace, restart, revoke the old one. Effect: none; unread mail is processed on the next pass |
| Batch database password | `AIRAVATA_DB_DSN` or `AIRAVATA_DB_PASSWORD` | `ALTER ROLE airavata PASSWORD …`, replace, restart. Effect: none |
| Batch cluster keys | `ssh_keys.private_key` | The owner calls `PUT /api/v1/ssh-keys/{id}`; configurations using the key follow. Effect: owner-driven; administrators cannot replace another user's key |

Deleting only the Dev Tunnels sealing key leaves sealed accounts that fail to open. Rotating the OIDC client secret
signs nobody out. The batch root account is enabled by default; disable it in production.

## Incident response

Neither server can disable a user or stop another user's work: the session server accepts any CILogon ID token for
its client until `exp`, and the batch server any token CILogon reports `active`. Act on the cluster:

- Lock the user's account, or remove from their `authorized_keys` the public keys whose private halves the session
  server stores; [Deleting stored keys](#deleting-stored-keys) lists their fingerprints.
- End the user's `sshd` processes on the login node, which closes any control master the session server holds.
- Remove shares of batch cluster configurations; until then the user runs batch work as each one's login user.

### Stopping work

Cancel the jobs in Slurm. The user can start a session again while their cluster access stands.

```bash
# Jupyter sessions: job names cs-s-<12 hex>-<seq>
squeue -h -u "$user" -o '%i %j' | awk '$2 ~ /^cs-s-[0-9a-f]+-[0-9]+$/ {print $1}' | xargs -r scancel
# CS Bridge sessions
scancel -u "$user" --name=linkspan-session
```

For a batch run, `scancel` the job named after its Airavata process ID. Stopping the units stops all Airavata
activity; running jobs continue unless cancelled.

### Deleting stored keys

The session server stores rows under a principal hash: the first 16 bytes of `sha256(sub + "\0" + "cilogon")` in
hexadecimal, where `sub` is the user's CILogon subject. Compute it, or find it from the user's cluster login:

```bash
p=$(printf '%s\0%s' 'http://cilogon.org/serverA/users/12345' cilogon | sha256sum | cut -c1-32)
psql -d cybershuttle -c "SELECT principal, host, payload::json->>'user' AS login, payload::json->>'hostname' AS hostname
  FROM cs_plane.ssh_hosts WHERE payload::json->>'user' = 'jdoe'"
```

List the stored keys' fingerprints; `ssh-keygen -lf ~jdoe/.ssh/authorized_keys` prints the same `SHA256:` form for
matching:

```bash
psql -d cybershuttle -c "SELECT name, type, fingerprint FROM cs_plane.ssh_keys WHERE principal = '$p'"
```

With the user's sessions stopped:

1. `sudo systemctl stop cs-plane`, so that no write in flight restores the rows.
2. As `ubuntu`, delete the rows and the principal's directory (private keys, SSH configuration, sealed Dev Tunnels
   account):

   ```bash
   psql -d cybershuttle <<SQL
   DELETE FROM cs_plane.sessions  WHERE owner = '$p';
   DELETE FROM cs_plane.ssh_hosts WHERE principal = '$p';
   DELETE FROM cs_plane.ssh_keys  WHERE principal = '$p';
   SQL
   rm -rf ~/.cybershuttle/control/hosts/"$p"
   ```

3. `sudo systemctl start cs-plane`.

Run history rows (`cs_plane.runs`, `owner = '$p'`) hold no credentials and may be kept for audit.

In the batch server, a user's keys are `ssh_keys` rows with `owner_id = 'cilogon:<id>'`. Remove the user's access,
then list their keys:

```sql
DELETE FROM slurm_cluster_config_user_sharings WHERE user_id = 'cilogon:12345';
DELETE FROM scp_data_storage_user_sharings WHERE user_id = 'cilogon:12345';
DELETE FROM group_members WHERE user_id = 'cilogon:12345';
DELETE FROM user_roles WHERE user_id = 'cilogon:12345';
SELECT ssh_key_id, ssh_key_name, public_key FROM ssh_keys WHERE owner_id = 'cilogon:12345';
```

Remove each listed public key from the cluster accounts that trust it; the private key also remains in every backup
taken while it existed. A key another user shares through a configuration or group stays valid until the share or
membership is removed.

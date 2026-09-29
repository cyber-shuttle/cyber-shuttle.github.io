---
title: Running Custos
description: Health checks, logs, reconciliation, backups, upgrades, secret rotation, cutting off users and troubleshooting for a centre that runs Custos.
---

# Running Custos

For the operators of a Custos deployment. Custos (Apache Airavata Custos) is Cybershuttle's security component and our
view of what a control plane for HPC operators should look like; it runs as a separate service with its own database.
[Connecting Custos](../setting-up/connecting-custos.md) covers setup, and
[Managing allocations](../planning/managing-allocations.md#implemented-functions) its functions.

## Health and logs

| Component | Health | Metrics |
|---|---|---|
| Server | `GET /healthz`, public, `{"status":"ok"}`; checks neither database nor connectors | None served |
| Signer | `GET /api/v1/health`; `503` when its database or Vault is down | Prometheus at `/metrics`, port 8084 |

The AMIE connector's Prometheus counters are exposed by no route. The Grafana dashboard
`dev-ops/compose/grafana/dashboards/amie-service.json` reads most panels from the AMIE tables; point its PostgreSQL
data source at `custos` (it names `access_ci`). Its Prometheus panels stay empty.

The working checks, against database `custos`:

| Check | Query | Healthy |
|---|---|---|
| AMIE packets failed permanently | `SELECT count(*) FROM amie_processing_events WHERE status = 'PERMANENTLY_FAILED'` | 0 |
| Cluster accounts not provisioned in COmanage | `SELECT id, local_username FROM compute_cluster_users WHERE provisioned_at IS NULL AND created_at < now() - interval '10 minutes'` | No rows |
| Connector failures | `SELECT event_type, count(*) FROM audit_events WHERE event_type LIKE '%Failed' AND event_time > now() - interval '1 day' GROUP BY 1` | No rows |
| Usage monitor | Log line `successfully polled SLURM usage` | Every 30 seconds |

The server writes JSON logs to standard output at `core.log_level`, one line per HTTP request; the Slurm client also
logs each request body. Nothing rotates or ships logs.

A Slurm connector with incomplete settings logs the Slurm token in clear text: the association mapper at `info`, the
usage monitor at `warn`.

The AMIE, COmanage and Slurm connectors write audit rows to `audit_events` with `trace_id`, `span_id` and
`parent_span_id`; the signer logs its audit records instead. Reading them needs `core:traces:read`; the portal shows
them under **Site administration → Tracing** (`/admin/traces`). To follow one request, for example an allocation that
did not reach Slurm:

| Endpoint | Returns |
|---|---|
| `GET /audit/traces` | Traces, filtered by `q`, `source`, `status`, `from`, `to`, `limit`, `offset` |
| `GET /audit/traces/{trace_id}` | One trace as a tree of events |
| `GET /audit/events?trace_id=…` | A trace's events, optionally one `span_id` |
| `GET /audit/sources` | Sources present, such as `amie`, `comanage`, `slurm` |
| `GET /connectors/amie/packets/{packet_id}/audits` | One AMIE packet's events |

## Reconciliation

Events travel on an in-memory bus and are lost if the process stops. The Slurm reconciler repairs user associations
only; [Troubleshooting](#troubleshooting) gives the manual repair for the rest. It runs at start-up and every
`association_reconcile_interval` (default 5 minutes), cluster by cluster:

| Does | Does not |
|---|---|
| Write missing user associations, or those whose `GrpTRES` or `GrpTRESMins` differ, for accounts provisioned at least `association_provision_grace` earlier | Create Slurm accounts |
| Overwrite limits changed by hand on associations it manages | Touch accounts that are not one of its allocations on that cluster, or account-level associations |
| Remove unexpected user associations in accounts it manages, including hand-made ones | Remove anything when it expects no associations on the cluster |
| | Retry COmanage provisioning or AMIE packets |

## Backups

Back up all five; the Vault keys are the only ones whose loss reaches every node.

| Data | Location | Note |
|---|---|---|
| Security component state | Database `custos`: core and `amie_*` tables, `schema_migrations`, `schema_migrations_amie` | After a restore, the reconciler removes associations granted since the backup |
| Signer records | Database `custos_signer` | Clients, issuance log, revocations |
| SSH CA private keys, serial counters | Vault KV engine `ssh-ca` | Losing them means a new CA and a new `TrustedUserCAKeys` on every node |
| OIDC issuer | Keycloak's database, if used | |
| Configuration | `custos.yaml` and its environment, `web/.env.local`, signer `config.yaml` | Contains credentials |

## Upgrades and restarts

Core migrations are embedded and applied at start-up; connectors keep their own migration tables, such as
`schema_migrations_amie`. Nothing applies down migrations, and there are no releases: back up `custos`, then deploy
from a pinned commit. The signer migrates only on `custos-signer migrate` or `serve --auto-migrate`.

Run a single server process: each process runs its own AMIE poller, reconciler and usage monitor. After each start, the usage monitor's first poll reads the whole `slurmdbd` job history
and replaces the charges it recomputes. A restart loses unhandled events; see [Reconciliation](#reconciliation).

## Secret rotation

| Secret | Read from | To rotate |
|---|---|---|
| SSH CA (signer) | Vault, per tenant and client | `POST /api/v1/admin/rotate-ca` with the client's credentials, then install `/api/v1/ca-public-key` as every node's `TrustedUserCAKeys` |
| Signer client secret | bcrypt hash in `client_ssh_configs` | Update the row |
| AMIE, COmanage API keys | Configuration, at start-up | Change and restart the server |
| Slurm JWT | Configuration, at start-up; never renewed | `scontrol token` before expiry, then restart the server |
| Portal OIDC client secret, `NEXTAUTH_SECRET` | `web/.env.local` | Change and restart the portal |
| LDAP bind password, CILogon device-flow client secret | Node files written by the playbook | Update `group_vars/all.yml`; re-run the playbook with `--tags sssd,pam` |

CA rotation discards the previous key. Nothing rotates on a schedule; `period_hours` is only recorded.

## Cutting off a user

Each action removes one kind of access; combine them.

| Action | Effect | Not affected |
|---|---|---|
| `PUT /compute-allocation-memberships/{id}/status`, `{"membership_status": "INACTIVE"}` | Removes the user's Slurm associations under that allocation; the reconciler does not restore them | Other allocations; running jobs (`scancel` them); the POSIX account and LDAP entry |
| `DELETE /users/{id}/roles/{roleId}`, `DELETE /users/{id}/privileges/{key}` | Applies on the next request | |
| `DELETE /user-identities/{id}` on the `oidc` identity | Refuses sign-in to the security component within `cache_ttl` (at most 60 seconds) | Slurm, COmanage, SSH |
| `PUT /users/{id}/status` | Changes the record only | Sign-in, Slurm, COmanage |
| Set the CoPerson inactive in COmanage | Removes the LDAP entry, so SSSD stops resolving the user and device-code SSH login fails; `sss_cache -u <user>` drops cached entries | The security component never does this itself |
| Signer: `enabled = false` on the client row | Stops new certificates | Issued certificates, valid until expiry (default at most 24 hours); revocation is recorded, not enforced |

Rotating the CA and updating `TrustedUserCAKeys` invalidates all issued certificates.

## Troubleshooting

| Symptom | Cause | Workaround |
|---|---|---|
| An AMIE packet stays failed; **Retry** and **Resolve** return `501 not_implemented` | After three tries (retries at 30 and 60 seconds) packets are marked failed; those routes are placeholders | Fix the cause, then requeue the event in the database (below) |
| A connector is missing, or sends values such as `${AMIE_API_KEY}` | Unset variables stay literal in `custos.yaml`; a connector with empty credentials is skipped | Set every referenced variable, or remove the block or set `enabled: false` |
| After a crash or restart, a new member has no POSIX account, or a new allocation no Slurm account | Events are delivered in memory and lost; the reconciler repairs user associations only | See below |
| Allocations are charged CPU × hours only | The usage monitor charges the `billing` TRES, which is the CPU count by default | Set `TRESBillingWeights` on the partition and `PriorityFlags=MAX_TRES`; later polls recompute only jobs inside `usage_lookback`, and a server restart recomputes all |
| A finished job has no usage charge | Its account, user, partition or rate is not registered in the security component; all but the account case log a warning | Correct the names, or add a rate with `POST /compute-allocation-resource-rates` |
| Onboarding fails with "pick a cluster, N are registered" | Without `allocation_id` or `compute_cluster_id`, exactly one cluster must exist | Pass `compute_cluster_id` to `POST /users` |
| Sign-in fails with `401 identity_not_linked` | A new identity links only to a `PENDING` user with the same `email` and no OIDC identity; `email_verified` is not checked | Onboard with the exact e-mail the issuer sends; check the record with `GET /users` |
| "Invalid account or account/partition combination specified" just after a user is added | The reconciler writes the association at its first sweep after `association_provision_grace` (30 seconds); or QoS `normal` is missing or not allowed | Wait for the sweep or shorten `association_reconcile_interval`; create and allow QoS `normal` |
| Association writes and usage polls fail with `401` from `slurmrestd` | The Slurm JWT, read once at start-up, expired | Issue a new token and restart the server |
| A user whose access ended can still log in | The security component revokes Slurm associations only, never COmanage | Set the CoPerson inactive in COmanage |
| Device-code SSH login is refused though `getent passwd` finds the user | The registry gets the user's `oidcsub` only after their first sign-in to the security component, published as `voPersonExternalID` | Have the user sign in to the portal once; check the LDAP provisioner mapping |
| A revoked SSH certificate still works | Revocations are recorded, but no revocation list is produced | Wait for expiry, or rotate the CA and update `TrustedUserCAKeys` |
| The AMIE Grafana dashboard is empty | Its data source names database `access_ci`, and the server serves no `/metrics` | Point the data source at `custos`; Prometheus panels stay empty |
| **Retry** in the portal's trace view is disabled | The server has no retry route for traces | None |

To requeue a failed AMIE packet, reset its event; the processor picks it up within `worker_interval`.

```sql
UPDATE amie_processing_events SET status = 'RETRY_SCHEDULED', attempts = 0, next_retry_at = now() WHERE packet_id = '…';
```

To repair lost events:

| Missing | Repair |
|---|---|
| Slurm account | `sacctmgr add account <allocation name> cluster=<cluster>` |
| COmanage account | Delete the cluster account, then `POST /compute-cluster-users` with the same `local_username`; this republishes the creation event but does not restore administrator access |

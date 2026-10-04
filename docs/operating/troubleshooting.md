---
title: Troubleshooting
description: Problems a resource provider may meet with Cybershuttle on a Slurm cluster, their causes, and the workarounds that exist today.
---

# Troubleshooting

Problems by symptom, with cause and workaround. Text in quotation marks is the message the client shows the user.
[Preparing the cluster](../setting-up/preparing-the-cluster.md) covers the cluster settings named here.
Problems with the security component (Custos) are in [Running Custos](./running-custos.md#troubleshooting).

## First checks

| Look at | Where | Tells |
|---|---|---|
| The message the user saw | The client; ask for its exact text | Which row below applies; it quotes Slurm's own refusal where there is one |
| The job | `sacct -u <user> --starttime=now-1days --format=JobID,JobName%30,State,ExitCode,Elapsed,NodeList`, with the names in [Job identification](./visibility-and-control.md#job-identification) | Whether a job was submitted, whether it started, and how it ended |
| The job's `.err` log | `linkspan-session-<jobid>.err` (VS Code) or `<session id>-<run>.err` (Jupyter), in `~/.cybershuttle/logs` | What Linkspan could not do on the compute node |

No job at all means the failure came before submission: discovery, validation or Linkspan installation. Only the
user and root can read the logs. An Airavata operator also has the stored session `error`; see
[Logs](./running-in-production.md#logs).

## Scheduling and policy

| Symptom | Cause | Workaround |
|---|---|---|
| "Validation failed" or "rejected the session configuration", with a Slurm message | `sbatch --test-only` refused the script: a submit filter, or a partition, QOS or account limit | Intended; make filter refusals explanatory with `slurm.log_user` |
| Jupyter sessions pass validation but submission is refused | The submit filter keys on the job name or an environment variable, which are set only at submission | Match the job script instead, for example `LINKSPAN_BIN=`; see [Slurm policy](../setting-up/preparing-the-cluster.md#slurm-policy-for-interactive-sessions) |
| A session stays `QUEUED` indefinitely | The request exceeds `MaxTime`, a QOS or an association limit; Airavata checks only accounts, partitions and per-node CPUs, memory and GPUs | `EnforcePartLimits=ALL` and QOS `Flags=DenyOnLimit`, so validation refuses it with a reason |
| Jupyter sessions cannot start on a small partition | Airavata requires at least 2 CPUs and 4096 MB | None; allow sessions of that size |
| "Slurm account was not discovered for this SSH host" | The account is missing from `sacctmgr show associations where user=<user>` run by the user | Add the association. CS Bridge also reads `/usr/local/etc/project.map` where it exists |
| "remote discovery failed to query Slurm partitions" or "…the accounts the remote user is associated with" | `sinfo` or `sacctmgr` failed, or is not on the `PATH` of a non-interactive SSH command | Put Slurm commands on that `PATH`; login profiles and modules are not loaded |
| The SSH authentication console reopens, or "SSH authentication is required" | The control master closed: missed keep-alives, a login-node or Airavata restart, or an `sshd` connection-lifetime limit | The user authenticates again; running jobs continue |
| Batch submissions fail to authenticate on login nodes that require MFA | Batch runs log in with a key alone and cannot answer prompts | Exempt that account's key logins, for example with an `sshd_config` `Match User` block |

## Network and downloads

A session needs outbound HTTPS from the login node (Linkspan installation) and the compute node (Linkspan's
connection and the Jupyter environment).

| Symptom | Cause | Workaround |
|---|---|---|
| Jupyter sessions fail while `STARTING`; the `.err` log shows a failed connection to Airavata's session server (`jupyterapi.cybershuttle.org` on the public instance) | No outbound HTTPS from compute nodes; Linkspan's WebSocket ignores `HTTPS_PROXY` | Allow direct egress or NAT to the hosts in [Requirements](../planning/requirements.md#network-egress); a proxy does not help |
| VS Code sessions never connect over a Dev Tunnel | The node cannot fetch the `devtunnel` CLI or reach the relay | Allow the Dev Tunnel hosts in [Requirements](../planning/requirements.md#network-egress). A CLI placed at `~/.cybershuttle/bin/devtunnel` avoids the download, not the relay |
| "…could not download the Linkspan release." | The login node cannot reach GitHub's release hosts | Allow the login node's hosts in [Requirements](../planning/requirements.md#network-egress), or place Linkspan 0.22.0 or later at `~/.cybershuttle/bin/linkspan`, as a copy or a symbolic link to a shared copy |
| "…the Linkspan on this SSH host is older than 0.22.0…" | A pre-installed binary is below the minimum | Replace it with a current release |
| "…the SSH host reports an architecture Linkspan is not released for." | The login node is not `x86_64`, `aarch64` or `arm64` | None |
| Sessions fail when compute and login nodes differ in architecture | Linkspan is chosen by `uname -m` on the login node | None |
| The first Jupyter session fails while `STARTING`; the `.err` log shows `curl`, `uv` or package download errors | Linkspan builds the Python environment on the compute node from `astral.sh` (uv), GitHub (Python 3.12) and PyPI | Allow those hosts, or place `uv` at `~/.cybershuttle/bin/uv` and set mirrors (`index-url`, `python-install-mirror`) in `/etc/uv/uv.toml` |

A hand-placed Linkspan lasts only where the login node cannot reach GitHub; elsewhere a newer release replaces it,
symbolic link included; see [Linkspan installation](./airavata-sessions-and-runs.md#linkspan-installation).

## Nodes and isolation

| Symptom | Cause | Workaround |
|---|---|---|
| Other users on a shared node can reach a session's control API | Linkspan's loopback API has no password | `ExclusiveUser=YES` or exclusive nodes; see [Node sharing](../setting-up/preparing-the-cluster.md#node-sharing) and [Cluster security](../planning/cluster-security.md#known-limitations) |
| A Dev Tunnel host token is visible in `ps` | Linkspan passes it to `devtunnel host` as `--access-token` | Mount `/proc` with `hidepid=2`, or keep other users off the node; the token covers one tunnel and one run |
| A user's kernels and unsaved notebook state are gone | The job reached its walltime; kernels are not checkpointed | None; saved files remain |
| Node `/tmp` fills up | Session jobs unset `TMPDIR` and `XDG_RUNTIME_DIR`; CS Bridge installs the VS Code server in `/tmp/cs-vscode/<session id>`; nothing cleans up | A per-job `/tmp` (`job_container/tmpfs`) or a cleaning epilog |
| No CPU or memory readings | cgroup v1, or no per-job cgroup; Linkspan reads only the job's cgroup v2 files | cgroup v2 with Slurm's cgroup plugins; Jupyter runs still get `sacct` efficiency after they end |
| No GPU readings | `nvidia-smi` is not on the job's `PATH`, or the GPUs are not NVIDIA | Put `nvidia-smi` on the jobs' default `PATH`; none for other vendors |
| A session job ends at once with no `.out` or `.err` | The home quota is full | Free space; users may delete `~/.cybershuttle/logs`, which nothing prunes |

## Batch runs

| Symptom | Cause | Workaround |
|---|---|---|
| A run's status never changes and outputs are not copied back | Airavata never read the job's e-mail: undelivered, subject rewritten, or job renamed | Deliver job e-mail externally, keep Slurm's subject and the job name; see [Job e-mail](../setting-up/preparing-the-cluster.md#job-e-mail-for-batch-runs) |
| A run cannot be cancelled from Cybershuttle | Not implemented | `scancel --user=<login user> --name=<process id>` |
| Directory or file-list inputs and outputs are missing | Staging copies single files only | Pack them into one archive |
| A run pends with a limit reason, or is refused at submission | Runs are not checked against partition limits or validated first | `EnforcePartLimits=ALL` refuses them at submission |
| Connections from the Airavata host are rate-limited or blocked | Each staging, upload and submission step opens its own SSH connection | Exempt the Airavata host's address from `MaxStartups` or fail2ban limits |

The batch server parses the mail subject `Slurm Job_id=<id> Name=<process id> <event>`.

## Airavata host

Checks and log lines are in [Running in production](./running-in-production.md#health-checks).

| Symptom | Cause | Workaround |
|---|---|---|
| `cs-plane.service` restarts every three seconds | The server refused to start; the journal shows `cs: <error>`, such as `CS_OIDC_CLIENT_SECRET is required`, `CS_DATABASE_URL is required` or `the database URL's search_path names no existing schema` | Correct the setting the message names |
| `cs: unsupported state database format` | The schema holds tables without the format marker this release writes; nothing is migrated | Apply the release's upgrade steps, or restore a dump of the same format |
| Browser requests answer `403 origin_not_allowed` | The site's origin is not listed; `--allowed-origin` is matched exactly, as scheme and host without a path | Add the origin to the unit and restart |
| Sign-in answers `502 upstream_unavailable` | The server cannot reach CILogon | Restore outbound HTTPS to the issuer |
| Every signed-in user is answered `401` | CILogon's keys could not be fetched after the five-minute cache expired; or the host clock is past the tokens' `exp`; or `--oidc-client-id` differs from the tokens' `aud` | Check the end-to-end health check, the clock and the client ID |
| Authenticated requests answer `500 internal_error` | PostgreSQL is unreachable, or another unclassified failure; the journal shows `request failed with an unclassified error` | `pg_isready`; find the route in the nginx access log |
| A session's `error` reads as an SSH failure and its log tail shows "Session status check failed" | Reconciliation could not run its commands on that cluster as that user: the login node is unreachable, or SSH needs authentication | Restore reachability, or the user authenticates again; the next successful pass clears the error |
| After a restart, users are asked to authenticate to their clusters again | Control masters opened by interactive authentication end with the server | Expected. An SSH host with a stored key, no passphrase and no second factor reconnects without the user |

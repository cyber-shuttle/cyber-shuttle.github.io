---
sidebar_position: 3
title: Visibility and control
description: How to recognise Cybershuttle jobs on a Slurm cluster, and how to allow, limit or block them with the tools you already use.
---

# Visibility and control

For the administrator of a cluster whose users run Cybershuttle: how to recognise its jobs, and how to limit or block
them with `squeue`, `sacct`, QOS and `job_submit` plugins.

Every Cybershuttle job is an ordinary `sbatch` submission over SSH. An interactive session (VS Code or Jupyter) runs
as the researcher's own account; a batch run as its cluster configuration's login user, which several researchers may
share.

## Job identification

Linkspan is the agent a session job runs. Session paths are relative to `~/.cybershuttle`.

| Work | Slurm job name | Output files |
|---|---|---|
| VS Code (CS Bridge) | `linkspan-session` | `logs/linkspan-session-<jobid>.out`, `.err` |
| Jupyter | `cs-<session id>-<run>` | `logs/<session id>-<run>.out`, `.err` |
| Batch run | The Airavata process ID | `<work root>/<process id>/<process id>.stdout`, `.stderr` |

A session job's process is `bin/linkspan … --tunnel-mode devtunnel` (or `link`) for VS Code and `bin/linkspan … --workflow …` for
Jupyter; a batch run's is the application's own command.

A Jupyter job is named like `cs-s-012345abcdef-1`. Job names can be changed by the client; the process name
`linkspan` and the `~/.cybershuttle` paths are more reliable markers.

```bash
# VS Code sessions
squeue --name=linkspan-session --format="%i %u %a %P %M %L"
sacct --starttime=now-7days --name=linkspan-session --format=JobID,User,Account,Partition,Elapsed,TotalCPU,MaxRSS
# Jupyter sessions
squeue -h --format="%i %u %a %P %M %L %j" | awk '$NF ~ /^cs-s-[0-9a-f]+-[0-9]+$/'
```

A batch run's job is marked by its `--mail-user`, Airavata's own mailbox, the same for every run.

## Cluster records

Each step of a session leaves a trace on the cluster:

| Step | Trace |
|---|---|
| Discover | SSH logins by the user to the login node; `sacctmgr` and `sinfo` invocations |
| Validate | `sbatch --test-only` invocations, visible to a `job_submit` plugin |
| Install | Files under `$HOME/.cybershuttle` on the login node's file system |
| Start | A `linkspan` process on the compute node, serving SSH itself or running Jupyter Server as its child, on `127.0.0.1` |
| Connect | Outbound HTTPS from the compute node to the Dev Tunnels relay or to Airavata's session server (`jupyterapi.cybershuttle.org` on the public instance) |
| End | A normal completion, cancellation or timeout in Slurm accounting |

No inbound port is opened on the compute node; what Linkspan starts listens on loopback only.

A batch run leaves SSH and SCP logins as the cluster configuration's login user, then the job itself.

## Airavata records

These records serve users' own views and are not an audit trail; Slurm accounting is the authoritative record.

| Work | Recorded |
|---|---|
| Jupyter session | Cluster, Slurm account, resources and job ID; the newest 200 runs across all users, with their `sacct` accounting |
| VS Code session | Nothing by default: CS Bridge submits the job over the user's own SSH connection. With the experimental link transport, the session and its runs, without `sacct` accounting |
| Batch run | The process, the user who launched it, its Slurm job ID and the job states reported by Slurm e-mail |

Airavata also holds users' SSH host entries and SSH keys; see [Cluster security](../planning/cluster-security.md)
for what they permit and [Deleting stored keys](./running-in-production.md#deleting-stored-keys) for their removal.

## Controls

The site's existing Slurm mechanisms apply; nothing is configured in Cybershuttle.

| To | Use |
|---|---|
| Limit interactive use per user or account | QOS limits (`MaxJobsPerUser`, `MaxTRESPerUser`, `MaxWall`) on the partitions sessions use |
| Restrict sessions to certain partitions | A `job_submit` plugin or Lua filter; users see its refusal message at validation |
| Block Cybershuttle | A submit filter matching the job script (a session script sets `LINKSPAN_BIN=`) or Airavata's `--mail-user`; or block outbound access to the relay hosts in [Requirements](../planning/requirements.md) |
| Reclaim idle resources | Existing idle-job or low-utilisation policies; users also see each run's `sacct` efficiency |
| Audit usage | `sacct`, the accounting database and allocation reports; sessions are charged like any other job |
| Stop one user's work | `scancel` the jobs; see [Incident response](./running-in-production.md#incident-response) |

A submit filter stops new jobs only. Cancelling a session job is safe at any time; Airavata marks a cancelled Jupyter
session `STOPPED` within about 30 seconds.

Cybershuttle uses an account the researcher already holds. The security component ([Custos](../planning/managing-allocations.md)) provisions accounts, Slurm associations
and SSH access from allocation decisions.

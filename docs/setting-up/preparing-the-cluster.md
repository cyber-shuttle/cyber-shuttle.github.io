---
title: Preparing the cluster
description: How to prepare a Slurm cluster for Cybershuttle — SSH and MFA, session policy, node sharing, egress, usage readings, home space and job e-mail — and how to verify it.
---

# Preparing the cluster

This page is for the system administrator of a Slurm cluster whose researchers will use Cybershuttle. The centre
installs nothing: CS Bridge or Airavata installs Linkspan, the program that runs inside a session's job, in the user's
home directory on first use. The page assumes the commands and egress in [Requirements](../planning/requirements.md)
and familiarity with `slurm.conf`, QOS and `job_submit` plugins.

Three parts of Cybershuttle reach the cluster. Prepare only for those your researchers use:

| Part | What it is | Sections that apply |
|---|---|---|
| CS Bridge | VS Code extension on the researcher's computer | All except job e-mail |
| Airavata, Jupyter sessions | Airavata's session server; logs in and submits for the researcher. The public instance unless the centre [hosts its own](./hosting-airavata.md) | All except job e-mail |
| Airavata, batch runs | Airavata's batch server; submits with a *cluster configuration*: login user, SSH key and work directory | Accounts and SSH login; job e-mail |

## Accounts and SSH login

Cybershuttle creates no accounts; it uses the cluster accounts researchers already hold. Each part logs in
differently:

| Part | From | Authenticates with | Connection |
|---|---|---|---|
| CS Bridge (VS Code) | The researcher's computer | The researcher's SSH configuration; prompts appear in VS Code | One `ssh … bash -l` per host over a control master (`ControlPersist=600`, except on Windows) |
| Airavata, Jupyter sessions | The Airavata host | The SSH key the researcher uploaded; password and MFA prompts answered in a browser terminal | One control master per user and host, held until it drops or the session server restarts (`ControlPersist=no`) |
| Airavata, batch runs | The Airavata host | The cluster configuration's key only | A new connection per staging, upload and `sbatch` step; host key not checked |

Background commands never raise a prompt (`BatchMode=yes`). Session traffic does not pass through SSH, so a dropped
connection does not affect running jobs.

1. If SSH to the login nodes is restricted by source address, allow the Airavata host: Jupyter and batch
   connections come from it, not from the researcher's computer.
2. For batch runs, let the cluster configuration's login user log in with its key alone. Where the login nodes
   require MFA for every login, exempt that account, for example in an `sshd_config` `Match User` block. That user
   needs `sbatch`, on `PATH` or in the cluster's registered Slurm location, and SCP access to the configuration's work
   root for job scripts, inputs and outputs.
3. Put the commands in [Requirements](../planning/requirements.md#login-node), and `scp` for batch runs, on the `PATH`
   of a non-interactive SSH command. Airavata runs `ssh <host> sh -s` without a login shell, so it does not see paths
   added by login profiles or `module load`; CS Bridge runs `bash -l` and sees the login `PATH`. To confirm, run this
   as a test user from another machine; no output means every command was found:

   ```bash
   ssh <login node> sh -s <<'EOF'
   for c in sacctmgr sinfo sbatch squeue sacct scancel srun curl scp tar base64 od install printenv sed sort; do
     command -v "$c" >/dev/null || echo "missing: $c"
   done
   EOF
   ```

4. Make `$HOME` the same filesystem on login and compute nodes. Linkspan is written from the login node and run on
   a compute node. To confirm, create a file in a test user's home on the login node and list it with
   `srun --partition=<partition> ls "$HOME/<file>"`.

## Network egress

No node needs an inbound port. Allow outbound HTTPS from the login and compute nodes to the hosts in
[Requirements](../planning/requirements.md#network-egress), with direct egress or NAT on compute nodes, since the link
transport ignores `HTTPS_PROXY`.

To confirm, request a session endpoint of Airavata from a compute node (substitute your host name if you host your
own):

```bash
srun --partition=<partition> curl -sS -o /dev/null -w '%{http_code}\n' https://jupyterapi.cybershuttle.org/api/v1/sessions
```

`401` means the node reached Airavata, which refuses the request without a sign-in; `000` with a time-out or
name-resolution error means the connection was blocked.

## Slurm policy for interactive sessions

Each VS Code or Jupyter session is one batch job that runs Linkspan for the session's lifetime. Slurm, and any submit
filter, sees these directives:

| Directive | Value |
|---|---|
| `--nodes`, `--ntasks` | `1`, `1` |
| `--cpus-per-task`, `--mem` | As requested; Airavata requires at least 2 CPUs and 4096 MB for Jupyter sessions |
| `--time` | As requested |
| `--partition`, `--account` | As chosen by the user from `sinfo` and the user's `sacctmgr` associations |
| `--gres` | `gpu:<type>:<count>` or `gpu:<count>` when a GPU is requested |
| Job name | `linkspan-session` (VS Code), `cs-<session id>-<run>` (Jupyter) |

Airavata checks that the account is one of the user's associations, `sinfo` listed the partition, and the request
fits one of its nodes; it does not check `MaxTime`, QOS or association limits. Both clients then run
`sbatch --test-only` and show the user Slurm's answer, including any submit-filter message.

Bound sessions through the partition and QOS:

1. Give sessions a partition or QOS whose limits suit interactive use: `MaxWall`, `MaxJobsPerUser`, `MaxTRESPerUser`.
2. Set `EnforcePartLimits=ALL` in `slurm.conf` and `Flags=DenyOnLimit` on the QOS. Without them a request over the
   limits stays pending with no explanation.
3. To restrict or route sessions, match the job script, not the job name: Jupyter's job name is absent during
   validation. Both clients' scripts assign `LINKSPAN_BIN=`. A `job_submit.lua` that confines sessions to one
   partition:

   ```lua
   function slurm_job_submit(job_desc, part_list, submit_uid)
     if job_desc.script and string.find(job_desc.script, "LINKSPAN_BIN=", 1, true)
         and job_desc.partition ~= "interactive" then
       slurm.log_user("Cybershuttle sessions must use the interactive partition")
       return slurm.ERROR
     end
     return slurm.SUCCESS
   end

   function slurm_job_modify(job_desc, job_rec, part_list, modify_uid)
     return slurm.SUCCESS
   end
   ```

   The message from `slurm.log_user` is what the user sees when validation fails.

## Node sharing

Linkspan's control API listens on `127.0.0.1` without a password, so other users' jobs on the same node can call it;
see [Cluster security](../planning/cluster-security.md#known-limitations). The partition's sharing decides who that is:

| Partition setting | Who else runs on the node | Cost |
|---|---|---|
| Default sharing | Any user's jobs | None; the exposure applies |
| `ExclusiveUser=YES` | The same user's jobs | Some idle cores |
| `OverSubscribe=EXCLUSIVE` | No other job | A whole node charged for a session that may ask for 2 CPUs |

To use `ExclusiveUser=YES`, set it on the partition line in `slurm.conf`, such as `PartitionName=interactive Nodes=… ExclusiveUser=YES`, and run
`scontrol reconfigure`. On shared nodes, mounting `/proc` with `hidepid=2` also hides the Dev Tunnel host token that
appears on a command line.

The job script unsets `TMPDIR` and `XDG_RUNTIME_DIR`, so sessions write temporary files to the node's `/tmp`, and CS
Bridge installs the VS Code server in `/tmp/cs-vscode/<session id>`. Nothing removes these files; a per-job `/tmp`
(the `job_container/tmpfs` plugin) or an epilog that cleans `/tmp` keeps nodes from filling.

## Usage readings

The clients show live CPU, memory and GPU use, sampled inside the job. Each reading needs the following; a session
runs without them:

| Reading | Source | Needs |
|---|---|---|
| Memory | `memory.current` of the job's cgroup | cgroup v2 and `ProctrackType=proctrack/cgroup` or `TaskPlugin=task/cgroup`, giving a `job_<id>` cgroup; memory controller on |
| CPU | `usage_usec` in the job cgroup's `cpu.stat` | As above; CPU controller on |
| GPU | `nvidia-smi --query-gpu=index,utilization.gpu,memory.used,memory.total` | `nvidia-smi` on the job's `PATH`; with `ConstrainDevices=yes` it reports only the job's GPUs |

A reading that cannot be taken is left empty; non-NVIDIA GPUs have none.

## Home-directory space

Apart from the temporary files under [Node sharing](#node-sharing), Cybershuttle writes only under `~/.cybershuttle` in
each user's home, which counts against the home quota:

| Path | Written by | Contents |
|---|---|---|
| `bin/linkspan` | Either client, from the login node | The Linkspan binary |
| `bin/uv`, `python/`, `cache/uv/` | Linkspan, first Jupyter session | uv, a Python 3.12 installed by uv unless it finds one, and uv's package cache |
| `jupyter-env/` | Linkspan, first Jupyter session | The environment of Jupyter Server, `jupyter-server-terminals` and `ipykernel` |
| `bin/devtunnel` | Linkspan, first Dev Tunnel session | Microsoft's `devtunnel` CLI |
| `bin/ttyd` | Linkspan, first terminal | ttyd 1.7.7 |
| `checkpoints/<id>/` | Linkspan, `checkpoint.pause` | CRIU images and `snapshot`, the process's PID and stdio names |
| `sessions/<session id>/workflow.yaml` | Airavata | The workflow a Jupyter session's Linkspan runs |
| `logs/` | Each session job | One `.out` and `.err` per run |

Nothing prunes these files. A user may delete `logs/` at any time; deleting `jupyter-env/` or `bin/linkspan` makes
the next session rebuild it. If the home quota is full, the job exits before Linkspan starts.

## Job e-mail for batch runs

The batch server learns every state change from Slurm's job e-mail, sent as in
[Requirements](../planning/requirements.md#job-e-mail) to a mailbox it reads over IMAP. Without this mail, runs are
accepted but never reported as started or ended.

1. Make `MailProg`, which sends job e-mail from the Slurm controller, deliver to external addresses. To confirm,
   submit `sbatch --mail-type=END --mail-user=<an external address> --wrap=true` and check that the message arrives.
2. Keep Slurm's subject line, `Slurm Job_id=<id> Name=<name> <event>, …`, and the job name, which is the Airavata
   process ID. The batch server reads both from the subject.

A run whose `Ended` or `Failed` message is lost keeps its outputs on the cluster. The batch server cannot cancel a
batch job; only `scancel` on the cluster can.

## Verify the setup

Run these checks in order with a test account that has an association on the cluster.

1. Start a session from [CS Jupyter](/jupyter) or
   [CS Bridge](../vscode/getting-started.md) on the partition sessions should use. Validation shows Slurm's answer; a
   refusal from your filter confirms that the filter is applied.
2. Find the job:

   ```bash
   squeue --user=<test user> --format="%i %j %T %P %N %L"
   ```

   It is named `cs-<session id>-<run>` (Jupyter) or `linkspan-session` (VS Code).
3. On the job's node, as root or in a shell from `srun --jobid=<jobid> --overlap --pty bash`, confirm the process
   and that nothing listens beyond loopback:

   ```bash
   ps -u <test user> -o pid,args | grep '[.]cybershuttle/bin/linkspan'
   ss -ltnp | grep -E 'linkspan|python'
   ```

   Linkspan's and Jupyter Server's listeners are all on `127.0.0.1`.
4. Confirm the job has its own cgroup and, as the test user on a GPU partition, that `nvidia-smi` runs in the job:

   ```bash
   cat /proc/<linkspan pid>/cgroup    # 0::/…/job_<jobid>/…
   srun --jobid=<jobid> --overlap nvidia-smi
   ```

5. Read `~/.cybershuttle/logs/` in the test user's home. The `.err` file names any host the node could not reach,
   which points at a missing [egress](#network-egress) rule.
6. Stop the session in the client. The job has ended, and its accounting record shows what the session consumed:

   ```bash
   sacct --jobs=<jobid> --format=JobID,JobName,Partition,Account,State,Elapsed,TotalCPU,MaxRSS
   ```

7. For batch runs, launch a short test run. The Slurm controller's mail log shows its `Began` and `Ended` messages
   leaving for the batch server's mailbox, and the run's batch job statuses then show both events.

If a step fails, [Troubleshooting](../operating/troubleshooting.md) lists the causes.
[Visibility and control](../operating/visibility-and-control.md) covers watching and limiting sessions in use.

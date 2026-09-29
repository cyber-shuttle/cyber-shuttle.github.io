---
title: Linkspan workflow format
description: Linkspan workflow documents, their triggers, steps and actions, and how a workflow ends the job.
---

# Linkspan workflow format

A **workflow** is a YAML document of steps that Linkspan runs at set points in the job's life. It does from a file what
a client would do over the [HTTP API](./linkspan-http-api.md), with no client connected. Airavata uses one to start
Jupyter; [Checkpoint/Restore](./checkpoint-restore.md) uses one to checkpoint a process before the walltime.

Pass the document with `--workflow <file>`; Linkspan loads one document per process. The code is
`subsystems/workflow/workflow.go`. The document shape Airavata writes is a frozen contract
([Compatibility](./linkspan-development.md#compatibility)).

## Document

```yaml
name: <label, optional>
tasks:                 # required; at least one trigger
  - on: start          # start (default), ready, stop, SIGUSR1, SIGUSR2 or SIGHUP
    steps:             # required; at least one
      - name: <label, shown in the log>
        ref: <id>      # optional; the ID of the server or process the step creates
        action: <shell.exec or <subsystem>.<verb>>
        params: {...}  # the matching route's request body
```

Each entry of `tasks` is a **trigger**: a **moment** (`on`) and the steps to run at it. Several triggers may name the
same moment; their steps run in document order. A step's `ref` is passed to its action as the `ref` parameter.

Linkspan validates the document at startup, before anything binds. It refuses an unknown moment, field or action, an
empty `tasks` list, and a trigger without steps, and exits `1`. A step's `params` are not checked until the step runs. The messages are listed under
[Configuration › Validation](./linkspan-configuration.md#validation).

## Moments

`start` and `ready` hold the job's work, and the job ends when both are complete. `stop` and the signals react to
events.

| Moment | Runs when |
|---|---|
| `start` | The listeners, usage sampler and transports have started |
| `ready` | The `start` run is complete, including every server and process it started having ended |
| `stop` | Linkspan has received `SIGINT` or `SIGTERM`, or a task has failed; before teardown, with the API still up |
| `SIGUSR1`, `SIGUSR2`, `SIGHUP` | Each time the signal arrives |

Linkspan subscribes only to the signals the document names. Without a trigger, `SIGUSR1` and `SIGUSR2` are ignored and
`SIGHUP` ends Linkspan at once ([Configuration › Signals and exit codes](./linkspan-configuration.md#signals-and-exit-codes)).

Slurm sends a signal ahead of the walltime when the job script asks for one: `#SBATCH --signal=B:USR1@120` sends
`SIGUSR1` two minutes before. `B:` sends it to the batch shell only, so start Linkspan with `exec`.

A `stop` trigger holds steps that must run whenever Linkspan stops in an orderly way, such as copying results. It does
not run when Linkspan is killed outright.

## Actions

`params` is the matching route's [request body](./linkspan-http-api.md#routes), and the step succeeds on the route's
`2xx` answers. The `select`, `start` and `stop` actions of a subsystem's sessions map to
`GET`, `POST` and `DELETE …/{id}` on `/<subsystem>/sessions`; every other action maps to `POST /<subsystem>/<verb>`,
and `shell.exec` to `POST /workflow/shell/exec`.

| Action | Does | `params` |
|---|---|---|
| `shell.exec` | Runs `command` under `sh -c`; answers when it ends | `command` |
| `vscode.sessions.select` | Lists SSH servers | |
| `vscode.sessions.start` | Starts an SSH server for one key | `authorized_key` |
| `jupyter.setup` | Builds the Jupyter environment ahead of the first server | |
| `jupyter.sessions.select` | Lists Jupyter servers | |
| `jupyter.sessions.start` | Starts a Jupyter server | `root_dir`, `addr`, `token` |
| `jupyter.sessions.stop` | Stops a task by ID | `id` |
| `terminal.sessions.select` | Lists terminals | |
| `terminal.sessions.start` | Starts a web terminal | `cwd` |
| `terminal.sessions.stop` | Stops a task by ID | `id` |
| `filesystem.mount`, `filesystem.copy`, `filesystem.sync` | Fails: `400` without its params, else `501` | `source`, `target` |
| `filesystem.unmount` | As above | `target` |
| `checkpoint.pause` | Checkpoints a running process with CRIU and ends it | `id` |
| `checkpoint.resume` | Resumes a checkpoint under the same ID; answers when it ends | `id` |

The `filesystem` actions are ongoing work.

Without a `ref`, Linkspan assigns the ID. IDs share one namespace across kinds, so a repeated `ref` replaces the
earlier task. The exception is `vscode.sessions.start`, which answers with an SSH server already running under that `ref`.

## Runs

A **run** is one moment's steps executed once.

- Steps run in order. A status outside `2xx` fails the run, and a failed run is fatal: Linkspan logs
  `fatal: workflow: step <n> (<name>): <action>: <status> <error>`, runs the `stop` steps and exits `1`.
- After its steps, a run **waits on every server and process its steps started**, found by the `id` in each step's
  response. A `start` run that starts a Jupyter server therefore completes only when that server ends, and `ready`
  runs only then. An SSH server stops only with Linkspan or a stop by ID, so a run that starts one with
  `vscode.sessions.start` waits until then.
- A step answered `202`, from a process that a pause ended, ends that moment's run. Later steps of every trigger at
  that moment are skipped; the run still waits on what earlier steps started.
- Once `start` and `ready` both complete, Linkspan logs `workflow: start and ready done, ending the job` and sends
  itself `SIGTERM`, which runs the `stop` steps. A job therefore ends with its payload or its servers.
- A document whose `start` and `ready` steps are absent or start nothing that lasts ends the job as soon as those
  steps finish. Without `--workflow`, Linkspan runs until it is signalled.
- Signal triggers run one at a time, but may run alongside `start` and `ready`.
- Each step logs `workflow: [<i>/<n>] "<name>" on <moment>`, then `workflow: <action>: <response JSON>`.

## Examples

### Starting Jupyter, as Airavata does

```yaml
name: cs-session
tasks:
  - on: start
    steps:
      - name: Start Jupyter Server
        action: jupyter.sessions.start
        params:
          root_dir: "/home/alice/project"
          addr: "127.0.0.1:31338"
```

The token comes from `JUPYTER_TOKEN` in the job's environment. The `start` run waits on the server, so the job lives
as long as the server does.

### Checkpointing across jobs

[Checkpoint/Restore](./checkpoint-restore.md) has the complete example, `train.yml` and `resume.yml`.
When `checkpoint.pause` ends the process on `SIGUSR1`, the `shell.exec` step answers `202`, the `start` run ends, and
Linkspan ends the job. A Jupyter server started alongside would keep the `start` run waiting until it ends.

### Exercising every moment locally

`examples/workflow.yml` in the repository logs a line at each moment, builds the Jupyter environment on `start`, and
starts a Jupyter server on `ready`. Run it with `./linkspan --port 8080 --workflow examples/workflow.yml`, send
`kill -USR1 <pid>`, then press Ctrl-C to see the `stop` step.

| Example in the repository | Shows |
|---|---|
| `examples/workflow.yml` | Each moment against a local Linkspan |
| `examples/checkpoint.yml` | A payload paused on `SIGUSR1` |
| `examples/restore.yml` | The next job, resuming it |
| `examples/checkpoint.sh` | One checkpoint job and three resumes, on Linux with CRIU or in Docker from macOS; checks the payload's count is whole |

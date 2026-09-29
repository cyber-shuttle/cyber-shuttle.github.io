---
title: Linkspan configuration
description: Linkspan's flags, environment variables, validation errors, files, signals and exit codes.
---

# Linkspan configuration

This page lists everything that configures a Linkspan process, for writing a job script or a launching client, or
reading a log line that begins `fatal:`. Flags are registered in `main.go`; transport arguments are parsed in
`internal/tunnel/link` and `internal/tunnel/devtunnel`.

## Flags

Flags use Go's `flag` package: `-x` and `--x` are equivalent, and a value may be given as `--flag=v` or `--flag v`.

| Flag | Default | Description |
|---|---|---|
| `--port` | `8080` | Control port, the API's TCP port on `127.0.0.1`; `0` picks a free one |
| `--socket` | | Unix socket that also serves the API, mode `0600`; alone, it replaces the port |
| `--workflow` | | [Workflow](./linkspan-workflow-format.md) YAML file |
| `--tunnel-enable` | `false` | Carry the API off the node over `--tunnel-mode` |
| `--tunnel-mode` | | `link`, `devtunnel` or both, comma-separated |
| `--tunnel-link-args` | | `"--url <ws or wss URL>"` of Airavata's link endpoint |
| `--tunnel-devtunnel-args` | | `"--id <Dev Tunnel id> --cluster <Dev Tunnels region>"` |
| `--version` | | Print the version and exit |
| `-h`, `--help` | | Print the flag list to stderr and exit `0` |

`--tunnel-mode` is required with `--tunnel-enable`, and each transport's args with that transport; each is refused
without the other ([Validation](#validation)). The transport arguments are themselves flags, parsed the same way:
`--tunnel-link-args="--url=wss://…"` is valid.

`--version` prints a bare `X.Y.Z` or `X.Y.Z.<commit>` as the only line on stdout. A plain `go build` reports `dev`,
which Airavata's version check refuses.

## Listeners

The API asks for no credential, so the listener is the access control: a loopback port admits every user on the node,
the socket only the job's user. On a shared node, prefer `--socket`.

| Listener flags | Listens on |
|---|---|
| Neither | `127.0.0.1:8080` |
| `--port` | `127.0.0.1:<port>` |
| `--socket` | The socket only |
| Both | Both, with the same routes |

Each listener logs `http: listening on <addr>`; with `--port 0` the line names the chosen port. Servers log the same
line under their kind (`sshd`, `jupyter`, `terminal`). At the `--socket` path, Linkspan replaces any existing socket,
even one another process still serves, and refuses any other file. It removes the socket on exit.

A Unix socket connects only on its node. A caller elsewhere in the cluster reaches it through a job step:

```bash
srun --jobid=<job id> --overlap curl --unix-socket ~/.cybershuttle/linkspan.sock http://localhost/api/v1/usage
```

The `devtunnel` transport carries only the control port. With `--socket` alone it starts, but nothing answers through
the tunnel; give it a `--port`.

## Environment

Linkspan reads these variables from the environment it is started in. An empty token is refused.

| Variable | Read by |
|---|---|
| `LINKSPAN_LINK_TOKEN` | The `link` transport, which offers it as the WebSocket subprotocol `link.<token>`; required with `link` |
| `LINKSPAN_TUNNEL_HOST_TOKEN` | The `devtunnel` transport, which passes it as `--access-token` to `devtunnel host`; required with `devtunnel` |
| `JUPYTER_TOKEN` | `jupyter.sessions.start`, as the token when the request names none |
| `SHELL` | Terminals, as the shell `ttyd` runs (default `sh`) |
| `HOME` | Locating `~/.cybershuttle` |
| `PATH` | Finding `sh`, `curl`, `nvidia-smi` and `criu` |
| `HTTPS_PROXY`, `NO_PROXY` | Linkspan's own downloads of the `devtunnel` CLI and `ttyd`; the link ignores them and dials directly |

Every child process, including Jupyter kernels and SSH commands, inherits Linkspan's whole environment.

`CS_LINK_URL`, `CS_CONTROL_PORT`, `CS_DEVTUNNEL_ID` and `CS_DEVTUNNEL_CLUSTER` are not read by Linkspan;
Airavata's job script expands them into flags.

## Files

Linkspan writes only under `~/.cybershuttle/`. Downloads are staged as `<file>.part` and renamed into place; HTTPS is
their only verification. A file already present is never fetched again; delete it to force a new download.

| Path | Contents | Written |
|---|---|---|
| `bin/uv`, `python/`, `cache/uv/`, `jupyter-env/` | `uv`, the Python 3.12 it downloads when needed, its cache, and the Jupyter environment | By the first Jupyter setup |
| `bin/devtunnel` | Microsoft's CLI | On first use of the `devtunnel` transport |
| `bin/ttyd` | ttyd 1.7.7 | On the first terminal |
| `checkpoints/<id>/` | CRIU images and `snapshot`, the process's PID and stdio names | By `checkpoint.pause` |

The clients write `bin/linkspan`, `logs/` and `sessions/<id>/workflow.yaml`;
[Home-directory space](/setting-up/preparing-the-cluster#home-directory-space) lists every file.

## Validation

Flags, transports and the workflow are validated before anything binds. A failure logs `fatal: <message>` and exits
`1`.

| Condition | Message |
|---|---|
| `--tunnel-enable` without `--tunnel-mode`, or the reverse | `--tunnel-mode is required with --tunnel-enable and refused without it` |
| `--tunnel-mode` names an unknown, empty or repeated transport | `--tunnel-mode: "<x>" is not link or devtunnel, or is repeated` |
| A listed transport without its args, or args for an unlisted one | `--tunnel-<name>-args is required with --tunnel-mode=<name> and refused without it` |
| Link args other than one `--url` with a `ws` or `wss` scheme and a host | `--tunnel-link-args needs only --url, a ws or wss URL` |
| No link token | `LINKSPAN_LINK_TOKEN is required with the link transport` |
| Dev Tunnel args other than a non-empty `--id` and `--cluster` | `--tunnel-devtunnel-args needs only --id and --cluster` |
| No host token | `LINKSPAN_TUNNEL_HOST_TOKEN is required with the devtunnel transport` |
| Unreadable workflow file | `workflow: read: <err>` |
| Invalid YAML or an unknown field | `workflow: parse: <err>` |
| No triggers | `workflow: no tasks` |
| Unknown moment | `workflow: trigger <n>: unknown "<on>"` |
| A trigger without steps | `workflow: trigger <n>: no steps` |
| Unknown action | `workflow: trigger <n> (<step name>): unknown action "<action>"` |
| A listener cannot bind: port in use, or a non-socket file at the socket path | `tasks: listen: <err>` |

An unknown flag prints the error and the flag list to stderr and exits `2`.

## Lifecycle

A Linkspan process runs through five stages:

1. Validate flags, transports and the workflow.
2. Start tasks: one HTTP listener per address, the usage sampler, one task per transport, then the workflow.
3. Run until `SIGINT` or `SIGTERM`, or the first fatal task error, logged as `fatal: <task id>: <err>`.
4. Run the workflow's `stop` trigger, with the API still up.
5. Cancel every task and wait for it; each child's process group receives `SIGKILL`. Log `stopped` and exit.

Only some task failures end the process at stage 3:

| Failure | Fatal |
|---|---|
| A transport | No: logs `<transport>: <err>` and redials |
| A workflow step, a listener, an SSH server | Yes |
| A Jupyter server, terminal or process | No: recorded in its state |

## Signals and exit codes

Slurm delivers signals to the job: `SIGTERM` when the job is cancelled or reaches its walltime, and the signal named in
`#SBATCH --signal` ahead of the walltime.

| Signal | Effect |
|---|---|
| `SIGINT`, `SIGTERM` | Graceful: `stop` steps, teardown, exit `0` |
| `SIGUSR1`, `SIGUSR2` | Runs the workflow's trigger for that signal; ignored without one |
| `SIGHUP` | Runs the workflow's trigger for it; without one, ends Linkspan at once with no `stop` steps or teardown, and child processes survive in their own process groups |

When Linkspan is the job's main process, its exit code is the job's:

| Exit code | When |
|---|---|
| `0` | A graceful signal, `--version` or `--help` |
| `1` | A validation or listen error, a fatal task error, or a failing workflow step, including a `stop` step |
| `2` | An unknown flag or a malformed flag value |

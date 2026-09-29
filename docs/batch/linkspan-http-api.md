---
title: Linkspan HTTP API
description: Every Linkspan /api/v1 route, its request and response, and the server and process objects it returns.
---

# Linkspan HTTP API

This page lists every route Linkspan serves under `/api/v1` and the objects it returns, for client authors and anyone
driving Linkspan with `curl`. The routes are declared in
`main.go` and in each package under `subsystems/`. Every route except `/health`, `/usage` and `/forward` is also a
workflow [action](./linkspan-workflow-format.md#actions) whose `params` are the route's request body.

| Reached | Base URL |
|---|---|
| On the compute node | `http://127.0.0.1:<control port>` |
| Over a socket listener | `http://localhost`, with `curl --unix-socket <path>` |
| Through a Dev Tunnel | `https://<id>-<port>.<region>.devtunnels.ms` |

[Running Linkspan by hand](./running-linkspan-by-hand.md) has a worked call for most routes.

## Conventions

These hold for every route except `/forward`, all handled by `internal/router`:

| Aspect | Behaviour |
|---|---|
| Authentication | None: reaching the port or socket is the authorization (see [Access control](./linkspan-architecture.md#access-control)) |
| Request body | A JSON object, or empty; the path's `{id}` is added to it as `id` |
| Body errors | `400` for a body that is not a JSON object, `413` over 64 KB |
| Parameter types | A parameter of the wrong JSON type is treated as absent; values such as Jupyter's `addr` and `ref` are not otherwise validated |
| Error body | `{"error": "<message>"}` |
| Content type | `application/json`, except the plain-text `404` and `405` Go writes for unregistered paths and methods; `/forward`'s `404` is JSON too |
| Timeouts | Request headers within 10 seconds; no write timeout, so `shell/exec` and `checkpoint/resume` hold the request until the process ends |
| `ref` | The ID for the server or process the request creates; without one Linkspan assigns it. Lets a client find or replace what it started. A `ref` equal to any existing task's ID replaces that task, except for [SSH servers](#vs-code-ssh) |

## Routes

The Request column lists the body's fields, all strings. A field is optional unless the Answers column gives an error
for its absence.

| Method | Path | Request | Answers |
|---|---|---|---|
| `GET` | `/api/v1/health` | | `200 {"status":"ok"}` |
| `GET` | `/api/v1/usage` | | `200` with the latest [sample](#usage); `{}` before the first |
| `GET` | `/api/v1/forward/{port}` | WebSocket upgrade | Carries one TCP connection to the port; see [Forward](#forward) |
| `POST` | `/api/v1/workflow/shell/exec` | `{"command", "ref"}` | When the process ends, as below; `400` without `command` |
| `GET` | `/api/v1/vscode/sessions` | | `200` with a list of SSH [server objects](#servers) |
| `POST` | `/api/v1/vscode/sessions` | `{"authorized_key", "ref"}` | `201 {"id":"s-<port>","bind_port":<port>}`; `200` when `ref` names a running SSH server; `400` for a missing or invalid key, or one with options |
| `POST` | `/api/v1/jupyter/setup` | | `200 null` once the environment is built; `500 {"error":"<step>: <err>"}` |
| `GET` | `/api/v1/jupyter/sessions` | | `200` with a list of Jupyter server objects |
| `POST` | `/api/v1/jupyter/sessions` | `{"root_dir", "addr", "token", "ref"}` | `201` with the server object, in state `starting`; `500` if `addr` cannot be bound |
| `DELETE` | `/api/v1/jupyter/sessions/{id}` | | `200 {"id":"<id>","state":"stopped"}`; `404` for an unknown ID |
| `GET` | `/api/v1/terminal/sessions` | | `200` with a list of terminal server objects |
| `POST` | `/api/v1/terminal/sessions` | `{"cwd", "ref"}` | `201` with the server object; `501` on a platform other than Linux `amd64` or `arm64` |
| `DELETE` | `/api/v1/terminal/sessions/{id}` | | `200 {"id":"<id>","state":"stopped"}`; `404` for an unknown ID |
| `POST` | `/api/v1/filesystem/mount`, `/copy`, `/sync` | `{"source", "target"}` | `400` for a missing parameter, else `501` |
| `POST` | `/api/v1/filesystem/unmount` | `{"target"}` | `400` for a missing parameter, else `501` |
| `POST` | `/api/v1/checkpoint/pause` | `{"id"}` | `200 {"id","dir"}` once written; `404` if no such process is running; `500` with CRIU's error; `501` without `criu` |
| `POST` | `/api/v1/checkpoint/resume` | `{"id"}` | When the resumed process ends, as below; `404` without a checkpoint; `501` without `criu` |

`shell/exec` and `checkpoint/resume` answer when the process ends:

| Answer | When |
|---|---|
| `200` with the [process object](#processes) | It exited with status 0 |
| `202` with the process object | A pause ended it |
| `500` with its error | Otherwise |

`criu` is looked up on `PATH`. Lists are ordered by ID and are `[]` when empty. An empty `root_dir` or `cwd` means
Linkspan's working directory. The routes keep the `/sessions` path for history; what they start are servers.

The two `DELETE` routes stop any task by ID, whatever its kind, including a process, a transport or a listener;
Linkspan keeps running without a stopped listener. Stopping a server or process sends `SIGKILL` to its process group.

## Usage

```json
{
  "memBytes": 2147483648,
  "cpuUsageUsec": 295339339,
  "gpus": [{ "index": 0, "utilPct": 40, "memUsedMiB": 1024, "memTotalMiB": 40960 }]
}
```

A background task samples at start and every five seconds after; the route answers from the last sample.

| Field | Source |
|---|---|
| `memBytes` | `memory.current` of the job's cgroup v2 |
| `cpuUsageUsec` | `usage_usec` in `cpu.stat` of the job's cgroup; cumulative, so the difference between samples gives a rate |
| `gpus` | `nvidia-smi --query-gpu=index,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits` |

The job's cgroup is the `0::` entry of `/proc/self/cgroup` with Slurm's `/step_…` suffix removed. A source that cannot
be read omits its field, so macOS and nodes without `nvidia-smi` return fewer fields.

## Servers

Jupyter, SSH and terminal servers share one object and one lifecycle. A Jupyter or terminal server is `starting` when
its request answers; poll the list until its `state` is `running`. An SSH server is `running` before the
reply.

```json
{ "id": "j-41235", "addr": "127.0.0.1:41235", "state": "running", "error": "", "root_dir": "/home/me", "token": "…" }
```

| Field | Meaning |
|---|---|
| `id` | `ref`, or the kind's initial and the port: `s-<port>`, `j-<port>`, `t-<port>` |
| `addr` | The loopback address the server listens on |
| `state` | See below |
| `error` | Why the server failed; empty otherwise |
| `root_dir`, `token` | Jupyter only |
| `cwd` | Terminals only |

| State | Meaning |
|---|---|
| `starting` | Launched; its port does not yet accept connections |
| `running` | Its port accepts connections |
| `exited` | Ended with status 0 |
| `failed` | Ended otherwise, or never started; `error` says why |

A missing folder or failed setup fails the server, not the request. A server that has ended stays listed until it is
stopped or replaced, or until a workflow run waiting on it removes it. Servers bind loopback and are reached through
`/api/v1/forward` or the link.

### VS Code (SSH)

One SSH server per key, on a loopback port, admitting only that public key:

- A key with `authorized_keys` options is refused with `400`, since the server would ignore the options.
- The port accepts connections before the reply.
- A `ref` that names a running SSH server is answered `200` with that server, whatever key the request names;
  concurrent requests with one `ref` start one server. Airavata and CS Bridge name each key's server
  `ssh-<key hash>`.
- Each server generates a new RSA host key when it starts.
- Commands run as `sh -c <command>`, or `sh -s` without one, with Linkspan's environment. PTYs are refused.
- Local forwarding (`direct-tcpip`), Unix-socket forwarding (`direct-streamlocal@openssh.com`) and the `sftp`
  subsystem are supported; reverse forwarding is not.
- The exit status is the child's own; `255` when it was killed by a signal; `127` only when the command could not run.

There is no route that stops an SSH server; it stops with Linkspan.

### Jupyter

`jupyter.setup` builds the environment. Only one setup runs at a time, and each step is idempotent:

1. Install `uv` with `curl -LsSf https://astral.sh/uv/install.sh | sh`, unless `~/.cybershuttle/bin/uv` exists.
2. `uv venv --allow-existing --python 3.12 ~/.cybershuttle/jupyter-env`.
3. `uv pip install jupyter-server ipykernel jupyter-server-terminals` into that environment.

`UV_UNMANAGED_INSTALL=~/.cybershuttle/bin`, `UV_CACHE_DIR=~/.cybershuttle/cache/uv` and
`UV_PYTHON_INSTALL_DIR=~/.cybershuttle/python` keep all of it under `~/.cybershuttle`.

Every server start runs setup, so `uv` checks the environment each time, then runs in `root_dir`:

```bash
<env>/bin/python -m jupyter_server --no-browser --ip=127.0.0.1 --port=<port> --port-retries=0 \
  --ServerApp.allow_origin=* --ContentsManager.allow_hidden=True
```

`JUPYTER_TOKEN` is the request's `token`, else the `JUPYTER_TOKEN` Linkspan inherited, else a new random token
(32 bytes, base64url). `addr` fixes the port; the server always binds `127.0.0.1`. It is a stock Jupyter Server with
no bundled interface; the client supplies the JupyterLab interface.

### Terminals

Each terminal runs in `cwd`:

```bash
ttyd -p <port> -i 127.0.0.1 -W ${SHELL:-sh} -l
```

ttyd 1.7.7 is downloaded from its GitHub release on first use; `-W` makes the terminal writable.
Terminals run on Linux `amd64` and `arm64` only. ttyd has no authentication of its own.

## Processes

`shell.exec` runs `command` under `sh -c`, with Linkspan's stdout and stderr, as a task with ID `ref`, or
`p-<Unix time in nanoseconds>` without one. A `ref` naming an existing process replaces it. The process object adds
`pid` and `command`:

```json
{ "id": "trainloop", "addr": "", "state": "exited", "error": "", "pid": 4242, "command": "sh -c python train.py" }
```

A process is `starting` until it has started, then `running`; it ends `exited` on status 0, else `failed`. Once it
ends it is removed from the registry. No route lists processes, so only the request that started one reports its end.
Give it a `ref` if anything else must name it, as `checkpoint.pause` must.

`checkpoint.pause` checkpoints a running process:

1. `criu dump` writes the process tree into `~/.cybershuttle/checkpoints/<id>.part`, with a `snapshot` file recording
   the PID and the names of its stdout and stderr.
2. The folder replaces `~/.cybershuttle/checkpoints/<id>`, so a failed dump leaves the earlier checkpoint intact.
3. The process ends, and the request or step waiting on it answers `202`.

`checkpoint.resume` runs `criu restore` as a new process under the same ID, with the current Linkspan's stdout and
stderr in place of the dumped ones, and answers as `shell.exec` does. CRIU runs with `--shell-job --tcp-established`,
plus `--unprivileged` when Linkspan is not root, which needs CRIU 3.18 or newer.

## Forward

`GET /api/v1/forward/{port}` upgrades to a WebSocket and pipes one TCP connection to `127.0.0.1:<port>`, in binary
frames each way; closing either side closes both. A Dev Tunnel client opens one forward per connection to reach an
SSH, Jupyter or terminal server; the link does not need it.

| Answer | When |
|---|---|
| `101` | A task in state `running` is bound to that port: the control port itself, or any SSH, Jupyter or terminal server |
| `404 {"error":"no running server on that port"}` | Nothing running serves the port, or it is not a number |
| `403` | The request has an `Origin` header whose host differs from its `Host` header |
| `400` | The port is served, but the request is not a WebSocket upgrade |

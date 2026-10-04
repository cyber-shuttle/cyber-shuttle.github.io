---
title: Running Linkspan by hand
description: Install Linkspan, start a Jupyter server and an SSH server in a job, and reach them from off the node.
---

# Running Linkspan by hand

This tutorial runs Linkspan by hand inside a Slurm job. You start a Jupyter server and an SSH server through its HTTP
API, reach both, stop Linkspan, and then carry the API off the node over a Dev Tunnel. It takes about fifteen minutes,
most of it the first Jupyter environment build.

[Airavata](/setting-up/airavata-architecture) and [CS Bridge](/vscode/architecture) normally launch Linkspan; doing it
by hand shows whether a cluster can run sessions and where one fails.

## Prerequisites

| Need | For |
|---|---|
| A shell on a Linux compute node in a job, such as `srun --time=01:00:00 --pty bash` | Every step |
| A writable home directory | Every download and build, all under `~/.cybershuttle/` |
| `curl`, and HTTPS from the node to the download hosts below | Downloading Linkspan and building the Jupyter environment |
| The [`devtunnel` CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started) signed in on your laptop, and HTTPS from the node to the Dev Tunnels hosts below | [Reach Linkspan from your laptop](#reach-linkspan-from-your-laptop) |

| Hosts | Needed by |
|---|---|
| `github.com`, `release-assets.githubusercontent.com` | The Linkspan download |
| `astral.sh`, `pypi.org`, `files.pythonhosted.org` | The Jupyter environment |
| `tunnelsassetsprod.blob.core.windows.net`, `devtunnels.ms`, `rel.tunnels.api.visualstudio.com` | The Dev Tunnel |

## Start servers in a job

Run every command in this part in the job's shell on the compute node.

### 1. Download Linkspan

```bash
curl -fsSL https://github.com/cyber-shuttle/linkspan/releases/latest/download/linkspan_Linux_x86_64.tar.gz |
  tar -xz linkspan
./linkspan --version
```

The last command prints the version, for example `0.22.1`. On an `arm64` node use `linkspan_Linux_arm64.tar.gz`.

### 2. Start Linkspan

```bash
./linkspan --port 8080 > linkspan.log 2>&1 &
curl -s http://127.0.0.1:8080/api/v1/health
```

The reply is `{"status":"ok"}`, and `linkspan.log` has a line ending `listening on 127.0.0.1:8080`. Port `8080` is now
the **control port**, the loopback port that serves the whole API. The API asks for no credential; every user on the
node can call it.

If `curl` cannot connect and the log says `fatal: tasks: listen:` with `address already in use`, another process holds
the port. Start Linkspan with another `--port`, or with `--port 0` and read the chosen port from the log. Use that port
in the commands below.

### 3. Start a Jupyter server

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/jupyter/sessions \
  -H 'Content-Type: application/json' -d "{\"root_dir\": \"$HOME\"}"
```

The reply is the server object, in state `starting`:

```json
{"addr":"127.0.0.1:41235","error":"","id":"j-41235","root_dir":"/home/me","state":"starting","token":"Xq3…"}
```

Linkspan then builds the Python environment under `~/.cybershuttle/`; the first build takes a few minutes, and
`linkspan.log` shows the `uv` output. Poll the list until `state` is `running`:

```bash
curl -s http://127.0.0.1:8080/api/v1/jupyter/sessions
```

A `state` of `failed` carries the reason in `error`, most often a download host the node cannot reach.

Once it is `running`, query the server itself with the `addr` and `token` from the reply:

```bash
curl -s -H 'Authorization: token <token>' http://127.0.0.1:41235/api/status
```

Jupyter Server answers with a JSON object carrying `started` and `kernels`.

### 4. Start an SSH server

Each SSH server admits exactly one public key, named when it is started. Make a throwaway key and ask Linkspan for a
server that admits it:

```bash
ssh-keygen -q -t ed25519 -N '' -f ~/linkspan-demo
curl -s -X POST http://127.0.0.1:8080/api/v1/vscode/sessions \
  -H 'Content-Type: application/json' \
  -d "{\"authorized_key\": \"$(cat ~/linkspan-demo.pub)\"}"
```

The reply names the SSH server's loopback port, which already accepts connections:

```json
{"bind_port":41237,"id":"s-41237"}
```

Run a command through it:

```bash
ssh -i ~/linkspan-demo -p 41237 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no 127.0.0.1 hostname
```

It prints the compute node's host name. The options skip recording the host key, which is new on every start. The
server refuses PTYs, so always pass a command.

### 5. Read the job's usage

```bash
curl -s http://127.0.0.1:8080/api/v1/usage
```

The reply is the latest five-second sample of the job's cgroup, for example
`{"memBytes":2147483648,"cpuUsageUsec":295339339}`, with `gpus` added on a node with `nvidia-smi`.

### 6. Stop Linkspan

```bash
kill %1
tail -n 2 linkspan.log
```

The log ends with `signal received, stopping` and `stopped`, and every server Linkspan started has stopped. Delete the throwaway key with
`rm ~/linkspan-demo ~/linkspan-demo.pub`.

## Reach Linkspan from your laptop

Compute nodes accept no connections from off the cluster, so Linkspan dials out over a **transport**. The link, the
transport to Airavata, needs credentials only Airavata issues; without Airavata, use a Dev Tunnel that Linkspan hosts.

### 7. Create a Dev Tunnel

On your laptop:

```bash
devtunnel create
devtunnel port create <tunnel ID> -p 8080
devtunnel token <tunnel ID> --scopes host
devtunnel token <tunnel ID> --scopes connect
```

`devtunnel create` prints the tunnel ID, of the form `<id>.<cluster>`, where `<cluster>` is the Dev Tunnels region.
Only the control port is declared; every other server is reached through it.

| Token | Used by |
|---|---|
| **Host token** | Linkspan, to host the tunnel |
| **Connect token** | A client, to reach the tunnel |

### 8. Host the tunnel from the job

In the job, start Linkspan with the host token in its environment:

```bash
LINKSPAN_TUNNEL_HOST_TOKEN=<host token> ./linkspan --port 8080 \
  --tunnel-enable --tunnel-mode=devtunnel --tunnel-devtunnel-args="--id <id> --cluster <cluster>" \
  > linkspan.log 2>&1 &
```

On first use Linkspan downloads the `devtunnel` CLI to `~/.cybershuttle/bin/devtunnel`, then runs `devtunnel host`.
A wrong ID or token shows as `devtunnel: host process exited` repeating in `linkspan.log`, as Linkspan reruns it after
a growing delay.

The host token stays off Linkspan's command line, but the `devtunnel host` command line carries it, where other users
on the node can read it.

### 9. Call Linkspan through the tunnel

On your laptop:

```bash
curl -s -H 'X-Tunnel-Authorization: tunnel <connect token>' \
  https://<id>-8080.<cluster>.devtunnels.ms/api/v1/health
```

The reply is `{"status":"ok"}`, from the compute node. Every other server is reached through the
[`/api/v1/forward/{port}`](./linkspan-http-api.md#forward) WebSocket.

When you have finished, stop Linkspan in the job with `kill %1`. On your laptop, delete the tunnel with
`devtunnel delete <tunnel ID>`.

## Next steps

| To | Read |
|---|---|
| Carry the API over Airavata's link | [The link](./linkspan-architecture.md#the-link) |
| Checkpoint a process before the walltime | [Checkpoint/Restore](./checkpoint-restore.md) |
| Run steps at set points in a job | [Linkspan workflow format](./linkspan-workflow-format.md) |
| Listen on a Unix socket, or see every flag | [Linkspan configuration](./linkspan-configuration.md) |
| See every route and response | [Linkspan HTTP API](./linkspan-http-api.md) |

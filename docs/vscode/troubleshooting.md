---
sidebar_position: 4
title: Troubleshooting
description: Common CS Bridge problems, their causes and fixes.
---

# Troubleshooting

This page lists common CS Bridge problems and their fixes. To look up an exact message, see
[Error messages](./error-messages.md).

## Logs

Two logs show the cause of most problems; read them first.

| Log | Shows | Open it with |
|---|---|---|
| CS Bridge output | Each step the extension takes on your laptop, and each error | **View → Output**, then **CS Bridge** in the drop-down |
| Linkspan job log | What happened inside the job on the compute node | On the cluster: `~/.cybershuttle/logs/linkspan-session-<jobid>.out` and `.err` |

To read the newest job log, log in to the cluster and run:

```bash
cd ~/.cybershuttle/logs && tail -n 50 "$(ls -t *.err | head -1)"
```

A missing job log means the job never started running. Check it with `squeue -u $USER`; a session's job is named
`linkspan-session`.

## Symptoms and fixes

| Symptom | Cause | Fix |
|---|---|---|
| "Session validation failed" on **Add** | Slurm or the site's submit filter refused the job | Read Slurm's message; choose another account, partition or fewer resources |
| Stuck on **Submitting…** | The login node cannot download Linkspan from `github.com` | Check the output log; ask the site whether login nodes have outbound HTTPS |
| Stuck on **Starting Linkspan…** | The compute node cannot reach the Dev Tunnels relay | Read the job's `.err` log; compute nodes need outbound HTTPS to `*.devtunnels.ms` |
| Microsoft sign-in fails | The local network blocks `login.microsoftonline.com` or `*.devtunnels.ms` | Try another network, or ask your IT group |
| `No ptyHost heartbeat`, or the remote window crashes | The job hit its memory limit, which killed the VS Code server | Start a session with more memory |
| The remote window disconnects | The Dev Tunnel connection dropped | Wait about a minute; if the card returns to **Connect**, click it |
| The card shows **Unreachable** | A status check or the connection to the node failed | Wait for the next check, or click **Reconnect**. For `SSH host unreachable`, see below |
| MFA is requested again | The shared SSH connection to the login node closed | Expected; answer in the **SSH Authentication** panel |
| Extensions missing in each new job | The VS Code server is installed afresh for each job | List them in the VS Code setting `remote.SSH.defaultExtensions` |
| Dev Containers errors in the remote window | The extension needs a container runtime the cluster lacks | Disable Dev Containers in that window |
| Slow file transfer | Traffic goes through Microsoft's relay | Use `scp`, `rsync` or Globus through the login node or a data transfer node |

`SSH host unreachable` means a background status check could not log in, because it never shows a login prompt. To log
in again, click **Open Menu** →
**Create New SSH Session** → the cluster. If the form appears without a prompt, click the draft card's refresh icon
(**Refresh Slurm details**). Answer the prompt and close the form; the card recovers at the next check.

## Questions

**How is this different from Remote-SSH alone?** Remote-SSH connects to a host you can already reach. CS Bridge first
gets you a compute node through Slurm and a path to it.

**Why at least 2 CPUs and 4 GB?** Less starves the VS Code server, and Slurm kills it.

**Can someone else connect to my session?** Not through SSH: the node's SSH server accepts only the session's key. On a
shared node, see [Credentials and data](./index.md#credentials-and-data).

## Unlisted problems

For a problem not listed here, search the [issue tracker](https://github.com/cyber-shuttle/CS-Bridge/issues) and open
an issue if none matches. Attach the CS Bridge output and the job's `.out` and `.err` files, and name the cluster.

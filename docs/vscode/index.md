---
sidebar_position: 1
title: VS Code on a compute node
sidebar_label: Overview
description: CS Bridge opens a VS Code window on a Slurm compute node, using your own SSH access and your own allocation.
---

# VS Code on a compute node

**CS Bridge** is a VS Code extension that opens a VS Code window on a Slurm compute node. This page helps a
researcher decide whether to use it.

:status[available] Version 0.2.3 · [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cybershuttle.csbridge)

## How it works

On a Slurm cluster you log in to a shared **login node**. Heavy work runs on **compute nodes**, which Slurm allocates to
a job and which are normally reachable only from inside the cluster. CS Bridge reaches one:

1. You choose a partition, CPUs, memory, GPUs and a walltime in a form. CS Bridge submits a Slurm job through your own
   SSH login.
2. The job runs **Linkspan**, the Cybershuttle agent, which starts an SSH server on the compute node.
3. Linkspan and your laptop each connect outward to a **Dev Tunnel**, a Microsoft relay service, and meet there.
4. Remote-SSH opens the window through that path.

Your editor, terminals, debugger and extensions then run on the allocated node. You need no Cybershuttle account, and
the cluster's staff install nothing. [How it works](/overview/how-it-works) shows the sequence.

A session is an ordinary Slurm job under your user. Your allocation is charged from the moment it starts running until
you press **Stop** or the walltime ends, whether or not a window is open. Closing the VS Code window does **not** stop
the job.

## Suitable uses

| Suited to | Not suited to |
|---|---|
| Developing and debugging code that needs the cluster's GPUs, memory or software | Moving large datasets: the relay carries tens of Mbit/s; use `rsync` or Globus |
| Interactive analysis too heavy for a login node | Unattended runs over 24 hours, the longest walltime offered; submit a [batch job](/batch) |
| VS Code extensions (Python, Jupyter notebooks, C++, Git) on cluster files | Clusters whose compute nodes have no outbound internet access: Linkspan cannot reach the relay |

## Requirements

| Requirement | Notes |
|---|---|
| VS Code 1.101 or newer | Windows, macOS or Linux |
| OpenSSH `ssh` and `ssh-keygen` on `PATH` | Nothing is bundled |
| A Remote-SSH extension | Usually Microsoft's [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh); install it yourself |
| A Microsoft account | Creates the Dev Tunnel; a free account is enough |
| A Slurm cluster you reach with `ssh` | With the login the site already requires, and a Slurm account (allocation) where needed |

CS Bridge is tested on the ACCESS clusters in [Tested clusters](./architecture.md#tested-clusters). Another Slurm
cluster should work if it meets the [cluster requirements](/planning/requirements): its login node can download from `github.com` and its compute nodes
can make outbound HTTPS connections.

## Credentials and data

CS Bridge sends no cluster credential to Cybershuttle or to Microsoft, and collects no analytics.

| Item | Where it lives |
|---|---|
| SSH keys and cluster login | Your laptop only (`~/.ssh`); passwords and MFA replies go to your own `ssh` and are not kept |
| Per-session key for the node's SSH server | Your laptop only; a new key per session, deleted when the session stops |
| Microsoft account token | Your OS keychain, held by VS Code. The job receives only a token that can host that one tunnel |
| Code and terminal traffic | Microsoft's relay, inside SSH, encrypted end to end between laptop and node |
| Your job on the node | Runs as you, with your file permissions. CS Bridge adds `~/.cybershuttle/` (Linkspan and its logs) to your cluster home, and the VS Code server to the node's `/tmp` |

Shared nodes carry one limitation: Linkspan's control API listens on the node's `127.0.0.1` without a password, so
another user with a job on the same node could call it, for example to start an SSH server that runs as you. Where that
matters, ask the site which partitions give a job its own node ([Cluster security](/planning/cluster-security)).

Next, follow [Getting started](./getting-started.md).

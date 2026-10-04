---
sidebar_position: 1
title: Jupyter on a compute node
sidebar_label: Overview
description: CS Jupyter is JupyterLab in your browser whose files, kernels and terminals run on a Slurm compute node.
---

# Jupyter on a compute node

**CS Jupyter** is JupyterLab in your browser, with its files, kernels and terminals on a Slurm compute node. To start
using it, follow [Getting started](./getting-started.md).

:status[available] Version 0.1.1 · [Try it out](https://jupyter.cybershuttle.org) · [Self-hosting](/setting-up/hosting-the-jupyter-site)

## How it works

CS Jupyter keeps the JupyterLab interface in your browser and puts **Jupyter Server**, which reads and writes files
and runs **kernels**, the processes that execute notebook code, on a compute node.

You sign in through **CILogon**, which accepts your institution's credentials, and add the clusters you have accounts
on. When you start a session, Airavata, Cybershuttle's hosted service, logs in to the cluster over SSH as you and
submits a Slurm job. The job runs **Linkspan**, the Cybershuttle agent, which starts Jupyter Server and opens an
outbound connection back to Airavata; your browser reaches Jupyter Server through it. The cluster opens no inbound
port, but the compute node must reach the internet. [How it works](/overview/how-it-works) shows the sequence.

A session is an ordinary Slurm job. It holds the resources you requested, and your allocation is charged, until you
press **Stop** or the walltime ends. Closing the tab or signing out does not stop it.

## Suitable uses

| Suited to | Not suited to |
|---|---|
| Notebooks that need the cluster's GPUs, memory or data | Long unattended runs; submit a [batch job](/batch) |
| Working from a machine where you cannot install software | Clusters whose compute nodes have no outbound internet |
| One JupyterLab layout per project, kept across sessions | Cluster modules in a kernel without [setup](./environment-and-kernels.md#loading-modules-in-a-kernel) |

## Requirements

| Requirement | Notes |
|---|---|
| A current browser | Nothing to install |
| An identity CILogon accepts | Most university and national-lab logins; ORCID, GitHub, Google, Microsoft |
| An account on a Slurm cluster you reach with `ssh` | Plus a Slurm account (allocation) where the site requires one |
| A way to log in to that cluster | An uploaded SSH key, a password, or MFA answered in the browser |
| Outbound HTTPS from the cluster | Login node: to download Linkspan. Compute nodes: to reach Airavata and install Python packages. [Hosts](/planning/requirements#network-egress) |

Airavata, not your computer, opens the SSH connection, so it cannot use a local key file or `ssh-agent`. Upload the
key, or type the password or MFA code into a terminal in the browser.

## Credentials and data

Unlike [CS Bridge](/vscode), which uses your own SSH login, CS Jupyter has Airavata log in for you, so Airavata holds
more. Read the table before uploading a key or working with restricted data:

| Item | Held by | Consequence |
|---|---|---|
| Uploaded SSH private key | Airavata, in a file only its service account reads | Never returned to a browser; **Delete** under **SSH Keys** removes it. A passphrase is asked for at each login, not stored |
| Password or MFA code | Nobody | Passed to `ssh` as you type it |
| Cluster login | Airavata, as an open SSH connection | While open, Airavata can run commands on the cluster as you. A login answered in the browser stays open until it drops or Airavata restarts; a key without a passphrase logs in again when needed |
| Notebook, file and terminal traffic | Passes through Airavata | Encrypted in transit; Airavata can read it |
| Jupyter token | Airavata; your browser while connected | New for every job; grants code execution in your session |
| Dev Tunnels account, if connected | Airavata, encrypted at rest | Never sent to the browser |
| Sign-in tokens | The browser tab | Dropped on sign-out or when the tab closes |

On the node, Linkspan and everything it starts run as you and write only under `~/.cybershuttle`. The job is not
exclusive, and Linkspan's control API on `127.0.0.1` has no password, so another user whose job shares the node could
reach it. [Cluster security](/planning/cluster-security) lists the full set of limitations.

## Pages in this section

| Page | Kind | Covers |
|---|---|---|
| [Getting started](./getting-started.md) | Tutorial | Sign in, add a cluster, run a first notebook, stop |
| [Sessions and runs](./sessions-and-runs.md) | How-to | Session states, walltime, switching, run history, Dev Tunnels |
| [Environment and kernels](./environment-and-kernels.md) | How-to | The default kernel, your own kernels, modules, files |
| [Troubleshooting](./troubleshooting.md) | Reference | Logs, symptoms and fixes, network requirements, reporting a problem |

The pages from [User interface](./user-interface.md) on document the browser client itself for contributors and
operators.

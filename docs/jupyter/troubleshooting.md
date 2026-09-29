---
sidebar_position: 5
title: Troubleshooting
description: Common CS Jupyter problems, their causes and fixes.
---

# Troubleshooting

[User interface](./user-interface.md) gives the exact wording of every message the client shows.

## Finding the logs

Two logs cover most problems; read them before changing anything:

| Log | Where | Shows |
|---|---|---|
| Startup log | The session dialog (click a session card); after the run ends, **Run History** | What Airavata did: preparing the cluster, submitting, state changes |
| Job output | `<session>-<run>.out` and `.err` in `~/.cybershuttle/logs` on the cluster | What ran on the compute node: Linkspan, the environment build, Jupyter Server |

List the latest run's files with `ls -t ~/.cybershuttle/logs | head`. A run that never left `QUEUED` has no job output.

## Symptoms

Symptoms are listed in the order a session meets them, from adding a host to the end of a run:

| Symptom | Cause | Fix |
|---|---|---|
| **Add SSH Host** refuses the command | It contains `-i`, a remote command, an unsupported `-o` option, or a flag other than `-p`, `-l`, `-J` and `-o` | Keep host, user, port and jump host; [upload the key](./getting-started.md#2-add-a-cluster) and choose it under **SSH key** |
| **Add Session** is disabled | No SSH host is configured, the host list could not be read, or sessions are still loading | [Add a host](./getting-started.md#2-add-a-cluster); the card's tooltip gives the reason |
| The SSH authentication console keeps reopening | Login not completed, or the key needs a passphrase | Answer every prompt; check the key's passphrase |
| **Dev Tunnel** cannot be ticked | No Dev Tunnels account connected | [Connect one](./sessions-and-runs.md#dev-tunnels) |
| **Review** reports `Validation failed.` | Slurm or the site's submit filter refused the job | Read Slurm's message; click **Back** and change account, partition or resources |
| **Submit** or **Start** fails with `Preparing the session environment on <alias> failed: could not download the Linkspan release.` | The login node cannot reach `github.com` | Ask the site about outbound HTTPS from the login node |
| Long in `QUEUED` | The job is waiting in the Slurm queue | `cs-<session>-<run>` is the job's name; check it with `squeue --me`. Request fewer resources or another partition |
| Long in `STARTING` on the first session | The Python environment is being built | Wait a few minutes; later sessions reuse it |
| `FAILED` during `STARTING` | The node cannot reach a [required host](#network-requirements) | Read the `.err` log; ask the site about outbound HTTPS |
| A conda environment is missing from the Launcher | Not registered as a kernel | [Register it](./environment-and-kernels.md#using-your-own-environment-as-a-kernel), then reload |
| `module` commands have no effect in a notebook | Kernels do not load modules | Use a [kernel wrapper script](./environment-and-kernels.md#loading-modules-in-a-kernel) |
| Signed out after closing the tab | Sign-in lasts for one tab | Sign in again; running sessions are unaffected |
| A file, kernel or terminal request fails with `Jupyter refused this session's access again; reopen the session from the Launcher.` | Jupyter Server refused the session's token | Click the back arrow (**Back to sessions**) in the Sessions section, then **Connect** again |
| The page left the session and opened Run History | The job ended: walltime reached, memory exceeded, or cancelled | Read the run's outcome and peak memory; add a session that requests more walltime or memory |

## Network requirements

A session fails to start on a cluster that blocks outbound HTTPS, and only the site can open it: send your site the
list in [Requirements](/planning/requirements#network-egress).

## Reporting a problem

Open an issue at [cyber-shuttle/cs-jupyter](https://github.com/cyber-shuttle/cs-jupyter/issues) with the cluster, the
session's state and error, the startup log, and the job's `.out` and `.err` files. Report a suspected security
problem privately instead, as [Security](./security.md#reporting-a-vulnerability) describes.

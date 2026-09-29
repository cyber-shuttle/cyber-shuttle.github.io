---
sidebar_position: 2
title: Getting started
description: Sign in, add a cluster, start a session and open a notebook on a compute node.
---

# Getting started

This tutorial takes you from signing in to a notebook running on a Slurm compute node, and back to a stopped job.

Before you start, meet the [requirements](./index.md#requirements) and have at hand the `ssh` command you use to reach
the cluster. If you log in with a key, also have its private key file, and read
[Credentials and data](./index.md#credentials-and-data) before uploading it.

Every step happens in the JupyterLab **Launcher**, the tab that opens first, in its title row and **Sessions** section.
The file browser stays empty until step 5.

## 1. Sign in

Open the public CS Jupyter instance at [jupyter.cybershuttle.org](https://jupyter.cybershuttle.org), or your centre's
own, and click **Sign in**, in the welcome dialog or the title row. CILogon opens; choose your institution, log in, and you return to the site.

![The Welcome to CyberShuttle Jupyter dialog with its Sign in button](/img/screenshots/jupyter-welcome-light.png)
![The Welcome to CyberShuttle Jupyter dialog with its Sign in button](/img/screenshots/jupyter-welcome-dark.png)

**Result:** the **Sign in** button in the title row shows your account name and opens the account menu. Sign-in lasts
for that browser tab only.

![The title row showing the signed-in account jdoe@example.org with the account menu open: Dev Tunnels, SSH Keys, Sign out](/img/screenshots/jupyter-account-menu-light.png)
![The title row showing the signed-in account jdoe@example.org with the account menu open: Dev Tunnels, SSH Keys, Sign out](/img/screenshots/jupyter-account-menu-dark.png)

## 2. Add a cluster

1. If you log in with a key, open the account menu, then **SSH Keys → Upload key**. Give the key a name, choose the
   private key file and click **Upload**. The key appears in the list with its type and fingerprint. Skip this for
   password or MFA login.

   ![The SSH Keys dialog with the upload form filled in for a key named anvil-key, and delta-key already listed](/img/screenshots/jupyter-ssh-keys-light.png)
   ![The SSH Keys dialog with the upload form filled in for a key named anvil-key, and delta-key already listed](/img/screenshots/jupyter-ssh-keys-dark.png)
2. Click **SSH Hosts** in the Sessions section, then **Add SSH Host**, and fill in:

   | Field | Example |
   |---|---|
   | Alias | `delta` |
   | SSH command | `ssh -p 22 jdoe@login.delta.ncsa.illinois.edu` |
   | SSH key | The key uploaded above, or **None** for password or MFA login |

   For the SSH command, paste the one that already works for you and keep only the host, user, port (`-p`), jump host
   (`-J`) and `-o` options. Remove `-i`; the **SSH key** field replaces it.

   ![The SSH Hosts dialog with the add form: alias anvil, its ssh command and the SSH key choice; delta already listed](/img/screenshots/jupyter-ssh-hosts-light.png)
   ![The SSH Hosts dialog with the add form: alias anvil, its ssh command and the SSH key choice; delta already listed](/img/screenshots/jupyter-ssh-hosts-dark.png)

3. Click **Save SSH host**.

**Result:** the host appears in the SSH Hosts list. Expand it and click **Check health** to test that the login node,
or the first jump host, accepts a connection; it does not check your credentials.

## 3. Log in to the cluster

Click **Add Session** in the Sessions section and pick the cluster; Airavata logs in to it to read its Slurm accounts
and partitions. An **SSH authentication** terminal opens in the browser. Answer the password, key passphrase, MFA or
host key prompts as you would in your own terminal; nothing you type is stored. A key without a passphrase needs no
answer.

![The SSH authentication console in the Add Session dialog, asking for a Duo passcode for jdoe@login.delta.ncsa.illinois.edu while the dialog queries Slurm](/img/screenshots/jupyter-ssh-auth-light.png)
![The SSH authentication console in the Add Session dialog, asking for a Duo passcode for jdoe@login.delta.ncsa.illinois.edu while the dialog queries Slurm](/img/screenshots/jupyter-ssh-auth-dark.png)

**Result:** the terminal reports `SSH authentication succeeded.` and closes. You are not prompted again while Airavata
keeps the connection open.

## 4. Start a session

A **session** is a saved set of resources on one cluster; each time you start it, Airavata submits a new Slurm
job.

Once the login succeeds, the **Add Session** form offers only the Slurm accounts and partitions the cluster reports:

| Field | Default |
|---|---|
| Resource type | CPU; hidden if the cluster has one kind of partition |
| Slurm account | Your first account |
| Partition | The first of that type, shown as `name — N CPU · M MB` plus its GPUs |
| Root folder | `$HOME` |
| Cores | 2, up to the partition's CPUs |
| Memory (MB) | 4096, up to the partition's memory |
| Walltime (minutes) | 60 |
| GPU type, GPUs | The partition's first GPU type, 1 GPU |
| Transport | **Link**; see [Dev Tunnels](./sessions-and-runs.md#dev-tunnels) |

![The Add Session form for delta with GPU selected, account abc123-delta-gpu, partition gpuA100x4, 16 cores, 65536 MB, 180 minutes, one a100 GPU and the Link transport](/img/screenshots/jupyter-session-form-light.png)
![The Add Session form for delta with GPU selected, account abc123-delta-gpu, partition gpuA100x4, 16 cores, 65536 MB, 180 minutes, one a100 GPU and the Link transport](/img/screenshots/jupyter-session-form-dark.png)

Your allocation is charged for what you request, so request what the notebook needs. **Stop** ends the charge early,
but a running session's walltime cannot be extended.

The root folder is where the file browser opens and the highest folder it can reach. A relative path is under your
home directory; a path may start with a cluster variable, such as `$SCRATCH/myproject`.

Click **Review**, which asks Slurm (`sbatch --test-only`) whether it would accept the job. If Slurm refuses, the review
shows its message; click **Back**, change the account, partition or resources, and review again. Once the review reads
`Validation passed.`, click **Submit**.

![The Review Slurm job step reading Validation passed, with Back and Submit](/img/screenshots/jupyter-session-review-light.png)
![The Review Slurm job step reading Validation passed, with Back and Submit](/img/screenshots/jupyter-session-review-dark.png)

**Result:** the dialog becomes the session's own, with its state and a startup log, and a session card appears under
**Sessions**. The state is `SUBMITTING`, then `QUEUED` while the job waits in the Slurm queue.

![The Launcher Sessions section with four session cards: delta READY and Current with 1h 48m left, delta QUEUED, anvil STOPPED and delta FAILED, and the Add Session card](/img/screenshots/jupyter-launcher-light.png)
![The Launcher Sessions section with four session cards: delta READY and Current with 1h 48m left, delta QUEUED, anvil STOPPED and delta FAILED, and the Add Session card](/img/screenshots/jupyter-launcher-dark.png)

## 5. Connect

When Slurm starts the job, the session moves through `STARTING` to `READY`. The first session on a cluster stays a few
minutes longer in `STARTING` while it builds the [Python environment](./environment-and-kernels.md). Once the session is
`READY`, click **Connect** in the session dialog; if you closed it, click the session card.

![The session dialog of a READY session with Stop, Connect and Delete, its details, CPU, memory and GPU usage plots, and the status log](/img/screenshots/jupyter-session-dialog-light.png)
![The session dialog of a READY session with Stop, Connect and Delete, its details, CPU, memory and GPU usage plots, and the status log](/img/screenshots/jupyter-session-dialog-dark.png)

**Result:** the page reloads with the file browser at the root folder on the cluster, and the status bar shows the
walltime left. New notebooks, consoles and terminals run on the compute node; run `hostname` in a terminal to confirm.

![JupyterLab connected to the session: the file browser at the root folder, a terminal where hostname prints gpub042.delta.ncsa.illinois.edu, and 1h 48m left in the status bar](/img/screenshots/jupyter-session-running-light.png)
![JupyterLab connected to the session: the file browser at the root folder, a terminal where hostname prints gpub042.delta.ncsa.illinois.edu, and 1h 48m left in the status bar](/img/screenshots/jupyter-session-running-dark.png)

## 6. Stop

Closing the tab or signing out leaves the job running and charged. To end it, return to the **Launcher** tab, click
the session card, click **Stop**, and confirm.

**Result:** the job and its charge end, and **Run History** opens on the run with its duration and resource use. Kernel
state is lost; saved files remain on the cluster. The session stays in the list as `STOPPED`, and **Start** submits a
new job with the same resources.

Next, [Sessions and runs](./sessions-and-runs.md) covers the walltime, switching sessions and run history;
[Environment and kernels](./environment-and-kernels.md) shows how to use your own conda environment as a kernel. If a
step did not give its result, see [Troubleshooting](./troubleshooting.md).

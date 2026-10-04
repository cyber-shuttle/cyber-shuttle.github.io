---
sidebar_position: 1
title: Resource providers
sidebar_label: Overview
description: What Cybershuttle jobs are on a Slurm cluster, and the pages for planning, setting up and operating Cybershuttle at an HPC centre.
---

# Resource providers

This section is for HPC centre staff deciding whether and how to allow Cybershuttle: what it does on a Slurm
cluster, what it needs, and how to observe and control it with existing Slurm and network tools. Of the
[components](/#components), three connect to a cluster directly:

| Component | Where | Connection |
|---|---|---|
| CS Bridge, the VS Code client | The researcher's machine | SSH to the login node, to run Slurm commands |
| Airavata | Off the cluster: the public instance, or one the centre [hosts itself](../setting-up/hosting-airavata.md) | SSH to the login node, for Jupyter sessions and batch runs |
| Linkspan | Inside each session job, on a compute node | Outbound to Airavata or a relay; the editor or browser reaches the job through it, so the cluster opens no port |

Custos, the security component, acts only through services the centre runs, such as `slurmrestd`, and an optional PAM
module; see [Managing allocations](./managing-allocations.md).

## Job properties

Cybershuttle submits only ordinary Slurm jobs of a cluster account, installs no privileged component and opens no
inbound port, so submit filters, QOS, partition limits and fairshare apply unchanged.

An interactive session is one job that runs Linkspan for the session's lifetime. A batch run is one job submitted under
a **cluster configuration**: a record in Airavata naming a login user, an SSH key and a work root on one cluster.

| Property | Interactive sessions (VS Code, Jupyter) | Batch runs |
|---|---|---|
| Account | The researcher's own POSIX account and chosen Slurm account | The configuration's login user; everyone the owner shares it with runs as that user, so Slurm attributes all their runs to it |
| Validation | `sbatch --test-only` before each submission; a limit or submit filter answers before a job exists | None; a refused submission is recorded as `SUBMISSION_FAILED` |
| Privilege | None; writes only under `~/.cybershuttle` | None; writes in `<work root>/<process ID>` |
| Network | SSH to the login node from the researcher's machine (VS Code) or Airavata (Jupyter); outbound HTTPS from compute nodes | SSH and SCP from Airavata to the login node; nothing from compute nodes |
| Identification | Job name, the `linkspan` process and `~/.cybershuttle` log paths | Job name equal to the Airavata process ID; `--mail-user` set to Airavata's mailbox |

[Visibility and control](../operating/visibility-and-control.md) shows how to find and limit these jobs.

## Decisions for a centre

VS Code sessions need only the researcher's own SSH login and compute-node egress. The rest depends on:

| Decision | Why it arises | Details |
|---|---|---|
| Outbound HTTPS from compute nodes | Every session connects outward from its job; without egress none connects | [Network egress](./requirements.md#network-egress) |
| Node sharing for session jobs | Linkspan's control API has no password; other users on the node can call it | [Known limitations](./cluster-security.md#known-limitations) |
| SSH logins from Airavata | Airavata submits Jupyter sessions and batch runs with SSH keys it stores | [Airavata](./cluster-security.md#airavata) |
| Job e-mail to an external mailbox | Airavata's batch server learns a run's state only from Slurm's mail | [Job e-mail](./requirements.md#job-e-mail) |
| Hosting your own Airavata | The public instance holds Jupyter users' keys and sees their traffic; your own keeps both on your infrastructure | [When to host your own](../setting-up/hosting-airavata.md#when-to-host-your-own) |

## Pages by role and stage

| Role | Start with |
|---|---|
| System administrator | Requirements, Preparing the cluster |
| Security officer | Cluster security, Security model |
| Allocations or user-support officer | Managing allocations, Visibility and control |

| Stage | Page | Covers |
|---|---|---|
| Planning | [Requirements](./requirements.md) | Commands, node software, network egress and job e-mail |
| Planning | [Cluster security](./cluster-security.md) | What runs on your nodes, what Airavata holds, known limitations |
| Planning | [Security model](./security-model.md) | Trust boundaries, credentials, secrets and known gaps |
| Planning | [Managing allocations](./managing-allocations.md) | What Custos implements and what it does not |
| Setting up | [Preparing the cluster](../setting-up/preparing-the-cluster.md) | SSH, Slurm policy, node sharing, egress and mail, with a verification checklist |
| Setting up | [Hosting Airavata](../setting-up/hosting-airavata.md) | Running your own Airavata instance and pointing the clients at it |
| Setting up | [Hosting the Jupyter site](../setting-up/hosting-the-jupyter-site.md) | Building and configuring the CS Jupyter site |
| Setting up | [Connecting Custos](../setting-up/connecting-custos.md) | Custos's connectors to ACCESS, COmanage and Slurm; node enrolment |
| Setting up | [Airavata configuration](../setting-up/airavata-configuration.md) | Installing, configuring and verifying both servers |
| Setting up | [Airavata architecture](../setting-up/airavata-architecture.md) | The session and batch servers: packages, request handling, startup, batch orchestration |
| Setting up | [Airavata development](../setting-up/airavata-development.md) | Build, test, lint and release |
| Operating | [Visibility and control](../operating/visibility-and-control.md) | Identifying Cybershuttle jobs and limiting or blocking them |
| Operating | [Running in production](../operating/running-in-production.md) | Health, logs, backups, upgrades, secret rotation, incident response |
| Operating | [Running Custos](../operating/running-custos.md) | Health, reconciliation, backups, upgrades, secret rotation and troubleshooting of a Custos deployment |
| Operating | [Troubleshooting](../operating/troubleshooting.md) | Problems, causes and workarounds |
| Operating | [Compatibility](../operating/compatibility.md) | Component versions that work together and the documented commits |
| Operating | [Airavata sessions and runs](../operating/airavata-sessions-and-runs.md) | How the session server runs a session, from start to run history |
| Operating | [Airavata SSH hosts and keys](../operating/airavata-ssh-hosts-and-keys.md) | Stored hosts and keys, SSH configuration, interactive authentication |
| Operating | [Airavata persistence](../operating/airavata-persistence.md) | Schemas, files on disk, what a restart loses |
| Operating | [Airavata HTTP API](../operating/airavata-http-api.md) | Every session and batch route |

## Contact

Questions from resource providers, or a request to have a cluster tested, go to the
[cyber-shuttle GitHub organisation](https://github.com/cyber-shuttle).

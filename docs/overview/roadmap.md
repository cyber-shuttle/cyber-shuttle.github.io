---
sidebar_position: 4
title: Roadmap
description: Each Cybershuttle capability with its implementation status and the component that provides it, and which component holds each responsibility.
---

# Roadmap

This page lists each Cybershuttle capability with its implementation status and the component that provides it; the
[Introduction](./index.md#components) names the components.

## Implementation status

A status states what exists in the code, not a schedule; this page gives no dates.

| Status | Meaning |
|---|---|
| :status[available] | Implemented in the clients and Airavata and usable now |
| :status[development] | Implemented in its repository; not offered through the clients or the public instance |
| :status[planned] | No code exists |

| Capability | Status | Component | Notes |
|---|---|---|---|
| VS Code sessions on Slurm | :status[available] | CS Bridge | Version 0.2.3 on the Visual Studio Marketplace |
| Jupyter sessions on Slurm | :status[available] | CS Jupyter | A public instance is live at [jupyter.cybershuttle.org](https://jupyter.cybershuttle.org) |
| [CS Batch](/batch/cs-batch) on Slurm | :status[available] | Airavata | Public instance at [gateway.cybershuttle.org](https://gateway.cybershuttle.org); portal and REST API; status from job e-mail; no cancellation; single files by SCP, no directories |
| [Checkpoint/Restore](/batch/checkpoint-restore) | :status[development] | Linkspan | Released in Linkspan and usable from a user's own `sbatch` script; no client drives it |
| Allocation sync from ACCESS (AMIE) | :status[development] | Custos | Project, account, user-modify and person-merge packets |
| POSIX account provisioning | :status[development] | Custos | COmanage, published to LDAP; no removal when access ends |
| Slurm accounts and per-member limits | :status[development] | Custos | Through `slurmrestd`; revoked when membership ends; reconciled every 5 minutes |
| Usage charging and reports | :status[development] | Custos | From Slurm's billing TRES |
| Short-lived SSH certificates | :status[development] | Custos | Signer runs as an independent service beside Custos |
| SSH login with CILogon | :status[development] | Custos | PAM module and node-enrolment playbook |
| Hosted Custos deployment | :status[planned] | Custos | Only development deployments exist |
| [Nextflow](/batch/nextflow-pipelines) and other workflow engines | :status[planned] | Airavata | Nextflow runs on Slurm without Cybershuttle |

Status is taken from the default branch of each repository as of September 2026.

## Responsibilities by component

| Responsibility | Provided today by | With Custos |
|---|---|---|
| Sign-in and user identity | Airavata, by CILogon subject | Linked identities across ACCESS, CILogon and COmanage |
| Cluster accounts tied to allocations | Each site's account process | ACCESS sync, COmanage accounts, Slurm associations |
| SSH credentials | Uploaded keys (Airavata); the user's own keys (CS Bridge) | Short-lived SSH certificate signer |

Sessions, CS Batch runs and the agent inside the job stay with Airavata, the clients and Linkspan.
[Managing allocations](/planning/managing-allocations) gives the planned deployment model for Custos.

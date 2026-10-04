---
sidebar_position: 1
title: Batch
sidebar_label: Overview
description: Batch execution in Cybershuttle through CS Batch and Linkspan workflows, and the planned Nextflow support.
---

# Batch

A **batch job** is submitted with `sbatch`, runs unattended, and is collected afterwards; [VS Code](/vscode) and
[Jupyter](/jupyter) sessions, by contrast, are interactive jobs. This page lists the ways Cybershuttle supports batch
work on a Slurm cluster.

:status[available] Version `master` · [Try it out](https://gateway.cybershuttle.org) · [Self-hosting](/setting-up/hosting-airavata)

## Options

Every option submits an ordinary Slurm job charged to a cluster account's allocation.

| Option | For | Needs | Status |
|---|---|---|---|
| Your own `sbatch` scripts | Your existing workflow | Nothing | :status[available] |
| [CS Batch](./cs-batch.md) | Registered applications, with staged files and recorded runs | A registered cluster and application | :status[available] |
| [Checkpoint/Restore](./checkpoint-restore.md) | Runs longer than the walltime | CRIU on compute nodes | :status[development] |
| [Nextflow pipelines](./nextflow-pipelines.md) | Nextflow pipelines | — | :status[planned] |

## What Airavata adds

CS Batch is a portal backed by Apache Airavata. Compared with a plain `sbatch` script:

| Need | CS Batch |
|---|---|
| Provenance | Each run records the application, its inputs, the requested resources and the Slurm job ID |
| A shared allocation | A PI shares a cluster configuration; group members launch runs under it without its SSH key |
| Data movement | Declared input files are copied to the cluster before the job, outputs back after it |
| Another cluster | The application is registered apart from the clusters it is deployed on |

CS Batch does not cancel runs and learns job status only from Slurm's e-mails; see
[Limitations](./cs-batch.md#limitations).

## Linkspan pages

Linkspan is the agent that runs inside the job of every VS Code and Jupyter session; you also run it to
[checkpoint a batch job](./checkpoint-restore.md). These pages appear in the sidebar with the Power user switch on.

| Page | Kind | Covers |
|---|---|---|
| [Running Linkspan by hand](./running-linkspan-by-hand.md) | Tutorial | Start a Jupyter and an SSH server in a job and reach them |
| [Linkspan architecture](./linkspan-architecture.md) | Explanation | Features, tasks, actions, subsystems, transports, security |
| [Linkspan configuration](./linkspan-configuration.md) | Reference | Flags, environment, validation, files, signals, exit codes |
| [Linkspan HTTP API](./linkspan-http-api.md) | Reference | Every `/api/v1` route and the objects it returns |
| [Linkspan workflow format](./linkspan-workflow-format.md) | Reference | The workflow document, its moments and actions |
| [Linkspan development](./linkspan-development.md) | Reference | Build, checks, file layout, release, compatibility |

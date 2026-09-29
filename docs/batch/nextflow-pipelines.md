---
sidebar_position: 4
title: Nextflow pipelines
description: The planned Nextflow integration in Airavata, and how to run Nextflow on a Slurm cluster today.
---

# Nextflow pipelines

This page states the planned Nextflow support and shows how to run a Nextflow pipeline on a Slurm cluster today. It
assumes you know Nextflow and write your own `sbatch` scripts.

:status[planned] Airavata will launch a Nextflow pipeline as a run, as it does a single job through
[CS Batch](./cs-batch.md). The [Roadmap](/overview/roadmap) tracks its status.

## Run Nextflow on Slurm today

Run the Nextflow driver, the process that schedules the pipeline, in a small batch job with a long walltime; it
submits each task as its own job. Login nodes commonly end long-running processes. The site must allow `sbatch` from
compute nodes; where it does not, ask where the driver may run. Check the site's Nextflow module, container runtime
and queued-job limits.

1. Point Nextflow's Slurm executor at your partition and account, which every task job is charged to. `queueSize`
   keeps a wide pipeline within the site's per-user job limit:

   ```groovy title="nextflow.config"
   process {
       executor       = 'slurm'
       queue          = 'cpu'
       clusterOptions = '--account=abc123'
   }
   executor {
       queueSize = 50
   }
   ```

2. Submit the driver as a batch job:

   ```bash title="pipeline.sbatch"
   #!/bin/bash
   #SBATCH --time=48:00:00
   #SBATCH --cpus-per-task=2
   #SBATCH --mem=8G
   module load nextflow
   nextflow run nf-core/rnaseq -profile singularity -c nextflow.config --input samples.csv --outdir results
   ```

3. Follow progress in the job's output file and with `squeue -u $USER`. The pipeline is complete when the driver job
   ends and `results/` holds its outputs.

If the driver job reaches its walltime first, the pipeline stops part-way. Add `-resume` to the `nextflow run` line and
submit the script again; Nextflow runs only the remaining tasks.

You can write and test the configuration in a [VS Code](/vscode) or [Jupyter](/jupyter) session on the cluster.

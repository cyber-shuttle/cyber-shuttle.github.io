---
sidebar_position: 4
title: Environment and kernels
description: The Python environment Jupyter runs in, how to use your own conda environments and modules as kernels, and where files live.
---

# Environment and kernels

This page assumes you can start a session as in [Getting started](./getting-started.md).

A **kernel** is the process that runs a notebook's code; a **kernel spec** is the `kernel.json` file that tells
Jupyter how to start one. Each kernel spec appears as a card in the Launcher and in a notebook's kernel picker.

## The default kernel

The first session on a cluster builds one environment in your home directory; later sessions reuse it.

| Item | Value |
|---|---|
| Location | `~/.cybershuttle/jupyter-env` |
| Python | 3.12: the node's own if it has one, else one that [uv](https://docs.astral.sh/uv/) downloads into `~/.cybershuttle/python` |
| Packages | `jupyter-server`, `ipykernel`, `jupyter-server-terminals` only |

This environment runs Jupyter Server and provides the default **Python 3** kernel, with no scientific packages. Do not
install your own packages into it, since they can conflict with Jupyter Server's; use your own kernel instead.

## Using your own environment as a kernel

Register the environment as a kernel from a terminal on the cluster, either a JupyterLab terminal or an `ssh` login:

```bash
conda install -n myproject ipykernel
conda activate myproject
python -m ipykernel install --user --name myproject --display-name "Python (myproject)"
```

The last command writes `~/.local/share/jupyter/kernels/myproject/kernel.json`. After a page reload, **Python
(myproject)** appears in the Launcher. The registration is per cluster and lasts across sessions. To remove the kernel,
delete that `myproject` directory.

## Loading modules in a kernel

Kernels do not load cluster modules, and `module load` in a notebook cell runs in a separate shell. Either add the
variables a module sets to the kernel's `kernel.json` under `"env"`, or point `"argv"` at a wrapper script that loads
the modules and then starts the kernel. For example, with the environment registered above:

```bash title="~/.local/share/jupyter/kernels/myproject/start.sh"
#!/bin/bash
module load cuda
eval "$(conda shell.bash hook)"
conda activate myproject
exec python -m ipykernel_launcher "$@"
```

```json title="~/.local/share/jupyter/kernels/myproject/kernel.json"
{
  "argv": ["/bin/bash", "/home/jdoe/.local/share/jupyter/kernels/myproject/start.sh", "-f", "{connection_file}"],
  "display_name": "Python (myproject, CUDA)",
  "language": "python"
}
```

Replace `/home/jdoe` with your home directory; `argv` does not expand `~`. Use the module names and conda activation
from your batch scripts. To confirm, restart the kernel and run `import os; os.environ["LOADEDMODULES"]` in a cell.

## Terminals and files

Terminals run your shell on the compute node inside the Slurm job, so `module`, `conda` and `srun` behave as in any
Slurm job, and what a terminal runs counts against the session's cores and memory.

The file browser cannot go above the session's **Root folder**; a terminal can reach any path you can. Notebooks are
read and written on the cluster; Airavata stores no copy. For large transfers, use the cluster's own tools, such as
`rsync` to a data transfer node or Globus.

## Files in your home directory

Everything Cybershuttle installs on the cluster is under `~/.cybershuttle` and counts against your home quota. While no
session is running, each entry is safe to delete. Paths are relative to `~/.cybershuttle`:

| Path | Contents | If deleted |
|---|---|---|
| `bin/linkspan` | The agent | Downloaded again at the next start |
| `bin/uv` | uv | Installed again at the next start |
| `jupyter-env` | The Jupyter environment | Rebuilt at the next start |
| `python`, `cache` | Python downloaded by uv; uv's cache | Downloaded again; delete `jupyter-env` with `python`, since it points into it |
| `sessions/<id>/workflow.yaml` | The [Linkspan workflow](/batch/linkspan-workflow-format) each run of the session follows | Written again at the next start |
| `logs/<id>-<run>.out`, `.err` | Job output, one pair per run; never pruned | Gone; delete old ones freely |
| `workspaces/<id>.json` in the root folder's `.cybershuttle` | The session's JupyterLab layout | The session opens with an empty layout |

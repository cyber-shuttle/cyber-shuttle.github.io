---
title: Glossary
description: Terms used across Cybershuttle, as the code uses them.
---

# Glossary

Terms used across the Cybershuttle documentation, defined as the source code uses them. Identifiers in code formatting
are the names in the code.

## Core terms

| Term | Meaning |
|---|---|
| ACCESS | The NSF program that allocates time on national computing resources; the source of the allocation decisions Custos applies |
| Agent | The role Linkspan plays; see Linkspan |
| Airavata | Apache Airavata, the middleware: the session server (`cs serve`) holds sign-in, SSH hosts and keys, sessions and runs, the link and Dev Tunnels; the batch server (`airavata-server`) holds batch processes |
| Allocation, Slurm account | The Slurm account (`--account`) a job is charged to, granted by the site with an allocation of compute time |
| Batch run | One unattended Slurm job of a registered application, submitted by Airavata's batch server with its files copied in and out; a *process* in the batch API |
| CILogon | The federated login service, accepting institutional credentials, through which users sign in to Airavata |
| Client | The program a researcher works in: CS Bridge or CS Jupyter |
| Compute node | A node Slurm allocates to a job; normally reachable only from inside the cluster |
| CS Batch | The Airavata-backed portal for launching registered applications as Slurm jobs; see Batch run |
| CS Bridge | The VS Code extension that submits a session over the user's own `ssh` and opens a Remote-SSH window on it |
| CS Jupyter | A JupyterLite site: JupyterLab served as static files to the browser, with files, kernels and terminals on the compute node |
| Custos | Apache Airavata Custos, the security component: a control plane for HPC operators that turns allocation decisions into cluster accounts, Slurm associations, usage charges and SSH access |
| Dev Tunnel | A Microsoft Dev Tunnel created for a run and hosted by Linkspan inside the job |
| Dev Tunnels account | The account that creates Dev Tunnels: for Jupyter, a Microsoft or GitHub account connected to Airavata by device flow; for CS Bridge, the Microsoft account signed in to VS Code |
| Jupyter Server | The half of JupyterLab that reads files and runs kernels; Linkspan starts it on the compute node |
| Link | The WebSocket Linkspan dials to Airavata, carrying yamux streams |
| Linkspan | The agent that runs as a Slurm job's main process |
| Middleware | The role Airavata plays; see Airavata |
| Relay | The service a client and Linkspan both connect out to, so neither accepts an inbound connection: Microsoft's Dev Tunnels relay or Airavata |
| Remote-SSH | The VS Code extension that opens a window on a host reached with `ssh` |
| Root folder | The directory a session's Jupyter Server opens in |
| Run, `seq` | One Slurm job of a session; `seq` numbers the runs, starting at 1 |
| Session | A durable definition of where and how to run, started as many runs as needed |
| SSH host | A cluster login node reached over SSH, where Slurm commands run |
| State | One of a session's seven lifecycle states, such as `QUEUED` or `READY`; see [States](./how-it-works.md#states) |
| Transport, `tunnelModes` | How Linkspan carries traffic off the node: `link`, `devtunnel`, or both |
| Walltime | A job's time limit; `wallMinutes` in Airavata's API |

## Terms in the detailed pages

| Term | Meaning |
|---|---|
| Access, grant | The answer to `GET /api/v1/sessions/{id}/access`: the Jupyter URI and token for one run, bound to its `seq`; refused until the run is `READY` |
| Action | In Linkspan, a function that is both an HTTP route and a workflow step, named `<subsystem>.<verb>` or `shell.exec` |
| Alias | The name of an SSH host, as on a `Host` line |
| Attach | A client registering with Airavata a job it submitted itself; the run's platform is `vscode`, and Airavata does not submit, reconcile or cancel it |
| Capability | The per-run Jupyter token used as a credential; the forward route takes it as the subprotocol `capability.<token>` |
| Cluster configuration | In the batch API, the login user, working directory and SSH key that runs are submitted under; its owner can share it |
| Control master | An OpenSSH master connection that later commands to the same host reuse, so MFA is answered once |
| Control port | Linkspan's loopback HTTP API port; the only port its Dev Tunnel declares |
| Device flow | An OAuth sign-in in which the user enters a code on a web page; used by CS Bridge to sign in to Airavata, and by Airavata to connect a user's Dev Tunnels account |
| Discovery | Reading a user's Slurm accounts, partitions and home directory over SSH |
| Fail closed | CS Jupyter offering no kernels, terminals or files until a `READY` session is selected |
| Forward | A WebSocket carrying one TCP connection to a port a Linkspan task serves: Linkspan's `/api/v1/forward/{port}` or Airavata's `/api/v1/sessions/{id}/forward/{port}` |
| Freeze | Airavata copying an ended run, with its log tail, usage samples, final state and error, into run history |
| Host token | A Dev Tunnel token with the `host` scope, passed to the job as `LINKSPAN_TUNNEL_HOST_TOKEN` |
| Link token | The per-run secret Linkspan offers as the subprotocol `link.<token>`, from `LINKSPAN_LINK_TOKEN` |
| Narration | Status lines Airavata writes to a session's log tail |
| Per-session SSH host | CS Bridge's generated `Host <alias>-<suffix>` in the `ssh_config` in its VS Code extension storage, pointing at a local forward; the suffix is the last six characters of the session name |
| PKCE | The OAuth sign-in flow for a client that cannot keep a secret; used by CS Jupyter, with Airavata adding the client secret |
| Platform | Who launched a run: `jupyterlab` (Airavata's `start`) or `vscode` (a client's `attach`) |
| Preparation | Installing Linkspan and writing the workflow document on the SSH host before submitting |
| Principal | The signed-in user: the ID token's `sub` under tenant `cilogon`; the session table's `owner` column holds a hash of the two |
| Process | In the batch API, one run of a batch deployment, carried out as ordered tasks: data staging, job submission, job monitoring, interactive commands |
| Reconciliation | Airavata's session server folding Slurm observations into session states every 30 seconds |
| Ref | A client-chosen ID for a server or process Linkspan creates |
| Sample | One usage reading (memory in bytes, CPU microseconds, GPUs), taken every 5 seconds |
| Task | In Linkspan, an entry of its registry: the HTTP listener, the usage sampler, a transport, the workflow, a server or a process |
| Workflow | A YAML document of triggers (`start`, `ready`, `stop`, or a signal name) and the steps Linkspan runs at each |
| yamux | A protocol carrying many independent streams over one connection; each connection into a job is one stream on the link |

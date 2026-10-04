---
title: Error messages
description: Reference for the error messages CS Bridge shows, where each appears, and the condition in the code that produces it.
---

# Error messages

This page lists the messages CS Bridge shows when an operation fails, with the condition that produces each; source
files are relative to `src/`. For symptoms and fixes in plain terms, see [Troubleshooting](./troubleshooting.md).

Text in angle brackets is filled in at runtime. `<stderr>` is the remote command's standard error, usually the part to
read first. Messages and logs that name `cs-plane` refer to Airavata's
session server.

## Message locations

A message appears in one of these places:

| Surface | When |
|---|---|
| Error notification | A failed **Start**, **Submit Job**, **Stop** or menu action |
| Card status text | `Failed: <message>`, `Unreachable: <message>` or `Stop failed: <message>`, from the record's `errorMessage` |
| `Session validation failed` overlay | A rejected **Add** |
| Draft card | A failed read of Slurm accounts, with **Retry** |
| **CS Bridge** output channel | The messages above, except menu errors, plus transient retries that change no status |
| Cluster `~/.cybershuttle/logs/linkspan-session-<jobId>.err` | Linkspan's own errors inside the job |

The **CS Bridge** output channel (**View → Output → CS Bridge**) is a VS Code log channel: each entry reads
`<local time> [info|warning|error] <message>`, and **Developer: Set Log Level** sets which levels it shows.

At activation, `CS Bridge: CS Bridge storage is at schema <n>, newer than this CS Bridge reads (<m>); update CS Bridge.`
means a newer release migrated the extension's storage (`modules/store.ts`); the extension does not activate.

## Adding hosts and sessions

None of these touches a job, and the host entry or session record is left as it was.

| Source | Raises |
|---|---|
| `modules/sshCommandParser.ts` | Host parsing |
| `modules/sshHostsStore.ts` | Host editing |
| `modules/slurmSupport.ts` | Reading the cluster |
| `modules/sshSupport.ts` | The connection |
| `modules/slurmLaunch.ts` | Validation |

| Message | Cause |
|---|---|
| `CS Bridge: Missing hostname in SSH connection string` | The **Add SSH Host** command has no destination |
| `CS Bridge: Unknown flag <c>` | A flag outside Remote-SSH's `ssh` option grammar |
| `CS Bridge: Expected flag -<c> to have an argument but it did not` | A flag such as `-p` or `-i` ends the command |
| `CS Bridge: Argument missing for option <arg>` | `-o` without `Key=Value` |
| `CS Bridge: LocalForward needs a listener and a destination separated by a colon. <arg> does not match.` | `-L` without `listener:destination` |
| `CS Bridge: SSH <alias\|hostname\|username> cannot begin with -` | A value that `ssh` would read as an option |
| `CS Bridge: SSH <alias\|hostname\|username> cannot include the character <c>` | A backslash, quote, backtick, `!`, `%`, space, CR or LF |
| `CS Bridge: SSH host <alias> is not in ~/.ssh/config.` | **Edit** on a host that `~/.ssh/config` itself no longer defines |
| `CS Bridge: SSH host <alias> already exists.` | **Edit** renames the host to an alias another entry has |
| `Failed to delete SSH host <alias>: <message>` | `~/.ssh/config` could not be rewritten |
| `Failed to query associations (exit <n>): <stderr>` | `sacctmgr` failed, or the SSH connection did (exit 255) |
| `SSH connection to <alias> closed (exit <n>)` | Authentication failed, the prompt was dismissed, or the host refused the connection; appears inside other messages |
| `Slurm on SSH host <alias> rejected the session configuration: <stderr>` | `sbatch --test-only` or the site's submit filter refused the job; shown in the `Session validation failed` overlay |

A password or MFA prompt left unanswered for 120 seconds fails the connection: the `SSH_ASKPASS` helper
(`scripts/askpass.js`) exits with `Timed out waiting for password input`. Repeat the action to be asked again.

## Starting

**Start** errors appear as a notification. The session keeps its status and no job exists; correct the cause and
click **Start** again. Raised in `modules/transport.ts`, `modules/tunnelSupport.ts` and `modules/sessionSupport.ts`.

| Message | Cause |
|---|---|
| `Failed to create Dev Tunnel: Dev Tunnels authentication is required. Please sign in to your Microsoft account.` | Microsoft sign-in was cancelled or failed |
| `Failed to create Dev Tunnel: Dev Tunnel did not return a host token.` | The Dev Tunnels service returned a tunnel without a `host` token |
| `Failed to create Dev Tunnel: <message>` | Any other Dev Tunnels management failure |
| `Failed to attach the cs-plane session: Sign in to CyberShuttle first (CS Bridge: Open Menu).` | `link` transport **(experimental)** without a Cybershuttle credential |
| `Failed to attach the cs-plane session: <message>` | Airavata refused to define, stop or attach the session; `<message>` is Airavata's error message, or `cs-plane returned <status>.` |
| `Failed to generate Slurm script: <message>` | The job script could not be built from the record |

## Submitting

A failure sets `failed` and shows this notification, while the card shows `Failed: Failed to launch session: <message>`:

```text
Failed to launch session: <message>. Please clean up any resources on the cluster if necessary.
```

The steps run in the order of the table (`modules/slurmLaunch.ts`). Only the last row follows an `sbatch` that
succeeded, so the clean-up hint is for it: find the job with `squeue -u $USER`, where it is named `linkspan-session`, and
remove it with `scancel`.

| `<message>` | Cause |
|---|---|
| `Slurm is not available on SSH host <alias>: <stderr>` | `sinfo` exited non-zero |
| `Failed to detect remote architecture: <stderr>` | `uname -m` failed |
| `SSH host <alias> reports architecture <machine>, which Linkspan is not released for` | `uname -m` is not `x86_64`, `aarch64` or `arm64` |
| `Failed to install Linkspan on SSH host <alias>: <stderr>` | The download from `github.com` or the unpack failed, or produced an empty file |
| `Job submission failed: <stderr>` | `sbatch` exited non-zero |
| `Failed to parse job ID from sbatch output: <output>` | `sbatch` printed no `Submitted batch job <id>` line |

## Monitoring

These come from the background poll (`modules/sessionSupport.ts`; the Slurm state mapping is in
`modules/slurmParse.ts` and `modules/sessionMachine.ts`). The two `Failed` texts are final; `Unreachable` is not, and
the job may still be running.

| Card text | Cause |
|---|---|
| `Failed: Job ended with status: failed` | `sacct` reported `FAILED`, `BOOT_FAIL`, `DEADLINE`, `NODE_FAIL`, `PREEMPTED`, `REVOKED` or `SPECIAL_EXIT` |
| `Failed: Job ended with status: out_of_memory` | `sacct` reported `OUT_OF_MEMORY` |
| `Unreachable: SSH host unreachable: <message>` | A background `sacct` poll could not run over SSH |

Background polls use `BatchMode=yes`, so they fail while the host needs a password or MFA; the next successful poll
restores the status. A user action on that host, such as the draft card's **Refresh Slurm details**, raises the prompt
and restores the connection the polls reuse.

While the session is `preparing`, a failed call to Linkspan keeps the status and logs
`Linkspan unreachable (will retry): <message>`, for example `Linkspan /health unhealthy (status=<n>): <body>`. With the
`link` transport, the log reads `waiting for Linkspan's link to cs-plane` until Airavata reports the session
ready. After six consecutive failures, CS Bridge checks `sacct` and ends the session only on a terminal Slurm state, because a
relay outage is not evidence that the job died. The job's `.err` log on the cluster usually says why Linkspan cannot
reach the relay.

## Connecting

A failed **Connect** or **Reconnect** sets the message `Failed to connect <transport>: <message>`, where
`<transport>` is `Microsoft DevTunnel` or `Cybershuttle Link`. The session returns to `ready_to_connect` when
Linkspan's SSH server is already known, and to `unreachable` otherwise. The job is untouched. Raised in `sessionProvider.ts` from errors thrown in `modules/transport.ts`, `modules/linkTunnel.ts` and
`modules/linkspanSupport.ts`.

| `<message>` | Cause |
|---|---|
| `Microsoft DevTunnel <id> not found.` | The run's Dev Tunnel was deleted |
| `SSH private key not found for session` | `ssh_keys/id_cshost-<id>` in the extension's storage is missing |
| `Linkspan /vscode/sessions failed (status=<n> <text>): <body>` | Linkspan refused to start the SSH server |

`This session was stopped at its walltime limit. Start it again for a new run.` is informational: **Connect** was
pressed after the walltime passed.

## Stopping and deleting

A failed **Stop** sets `failed` while the job may still be running and charging.
Check with `squeue -u $USER` on the cluster and remove a remaining `linkspan-session` job with `scancel <jobId>`.
Raised in `modules/sessionSupport.ts` and `sessionProvider.ts`.

| Message | Cause |
|---|---|
| `Failed to stop session: Session <name>: failed to send stop command: <stderr>. Please check the cluster to ensure the job has stopped and clean up any resources if necessary.` | `scancel` failed and `sacct` does not show the job ended; the session becomes `failed` |
| `Session cannot be stopped from status: <status>` | **Stop** on a status that is not stoppable |
| `Session cannot be deleted from status: <status>` | Delete on a status other than `not_started`, `stopped` or `failed` |
| `Session not found.` | The record was deleted by another window |

## Signing in

| Message | Cause |
|---|---|
| `CS Bridge: <message>` | **Sign In to Microsoft DevTunnel** was cancelled or failed, and `<message>` is VS Code's; or **Sign In to CyberShuttle** failed, and `<message>` is Airavata's error message or `cs-plane returned <status>.` |

A `401` from any Airavata call, or a refresh refused with a status below 500, deletes the Cybershuttle credential.

---
title: Airavata SSH hosts and keys
description: How the session server stores each user's SSH hosts and keys, renders a private SSH configuration, runs remote commands and authenticates interactively.
---

# Airavata SSH hosts and keys

How Airavata's session server reaches a cluster as the signed-in user. (The batch server connects with a stored key
through Go's SSH client; see [its known gaps](../planning/security-model.md#batch-known-gaps).)

The server runs the OpenSSH client as its service account, once per command, with no cluster credential of its own. A
login node sees ordinary `ssh` connections to the user's account, authenticated by a key the user uploaded or by the
user's own interactive login.

An **SSH host** is a named login node; its name is the **alias**, as on a `Host` line. Each user's SSH hosts live in
the `ssh_hosts` table under their **principal**, a hash of their subject and tenant.

A user's SSH hosts are rendered to `~/.cybershuttle/control/hosts/<principal>/config` after each change, and every
`ssh` the server runs names that file, so users stay separate and the service account's own `~/.ssh/config` is never
read.

## Host parsing

A client posts the command the user already types:

```json
{ "alias": "delta", "command": "ssh -J bastion alice@login.delta.example.edu", "keyId": "delta-key" }
```

The server parses it; nothing that runs a local program on the Airavata host or includes other configuration is
accepted.

| Accepted | Detail |
|---|---|
| Leading `ssh` | Stripped |
| `-p PORT`, `-l USER`, `-J JUMP` | Attached or separate value |
| `-o Key=Value` | Allowlisted keys only; values `^[A-Za-z0-9_@%:./+=,~-]{1,256}$` |
| `--` | Ignored |
| One `[user@]host` | Required |

Allowlisted `-o` keys: `ProxyJump`, `StrictHostKeyChecking`, `UserKnownHostsFile`, `IdentitiesOnly`, `ForwardAgent`,
`ServerAliveInterval`, `ServerAliveCountMax`, `PreferredAuthentications`, `PubkeyAuthentication`,
`PubkeyAcceptedAlgorithms`, `HostKeyAlgorithms`, `KexAlgorithms`, `Ciphers`, `MACs`, `AddKeysToAgent`,
`Compression`, `RequestTTY`.

Refused: `-i` and `IdentityFile`, `ProxyCommand`, `Include`, `LocalCommand`, any other option, and a remote command.

`GET /api/v1/hosts/{alias}/health` tells a user whether the login node accepts connections, without authenticating.
It resolves the first hop with `ssh -G`, following up to seven `ProxyJump` levels, and opens a TCP connection. It
dials only public addresses: a login node on a loopback, private, link-local or unspecified address is reported
unreachable even when sessions on it work.

## Key storage

A key's metadata is a database row and its private half a file; each change is ordered to survive a crash:

| Operation | Steps |
|---|---|
| Create | Stage the file as `.put-<id>-<sha256>`, commit the metadata row, promote the file to `keys/<id>` |
| Delete | Rename the file to a `.delete-<id>` tombstone, commit, remove the file |

Startup resolves either interruption from committed metadata.

Keys are stored at mode `0600` under `hosts/<principal>/keys/`, unencrypted, and never returned by any route. A
passphrase is typed during interactive authentication and not stored. The row records the key's type and `SHA256:`
fingerprint, which an administrator matches against an `authorized_keys` file.

## Rendered configuration

Each stored SSH host becomes one stanza of its owner's configuration file:

```text title="hosts/<principal>/config"
Host delta
    hostname login.delta.example.edu
    identitiesonly yes
    identityfile /home/cs/.cybershuttle/control/hosts/<principal>/keys/delta-key
    proxyjump bastion
    user alice
```

`port` appears only when it is not 22; `identityfile` and `identitiesonly yes` only with a key. Startup regenerates
every file from committed rows.

## Command execution

Every non-interactive call is bounded (20 seconds by default, 5 minutes for preparation; output capped at 1 MiB). It
runs:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -F <principal config> -o ControlMaster=auto -o ControlPersist=600 -o ControlPath=<socket> <alias> ...
```

| Outcome | Treatment |
|---|---|
| Exit status 255, timeout or killed `ssh` | Ambiguous: the remote command may or may not have run. A job submission ending this way is left for reconciliation to find by job name |
| Authentication-failure marker on stderr, such as `Host key verification failed` | `409 ssh_authentication_required`: the client authenticates interactively |

OpenSSH's host-key defaults apply: an unknown host key fails the non-interactive call, and the user accepts it at the
interactive terminal. Accepted keys go to the service account's `~/.ssh/known_hosts`, which all users share, unless
the SSH host sets `UserKnownHostsFile`.

A **control master** is an OpenSSH connection that later commands to the same host reuse, so a password or second
factor is answered once. Sockets are keyed by configuration and alias, so one user's authentication never serves
another; they live at `$TMPDIR/cs-<uid>/m-<20 hex>` or `/tmp/cs-<uid>/…`.

A login node sees one long-lived connection per user and SSH host. A master opened by a non-interactive call closes
after ten idle minutes; reconciliation keeps it open while the user has a live session. Three missed keep-alives, 15
seconds apart, close it.

## Interactive authentication

`GET /api/v1/hosts/{alias}/ssh` upgrades to a WebSocket and runs, in a PTY:

```bash
ssh -o BatchMode=no -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -F <principal config> -o ControlMaster=auto -o ControlPersist=no -o ControlPath=<socket> \
    -q -T -N -o LogLevel=ERROR <alias>
```

The user answers host-key, password, passphrase and second-factor prompts in the browser's terminal; nothing typed is
stored. Once the master is up, the server sends `ready` and `exit 0`, and later commands for that user and alias use
it.

The master runs in the foreground until the connection drops, the login node closes it or the server stops; no route
closes it. After that, the next command to a host without a usable stored key answers
`409 ssh_authentication_required`, and the user authenticates again. See the
[frame protocol](./airavata-http-api.md#get-apiv1hostsaliasssh-websocket).

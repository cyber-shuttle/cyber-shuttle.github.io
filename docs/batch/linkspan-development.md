---
title: Linkspan development
description: Build, test, release Linkspan, its client compatibility contracts, and its file-layout rules.
---

# Linkspan development

This page is for contributors to Linkspan. Go 1.27 or newer is the only prerequisite. Read
[Architecture](./linkspan-architecture.md) first for where code belongs.

Changes go through pull requests against `main` of
[cyber-shuttle/linkspan](https://github.com/cyber-shuttle/linkspan). Branch off `main`, cover new behaviour with a
test, keep `make check` passing, and state in the description what you ran.

## Build

```bash
git clone https://github.com/cyber-shuttle/linkspan.git && cd linkspan
go build -o linkspan .   # reports version "dev"
make                     # cross-compiles bin/linkspan-{linux,darwin}-{amd64,arm64}
```

Use `go build` for day-to-day work; without `--tunnel-enable` or `--workflow` every route answers on the control port
([Running Linkspan by hand](./running-linkspan-by-hand.md)).

`make` builds with `CGO_ENABLED=0` and `-X main.version=<version>`. It refuses unless `HEAD` carries an exact tag
`vX.Y.Z` or `vX.Y.Z.<commit>`, whose number becomes the reported version; a `dev` build fails Airavata's version
check. Tag a build before testing it through Airavata:

```bash
git tag v0.23.0.$(git rev-parse --short HEAD) && make
```

Give the tag a number above the latest release, and copy the Linux binary to `~/.cybershuttle/bin/linkspan` on the
cluster. At each session start Airavata keeps an installed binary whose `X.Y.Z` is above the latest release, and
otherwise installs that release; a build numbered at or below the release is overwritten.

## Checks

`make check` runs what CI runs, fastest gate first:

| Target | Command |
|---|---|
| `fmt` | `golangci-lint fmt --diff` |
| `vet` | `go vet ./...` |
| `lint` | `golangci-lint run ./...` (`standard` plus `bodyclose`, `errorlint`, `gosec`, `dupl`, `gocritic`, `nilerr`, `prealloc`, `unconvert`, `unparam`, `wastedassign`) |
| `vuln` | `govulncheck ./...` |
| `test` | `go test -race ./...` |

`make tools` installs the pinned golangci-lint v2.13.2 and govulncheck v1.8.0.
Suppressions live in `.golangci.yml`, each naming its codes and reason, never in `//nolint`. Tests need no cluster,
network or GPU. CI runs `make check` on every pull request and every push to `main`.

To test by hand that an SSH server rejects a wrong key, stop `ssh` from reusing a connection or offering other keys;
otherwise the test can pass falsely:

```bash
ssh -o ControlMaster=no -o ControlPath=none -o IdentitiesOnly=yes -o BatchMode=yes -i badkey -p <bind_port> user@127.0.0.1
```

## File layout

`TestLayout`, in `layout_test.go`, enforces one declaration order on every Go file, so that each doc comment outlines
its file and a reader meets every name after what it depends on. A failure names the file, the rule number below and
the declaration at fault:

1. The package doc comment names every top-level type, function and method; a constant or variable may be named.
2. A constant, variable or type used by two or more functions sits above the first function.
3. A method is declared after the type it is on.
4. Every unexported function precedes every exported one; a method takes its receiver's visibility.
5. A function is declared after every function, type, constant and variable of the file that it names.
6. The doc comment names declarations in the order the file declares them.
7. Every doc-comment entry names something the file declares.

Files read bottom-up: primitives first, the surface last.

## Release

1. Add a `CHANGELOG.md` entry (Keep a Changelog, Semantic Versioning).
2. Push the tag `vX.Y.Z`.
3. Publish the GitHub release for that tag by hand, with its notes. The `on-release` workflow then runs GoReleaser,
   which uploads `linkspan_{Linux,Darwin}_{x86_64,arm64}.tar.gz`.

Releases that changed a surface clients depend on:

| Version | Notable change |
|---|---|
| 0.2.0 | Renamed from Conduit |
| 0.13.0 | Windows release archives removed |
| 0.17.0 | FRP tunnels, the Dev Tunnels SDK and the `/api/v1/tunnels` routes removed |
| 0.21.0 | The host token moved to the environment, `LINKSPAN_TUNNEL_HOST_TOKEN`; `--tunnel-mode` with per-transport args replaced `--link-url`, `--tunnel-id` and `--tunnel-cluster` |
| 0.22.0 | `GET /api/v1/metrics` became `/api/v1/usage`; transport `websocket` became `link`, configured by `--tunnel-link-args` |

## Compatibility

Clients install and drive Linkspan through its flags, `--version` and `--help` output, release archive name, link
protocol, and `/api/v1` routes and response shapes. Changing any of these needs a coordinated client release. The pull
request template asks the author to confirm that nothing in `docs/COMPATIBILITY.md` changed, or to name the client
release it needs. `main_test.go` pins the flag names, the version line, the archive name, the routes, the health and
usage bodies, and that `examples/workflow.yml` loads.

| Surface | Contract |
|---|---|
| `--version` | A bare `X.Y.Z[.commit]`, the only line on stdout; Airavata refuses a version below `0.22.0` by `sort -V` |
| Archive | `linkspan_Linux_${arch}.tar.gz` holding the member `linkspan` |
| Link | One WebSocket offering `cybershuttle.v1` and `link.<token>`, carrying yamux with Airavata as client; two-byte port header, one-byte answer ([The link](./linkspan-architecture.md#the-link)) |
| Response bodies | `/usage` camelCase, `/sessions` snake_case; `/usage` is an object |
| `POST /vscode/sessions` | `201` with `bind_port` already accepting; a `ref` already serving answers `200` |
| Workflow document | `tasks`, each with `on` and `steps`; Airavata ships one `start` trigger with `jupyter.sessions.start` |
| Jupyter token | The `token` field, passed to the server as `JUPYTER_TOKEN` |
| Dev Tunnel | Linkspan only hosts; the host token needs only the `host` scope |
| SSH shell and exit status | `sh -c`; the child's own status, `255` when signalled, `127` when the command could not run. VS Code's server bootstrap is written for `sh` and branches on the status |
| SSH channels | `sftp` and `direct-streamlocal@openssh.com`, which VS Code Remote-SSH uses |

`/terminal`, `/filesystem`, `/checkpoint` and `POST /jupyter/setup` are not contracts: no client drives them, so
they can change without a client release.

What each client uses:

| Client | Launches Linkspan with | Calls |
|---|---|---|
| Airavata | `--workflow`, `--port --tunnel-enable --tunnel-mode <transports>` and each transport's args; `JUPYTER_TOKEN` and each transport's token | `/health`, `/usage`, `/vscode/sessions`; Jupyter over the link or through `/forward` |
| CS Bridge | `--port <port> --tunnel-enable --tunnel-mode link` or `devtunnel` with its args; the token in the environment | `/health`, `/usage`, `/vscode/sessions`, `/forward` |

---
title: Compatibility
description: Which versions of each Cybershuttle component work together, the commits this site documents, and the contracts between them.
---

# Compatibility

Version requirements between Cybershuttle components, the commits this site documents, and the contracts that change
only in a coordinated release. Consult it before every upgrade: the components are released separately and all
before 1.0.

## Documented versions

Statements on this site describe each repository at these commits; a later build may behave differently.

| Component | Repository | Version | Commit |
|---|---|---|---|
| Airavata session server | [`cyber-shuttle/cs-plane`](https://github.com/cyber-shuttle/cs-plane) | 0.4.2 | `0621dbe`, 2026-09-30 |
| Airavata batch server | [`apache/airavata`](https://github.com/apache/airavata) | `master`, unreleased | `8177057`, 2026-09-29 |
| CS Jupyter | [`cyber-shuttle/cs-jupyter`](https://github.com/cyber-shuttle/cs-jupyter) | 0.1.1 | `339050e`, 2026-09-30 |
| CS Bridge | [`cyber-shuttle/CS-Bridge`](https://github.com/cyber-shuttle/CS-Bridge) | 0.2.3 | `e5543cd`, 2026-09-30 |
| Linkspan | [`cyber-shuttle/linkspan`](https://github.com/cyber-shuttle/linkspan) | 0.22.1 | `b90dee7`, 2026-09-30 |
| Security component (Custos) | [`apache/airavata-custos`](https://github.com/apache/airavata-custos) | `master`, unreleased | `c063f4a`, 2026-09-29 |

## Requirements

| Consumer | Requires |
|---|---|
| Airavata session server | Linkspan 0.22.0 or newer, for `--tunnel-link-args` and `--tunnel-mode link` |
| CS Bridge 0.2.3 | Linkspan 0.22.0 or newer; for the link transport, Airavata's session server at `https://jupyterapi.cybershuttle.org/api/v1`, fixed in `src/plane.ts` |
| CS Jupyter | Airavata session server 0.4.0 or newer |

To see what is installed:

| Component | Command |
|---|---|
| Session server | `cs version` on the Airavata host |
| Linkspan | `~/.cybershuttle/bin/linkspan --version` in the user's account on the login node |
| CS Bridge | The Extensions view of VS Code |

Where login nodes reach GitHub, the session server installs the latest Linkspan at each session start; see
[Linkspan installation](./airavata-sessions-and-runs.md#linkspan-installation). Where Linkspan is placed by hand,
replace it before upgrading the session server past a new minimum.

## Contracts

Upgrade the components on both sides of a changed contract together.

| Contract | Between | Defined in |
|---|---|---|
| `linkspan --version` output, release archive name and member | Airavata, CS Bridge → Linkspan | [Linkspan compatibility](/batch/linkspan-development#compatibility) |
| Linkspan flags and environment | Airavata, CS Bridge → Linkspan | [Linkspan configuration](/batch/linkspan-configuration) |
| The link protocol | Airavata ↔ Linkspan | [The link](/batch/linkspan-architecture#the-link) |
| Linkspan `/api/v1` response shapes | Airavata, CS Bridge → Linkspan | [Linkspan HTTP API](/batch/linkspan-http-api) |
| Workflow document | Airavata → Linkspan | [Workflows](/batch/linkspan-workflow-format) |
| Airavata `/api/v1` session routes, bodies and error codes | CS Jupyter, CS Bridge → Airavata | [HTTP API](/operating/airavata-http-api) |
| `--allowed-origin` and `cybershuttlePlaneApiUrl` | CS Jupyter deployment ↔ Airavata deployment | [Hosting the Jupyter site](/setting-up/hosting-the-jupyter-site) |

The session API is pinned by `TestCanonicalRouteManifest` in the session server's `main_test.go`, by
`subsystems/session/testdata/session-contract.json`, and by CS Jupyter's generated types.
CS Jupyter generates those TypeScript types with `tygo` from the session server's `wire.go` files at the commit pinned
in `tools/go.mod` (`8f67df7`, before 0.4.0; no `wire.go` file has changed since).

## Versioning

| Component | Scheme | Published |
|---|---|---|
| Airavata session server | `vX.Y.Z` tags; `Version` in `main.go` | No binaries; build from source |
| CS Jupyter | `0.1.1` in both `package.json` and `pyproject.toml` | Nothing; deployments rebuild `dist/` |
| CS Bridge | `X.Y.Z` tags, without `v`; release notes name a newer Linkspan it requires | Visual Studio Marketplace |
| Linkspan | `vX.Y.Z` tags, SemVer; `linkspan --version` omits the `v` | GitHub releases, built with GoReleaser |

These four keep a changelog in the Keep a Changelog format.

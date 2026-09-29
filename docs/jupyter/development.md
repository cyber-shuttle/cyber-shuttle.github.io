---
title: Development
description: Set up, build, test and change cs-jupyter, including the wire types it generates from Airavata.
---

# Development

This page is for contributors to the [cs-jupyter repository](https://github.com/cyber-shuttle/cs-jupyter). Read
[Architecture](./architecture.md) first. Tests run against fakes; only serving the site for manual use needs a real
Airavata session server.

## Prerequisites

| Tool | For |
|---|---|
| Bun | JavaScript dependencies and scripts |
| uv, Python 3.11 or newer | JupyterLab and JupyterLite build tooling |
| Chromium (`bunx playwright install --with-deps chromium`) | `test:browser` only |
| Go, the version in `tools/go.mod` | `bun run types` only |
| An Airavata session server to call | Serving the site; a local one listens on `http://127.0.0.1:8045` by default. [Airavata development](/setting-up/airavata-development) covers building one |

## Setup

Install the dependencies:

```bash
bun install --frozen-lockfile
uv sync --frozen
lefthook install   # optional pre-commit checks
```

The repository ships `cybershuttlePlaneApiUrl` empty, and the client refuses to start without a valid one. Set it
before serving, for example to `http://127.0.0.1:8045/api/v1`. It must be absolute HTTPS, or HTTP on loopback, with no
credentials, query or fragment. Set it in one of two places:

| File | Trade-off |
|---|---|
| Root `jupyter-lite.json` | Survives `bun run dev`, but `test:dist` fails while it is set, because the shipped value must be empty; never commit it |
| `dist/jupyter-lite.json` after `bun run build` | What a deployment does; serve `dist/` with any static server instead of `bun run dev` |

Then serve the site:

```bash
bun run dev
```

It prints the address. Add that origin to the session server's `--allowed-origin`; without it the browser blocks
sign-in and every Airavata request. To confirm the setup, open the address, sign in, and check that the Sessions
section lists the account's sessions.

## Scripts

| Script | Does |
|---|---|
| `build` | `clean`, `build:lib`, `build:lite` |
| `build:lib` | `tsc -b` into `lib/` |
| `build:extension` | `jupyter-builder build` into `labextension/` |
| `build:lite` | `build:extension`, then `jupyter lite build` into `dist/` |
| `clean` | Removes `lib`, `labextension`, `dist` and build caches |
| `dev` | `build:lib`, `build:extension`, `jupyter lite serve` |
| `lint` | `typecheck` and `prettier --check .` |
| `typecheck` | `tsc -b` and the tests' `tsconfig` |
| `types` | Regenerates `src/api/*.ts` from Airavata with tygo |
| `test` | Vitest (jsdom) over `tests/**/*.test.ts` |
| `test:dist` | Checks the built `dist/` |
| `test:browser` | Playwright Chromium against `dist/` with a fake Airavata, OAuth issuer and Jupyter Server |
| `test:all` | `test`, `test:dist`, `test:browser` |

`test:dist`, `test:browser` and `test:all` read the built site; after changing `src/`, run
`bun run build:lib && bun run build:lite` first.

## Tests

Logic in one module is a Vitest unit. Anything in the Launcher, a dialog or the page load needs `test:browser`, the
only suite that runs the real JupyterLab.

| Suite | Covers |
|---|---|
| Vitest | Units, one file per topic named in its top comment |
| `test:dist` | Federated extension, empty `cybershuttlePlaneApiUrl`, plugin enable and disable lists, deferred terminal plugin, no in-browser kernel |
| `test:browser` | PKCE sign-in, **Start**, the GitHub Dev Tunnels device flow, **Add Session** to **Connect**, Launcher re-mounting, SSH authentication, sign-out |

`tests/session-contract.test.ts` pins the Airavata wire contract; change it together with `PlaneClient.ts`.
`tests/setup.ts` sets `cybershuttlePlaneApiUrl` and supplies the storage and `<dialog>` APIs jsdom lacks.

## Generated types

tygo generates `src/api/*.ts` from Airavata's `wire.go` files (`tools/tygo.yaml`), mapping `time.Time` to
`string`; do not edit them by hand. When the client needs a route or field from a newer Airavata release, move the pin
in `tools/go.mod`:

```bash
cd tools
go get github.com/cyber-shuttle/cs-plane@<commit>
cd ..
bun run types
```

Then update the validators in `PlaneClient.ts` and `tests/session-contract.test.ts` for any changed field; a mismatch
fails `typecheck`.

## Checks and releases

| Where | Runs |
|---|---|
| lefthook pre-commit | In parallel: `typecheck`, `prettier --check` on staged files, `bun run test` |
| CI `test` | `bun install --frozen-lockfile`, `bun run lint`, `bun run test` |
| CI `types` | `bun run types`, then `git diff --exit-code src/api`, new files included |
| CI `e2e` | `bun run build`, `test:dist`, Playwright Chromium, `test:browser` |

CI runs on pull requests and on pushes to `main`.

Nothing is published; deployments rebuild `dist/` from `main`. Record user-visible changes under `## [Unreleased]` in `CHANGELOG.md` (Keep a Changelog) in the
same pull request.

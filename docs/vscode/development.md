---
title: Development
description: Build CS Bridge from source and run it in an Extension Development Host, plus its scripts, tests, automated checks, release procedure and contribution conventions.
---

# Development

This page takes a contributor from a clone of the CS Bridge repository to a running development build. To install the
published extension instead, see [Getting started](./getting-started.md).

Prerequisites: Git, [Bun](https://bun.sh/) at the version in `package.json`'s `packageManager` (1.4.2), and VS Code
1.101 or newer with the `code` command on `PATH`. Building, the unit tests and the interface
need no cluster; **Start** and **Connect** need the [requirements](./index.md#requirements) for running sessions.
[Source layout](./architecture.md#source-layout) shows where a change belongs.

## Run a development build

1. Clone the repository and install its dependencies:

   ```bash
   git clone https://github.com/cyber-shuttle/CS-Bridge.git
   cd CS-Bridge
   bun install
   ```

2. Start esbuild in watch mode:

   ```bash
   bun run watch
   ```

   It prints `[esbuild] build finished (0 errors)`.

3. Open the folder in VS Code and press **F5**. The repository ships no `launch.json` (`.vscode/` is gitignored), so
   choose **VS Code Extension Development** when VS Code asks for a debugger. An Extension Development Host window
   opens with the development build, and the **CS Bridge** icon appears in its activity bar.

4. After a rebuild, run **Developer: Reload Window** in the Extension Development Host to load the new bundles. The
   extension logs to **View → Output → CS Bridge** in that window.

Before opening a pull request, run the checks CI runs: `bun run check-types`, `bun run lint` and `bun run test`.

## Test the connect path

Only the Extension Development Host loads the development build. **Connect** opens a new VS Code window, which runs
the installed extension, so **F5** cannot test the status bar, the walltime handling or the return to a local window.
Test them from an installed package:

```bash
bun run dev
```

This packages `csbridge-<version>.vsix` and installs it over the Marketplace copy; reload VS Code. To return to the
published build, reinstall it from the Marketplace.

## Scripts and checks

| Task | Command | Notes |
|---|---|---|
| Build | `bun run build` | `bun esbuild.js`: codicons, extension bundle and webview bundles into `out/` |
| Watch | `bun run watch` | Rebuilds on change; reload the Extension Development Host to pick it up |
| Type-check | `bun run check-types` | `tsc -p ./ && tsc -p src/ui/tsconfig.json` |
| Lint | `bun run lint`, `bun run lint:fix` | `eslint src`, ESLint 10 flat config: 4-space indent, single quotes, semicolons, Stroustrup braces, operators at the start of a wrapped line |
| Test | `bun run test` | `bun test src`: every `*.test.ts` under `src/` |
| Package | `bun run package` | `bunx @vscode/vsce package --no-dependencies` → `csbridge-<version>.vsix`; `vscode:prepublish` type-checks and builds minified |

Tests sit beside their code as `*.test.ts`. A module that imports `vscode` cannot load under the test runner; move the
logic into a `vscode`-free module to test it. The webview
components have no automated tests, so a pull request that changes the interface includes a screenshot from the
Extension Development Host.

| Where | Runs |
|---|---|
| lefthook `pre-commit` | `bun run check-types` and `bun run lint` in parallel, when staged files match `*.{ts,tsx}`. Not a package dependency: install lefthook and run `lefthook install` once per clone |
| CI (`.github/workflows/ci.yml`), on pull requests and pushes to `main` | `bun install --frozen-lockfile`, `check-types`, `lint`, `test` on the Bun version in `packageManager` |

## Conventions

Branch off `main` and open the pull request against `main`.

- Every user-visible change adds a bullet under `## [Unreleased]` in `CHANGELOG.md`.
- The verb is "stop", not "cancel", and the status is `stopped`; Slurm's own terms (`CANCELLED`, `scancel`) stay as Slurm
  writes them.
- An experimental feature is tagged **(experimental)** after its name in prose; see
  [Experimental features](./architecture.md#experimental-features).
- A pull request states the commands run and, for a change to the launch or connect path, the cluster and scheduler it
  was tested on.
- There is no CLA and no DCO sign-off.

## Release

Each release is one pull request:

1. Bump `version` in `package.json`.
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, open a fresh `[Unreleased]` above it, and
   add the version's link definition at the bottom. Group entries under the Keep a Changelog headings only: Added,
   Changed, Deprecated, Removed, Fixed, Security.
3. If the release needs a newer Linkspan, release Linkspan first and write `Requires Linkspan X.Y.Z.` under the
   version heading. CS Bridge installs the latest Linkspan release from GitHub, so a CS Bridge published ahead of its
   Linkspan would run against the old agent.
4. Merge the pull request as `release: X.Y.Z`, then tag that commit `X.Y.Z` (no `v` prefix) and push the tag.
5. Run `bun run package` and upload `csbridge-X.Y.Z.vsix` to the Marketplace under the `cybershuttle` publisher. No
   workflow publishes automatically.

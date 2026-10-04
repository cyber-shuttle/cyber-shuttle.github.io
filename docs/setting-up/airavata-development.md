---
title: Airavata development
description: Build, test, lint and release Airavata's two Go codebases, and the conventions their pull requests follow.
---

# Airavata development

This page is for an administrator or engineer who builds Airavata from source or changes it. You need the Go version
in the table, Docker for a test PostgreSQL, and an OpenSSH client for the session server's tests.
[Hosting Airavata](./hosting-airavata.md) covers deploying the result.

| Codebase | Repository | Binary | Go (`go.mod`) | Default branch |
|---|---|---|---|---|
| Session server | `cyber-shuttle/cs-plane` | `cs` | 1.26.0 | `main` |
| Batch server | `apache/airavata` | `airavata-server` | 1.25 | `master` |

## Session server

### Build and test

```bash
git clone https://github.com/cyber-shuttle/cs-plane.git
cd cs-plane
go build -o cs .
./cs help
```

Database tests skip without `CS_TEST_DATABASE_URL`, so a passing run without it has not exercised persistence. Each
test creates and drops its own schema, so tests can share a database.

```bash
docker run -d -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17
export CS_TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable'
go test -race ./...
```

Two tests pin the published contract: `TestCanonicalRouteManifest` in `main_test.go` pins every route and method,
and `subsystems/session/testdata/session-contract.json` pins the JSON bodies clients rely on. A change that fails
either changes what CS Jupyter and CS Bridge depend on. Update the fixture only together with the clients,
as in [Compatibility](../operating/compatibility.md#contracts).

### Checks

The pre-commit hook runs locally what CI checks:

| Where | Runs |
|---|---|
| lefthook pre-commit (`lefthook install`) | `gofmt -l` on staged Go files, `go vet ./...`, `golangci-lint run ./...`, `go test -race ./...`, in sequence |
| CI (`.github/workflows/ci.yml`; pull requests and pushes to `main`; PostgreSQL 17 service) | `go build ./...`, `go vet ./...`, `golangci-lint` v2.13.2, `go test -race ./...` |

`golangci-lint` runs the `standard` set plus `bodyclose`, `errorlint`, `gosec`, `dupl`, `gocritic`, `nilerr`,
`prealloc`, `unconvert`, `unparam` and `wastedassign`, with `gofmt` as formatter. Suppressions belong in
`.golangci.yml`, each with its reason, never in `//nolint` comments.

### Code conventions

There is no ORM. `go generate ./internal/db` runs sqlc over each subsystem's `schema.sql` and `query.sql` and
regenerates the committed `query.sql.go`, `sql.go` and `sql_models.go`; see
[Persistence](../operating/airavata-persistence.md#session-tables). The source layout follows these rules:

- `main.go` is the composition root. `internal/` holds packages with no HTTP surface; `subsystems/` holds `oauth`,
  `ssh`, `devtunnels` and `session`, each owning its wire shapes, logic and routes.
- A subsystem imports `internal/*` only, never another subsystem. A cross-subsystem need is an interface the
  consumer declares and `main.go` satisfies.
- Request and response types live only in each package's `wire.go`, because CS Jupyter generates its
  TypeScript types from those files with tygo.

### Releases and pull requests

Releases are manual, with no release workflow and no published binary. A release is a tag that deployers build. Its
CHANGELOG entry carries any upgrade steps, because the server does not migrate its database.

1. Set `Version` in `main.go`.
2. Move the `## [Unreleased]` entries of `CHANGELOG.md` under the new version (Keep a Changelog 1.1.0).
3. Commit `Release X.Y.Z` and tag `vX.Y.Z`.

A pull request follows these rules:

- Branch off `main`, link the issue, and list the commands run.
- A change to a route, body, error code, flag or environment variable updates `docs/API.md` or `README.md` in the
  same pull request.
- A change to the session lifecycle or a trust boundary updates `docs/ARCHITECTURE.md`.
- A user-visible change adds a line under `## [Unreleased]` in `CHANGELOG.md`.

## Batch server

### Build and test

```bash
git clone https://github.com/apache/airavata.git
cd airavata
docker compose -f dev-tools/compose/compose.yml up -d postgres
go build -o bin/airavata-server ./cmd/airavata-server
./bin/airavata-server
```

The compose file starts PostgreSQL 17 on host port `15432` (database and user `airavata`, password `123456`) and
Adminer on `18080`. The server's defaults match it, so the server runs with no configuration: it creates its schema,
prints a root token for the first API calls, and listens on `:9095`. `curl -s localhost:9095/health` then prints
`{"status":"UP"}`. See [Startup and shutdown](./airavata-configuration.md#batch-startup-and-shutdown).

```bash
go test ./...
```

Tests that need an external system skip unless their variables are set:

| Test | Variables |
|---|---|
| `internal/db` against a live server (both schema paths) | `AIRAVATA_TEST_POSTGRES_DSN`, for example `postgres://airavata:123456@localhost:15432/airavata?sslmode=disable` |
| `internal/orchestration` SSH | `AIRAVATA_SSH_PRIVATE_KEY_PATH`, `AIRAVATA_SSH_PRIVATE_KEY_PASSPHRASE`, `AIRAVATA_SSH_HOST`, `AIRAVATA_SSH_USERNAME` |
| `internal/orchestration` e-mail monitor | `AIRAVATA_EMAIL_MONITOR_ADDRESS`, `AIRAVATA_EMAIL_MONITOR_APP_PASSWORD`, optional `AIRAVATA_EMAIL_MONITOR_MAILBOX`; it consumes unread mail |

### Checks

CI (`.github/workflows/ci.yml`) runs on pushes and pull requests to `master`, `release/*` and `rel/*`:

| Job | Runs |
|---|---|
| Build | `gofmt -l .` (must print nothing), `go vet ./...`, `go build ./...` |
| Test | `go test -race -coverprofile=coverage.out -covermode=atomic ./...`; uploads `coverage.out` |

There is no linter configuration and no pre-commit hook; run `gofmt -l .` and `go vet ./...` before pushing.

### Code conventions

A change to a model's table shape adds `internal/db/migrations/NNNN_description.sql` with the next number, because
production deployments turn automatic migration off and apply only these files. There are no down migrations; a
further migration corrects a mistake. Do not edit a migration once it has run outside development: the migrator
never applies a recorded version again. See
[Persistence](../operating/airavata-persistence.md#batch-migrations).

`docs/api.md` (narrative, with `curl` examples) and `docs/openapi.yaml` (OpenAPI 3.1) describe the routes and change
with them.

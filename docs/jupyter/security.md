---
title: Security
description: Security properties of the CS Jupyter browser client, its transport rules, and how to report a vulnerability.
---

# Security

This page lists the security properties of the CS Jupyter browser client and the rules every request follows, for
reviewers and operators. The client holds two kinds of credential: the account's CILogon ID token, which authorises
every Airavata call, and per-run *grants*, the Jupyter URI and token Airavata issues for one run of a session, which
allow code execution in that session.

The client decides nothing about who may do what. Airavata authenticates every request, finishes sign-in and
decides who may reach a session; see [Airavata security](/planning/security-model#airavata-servers).
[Cluster security](/planning/cluster-security) covers what Airavata and compute nodes hold, and the known
limitations there.

## Properties

| Property | Consequence | Code |
|---|---|---|
| Sign-in tokens live only in per-tab `sessionStorage`, never `localStorage`; session grants stay in memory | A sign-in ends with the tab and a grant with the page; neither reaches other tabs or later browser sessions | `src/AuthClient.ts`, `src/index.ts` |
| Airavata calls are pinned to the origin of `cybershuttlePlaneApiUrl`; the ID token never enters a URL, log or error; the SSH WebSocket carries it as a subprotocol | A request to another origin is blocked before the token is attached; the token stays out of browser history, referrers and server access logs | `src/PlaneClient.ts`, `src/ssh.ts` |
| A session's Jupyter URI must be `sessions/<id>/jupyter/` under the configured Airavata API URL | An access response cannot point JupyterLab, and the Jupyter token, at another host or session | `src/PlaneClient.ts` |
| Responses are validated; a missing or mistyped field fails, and grants and tokens also refuse unknown keys | A malformed or unexpected response is an error, not state the client acts on | `src/PlaneClient.ts`, `src/Common.ts` |
| No kernels, terminals or contents without a `READY` session | No code runs in the browser, and no request goes to an unauthenticated default server | `src/index.ts` |

Only the session ID enters the page URL. A grant is bound to the run number (`seq`) it was issued for, and refused if
already expired. When the session's run number changes, the page reloads for a new grant. Sign-out leaves the session
page, which discards its grant.

Attacks that presuppose the signed-in account's tokens or control of the configured Airavata instance are out of scope.

## Transport rules

Two fetch settings recur: `credentials: "omit"` sends Airavata no cookie, so authority comes only from the attached
token; `redirect: "error"` fails a redirect instead of following it with that token. A browser WebSocket cannot carry an
`Authorization` header, so the SSH socket offers the ID token as a subprotocol and Jupyter's WebSockets carry the
Jupyter token as `?token=`.

| Request | Rules |
|---|---|
| Airavata API | Same origin as `cybershuttlePlaneApiUrl`; `Authorization: Bearer <ID token>`; `credentials: "omit"`, `redirect: "error"`, `cache: "no-store"`; no cookies or XSRF header. A `401` drops the ID token |
| Sign-in routes (`oauth/*`) | No credential; the same `credentials`, `redirect` and `cache` settings, plus `referrerPolicy: "no-referrer"` and a 15-second timeout |
| SSH authentication WebSocket | `wss:`, or `ws:` on loopback, to the Airavata origin only. Subprotocols exactly `cybershuttle.v1` and `bearer.<base64url ID token>`. A token with whitespace or control characters, or over 16 KiB, is refused. The socket closes with `1002` unless Airavata selects `cybershuttle.v1`. The token is re-read on every open |
| Jupyter REST and WebSocket | The run-bound Jupyter token, as `Authorization: token` or `?token=`. A `401` or `403` on a REST call reloads the page once for fresh access |
| Dev Tunnels sign-in page | Opened in a new tab with `noopener`, `noreferrer` and `referrerPolicy: "no-referrer"` |

Errors are read from `{"error": {"code", "message"}}`.

## Reporting a vulnerability

Use the repository's **Security** tab, **Report a vulnerability**, never a public issue, pull request or discussion.
Include what an attacker can reach, reproduction steps, the browser and the commit. Report against current `main`:
nothing is published, fixes land on `main`, and deployments take them by rebuilding `dist/`.

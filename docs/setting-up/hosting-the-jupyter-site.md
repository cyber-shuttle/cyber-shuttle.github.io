---
title: Hosting the Jupyter site
description: Build the CS Jupyter static site, point it at Airavata, allow its origin, and every configuration key, storage key and URL parameter the client reads.
---

# Hosting the Jupyter site

This page takes a system administrator from a CS Jupyter checkout to a working site. `deployment-csvm` does all of this
([Hosting Airavata](./hosting-airavata.md#with-cs-infra)); follow this page only to deploy by hand or to serve the
site from another host.

CS Jupyter is the web page researchers open to start and use Jupyter sessions. It has no server process: a deployment
is the built `dist/` directory, served as static files over HTTPS at any path, plus one key naming Airavata's session
API.

Prerequisites:

- A running Airavata session server; see [Hosting Airavata](./hosting-airavata.md). Its CILogon client must list
  the site's `lab/index.html` URL, including any path prefix, as a redirect URI.
- Bun, uv and Python 3.11 or newer on the build machine, for the JupyterLite build.
- A static HTTPS host.

## Deploy the site

1. Build from a checkout; this deletes and rewrites `dist/`:

   ```bash
   git clone https://github.com/cyber-shuttle/cs-jupyter.git
   cd cs-jupyter
   bun install --frozen-lockfile
   uv sync --frozen
   bun run build
   ```

2. Set `cybershuttlePlaneApiUrl` in the `jupyter-config-data` object of `dist/jupyter-lite.json`:

   ```json
   "cybershuttlePlaneApiUrl": "https://jupyterapi.example.edu/api/v1"
   ```

   In a script, patch it and check the value:

   ```bash
   perl -pi -e 's#("cybershuttlePlaneApiUrl": *)"[^"]*"#$1"https://jupyterapi.example.edu/api/v1"#' dist/jupyter-lite.json
   grep cybershuttlePlaneApiUrl dist/jupyter-lite.json
   ```

   | Rule | Reason |
   |---|---|
   | The session server's `--public-url` plus `/api/v1` | The client accepts a session's Jupyter URI only under this URL |
   | Absolute HTTPS, or HTTP on `localhost`, `127.0.0.1` or `[::1]`; no credentials, query or fragment | Otherwise the extension throws on activation |
   | Set after every build | The build ships it empty |

   Patch `dist/jupyter-lite.json`, not the repository's root `jupyter-lite.json`.
3. Add the site's exact origin (scheme, host and port; no path) to the session server's `--allowed-origin`, and
   restart the server. Without it the browser blocks every request to Airavata. The flag is repeatable; each value is
   HTTPS or loopback HTTP, and `*` is rejected.

   ```bash
   cs serve ... --allowed-origin https://jupyter.example.edu
   ```

4. Serve `dist/`. Any static server works; `deployment-csvm` uses this nginx server block, with `dist/` copied to
   the `root`:

   ```nginx
   server {
       listen 443 ssl;
       server_name jupyter.example.edu;
       ssl_certificate /etc/letsencrypt/live/<certificate>/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/<certificate>/privkey.pem;
       root /var/www/jupyter.example.edu;
   }
   ```

5. Open the site at `lab/index.html`. A **Welcome to CyberShuttle Jupyter** dialog offers **Sign in**. After CILogon,
   the Launcher's **Sessions** section lists the account's sessions, and **Add Session** is enabled once an SSH host
   exists. The file browser, kernels and terminals stay empty until a `READY` session is connected.

When the site does not behave as in step 5, the browser's console names the cause:

| Symptom | Cause |
|---|---|
| The extension fails to activate; the console shows `cybershuttlePlaneApiUrl must be an absolute cs-plane API URL.` or `cybershuttlePlaneApiUrl is invalid; …` | The key is empty or invalid |
| Sign-in fails with a CORS error in the console | `--allowed-origin` lacks the origin |
| **Connect** never appears on a `READY` session; the Sessions section shows `cs-plane named a Jupyter proxy outside its own API.` | The key is not `--public-url` plus `/api/v1` |

## Configuration reference

The site has no environment variables and no JupyterLab settings schema. A deployment changes only
`cybershuttlePlaneApiUrl`; the rest describes what the site does in a user's browser.

### Page configuration

Keys in the `jupyter-config-data` object of `jupyter-lite.json`. The extension lists turn off JupyterLite's
in-browser kernels and file storage, so code runs only in a session on the cluster.

| Key | Default | Meaning |
|---|---|---|
| `cybershuttlePlaneApiUrl` | `""` | Airavata session API base; trailing `/` stripped. Empty or invalid makes the extension throw on activation |
| `appName` | `CyberShuttle Jupyter` | Application name |
| `deferredExtensions` | `["@jupyterlab/terminal-extension:plugin"]` | Activated later, only when a session offers terminals |
| `disabledExtensions` | 17 entries | The in-browser drive, kernel, session, workspace and service-worker plugins of JupyterLite; JupyterLab's default service managers; the open-folder-in-terminal command |
| `terminalsAvailable` | unset | Set at runtime to `true` on a session page, else `false` |

### Build configuration

Keys in `LiteBuildConfig` of `jupyter_lite_config.json`, read by `bun run build` and fixed in the repository.

| Key | Value |
|---|---|
| `apps` | `["lab"]` |
| `base_url` | `""` (relative URLs) |
| `federated_extensions` | `["labextension"]` |
| `ignore_sys_prefix` | `["federated_extensions"]` |
| `output_dir` | `dist` |

### URL parameters

The query parameters the site reads from its own URL, as they appear in a web server's access log.

| Parameters | Meaning |
|---|---|
| `session=<id>&workspace=<id>` | A session page; both must be the same `s-` plus 12 hexadecimal digits |
| `path=<document>` | Optional; a document to open on the session page |
| `code`, `state` | The OAuth callback from CILogon |

### Stored state

Browser entries are in `sessionStorage`, discarded when the tab closes; nothing is written to `localStorage`, and a
session's Jupyter grant is kept in memory only. The site stores nothing on its web server.

| Location | Key or path | Contents |
|---|---|---|
| `sessionStorage` | `cybershuttle.oauth.v1` | ID token, refresh token and `expiresAt` |
| `sessionStorage` | `cybershuttle.oauth.pkce.v1` | A pending sign-in: `state`, PKCE verifier, redirect URI and return URL |
| `sessionStorage` | `cybershuttle.jupyter-reload.v1` | `<id>/<seq>` of the run whose session page reloaded after Jupyter refused its access; removed when a Jupyter request next succeeds |
| `sessionStorage` | `cybershuttle.run-report.v1` | `<id>/<seq>` of a run to open in Run History after its session page ends |
| Session's Contents API | `workspaces/<id>.json` in `.cybershuttle` | The JupyterLab layout, relative to the Jupyter Server's root |

### Constants

Fixed timings, for interpreting delays a user reports.

| Constant | Value |
|---|---|
| Launcher poll | 1 second |
| Sign-in request timeout | 15 seconds |
| Token refresh margin | 60 seconds before expiry |
| Low-time warning | 10 minutes or less |
| Accounting "pending" window | 10 minutes after the run ends |
| Access retry backoff | 1 second, doubling to 30 |
| Usage plot window | At least 20 samples, widening with the sample count |

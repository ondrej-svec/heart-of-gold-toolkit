# Heart of Gold Share Server

Reference localhost share server for browser-viewable coding-agent artifacts.

The canonical contract lives in:

- `../docs/architecture/share-server-contract.md`

This README is the operational companion for that contract.

## What it is

A small local service with two surfaces:

- **admin/publish API** on `127.0.0.1:4815`
- **viewer surface** on `127.0.0.1:4816`

The admin/publish API stays localhost-only.
The viewer surface can optionally be exposed over Tailscale Serve.

## What it is not

- not a public hosting platform
- not a Tailscale replacement
- not a Pi-only feature
- not a shared directory hack without an API contract

## Layout

```text
share-server/
  package.json
  src/
    index.ts
    config.ts
    storage.ts
    publish.ts
    viewer.ts
    types.ts
```

## CLI

### Start in foreground

```bash
bun share-server/src/index.ts start
```

### Initialize config

```bash
bun share-server/src/index.ts init
```

### Health check

```bash
bun share-server/src/index.ts health
```

### Install stable local server files

```bash
bun share-server/src/index.ts install --server-dir ~/.agent-share/server
```

### Install macOS LaunchAgent

```bash
bun share-server/src/index.ts install-launch-agent --server-dir ~/.agent-share/server
```

## Manual curl publish examples

### Publish a single HTML file

```bash
curl -fsS -X POST \
  -F artifact=@./report.html \
  -F artifactType=html-file \
  http://127.0.0.1:4815/publish
```

### Publish a static site zip

```bash
cd ./site
zip -rq /tmp/site.zip .
curl -fsS -X POST \
  -F artifact=@/tmp/site.zip \
  -F artifactType=static-site-zip \
  http://127.0.0.1:4815/publish
```

## Security model

- publish/admin API binds to localhost only
- viewer surface binds to localhost only by default
- only the viewer surface should be exposed via `tailscale serve`
- artifacts are immutable by slug
- aliases are pointers, not mutable replacements for immutable history
- v1 supports static artifacts only

## Optional Tailscale Serve exposure

Expose only the viewer listener:

```bash
tailscale serve --bg --yes 4816
```

Then set `publicBaseUrl` in `~/.agent-share/config.json` to the tailnet URL, for example:

```json
{
  "server": {
    "publicBaseUrl": "https://mac-mini.tailnet-name.ts.net"
  }
}
```

## Minimal compatibility proof slice

The intended v1 validation path is:

1. **Manual shell proof**
   - `curl` publish against the admin API
2. **Portable skill proof in two harnesses**
   - `share-html` from one harness such as Pi
   - `share-html` from another harness such as Codex or Claude Code
3. **Real browser proof**
   - publish on the source machine
   - open the resulting viewer URL on a second tailnet device browser

## Status

v1 reference implementation and portable skill contract are scaffolded in-repo.

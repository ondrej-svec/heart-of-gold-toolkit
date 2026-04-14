---
name: share-html
description: Publish a local HTML file or static site directory to a configured local share server and return a browser-viewable URL. Use when the user wants to open coding-agent output in a browser on the same machine or another device over a private tailnet.
compatibility: Requires Bun, curl, zip, and Python 3. The share server must already be configured, or the user should run share-server-setup first.
---

# Share HTML

Publish browser-viewable artifacts to the local share server.

## Use this skill when

- the user generated an HTML report, preview, or visualization and wants a stable URL
- the user wants to open output in a browser on another device
- the user wants a share flow that works across coding agents
- another shared skill produced HTML as a derived artifact and now needs publication

## Supported inputs

- a single `.html` file
- a directory containing `index.html`

Common producers include:
- handcrafted HTML reports
- static-site outputs
- HTML mind maps or structured document previews generated from brainstorms, plans, or architecture docs

If the server is not configured yet, stop and run `share-server-setup` first.

## Default workflow

1. Verify health:
   ```bash
   bash scripts/healthcheck.sh
   ```
2. Publish the artifact:
   ```bash
   bash scripts/publish.sh <path>
   ```
3. Return the final URL to the user.

## Available scripts

- `scripts/healthcheck.sh` — check server config and health before publishing
- `scripts/publish.sh` — publish a single HTML file or static site directory

## Output expectations

The publish script prints structured JSON to stdout. Use the returned `url` as the primary browser URL. If both `url` and `viewerUrl` are present, prefer `url` when it is a tailnet/browser-facing URL.

## Failure handling

- Missing config → stop and use `share-server-setup`
- Unhealthy server → surface the health error clearly
- Unsupported artifact shape → explain the expected file/directory rules
- Missing `index.html` in a directory → reject rather than guess

## References

- `docs/usage.md`
- `docs/troubleshooting.md`

# Cross-Agent Share Server Contract

This document defines the v1 contract for the Heart of Gold local share server and its portable client skills.

It exists to make the implementation boundary explicit before server code is written.

## Purpose

The share system exists to let coding agents publish local HTML/static outputs into a stable browser-viewable location with minimal friction.

The core architecture is:

- a **local share server** running on the source machine
- **portable skills** that publish artifacts to that server
- optional **Tailscale Serve** exposure for private tailnet browser access

Tailscale is the network/proxy layer around the server. It is **not** the application server.

## Canonical Product Language

Use these terms consistently:

- **local share server** — the app/service that accepts artifacts and serves published output
- **publish API** — localhost-only API used by skills or manual `curl`
- **viewer surface** — browser-facing static artifact routes
- **artifact** — either a single HTML file or a static site bundle
- **reference server** — the Heart of Gold implementation of the local share server
- **existing server** — a compatible server the user already runs and wants the skills to use

Avoid:

- “Tailscale server”
- “Pi share command” as the primary product description
- wording that makes the app server and the Tailscale exposure layer sound like the same thing

## v1 Architectural Decisions

### 1. Server-first, skill-driven

The stable contract is the server API plus config file, not a harness-specific slash command.

This keeps the feature portable across Pi, Codex, Claude Code, OpenCode, and manual shell usage.

### 2. Two-surface model

The reference server uses **two local listeners** in v1.

#### Admin / publish listener
- default bind: `127.0.0.1:4815`
- purpose: health checks, publishing, optional listing/management
- visibility: localhost-only

#### Viewer listener
- default bind: `127.0.0.1:4816`
- purpose: serve published static artifacts for browser viewing
- visibility: localhost by default, optionally exposed over Tailscale Serve

This avoids a muddled trust boundary where the same exposed hostname also accepts uploads.

### 3. Tailscale exposure applies only to the viewer listener

If a user wants browser access from another tailnet device, the recommended setup is:

```bash
tailscale serve --bg 4816
```

or an equivalent `tailscale serve` configuration that proxies the **viewer** listener only.

The publish API remains local and is not intended for remote/tailnet use in v1.

### 4. Immutable publish model

Each publish creates a unique immutable artifact slug.

Optional aliases may point to the latest artifact, but immutable URLs are canonical.

### 5. Official runtime support in v1

The reference server must support:

- **foreground mode** for development and local testing
- **long-running mode** for everyday use

For v1, the official persistence target is:
- **macOS**: `launchd` via a user LaunchAgent generated or documented by the setup flow

Other platforms may run in foreground/manual mode in v1, but automated persistence is not required until a later phase.

This keeps the initial implementation aligned with the real use case without pretending full cross-platform service management exists on day one.

## Supported Artifact Types

### Artifact type: `html-file`

A single `.html` file.

Server behavior:
- stores it as an immutable artifact
- serves it at `/s/:slug/` or `/s/:slug/index.html`
- may wrap it into an internal directory structure for consistent serving

### Artifact type: `static-site-zip`

A zip archive containing a static site.

Requirements:
- archive must expand into a deterministic directory tree
- the effective site root must contain `index.html`
- archive must not contain path traversal entries
- ambiguous double-root packaging should be rejected unless the contract explicitly allows one top-level folder

Client rule:
- if the input is a directory, the publish skill packages it client-side into `static-site-zip`

v1 does **not** support arbitrary tarballs, app servers, or dynamic runtimes.

## URL Model

### Immutable artifact URL

Canonical viewer URL:

```text
/s/:slug/
```

Examples:

```text
http://127.0.0.1:4816/s/report--2026-04-14--abc123/
https://mac-mini.tailnet-name.ts.net/s/report--2026-04-14--abc123/
```

### Alias URL

Optional stable alias:

```text
/latest/:alias
```

Example:

```text
/latest/report
```

Alias URLs are convenience pointers. Immutable slug URLs remain canonical.

## Config Contract

v1 config path:

```text
~/.agent-share/config.json
```

This path is intentionally simple and harness-neutral.

### v1 schema

```json
{
  "server": {
    "apiUrl": "http://127.0.0.1:4815",
    "viewerUrl": "http://127.0.0.1:4816",
    "publicBaseUrl": "https://mac-mini.tailnet-name.ts.net",
    "apiToken": null,
    "provider": "reference",
    "version": 1
  },
  "defaults": {
    "publishMode": "immutable",
    "aliasStrategy": "none",
    "openAfterPublish": false
  }
}
```

### Field meanings

- `server.apiUrl` — localhost admin/publish base URL
- `server.viewerUrl` — localhost browser/viewer base URL
- `server.publicBaseUrl` — optional externally reachable viewer URL base, usually a Tailscale Serve URL
- `server.apiToken` — optional local token for publish requests if enabled later; may be `null` in v1
- `server.provider` — `reference` or another compatible implementation identifier
- `server.version` — config contract version
- `defaults.publishMode` — currently `immutable` only in v1
- `defaults.aliasStrategy` — `none` or future alias defaults
- `defaults.openAfterPublish` — optional UX flag for future wrappers

## API Contract

The v1 API is intentionally small.

### `GET /health` on admin listener

Purpose:
- compatibility check
- readiness check
- setup verification

Example response:

```json
{
  "ok": true,
  "service": "agent-share-server",
  "apiVersion": 1,
  "provider": "reference",
  "viewerUrl": "http://127.0.0.1:4816",
  "publicBaseUrl": "https://mac-mini.tailnet-name.ts.net",
  "supports": ["html-file", "static-site-zip", "alias"],
  "runtime": {
    "mode": "foreground",
    "platform": "darwin"
  }
}
```

### `POST /publish` on admin listener

Accepted as multipart form data.

Fields:
- `artifact` — uploaded file
- `artifactType` — `html-file` or `static-site-zip`
- `slug` — optional desired slug stem
- `title` — optional human title
- `alias` — optional alias name

Example response:

```json
{
  "ok": true,
  "id": "shr_01jshareexample",
  "slug": "report--2026-04-14--abc123",
  "url": "https://mac-mini.tailnet-name.ts.net/s/report--2026-04-14--abc123/",
  "viewerUrl": "http://127.0.0.1:4816/s/report--2026-04-14--abc123/",
  "aliasUrl": null,
  "artifactType": "html-file",
  "createdAt": "2026-04-14T12:00:00.000Z"
}
```

### `GET /shares` on admin listener

Optional in v1, but if implemented it remains localhost-only.

Purpose:
- lightweight listing for troubleshooting and future skill support

### Viewer routes on viewer listener

- `GET /s/:slug/`
- `GET /latest/:alias`

These are browser-facing routes.

## Error Contract

Error responses should be structured JSON from admin routes.

Example:

```json
{
  "ok": false,
  "error": {
    "code": "UNSUPPORTED_ARTIFACT",
    "message": "artifactType must be one of: html-file, static-site-zip"
  }
}
```

Recommended v1 error codes:
- `INVALID_REQUEST`
- `UNSUPPORTED_ARTIFACT`
- `INVALID_ARCHIVE`
- `INDEX_HTML_MISSING`
- `SLUG_CONFLICT`
- `INCOMPATIBLE_SERVER`
- `INTERNAL_ERROR`

## Slug and Alias Rules

### Slugs

Generated slugs should be:
- lowercase
- URL-safe
- human-readable when possible
- unique without mutation of prior artifacts

Recommended pattern:

```text
<slug-stem>--<yyyy-mm-dd>--<short-id>
```

If no `slug` is supplied, derive from title or source filename.

### Aliases

Aliases should be:
- optional
- stable pointers
- unique within the server

Setting an alias updates the pointer, not the immutable artifact.

## Storage Layout

Recommended v1 layout under:

```text
~/.agent-share/data/
```

Example:

```text
~/.agent-share/
  config.json
  data/
    artifacts/
      report--2026-04-14--abc123/
        index.html
      site-demo--2026-04-14--def456/
        index.html
        assets/
          main.css
    aliases/
      report.json
    metadata/
      shares.jsonl
```

Notes:
- immutable artifacts live in `artifacts/`
- aliases are separate indirections, not copies
- metadata may start as JSONL in v1; SQLite is a future migration path if needed

## Runtime Model

### Foreground mode

Used for local development and troubleshooting.

Example shape:

```bash
bun run share-server --config ~/.agent-share/config.json
```

### Long-running mode

Official v1 target:
- macOS user LaunchAgent managed or emitted by setup

The setup flow should either:
- install/update the LaunchAgent for the reference server, or
- print the exact commands/files required for the user to enable it

The setup flow must not pretend a background runtime exists if it only started a transient terminal process.

## Skill Contract

### `share-server-setup`

Responsibilities:
- detect config presence
- detect reference/existing server health
- install or adopt server config
- configure or document long-running mode
- optionally configure Tailscale Serve for the viewer listener
- verify end-to-end health

### `share-html`

Responsibilities:
- validate user input
- package directory artifacts into `static-site-zip`
- publish to `server.apiUrl`
- return viewer URL and, when configured, public URL
- fail clearly on missing config or incompatible server

## Minimal Cross-Agent Proof Slice

The v1 “cross-agent” claim is considered proven only when all of the following exist:

1. **Manual shell path**
   - one documented `curl` publish example against the reference server

2. **At least two harness paths**
   - two separate agent-harness-driven flows using the portable skill, not a harness-only wrapper

3. **One real viewing path**
   - one documented end-to-end example where an artifact is published on the source machine and viewed from a second device browser over a private tailnet URL

## Reference Repo Layout

Planned layout:

```text
heart-of-gold-toolkit/
  share-server/
    README.md
    package.json
    src/
      index.ts
      config.ts
      storage.ts
      publish.ts
      viewer.ts
      types.ts
  plugins/guide/skills/
    share-server-setup/
      SKILL.md
      scripts/
      docs/
    share-html/
      SKILL.md
      scripts/
      docs/
  docs/architecture/
    share-server-contract.md
```

This keeps:
- server implementation separate from the skill docs
- Guide as the home of the end-user skills
- architecture decisions in `docs/architecture/`

## Deferred Decisions

These are intentionally out of scope for the initial contract:

- Linux `systemd` automation
- Windows service automation
- browser upload UI
- per-user or per-tailnet authorization at the app layer
- analytics or dashboards
- remote publish over tailnet
- non-static artifact types

## Summary

The v1 system is:
- a localhost share server with two surfaces
- a localhost-only publish/admin API
- a browser-facing viewer surface that may be exposed via Tailscale Serve
- portable setup and publish skills
- immutable artifact publishing with optional aliases

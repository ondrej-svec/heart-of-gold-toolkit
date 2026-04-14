---
name: share-server-setup
description: Set up a local share server for coding-agent HTML/static artifacts, or connect portable share skills to an existing compatible server. Use when the user wants local browser-share infrastructure, Tailscale-backed viewing, or reusable artifact publishing across coding agents.
compatibility: Requires Bun, curl, and optionally Tailscale CLI for private tailnet exposure. macOS LaunchAgent automation is supported in v1.
---

# Share Server Setup

Set up or adopt a local share server for cross-agent HTML/static artifact sharing.

## Use this skill when

- the user wants to share generated HTML reports or static previews in a browser
- the user wants a reusable local share server, not a one-off ad hoc file server
- the user wants optional private viewing over Tailscale
- `share-html` cannot run because the share server is not configured yet

## Boundaries

This skill may:
- inspect local config and server health
- install the Heart of Gold reference share server
- write/update `~/.agent-share/config.json`
- configure a macOS LaunchAgent for long-running use
- optionally configure `tailscale serve` for the viewer listener

This skill may not:
- expose the publish API remotely
- enable Funnel/public internet access by default
- assume Tailscale is required for local usage

## Quick decision flow

1. Check current health:
   ```bash
   bash scripts/healthcheck.sh
   ```
2. If a compatible server already exists, keep it and update config if needed.
3. If no compatible server exists, install the reference server:
   ```bash
   bash scripts/install-reference-server.sh
   ```
4. For macOS long-running usage, install the LaunchAgent:
   ```bash
   bash scripts/install-launch-agent.sh
   ```
5. If the user wants browser access from another tailnet device, configure Tailscale for the **viewer** listener only:
   ```bash
   bash scripts/configure-tailscale-viewer.sh --public-base-url "https://<machine>.<tailnet>.ts.net"
   ```

## Existing compatible server mode

If the user already has a compatible local share server, write the config without reinstalling:

```bash
bash scripts/configure-existing-server.sh \
  --api-url "http://127.0.0.1:4815" \
  --viewer-url "http://127.0.0.1:4816" \
  --public-base-url "https://<machine>.<tailnet>.ts.net" \
  --provider existing
```

Then verify:

```bash
bash scripts/healthcheck.sh
```

## Reference implementation mode

Install the reference server files, initialize config, and verify health:

```bash
bash scripts/install-reference-server.sh
bash scripts/healthcheck.sh
```

On macOS, set up long-running mode:

```bash
bash scripts/install-launch-agent.sh
```

## Tailscale notes

Tailscale is optional.

If used, expose only the **viewer** listener. The publish/admin API remains localhost-only.

This skill's Tailscale helper configures:
- local viewer listener on `127.0.0.1:4816`
- `tailscale serve --bg 4816`
- config update for `publicBaseUrl`

## Available scripts

- `scripts/healthcheck.sh` — check config and `GET /health`
- `scripts/install-reference-server.sh` — install the reference server and initialize config
- `scripts/install-launch-agent.sh` — configure macOS LaunchAgent persistence
- `scripts/configure-existing-server.sh` — point config at an already-running compatible server
- `scripts/configure-tailscale-viewer.sh` — expose viewer listener over `tailscale serve` and update config

## References

- `docs/setup.md`
- `docs/existing-server.md`
- `docs/troubleshooting.md`

---
name: share-server-control
description: Control the local share server lifecycle after setup. Use when the user wants to check status, start or stop the local share server, restart it, or enable or disable private Tailscale viewer exposure.
compatibility: Requires macOS LaunchAgent-based reference server management in v1. Optional Tailscale CLI support for enabling or disabling private viewer exposure.
---

# Share Server Control

Control the local share server after it has been set up.

## Use this skill when

- the user wants to know whether the share server is running
- the user wants to start, stop, or restart the local server
- the user wants to enable or disable private Tailscale viewer exposure
- the user wants the current health/status without re-running setup

## Boundaries

This skill may:
- inspect the current config and server health
- control the macOS LaunchAgent for the reference server
- inspect or change Tailscale Serve viewer exposure

This skill may not:
- replace first-time setup
- expose the publish/admin API remotely
- enable Funnel/public internet access by default

## Recommended commands

### Status
```bash
bash scripts/status.sh
```

### Start the local server
```bash
bash scripts/start.sh
```

### Stop the local server
```bash
bash scripts/stop.sh
```

### Restart the local server
```bash
bash scripts/restart.sh
```

### Enable private viewer exposure over Tailscale
```bash
bash scripts/enable-viewer.sh --public-base-url "https://<machine>.<tailnet>.ts.net"
```

### Disable private viewer exposure over Tailscale
```bash
bash scripts/disable-viewer.sh
```

## Notes

- In v1, lifecycle control assumes the reference server was installed as a macOS LaunchAgent.
- If the user has not set up the server yet, stop and use `share-server-setup` first.
- `status.sh` is the safest first command because it shows LaunchAgent state, health, and Tailscale Serve status together.

## Available scripts

- `scripts/status.sh` — show LaunchAgent, health, and viewer exposure status
- `scripts/start.sh` — load the LaunchAgent and start the local share server
- `scripts/stop.sh` — unload the LaunchAgent and stop the local share server
- `scripts/restart.sh` — restart the LaunchAgent cleanly
- `scripts/enable-viewer.sh` — enable private Tailscale Serve exposure for the viewer listener
- `scripts/disable-viewer.sh` — turn off private Tailscale Serve exposure

## References

- `docs/usage.md`
- `docs/troubleshooting.md`

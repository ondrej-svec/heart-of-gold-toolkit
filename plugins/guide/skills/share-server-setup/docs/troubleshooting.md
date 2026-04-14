# Troubleshooting

## Config missing

Expected path:

```text
~/.agent-share/config.json
```

Create it by running:

```bash
bash scripts/install-reference-server.sh
```

## Health check fails

1. Confirm the server is running in foreground or via LaunchAgent.
2. Check the configured `apiUrl` in `~/.agent-share/config.json`.
3. Run:

```bash
bunx @heart-of-gold/toolkit share-server health
```

## Tailscale URL does not load

1. Confirm the viewer server is healthy locally on `http://127.0.0.1:4816/`.
2. Run `tailscale serve status`.
3. Confirm the configured `publicBaseUrl` matches the actual tailnet URL.
4. Ensure you used `tailscale serve`, not `tailscale funnel`.

## LaunchAgent installed but server not running

Unload and reload the LaunchAgent using the commands printed by `install-launch-agent.sh`, then inspect logs under:

```text
~/.agent-share/logs/
```

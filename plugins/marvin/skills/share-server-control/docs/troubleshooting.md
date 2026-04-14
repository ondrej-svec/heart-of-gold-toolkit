# Share Server Control Troubleshooting

## LaunchAgent commands fail

This v1 control skill assumes the reference server is installed as a macOS LaunchAgent.

If the plist is missing, run `share-server-setup` first.

## Status shows health failure

Check whether the LaunchAgent is loaded and the server is reachable:

```bash
bash scripts/status.sh
```

If needed, restart it:

```bash
bash scripts/restart.sh
```

## Tailscale disable/enable fails

Confirm the `tailscale` CLI is available on PATH and that Serve is supported on the current tailnet.

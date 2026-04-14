# Share Server Setup

## Reference server path

1. Install the reference server files:

```bash
bash scripts/install-reference-server.sh
```

2. Verify local health:

```bash
bash scripts/healthcheck.sh
```

3. On macOS, install the LaunchAgent for long-running use:

```bash
bash scripts/install-launch-agent.sh
```

4. Load the LaunchAgent using the commands printed by the installer output.

## Optional Tailscale viewer exposure

Expose only the viewer listener:

```bash
bash scripts/configure-tailscale-viewer.sh --public-base-url "https://<machine>.<tailnet>.ts.net"
```

This keeps the publish/admin API local while making browser viewing available on the tailnet.

## End-to-end tailnet workflow

1. Publish from the source machine with `share-html` or manual `curl`
2. Receive a URL under `/s/<slug>/`
3. Open the returned tailnet URL on the second device browser
4. Keep publishing local-only; only viewing is exposed over Tailscale

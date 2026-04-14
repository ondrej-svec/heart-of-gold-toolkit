# Share HTML Troubleshooting

## Config missing

Run `share-server-setup` first.

## Publish fails with unsupported artifact

Only these inputs are supported in v1:
- one `.html` file
- one directory with `index.html` at the root

## Viewer URL is local only

If `url` is local and not tailnet-reachable, configure optional viewer exposure with:

```bash
bash ../share-server-setup/scripts/configure-tailscale-viewer.sh --public-base-url "https://<machine>.<tailnet>.ts.net"
```

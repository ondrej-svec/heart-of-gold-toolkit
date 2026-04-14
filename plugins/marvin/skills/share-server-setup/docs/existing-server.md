# Existing Compatible Server

If the user already runs a compatible local share server, do not reinstall the reference implementation.

Instead, point the config at the existing endpoints:

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

Compatibility expectation in v1:
- `GET /health`
- `POST /publish`
- viewer routes under `/s/:slug/`

# Share HTML Usage

## Single HTML file

```bash
bash scripts/publish.sh ./tmp/report.html
```

## Static site directory

```bash
bash scripts/publish.sh ./out/site
```

## With alias

```bash
bash scripts/publish.sh ./tmp/report.html --alias report
```

The script prints JSON. Use the `url` field as the primary browser URL.

## Cross-agent usage examples

### Pi

```text
/skill:share-html /path/to/report.html
```

### Codex or Claude Code

Invoke the same skill through the harness's skill command mechanism, then run:

```bash
bash scripts/publish.sh /path/to/report.html
```

The portability claim depends on the same script-backed skill working without a Pi-only wrapper.

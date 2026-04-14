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

## Visualization usage example

Generate a shareable HTML mind map from an existing brainstorm/plan/architecture doc:

```bash
bash ../visualize/scripts/render-and-share.sh docs/brainstorms/2026-04-14-example-brainstorm.md
```

The script prints JSON from the share server publish API. Use the returned `url` as the primary browser URL.

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

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

For markdown brainstorm/plan/architecture docs, use the shared `visualize` skill as the entrypoint. It can generate an HTML mind map and publish it through `share-html` when sharing is configured:

```text
/babel-fish:visualize docs/brainstorms/2026-04-14-example-brainstorm.md
```

If you already have a generated `.html` file or static site directory, publish it directly with `share-html` using `scripts/publish.sh`.

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

# Explicit writing through Pi

Ordinary `help`, cards, search and doctor remain offline and independent of Pi. Reading writing guidance never executes these actions. This runner is a separate send boundary, not an autonomous editor or a replacement for review.

## Actions and provenance

| Action | Result disposition |
| --- | --- |
| `improve-writing` | `review-rewrite`: proposed replacement; review before applying |
| `analyze-prose` | `scratch`: evaluation and recommendations, never replacement |
| `summarize-micro` | `scratch`: compact Markdown summary, never replacement |

Only three unmodified Fabric `system.md` files are vendored. `vendor/fabric/SOURCE.json` records upstream repository, commit `6b0914d1bb0dbf54facec1743838c7312e945634`, paths, byte lengths and SHA-256 values; the upstream MIT `LICENSE` is retained. Runtime verifies the selected prompt against an owned hash. Owned instructions surround the upstream prompt and specify language/meaning preservation, output-only behavior and disposition. Prompt text cannot grant tools. Prompt-injection instructions inside source remain untrusted text; model obedience and factual quality still require human review.

Legacy editor filters/presets are not migrated, loaded or invoked. Existing `:Llm` behavior and mappings remain unchanged. The [opt-in editor adapter](neovim-ai.md) implements review/Apply; live AI installation and human acceptance remain separate steps.

## Passive preview, then explicit send

Requires trusted local **Pi 0.85.1**, **Node 22.19+** on macOS/Linux and built-in **OpenAI Codex** routing. No dependency is installed. No provider/model fallback is attempted.

```sh
workstation-guide ai list --json
workstation-guide ai prepare improve-writing --json
```

`prepare` is read-only: no Pi process, authentication file read, credential refresh or network request. It returns action/prompt fingerprint, exact provider/model/thinking, Pi version, notice, limits and a confirmation `fingerprint`. It uses canonical saved Pi defaults, including a saved per-model thinking choice, **not** `PI_MODEL`, `PI_PROVIDER` or `PI_REASONING_LEVEL` inherited from another session. An optional private profile `ai` object must explicitly supply all of `provider`, `model`, `thinking`; it never changes Pi settings.

Review that preview and the exact text you intend to send. Then pipe only that text:

```sh
# Sending is an explicit external-provider action, not a help example to auto-run.
printf '%s' 'A deliberately synthetic paragraph.' | workstation-guide ai run improve-writing \
  --send --expect <fingerprint-from-reviewed-preview> --json
```

Replace the placeholder deliberately; no automatic preparation/confirmation one-liner is provided. Input must be piped, valid nonempty Unicode, contain no NUL, and finish within ten seconds. Source is never a positional argument, filename or shell template. The CLI does not save or apply its result.

AI subcommands return JSON v1. Successful list returns `{schemaVersion:1,ok:true,actions}`; prepare returns the preview fields; run adds `text` and `durationMs`. Use `--json` so argument/profile failures before action dispatch are also JSON. Handled adapter errors return `{schemaVersion:1,ok:false,error:{code,message}}` and exit 1; messages are stable and exclude child stderr, source, raw events, credentials and private paths. Validated text is JSON-escaped on stdout, not rendered as terminal escape sequences.

JavaScript API (`src/writing.mjs`):

```js
listWritingActions();
prepareWriting(actionId, { env, preferences }); // synchronous, passive
await runWriting(actionId, input, {
  env, preferences, expectedFingerprint, signal, timeoutMs: 180000,
});
```

A run freshly resolves configuration and requires an exact nonempty confirmation fingerprint before spawning, then rechecks after child closure. Changed settings/prompt/install/environment refuse the result, never silently retry with new choices. Fingerprints bind the owned contract, prompt, choices, environment, settings bytes, Pi package metadata/bundle, shipped model data and validated model-store contents. Pi's creation of an absent empty model store is harmless; changed routing is not. Fingerprints detect drift in those inputs, **not publisher authenticity, full dependency attestation or hostile same-user filesystem races**.

## Process and result boundary

- The trusted Pi executable is resolved through absolute PATH entries and its package/interface metadata is validated. The running Node executes the resolved bundle directly, without another shebang interpreter or shell.
- `models.json`, inherited routing overrides and altered OpenAI Codex model-store definitions are rejected. A cached built-in catalog is accepted only when each included model exactly matches shipped data. Unsupported thinking levels are rejected, not clamped.
- Each run uses an owned 0700 empty temporary cwd and a new POSIX process group. It retains canonical HOME and intentional `PI_CODING_AGENT_DIR`; **auth is never copied** and no `--api-key` is passed.
- The allowlisted child environment contains HOME/PATH/agent directory, locale/timezone and intentional proxy/CA settings. API-key environment variables, Node hooks, editor/pager/debug variables, session/control metadata and arbitrary inherited options are dropped. macOS may add its own CoreFoundation locale variable after exec.
- Fixed argv: `-p --mode json --no-session --no-tools --no-extensions --no-skills --no-context-files --no-prompt-templates --no-themes --no-approve --offline`, explicit provider/model/model scope/thinking, nonempty composed `--system-prompt`, and an **actual empty argument** for `--append-system-prompt`.
- Input travels only on stdin inside a fixed non-slash JSON envelope/trailer. `/llama`, `@file`, leading dashes, metacharacters, CRLF, Unicode and boundary whitespace remain data, not CLI/template/file commands.
- Limits: input/result **128 KiB** each, aggregate JSON and individual record **16 MiB**, discarded stderr **1 MiB**, default/max generation **180 seconds**. UTF-8/JSONL are decoded incrementally; malformed/truncated streams fail closed.
- Return requires session v3, one matching user/assistant turn, exact provider/model/API, successful `stop`, matching repeated terminal messages, empty tool results, `agent_end` with no retry, `agent_settled`, and exit 0 with closed pipes. Errors can have exit 0; exit status alone is insufficient. Tool calls/events, retries, compaction, additional turns, missing lifecycle, late failure and empty/oversized output are rejected.
- Deltas and thinking are never appended to the result. Final-answer text blocks are preferred where signatures distinguish commentary/final; ordinary unsigned text remains ordered. Repeated final events are compared, not concatenated.
- Timeout, AbortSignal, SIGINT/SIGTERM invalidate success and terminate only the owned group, escalating after 500 ms. Cooperative leader closure does not cancel escalation for a stubborn descendant. The runner awaits child/pipe closure and group escalation before returning. It does not claim to contain deliberately detached/escaped descendants of malicious installed code.
- No source, result, thinking, stderr or raw event logs are written by the runner. Cleanup removes only its identity-checked empty directory, never recursively deletes unexpected files or follows a substituted directory. Unsafe cleanup fails closed and can retain private temporary state. SIGKILL, OS crashes or killing Node before its cancellation handler starts may bypass cleanup.

## What this does not isolate

These are resource/transport restrictions, **not a filesystem or network sandbox**. Pi's installed code/dependencies and canonical global configuration are trusted. Startup can read saved theme/configuration, perform migrations and create catalog/auth locks; OAuth can refresh credentials. `--no-themes` disables theme discovery, not every saved-theme read. `--no-session` does not promise the provider stores nothing. `--offline` disables startup maintenance fetches, **not inference or OAuth refresh**.

One process/prompt may make multiple provider HTTP requests (transport retry/fallback or compaction); rejected lifecycle retries cannot undo already-sent text. Internal provider retries need not appear as agent retry events. Deliberate proxy/CA configuration can affect where traffic is observed. Check the provider account's data policy separately. No private-writing test or latency/quality acceptance is implied by offline tests.

## Verification

Portable unit tests use a synthetic Pi package and fake process; no live credentials or provider calls:

```sh
node --test workstation/tests/writing*.test.mjs
```

The explicit macOS probe below loads reviewed installed Pi code in a **disposable HOME**, with synthetic non-credentials, a fixture-only in-memory fetch replacement, and inherited `sandbox-exec` network denial. It exercises real startup, context/resource flags, Codex request construction/parser and JSON lifecycle. It cannot contact Codex or refresh a real login. It is separate from the normal portable suite and does not test real provider quality:

```sh
WORKSTATION_PI_BOUNDARY_ENTRY=/absolute/reviewed/pi/dist/bundle/cli.js \
  node --test workstation/tests/writing-pi-boundary.mjs
```

The probe poisons global/project context and append prompts, global skill/template/extension fixtures, and source command-like text; none becomes executable behavior or hidden system context. Synthetic request bodies/event diagnostics are retained only inside disposable test fixtures and removed afterward; production has no such capture hook. Its fetch getter survives Pi's startup Undici installation; OS denial remains the backstop for unmocked transports. Node 24/25/macOS, Node 22/Linux, actual provider inference and user/editor acceptance must be reported separately.

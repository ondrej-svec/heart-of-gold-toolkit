# Dependencies, private dotfiles, and scoped backup

## Installation inventory

This module's offline reference CLI requires **Node.js 22+**, not Bun, Pi, or model credentials. Node 22 compatibility must be tested before claiming it; the initial backup tests ran on Node 25/macOS. Nothing here installs dependencies or changes live configuration.

| Component | Classification | Installation / verification boundary |
| --- | --- | --- |
| Node.js 22+ | Required for the direct guide and backup | Install through the user's chosen Node distribution; verify `node --version`. |
| Neovim 0.11.x | Optional Markdown reader; required for later editor integration | Interactive lessons prefer isolated Neovim; missing editor or `--plain` retains terminal reference. No live configuration is loaded by the reader. |
| zsh | Optional shell integration | Opt-in wrapper only; never source an unknown `.zshrc` to inspect it. Other shells use the direct CLI. |
| tmux | Optional workspace integration | Verify `tmux -V`; executable presence does not prove prefix, menus, session manager or cockpit configuration. |
| fzf | Optional picker and shell hooks | Verify executable presence/version separately from Ctrl-T/Ctrl-R hook configuration. The guide must fall back to plain output. |
| Glow (`glow`) | Optional Markdown presentation | Presence is not proof of read-only behavior: upstream startup can write configuration. Plain rendering remains available. |
| tldr | Optional command examples | Direct user-controlled examples only; some clients refresh their cache. Basic guide browsing must not trigger downloads. |
| Pi | Optional AI writing dependency, not reference dependency | Obtain through the supported Pi distribution; interface compatibility and provider/model consent are separate gates. Do not invoke Pi just to inspect credentials or infer readiness. |
| Personal cockpit | Personal/private, never installed transitively | An observed local `@bobo/cockpit` CLI comes from a separately maintained personal checkout. Access, redistribution and second-machine install are unverified. Mark unavailable/needs-profile-check elsewhere. |

The initial workstation inventory found all of the above executables. Exact local versions, executable origins, personal paths and private bindings belong only in the private baseline/profile, not this distribution. Existing fzf hooks, `help`/`cheat` aliases, tmux menu/session scripts, and which-key/legacy writing helpers must be preserved until an explicit migration. Presence checks are not live editor/shell integration acceptance.

## Fixed-scope additive backup

From the toolkit checkout:

```sh
node workstation/scripts/backup.mjs           # dry-run, no filesystem writes
node workstation/scripts/backup.mjs --apply   # explicitly create one private snapshot
```

The script only inspects these paths:

- Under `${XDG_CONFIG_HOME:-$HOME/.config}`: `CHEATSHEET.md`, `zsh/.zshrc`, `tmux/main.conf`, `nvim/lua/llm-filter.lua`, `nvim/lua/plugins/which-key.lua`, `.gitignore`, `nvim/after/plugin/workstation-help.lua`, `workstation/profile.json`.
- Under `$HOME`: `.zshrc` and `.tmux.conf`. Regular files are captured as bytes; symlinks are accepted only if they point directly to the corresponding allowlisted config file. A missing target is recorded as missing at its config entry while the root symlink identity is preserved.

Snapshots go to `${XDG_STATE_HOME:-$HOME/.local/state}/workstation-guide/backups/<unique-id>/`. Paths must be absolute; relocated HOME/XDG paths and spaces are supported. Existing symlinked XDG roots, config leaves, source/destination directory ancestors, and unrecognized root symlinks fail closed. This deliberately rejects some legitimate custom symlink layouts rather than guessing their safety. HOME itself is canonicalized for OS-level aliases.

Each snapshot contains a versioned `manifest.json` and numbered byte payloads. The manifest records missing paths, file modes, byte lengths, SHA-256 hashes and literal symlink targets. Link payloads contain the target text, **not a dereferenced duplicate or live symlink**. Original modes are metadata; backup payloads/manifest are created with `0600`, snapshot/new parent directories with `0700` (a stricter umask can reduce permissions further). Existing directories are never chmodded. Each source is limited to 8 MiB; nonregular files are rejected. Source identity/stat changes detected during capture abort the run.

A new destination is exclusive, never merged or overwritten. The manifest is written last as the completion marker. A failure can leave a private incomplete directory without a manifest; it is not a valid backup and is never automatically swept. Originals are never written. The API additionally accepts an explicit destination for disposable tests; no CLI arbitrary-path or recursive-backup option exists.

**Private artifact:** both the manifest and payloads can contain personal paths, preferences and writing. Keep them outside all Git repositories and distribution payloads. Dry-run JSON also contains private metadata; do not paste it into public logs. This is a narrow local safety copy, not encryption, a whole-machine backup, an off-machine backup, or a hostile-concurrent-filesystem sandbox. It does not preserve ownership, ACLs, extended attributes or birth times. Keep the source and destination parent directories under your control during capture.

### Restoration boundary

No automatic restore command is implemented in this slice. Before any future scoped restore: inspect the manifest, verify every payload hash, preview conflicts against the current destination, and obtain explicit approval. Restore regular file bytes and then the recorded mode; recreate approved links from their recorded target text, never by copying a symlink payload as config. Missing entries mean the source did not exist at backup time, not permission to delete later work. Never restore over later user edits or clone into populated `~/.config`. Alternate-home backup tests are not second-device restoration evidence.

## Exact private integration paths (opt-in, not an installer)

The private dotfiles repository uses an inverse allowlist. Keep every current exclusion. Proposed new private integration paths are limited to:

```text
workstation/profile.json
workstation/DEPENDENCIES.md
workstation/RESTORE.md
workstation/restore-manifest.json
workstation/pi-preferences.json
zsh/workstation-guide.zsh
nvim/after/plugin/workstation-help.lua
```

Help-only activation needs the profile and reviewed snippets. Other paths remain future proposals: `restore-manifest.json` would describe only approved managed paths/dependencies, never embed private backup payloads; `pi-preferences.json` is reserved for explicitly selected nonsecret provider/model/thinking preferences later. This backup never reads Pi settings. Do not create or allow those future files as part of help-only activation.

For an ignored `workstation/` parent, help-only activation uses an explicit profile-only exception rather than opening the whole directory:

```gitignore
!/workstation/
/workstation/*
!/workstation/profile.json
```

For help-only activation, allow **only** the profile child; the other workstation files above remain proposals. The Neovim after/plugin hook avoids a plugin-manager spec or init.lua edit. Its trusted module path remains private, and normal startup or deliberately sourcing just that hook activates the command.

The two integration snippets sit inside already-allowed authored zsh/Neovim directories; review those exact files individually rather than widening any directory rule. Toolkit binaries, vendored prompts and reusable adapters stay in the toolkit installation, not copied into tracked dotfiles. No blanket allowance for Pi, Fabric, `.config`, new tool directories, runtime state or machine overrides.

Never allow/copy `.env`, Pi `auth.json`, sessions, trust records, caches, whole Pi profiles, or credential-bearing neighboring tool directories. Preserve exclusions for all current credential stores and for editor/shell scratch, nested migration copies, newsboat state and vendored screenshots. Use explicit staging, never blanket `git add -A` in dotfiles.

## Audit and publication gate

A local redacting scanner must cover all tracked working files and every unique blob across all reachable commits, with an explicit count and any excluded/unreadable files recorded privately. Commit/tag metadata and filenames also need privacy consideration. Do not upload content or inspect neighboring auth stores. Scanner findings retain rule/path/object identifiers only, never matches or snippets. Check the scanner with a synthetic positive control. No automatic credential rotation, history rewriting, remote creation or publication.

The initial local scan completed its reachable-object scope without skips and reported no rule matches. That is **not publication clearance**: private account metadata, personal paths and history author metadata remain, and exhaustive manual privacy review is still open. Scanner coverage cannot establish absence of all secrets. Keep the dotfiles private, obtain any remediation decision explicitly, and rerun the scanner/manual distribution review before a separately approved push. The local baseline report and snapshot must never enter the shared package. No off-machine backup or second-Mac verification has been completed by this slice.

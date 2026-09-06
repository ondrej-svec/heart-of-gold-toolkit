# Opt-in: source this file from zsh. No tools run until help is invoked.
# Resolve while sourcing, so later cd commands and paths with spaces are safe.
typeset -g _WORKSTATION_GUIDE_ENTRY="${${(%):-%x}:A:h:h:h}/bin/workstation-guide.mjs"
builtin unalias 'help' 2>/dev/null || true

function help {
  emulate -L zsh
  if [[ ! -f "$_WORKSTATION_GUIDE_ENTRY" || ! -r "$_WORKSTATION_GUIDE_ENTRY" ]]; then
    print -u2 -- 'Workstation guide entry is missing. Restore the toolkit checkout or re-source its integrations/zsh/help.zsh from the new location.'
    return 127
  fi
  if ! builtin whence -p node >/dev/null; then
    print -u2 -- 'Workstation guide needs Node.js 22+. Activate your Node installation, then retry help.'
    return 127
  fi
  command node "$_WORKSTATION_GUIDE_ENTRY" "$@"
}

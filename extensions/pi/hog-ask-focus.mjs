// Pi 0.85.1 fullscreen consumes focus reports before public input listeners.
// This passive, card-lifetime observer must precede ProcessTerminal when focus
// and activation arrive in one chunk. It never consumes/transforms input or
// changes terminal modes, and retains only a possible split ESC-[ prefix.
export function observeTerminalFocus(input, onFocusChange) {
  if (!input.isTTY) return () => {};
  let tail = '';
  let active = true;
  const observe = (chunk) => {
    if (!active) return;
    const text = tail + (typeof chunk === 'string' ? chunk : chunk.toString('latin1'));
    tail = text.endsWith('\x1b[') ? '\x1b[' : text.endsWith('\x1b') ? '\x1b' : '';
    if (/\x1b\[[IO]/.test(text)) onFocusChange();
  };
  input.prependListener('data', observe);
  return () => {
    if (!active) return;
    active = false;
    tail = '';
    input.removeListener('data', observe);
  };
}

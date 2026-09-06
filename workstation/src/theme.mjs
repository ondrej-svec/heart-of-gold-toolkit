// Semantic ANSI roles shared with the workstation's Rosé Pine Moon/Dawn terminal.
// The rendering client owns the palette, including over SSH. No OS query or config sourcing.
export function colorEnabled(env, tty, plain = false) {
  return !!tty && !plain && env.TERM !== 'dumb' && !env.NO_COLOR;
}
const paint = (code, text) => `\x1b[${code}m${text}\x1b[0m`;
export function colorText(text, headings = []) {
  return text.split('\n').map(line => {
    if (/^(?:#{1,6} |HEART OF GOLD|How do I|SETUP CHECK|MANUAL PRACTICE)/.test(line) || headings.includes(line)) return paint('1;35', line);
    const item = /^(\s*\d+\.)(.*?)(  \([a-z0-9.-]+\))$/.exec(line);
    if (item) return paint('35', item[1]) + item[2] + paint('90', item[3]);
    return line.replace(/`[^`\n]+`/g, code => paint('34', code))
      .replace(/^(WHERE|SETUP|Source:|Related:)/, label => paint('35', label));
  }).join('\n');
}
// Explicit safe argv, never inherited FZF_DEFAULT_OPTS (which can execute commands).
export const FZF_COLORS = '--color=fg:-1,bg:-1,fg+:7,bg+:0,hl:4,hl+:4,info:5,prompt:5,pointer:4,marker:3,spinner:5,header:4,border:8,label:5';

const highlights = {
  Normal: 'ctermfg=7 ctermbg=NONE', EndOfBuffer: 'ctermfg=8', NonText: 'ctermfg=8',
  LineNr: 'ctermfg=8', CursorLineNr: 'ctermfg=5 cterm=bold', CursorLine: 'ctermbg=0',
  StatusLine: 'ctermfg=5 ctermbg=0 cterm=bold', StatusLineNC: 'ctermfg=8 ctermbg=0',
  WinSeparator: 'ctermfg=8', VertSplit: 'ctermfg=8', Visual: 'ctermfg=7 ctermbg=0',
  Search: 'ctermfg=0 ctermbg=3', IncSearch: 'ctermfg=0 ctermbg=6',
  ErrorMsg: 'ctermfg=1', WarningMsg: 'ctermfg=3', MoreMsg: 'ctermfg=4',
  Title: 'ctermfg=5 cterm=bold', Comment: 'ctermfg=8', Constant: 'ctermfg=6',
  String: 'ctermfg=2', Identifier: 'ctermfg=4', Statement: 'ctermfg=5',
  PreProc: 'ctermfg=5', Type: 'ctermfg=3', Special: 'ctermfg=6', Delimiter: 'ctermfg=8',
  Underlined: 'ctermfg=4 cterm=underline',
  markdownH1: 'ctermfg=5 cterm=bold', markdownH2: 'ctermfg=5 cterm=bold',
  markdownH3: 'ctermfg=5 cterm=bold', markdownH4: 'ctermfg=5 cterm=bold',
  markdownH5: 'ctermfg=5 cterm=bold', markdownH6: 'ctermfg=5 cterm=bold',
  markdownHeadingDelimiter: 'ctermfg=5', markdownCode: 'ctermfg=4', markdownCodeBlock: 'ctermfg=4',
  markdownCodeDelimiter: 'ctermfg=8', markdownLinkText: 'ctermfg=4 cterm=underline',
  markdownUrl: 'ctermfg=4 cterm=underline', markdownLinkDelimiter: 'ctermfg=8',
  markdownLinkTextDelimiter: 'ctermfg=8', markdownBold: 'ctermfg=7 cterm=bold',
  markdownItalic: 'ctermfg=7 cterm=italic', markdownListMarker: 'ctermfg=6',
};
export const READER_THEME = ['set notermguicolors', ...Object.entries(highlights).map(([group, style]) =>
  `highlight ${group} cterm=NONE ctermfg=NONE ctermbg=NONE gui=NONE guifg=NONE guibg=NONE ${style}`)].join(' | ');

// Glamour/Chroma requires hex token colors, not numeric slot strings. Standard ANSI
// hex values below intentionally quantize to slots 0–15 in Glow's terminal256 renderer.
const ansi = ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0', '#808080'];
const tokens = {
  7: ['text', 'operator', 'punctuation', 'name', 'name_other', 'literal'],
  1: ['error', 'name_exception', 'generic_deleted'],
  8: ['comment', 'comment_preproc'],
  5: ['keyword', 'keyword_reserved', 'keyword_namespace', 'keyword_type', 'name_attribute', 'name_class', 'name_decorator'],
  4: ['name_builtin', 'name_tag', 'name_function', 'generic_inserted'],
  6: ['name_constant', 'literal_number', 'literal_date', 'literal_string_escape', 'generic_subheading'],
  3: ['literal_string'],
};
const chroma = Object.fromEntries(Object.entries(tokens).flatMap(([slot, names]) => names.map(name => [name, { color: ansi[slot] }])));
export const GLOW_STYLE = {
  document: { block_prefix: '\n', block_suffix: '\n', color: '7', margin: 2 },
  block_quote: { indent: 1, indent_token: '│ ', color: '8' }, paragraph: {}, list: { level_indent: 2 },
  heading: { block_suffix: '\n', color: '5', bold: true },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [`h${n}`, { prefix: '#'.repeat(n) + ' ' }])),
  text: {}, strikethrough: { crossed_out: true }, emph: { italic: true }, strong: { bold: true },
  hr: { color: '8', format: '\n────────\n' }, item: { block_prefix: '• ' }, enumeration: { block_prefix: '. ' },
  task: { ticked: '[✓] ', unticked: '[ ] ' }, link: { color: '4', underline: true }, link_text: { color: '4', bold: true },
  image: { color: '5', underline: true }, image_text: { color: '8' },
  code: { prefix: ' ', suffix: ' ', color: '4' }, code_block: { color: '7', margin: 2, chroma },
  table: {}, definition_list: {}, definition_term: {}, definition_description: { block_prefix: '\n→ ' },
  html_block: {}, html_span: {},
};

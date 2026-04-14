#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(args) {
  const opts = { file: null, out: null, mode: 'auto' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' && i + 1 < args.length) opts.out = args[++i];
    else if (arg === '--mode' && i + 1 < args.length) opts.mode = args[++i];
    else if (!arg.startsWith('-')) opts.file = arg;
  }
  return opts;
}

function parseDocument(markdown) {
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  const frontmatter = {};
  if (lines[0]?.trim() === '---') {
    i = 1;
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '---') { i++; break; }
      const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (match) frontmatter[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  }

  const sections = [];
  let current = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      current = { level: heading[1].length, title: heading[2].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return { frontmatter, sections, raw: markdown };
}

function collectChecklists(lines) {
  return lines
    .map((line) => line.match(/^\s*- \[( |x)\]\s+(.+)$/i))
    .filter(Boolean)
    .map((m) => ({ done: m[1].toLowerCase() === 'x', text: m[2].trim() }));
}

function textFromLines(lines) {
  return lines.join('\n').trim();
}

function firstParagraph(lines) {
  const blocks = textFromLines(lines).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks[0] || '';
}

function classifyMode(_filePath, _doc, preferredMode) {
  if (preferredMode && preferredMode !== 'auto') return preferredMode;
  return 'outline';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderShell({ title, eyebrow, summary, toc, content, badge = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
:root {
  --bg: #0b1020;
  --panel: rgba(255,255,255,0.06);
  --panel-strong: rgba(255,255,255,0.1);
  --text: #eef2ff;
  --muted: #b8c0d9;
  --border: rgba(255,255,255,0.12);
  --accent: #7c9cff;
  --accent-2: #80e0d0;
  --success: #86efac;
  --warn: #fbbf24;
  --danger: #fca5a5;
  --shadow: 0 20px 60px rgba(0,0,0,0.35);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: radial-gradient(circle at top, #16213d 0%, var(--bg) 48%); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { line-height: 1.55; }
main { max-width: 1440px; margin: 0 auto; padding: 40px 24px 72px; }
.hero { display: grid; gap: 16px; margin-bottom: 28px; }
.eyebrow { color: var(--accent-2); text-transform: uppercase; letter-spacing: 0.14em; font-size: 12px; font-weight: 700; }
.hero h1 { margin: 0; font-size: clamp(32px, 4vw, 56px); line-height: 1.03; }
.hero p { margin: 0; max-width: 78ch; color: var(--muted); font-size: 17px; }
.badge { display: inline-flex; align-items: center; gap: 8px; width: fit-content; padding: 8px 12px; border-radius: 999px; background: rgba(124,156,255,0.18); border: 1px solid rgba(124,156,255,0.25); color: #dce5ff; font-size: 13px; }
.layout { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 24px; }
nav { position: sticky; top: 16px; align-self: start; padding: 18px; border-radius: 20px; background: var(--panel); border: 1px solid var(--border); box-shadow: var(--shadow); backdrop-filter: blur(16px); }
nav h2 { margin: 0 0 10px; font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
nav a { display: block; padding: 10px 12px; margin: 4px 0; color: var(--text); text-decoration: none; border-radius: 12px; }
nav a:hover { background: rgba(255,255,255,0.05); }
.section { margin-bottom: 18px; padding: 24px; border-radius: 24px; background: var(--panel); border: 1px solid var(--border); box-shadow: var(--shadow); backdrop-filter: blur(16px); }
.section h2 { margin: 0 0 14px; font-size: clamp(22px, 2vw, 30px); }
.section h3 { margin: 20px 0 8px; font-size: 18px; }
.section p, .section li, .section td, .section th { color: var(--muted); font-size: 15px; }
.section ul { padding-left: 18px; }
.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
.card { padding: 18px; border-radius: 18px; background: var(--panel-strong); border: 1px solid var(--border); }
.card h3, .card h4 { margin-top: 0; }
.kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent-2); margin-bottom: 8px; }
.checklist { display: grid; gap: 10px; }
.item { padding: 14px 16px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); }
.item.done { border-color: rgba(134,239,172,0.35); }
.item .status { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
.item.done .status { color: var(--success); }
.item.todo .status { color: var(--warn); }
.meta-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.meta { padding: 14px 16px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); }
.meta .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.meta .value { margin-top: 8px; font-weight: 600; font-size: 15px; color: var(--text); }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
pre { white-space: pre-wrap; background: rgba(0,0,0,0.24); padding: 16px; border-radius: 16px; border: 1px solid var(--border); }
@media (max-width: 980px) { .layout { grid-template-columns: 1fr; } nav { position: static; } .grid.cols-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <section class="hero">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(summary || 'Shareable HTML artifact generated by Heart of Gold Visualize.')}</p>
    ${badge ? `<div class="badge">${escapeHtml(badge)}</div>` : ''}
  </section>
  <div class="layout">
    <nav>
      <h2>Contents</h2>
      ${toc}
    </nav>
    <section>${content}</section>
  </div>
</main>
</body>
</html>`;
}

function renderOutline(doc, title, eyebrow, badge) {
  const toc = doc.sections.map((s, i) => `<a href="#section-${i}">${escapeHtml(s.title)}</a>`).join('');
  const content = doc.sections.map((section, i) => {
    const body = textFromLines(section.lines);
    const paragraphs = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
      if (b.includes('\n- ') || b.match(/^-/m)) {
        const items = b.split(/\n/).map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]).filter(Boolean);
        if (items.length) return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      }
      return `<p>${escapeHtml(b)}</p>`;
    }).join('');
    return `<article id="section-${i}" class="section"><h2>${escapeHtml(section.title)}</h2>${paragraphs || '<p>No details captured.</p>'}</article>`;
  }).join('');
  return renderShell({ title, eyebrow, summary: firstParagraph(doc.sections[0]?.lines || []), toc, content, badge });
}

function renderRoadmap(doc, title, badge) {
  const toc = ['Summary', ...doc.sections.map((s) => s.title)].map((s, i) => `<a href="#section-${i}">${escapeHtml(s)}</a>`).join('');
  const tasksSection = doc.sections.find((s) => /implementation tasks/i.test(s.title));
  const tasks = tasksSection ? collectChecklists(tasksSection.lines) : [];
  const meta = [
    ['Status', doc.frontmatter.status || 'unknown'],
    ['Confidence', doc.frontmatter.confidence || 'n/a'],
    ['Date', doc.frontmatter.date || 'n/a'],
    ['Type', doc.frontmatter.type || 'plan'],
  ];
  let content = `<article id="section-0" class="section"><h2>Summary</h2><div class="meta-grid">${meta.map(([l,v]) => `<div class="meta"><div class="label">${escapeHtml(l)}</div><div class="value">${escapeHtml(v)}</div></div>`).join('')}</div></article>`;
  if (tasks.length) {
    content += `<article id="section-1" class="section"><h2>Implementation Tasks</h2><div class="checklist">${tasks.map((t) => `<div class="item ${t.done ? 'done' : 'todo'}"><div class="status">${t.done ? 'Done' : 'Planned'}</div><div>${escapeHtml(t.text)}</div></div>`).join('')}</div></article>`;
  }
  const remaining = doc.sections.filter((s) => !/implementation tasks/i.test(s.title));
  content += remaining.map((section, idx) => {
    const body = firstParagraph(section.lines);
    return `<article id="section-${idx + 2}" class="section"><div class="kicker">Plan Section</div><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(body || 'See source markdown for full details.')}</p></article>`;
  }).join('');
  return renderShell({ title, eyebrow: 'Plan Dashboard', summary: firstParagraph(doc.sections[0]?.lines || []), toc, content, badge });
}

function renderArchitecture(doc, title, badge) {
  const toc = doc.sections.map((s, i) => `<a href="#section-${i}">${escapeHtml(s.title)}</a>`).join('');
  const cards = doc.sections.slice(0, 4).map((section) => `<div class="card"><div class="kicker">${escapeHtml(section.title)}</div><p>${escapeHtml(firstParagraph(section.lines) || 'See source markdown for detail.')}</p></div>`).join('');
  const content = `<article class="section"><h2>Architecture Overview</h2><div class="grid cols-2">${cards}</div></article>` + doc.sections.map((section, i) => `<article id="section-${i}" class="section"><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(firstParagraph(section.lines) || 'See source markdown for detail.')}</p></article>`).join('');
  return renderShell({ title, eyebrow: 'Architecture View', summary: firstParagraph(doc.sections[0]?.lines || []), toc, content, badge });
}

function renderMindmap(filePath, outFile) {
  const script = join(dirname(new URL(import.meta.url).pathname), 'render-mindmap', 'index.js');
  execFileSync('node', [script, '--html', outFile, filePath], { stdio: 'ignore' });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file || !opts.out) {
    console.error('Usage: smart-render.js <file.md> --out <file.html> [--mode auto|mindmap|outline|roadmap|architecture|mockup|explainer]');
    process.exit(1);
  }
  const markdown = readFileSync(opts.file, 'utf8');
  const doc = parseDocument(markdown);
  const mode = classifyMode(opts.file, doc, opts.mode);
  const title = doc.frontmatter.title || doc.sections[0]?.title || basename(opts.file);
  const badge = opts.mode && opts.mode !== 'auto'
    ? `Mode: ${mode}`
    : 'Mode: outline (safe default — agent may override)';

  if (mode === 'mindmap') {
    renderMindmap(opts.file, opts.out);
    return;
  }

  const html = mode === 'roadmap'
    ? renderRoadmap(doc, title, badge)
    : mode === 'architecture'
      ? renderArchitecture(doc, title, badge)
      : renderOutline(doc, title, 'Structured View', badge);
  writeFileSync(opts.out, html, 'utf8');
}

main();

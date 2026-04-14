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

function textFromLines(lines) {
  return lines.join('\n').trim();
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function firstParagraph(lines) {
  const blocks = textFromLines(lines).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks[0] || '';
}

function splitBlocks(lines) {
  return textFromLines(lines).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
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

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function renderShell({ title, eyebrow, summary, nav, content, badge = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
:root {
  --bg: #09111f;
  --bg-2: #0f1a31;
  --panel: rgba(255,255,255,0.06);
  --panel-strong: rgba(255,255,255,0.1);
  --panel-soft: rgba(255,255,255,0.04);
  --text: #eef2ff;
  --muted: #b8c0d9;
  --muted-2: #93a0bf;
  --border: rgba(255,255,255,0.11);
  --accent: #7c9cff;
  --accent-2: #80e0d0;
  --success: #86efac;
  --warn: #fbbf24;
  --danger: #fca5a5;
  --shadow: 0 24px 80px rgba(0,0,0,0.34);
  --radius-xl: 28px;
  --radius-lg: 22px;
  --radius-md: 16px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { color-scheme: dark; }
body {
  background:
    radial-gradient(circle at top left, rgba(124,156,255,0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(128,224,208,0.12), transparent 24%),
    linear-gradient(180deg, var(--bg-2) 0%, var(--bg) 100%);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.55;
}
main { max-width: 1480px; margin: 0 auto; padding: 36px 22px 84px; }
.hero {
  display: grid;
  gap: 18px;
  padding: 28px;
  border-radius: 32px;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: var(--shadow);
  margin-bottom: 24px;
}
.eyebrow { color: var(--accent-2); text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; font-weight: 700; }
.hero h1 { margin: 0; font-size: clamp(34px, 4vw, 62px); line-height: 1.02; text-wrap: balance; }
.hero p { margin: 0; max-width: 78ch; color: var(--muted); font-size: 17px; }
.hero-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.badge, .pill {
  display: inline-flex; align-items: center; gap: 8px; width: fit-content;
  padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06); color: #dce5ff; font-size: 13px;
}
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 24px;
  align-items: start;
}
main > nav, .rail {
  position: sticky;
  top: 16px;
  align-self: start;
  display: grid;
  gap: 14px;
}
.panel {
  padding: 18px;
  border-radius: var(--radius-lg);
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}
.panel h2, .panel h3 { margin: 0 0 10px; }
.panel h2 { font-size: 15px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
.nav-links { display: grid; gap: 8px; }
.nav-links a {
  display: block; padding: 10px 12px; color: var(--text); text-decoration: none;
  border-radius: 12px; background: rgba(255,255,255,0.02);
}
.nav-links a:hover { background: rgba(255,255,255,0.07); }
.section {
  margin-bottom: 20px; padding: 24px; border-radius: var(--radius-xl);
  background: var(--panel); border: 1px solid var(--border); box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}
.section h2 { margin: 0 0 14px; font-size: clamp(22px, 2vw, 32px); text-wrap: balance; }
.section h3 { margin: 0 0 10px; font-size: 18px; }
.section p, .section li, .section td, .section th { color: var(--muted); font-size: 15px; }
.section ul { margin: 0; padding-left: 18px; }
.summary-grid, .stats-grid, .aside-grid, .card-grid, .lane-grid { display: grid; gap: 16px; }
.summary-grid, .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.card-grid.cols-2, .aside-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.card, .stat, .task-card, .lane, .detail-card, .mini-card {
  padding: 18px; border-radius: var(--radius-md); background: var(--panel-soft); border: 1px solid var(--border);
}
.stat .label, .mini-card .label, .task-meta, .kicker {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.11em; color: var(--accent-2);
}
.stat .value { margin-top: 8px; font-size: 28px; font-weight: 700; color: var(--text); }
.stat .hint, .mini-card p { margin: 8px 0 0; color: var(--muted-2); font-size: 13px; }
.card p, .task-card p, .lane p { margin: 0; }
.kicker { margin-bottom: 8px; }
.lane-grid { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); align-items: start; }
.lane {
  padding: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035));
}
.lane h3 { margin: 0 0 4px; font-size: 22px; }
.lane .lane-copy { color: var(--muted-2); margin-bottom: 14px; }
.stack { display: grid; gap: 12px; }
.task-card {
  background: rgba(7, 14, 27, 0.44);
}
.task-head { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.task-id {
  display: inline-flex; align-items: center; justify-content: center; min-width: 42px;
  padding: 6px 10px; border-radius: 999px; background: rgba(124,156,255,0.18);
  color: #dbe5ff; font-weight: 700; font-size: 13px;
}
.task-title { margin: 0; font-size: 16px; line-height: 1.35; }
.task-body { color: var(--muted); font-size: 14px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: var(--muted-2); font-size: 12px;
}
.chip.warn { color: #ffd88d; border-color: rgba(251,191,36,0.22); background: rgba(251,191,36,0.08); }
.chip.good { color: #c7ffd7; border-color: rgba(134,239,172,0.24); background: rgba(134,239,172,0.08); }
.chip.danger { color: #ffd1d1; border-color: rgba(252,165,165,0.24); background: rgba(252,165,165,0.09); }
.callout {
  padding: 18px; border-radius: var(--radius-md); background: rgba(124,156,255,0.09);
  border: 1px solid rgba(124,156,255,0.18);
}
.callout strong { display: block; margin-bottom: 8px; }
.details { margin-top: 14px; }
.details summary {
  cursor: pointer; list-style: none; color: var(--text); font-weight: 600;
}
.details summary::-webkit-details-marker { display: none; }
.details .detail-body { margin-top: 12px; color: var(--muted); font-size: 14px; }
.raw {
  white-space: pre-wrap; background: rgba(0,0,0,0.24); padding: 16px; border-radius: 14px; border: 1px solid var(--border);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #d8e1fb;
}
.metric-list { display: grid; gap: 12px; }
.metric-list .mini-card { padding: 14px 16px; }
.metric-list .value { margin-top: 6px; font-size: 15px; color: var(--text); font-weight: 600; }
@media (max-width: 1080px) {
  .page { grid-template-columns: 1fr; }
  main > nav, .rail { position: static; }
  .summary-grid, .stats-grid, .card-grid.cols-2, .aside-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  main { padding: 20px 14px 60px; }
  .hero, .section { padding: 20px; }
  .summary-grid, .stats-grid, .card-grid.cols-2, .aside-grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<main>
  <section class="hero">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(summary || 'Shareable HTML artifact generated by Heart of Gold Visualize.')}</p>
    <div class="hero-row">
      ${badge ? `<div class="badge">${escapeHtml(badge)}</div>` : ''}
    </div>
  </section>
  <div class="page">
    <section>${content}</section>
    <aside class="rail">${nav}</aside>
  </div>
</main>
</body>
</html>`;
}

function renderListBlock(block) {
  const items = block.split(/\n/).map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1]).filter(Boolean);
  if (!items.length) return null;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderOutline(doc, title, eyebrow, badge) {
  const nav = `
    <div class="panel"><h2>View</h2><div class="metric-list"><div class="mini-card"><div class="label">Mode</div><div class="value">Structured outline</div><p>Safe default when the agent does not force a richer artifact family.</p></div></div></div>
    <div class="panel"><h2>Sections</h2><div class="nav-links">${doc.sections.map((s, i) => `<a href="#section-${i}">${escapeHtml(s.title)}</a>`).join('')}</div></div>`;
  const content = doc.sections.map((section, i) => {
    const blocks = splitBlocks(section.lines).map((block) => renderListBlock(block) || `<p>${escapeHtml(block)}</p>`).join('');
    return `<article id="section-${i}" class="section"><div class="kicker">Structured View</div><h2>${escapeHtml(section.title)}</h2>${blocks || '<p>No details captured.</p>'}</article>`;
  }).join('');
  return renderShell({ title, eyebrow, summary: firstParagraph(doc.sections[0]?.lines || []), nav, content, badge });
}

function parseTaskSection(section) {
  const source = textFromLines(section.lines);
  if (!source) return [];
  const regex = /- \[( |x)\]\s+\*\*([^*]+)\*\*\s*([\s\S]*?)(?=(?:\s+- \[(?: |x)\]\s+\*\*)|$)/g;
  const tasks = [];
  let match;
  while ((match = regex.exec(source))) {
    const done = match[1].toLowerCase() === 'x';
    const bold = normalizeWhitespace(match[2]);
    const detail = normalizeWhitespace(match[3] || '');
    const idMatch = bold.match(/^([A-Z][A-Z0-9-]*)\.\s*(.+)$/);
    const id = idMatch ? idMatch[1] : null;
    const title = idMatch ? idMatch[2] : bold;
    const depMatch = detail.match(/\*\*\[depends on ([^\]]+)\]\*\*/i);
    const parallel = /\*\*\[parallel(?: with [^\]]+)?\]\*\*/i.test(detail);
    const notInAcceptance = /not in this plan'?s acceptance/i.test(detail);
    tasks.push({
      done,
      id,
      title,
      detail,
      dependency: depMatch ? depMatch[1] : null,
      parallel,
      deferred: notInAcceptance,
    });
  }
  return tasks;
}

function compactDetail(detail) {
  return detail
    .replace(/\*\*\[parallel(?: with [^\]]+)?\]\*\*/ig, '')
    .replace(/\*\*\[depends on ([^\]]+)\]\*\*/ig, 'Depends on $1.')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPlanModel(doc) {
  const byTitle = new Map(doc.sections.map((s) => [s.title.toLowerCase(), s]));
  const find = (name) => byTitle.get(name.toLowerCase());
  const prioritySections = doc.sections.filter((s) => /^(P\d+|Deferred)/.test(s.title));
  const workstreams = prioritySections.map((section) => ({
    title: section.title,
    summary: firstParagraph(section.lines),
    tasks: parseTaskSection(section),
  }));

  const tasks = workstreams.flatMap((lane) => lane.tasks.map((task) => ({ ...task, lane: lane.title })));
  const dependencies = tasks.filter((t) => t.dependency);
  const risksText = firstParagraph(find('Risk Analysis')?.lines || []);
  const acceptanceText = firstParagraph(find('Acceptance Criteria')?.lines || []);
  const constraintsText = firstParagraph(find('Constraints and Boundaries')?.lines || []);
  const proposedSolution = firstParagraph(find('Proposed Solution')?.lines || []);
  const scope = firstParagraph(find('Scope and Non-Goals')?.lines || []);
  const rationale = firstParagraph(find('Decision Rationale')?.lines || []);

  return {
    mission: firstParagraph(doc.sections[0]?.lines || []),
    problem: firstParagraph(find('Problem Statement')?.lines || []),
    targetEndState: firstParagraph(find('Target End State')?.lines || []),
    proposedSolution,
    scope,
    rationale,
    risksText,
    acceptanceText,
    constraintsText,
    workstreams,
    tasks,
    dependencyCount: dependencies.length,
    parallelCount: tasks.filter((t) => t.parallel).length,
    deferredCount: tasks.filter((t) => t.deferred).length,
  };
}

function renderTaskCard(task) {
  const chips = [];
  chips.push(`<span class="chip ${task.done ? 'good' : 'warn'}">${task.done ? 'Done' : 'Planned'}</span>`);
  if (task.dependency) chips.push(`<span class="chip">Depends on ${escapeHtml(task.dependency)}</span>`);
  if (task.parallel) chips.push('<span class="chip good">Parallel</span>');
  if (task.deferred) chips.push('<span class="chip danger">Deferred</span>');
  const detail = compactDetail(task.detail);
  const short = detail.slice(0, 220) + (detail.length > 220 ? '…' : '');
  return `<article class="task-card">
    <div class="task-head">
      <div>
        <div class="task-meta">${escapeHtml(task.lane || 'Task')}</div>
        <h4 class="task-title">${task.id ? `<span class="task-id">${escapeHtml(task.id)}</span> ` : ''}${escapeHtml(task.title)}</h4>
      </div>
    </div>
    ${short ? `<p class="task-body">${escapeHtml(short)}</p>` : ''}
    <div class="chip-row">${chips.join('')}</div>
    ${detail.length > 220 ? `<details class="details"><summary>Show Full Task Detail</summary><div class="detail-body">${escapeHtml(detail)}</div></details>` : ''}
  </article>`;
}

function renderRoadmap(doc, title, badge) {
  const model = extractPlanModel(doc);
  const nav = `
    <div class="panel">
      <h2>Execution Snapshot</h2>
      <div class="metric-list">
        <div class="mini-card"><div class="label">Mode</div><div class="value">Plan dashboard</div><p>Optimized for execution clarity rather than markdown fidelity.</p></div>
        <div class="mini-card"><div class="label">Workstreams</div><div class="value">${model.workstreams.length}</div></div>
        <div class="mini-card"><div class="label">Tasks</div><div class="value">${model.tasks.length}</div></div>
        <div class="mini-card"><div class="label">Dependencies</div><div class="value">${model.dependencyCount}</div></div>
      </div>
    </div>
    <div class="panel">
      <h2>Jump</h2>
      <div class="nav-links">
        <a href="#summary">Summary</a>
        <a href="#workstreams">Priority Lanes</a>
        <a href="#acceptance">Acceptance & Risks</a>
        <a href="#appendix">Source Appendix</a>
      </div>
    </div>
    <div class="panel">
      <h2>Decision</h2>
      <p>${escapeHtml(model.rationale || 'Execution-first plan view selected to foreground phases, tasks, and dependencies.')}</p>
    </div>`;

  const heroStats = [
    ['Workstreams', model.workstreams.length, 'Priority lanes in this plan'],
    ['Tasks', model.tasks.length, 'Tracked implementation actions'],
    ['Parallel', model.parallelCount, 'Tasks marked as parallelizable'],
    ['Deferred', model.deferredCount, 'Explicitly out of this pass'],
  ];

  const topTasks = model.tasks.slice(0, 4).map(renderTaskCard).join('');
  const laneHtml = model.workstreams.map((lane) => {
    const laneId = slugify(lane.title);
    const intro = lane.summary || `${lane.tasks.length} task${lane.tasks.length === 1 ? '' : 's'} in this lane.`;
    return `<section class="lane" id="lane-${laneId}">
      <div class="kicker">Priority Lane</div>
      <h3>${escapeHtml(lane.title)}</h3>
      <p class="lane-copy">${escapeHtml(intro)}</p>
      <div class="stack">${lane.tasks.length ? lane.tasks.map(renderTaskCard).join('') : '<div class="task-card"><p class="task-body">No parsed tasks found. See appendix for source detail.</p></div>'}</div>
    </section>`;
  }).join('');

  const appendixSections = doc.sections.map((section, i) => {
    const raw = textFromLines(section.lines);
    const snippet = raw.length > 1400 ? `${raw.slice(0, 1400)}\n…` : raw;
    return `<article class="detail-card">
      <div class="kicker">Source Section</div>
      <h3>${escapeHtml(section.title)}</h3>
      <details class="details" ${i < 2 ? 'open' : ''}><summary>Show Source Detail</summary><div class="detail-body"><div class="raw">${escapeHtml(snippet || 'No detail captured.')}</div></div></details>
    </article>`;
  }).join('');

  const content = `
    <article class="section" id="summary">
      <div class="kicker">Plan Dashboard</div>
      <h2>Execution Summary</h2>
      <div class="callout"><strong>Mission</strong>${escapeHtml(model.mission || 'No summary captured.')}</div>
      <div class="summary-grid" style="margin-top:16px;">
        ${heroStats.map(([label, value, hint]) => `<div class="stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div><div class="hint">${escapeHtml(hint)}</div></div>`).join('')}
      </div>
      <div class="aside-grid" style="margin-top:16px;">
        <div class="card"><div class="kicker">Problem</div><h3>Why This Exists</h3><p>${escapeHtml(model.problem || 'See source document for full problem framing.')}</p></div>
        <div class="card"><div class="kicker">Target</div><h3>What Good Looks Like</h3><p>${escapeHtml(model.targetEndState || 'See source document for target end state.')}</p></div>
      </div>
    </article>

    <article class="section">
      <div class="kicker">Plan Strategy</div>
      <h2>Scope, Approach & Key Moves</h2>
      <div class="card-grid cols-2">
        <div class="card"><div class="kicker">Scope</div><p>${escapeHtml(model.scope || 'See source document for scope detail.')}</p></div>
        <div class="card"><div class="kicker">Approach</div><p>${escapeHtml(model.proposedSolution || 'See source document for solution framing.')}</p></div>
      </div>
    </article>

    <article class="section" id="workstreams">
      <div class="kicker">Priority Lanes</div>
      <h2>Workstreams & Tasks</h2>
      <p>The plan is shown as priority lanes so execution order, task grouping, and dependency shape are visible without reading the full markdown in sequence.</p>
      <div class="lane-grid" style="margin-top:16px;">${laneHtml}</div>
    </article>

    <article class="section">
      <div class="kicker">Immediate Scan</div>
      <h2>Representative Tasks</h2>
      <div class="card-grid cols-2">${topTasks || '<div class="card"><p>No tasks captured.</p></div>'}</div>
    </article>

    <article class="section" id="acceptance">
      <div class="kicker">Execution Guardrails</div>
      <h2>Acceptance, Risks & Constraints</h2>
      <div class="card-grid cols-2">
        <div class="card"><div class="kicker">Acceptance Gates</div><p>${escapeHtml(model.acceptanceText || 'See source markdown for explicit acceptance criteria.')}</p></div>
        <div class="card"><div class="kicker">Primary Risk</div><p>${escapeHtml(model.risksText || 'No risk summary extracted.')}</p></div>
        <div class="card"><div class="kicker">Constraint</div><p>${escapeHtml(model.constraintsText || 'No constraint summary extracted.')}</p></div>
        <div class="card"><div class="kicker">Decision Rationale</div><p>${escapeHtml(model.rationale || 'No rationale summary extracted.')}</p></div>
      </div>
    </article>

    <article class="section" id="appendix">
      <div class="kicker">Source Appendix</div>
      <h2>Source Detail</h2>
      <p>The raw plan remains canonical. This appendix keeps source detail available without letting markdown dominate the primary reading path.</p>
      <div class="stack" style="margin-top:16px;">${appendixSections}</div>
    </article>`;

  return renderShell({ title, eyebrow: 'Plan Dashboard', summary: model.mission, nav, content, badge });
}

function renderArchitecture(doc, title, badge) {
  const nav = `
    <div class="panel"><h2>View</h2><div class="metric-list"><div class="mini-card"><div class="label">Mode</div><div class="value">Architecture brief</div><p>Focused on boundaries, sections, and key decisions.</p></div></div></div>
    <div class="panel"><h2>Sections</h2><div class="nav-links">${doc.sections.map((s, i) => `<a href="#section-${i}">${escapeHtml(s.title)}</a>`).join('')}</div></div>`;
  const cards = doc.sections.slice(0, 6).map((section) => `<div class="card"><div class="kicker">${escapeHtml(section.title)}</div><p>${escapeHtml(firstParagraph(section.lines) || 'See source markdown for detail.')}</p></div>`).join('');
  const detail = doc.sections.map((section, i) => `<article id="section-${i}" class="section"><div class="kicker">Architecture Section</div><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(firstParagraph(section.lines) || 'See source markdown for detail.')}</p></article>`).join('');
  const content = `<article class="section"><div class="kicker">Architecture View</div><h2>System Overview</h2><div class="card-grid cols-2">${cards}</div></article>${detail}`;
  return renderShell({ title, eyebrow: 'Architecture View', summary: firstParagraph(doc.sections[0]?.lines || []), nav, content, badge });
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

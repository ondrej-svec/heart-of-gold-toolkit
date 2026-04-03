#!/usr/bin/env node

/**
 * render-mindmap — Terminal-native Unicode mind map renderer
 *
 * Usage:
 *   node index.js [file.md]           # render markdown file
 *   node index.js --json [file.json]  # render JSON tree
 *   cat file.md | node index.js       # pipe markdown via stdin
 *
 * Options:
 *   --width N      Constrain to N columns (default: terminal width or 120)
 *   --depth N      Limit rendering depth
 *   --no-color     Plain Unicode without ANSI colors
 *   --json         Treat input as JSON (not markdown)
 *   --compact      Single-line nodes without boxes
 *   --html [out]   Generate interactive HTML via markmap-cli
 */

import { readFileSync, writeFileSync, mkdtempSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { parseMarkdown, parseJSON } from './parse.js';
import { renderMindmap } from './render.js';
import { renderCompact } from './compact.js';
import { renderVertical } from './vertical.js';

function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  // Read input
  let input;
  if (opts.file) {
    input = readFileSync(opts.file, 'utf8');
  } else if (!process.stdin.isTTY) {
    input = readFileSync('/dev/stdin', 'utf8');
  } else {
    console.error('Usage: render-mindmap [options] [file.md]');
    console.error('  or: cat file.md | render-mindmap');
    console.error('');
    console.error('Options:');
    console.error('  --width N      Terminal width (default: auto or 120)');
    console.error('  --depth N      Max depth to render');
    console.error('  --no-color     Disable ANSI colors');
    console.error('  --json         Parse input as JSON tree');
    console.error('  --compact      Compact tree (no boxes)');
    console.error('  --html [file]  Generate HTML mind map via markmap');
    process.exit(1);
  }

  // HTML mode: pipe markdown to markmap-cli
  if (opts.html) {
    const outFile = opts.htmlOutput || (opts.file ? opts.file.replace(/\.\w+$/, '.html') : '/tmp/mindmap.html');
    // If input is already markdown, use it directly; otherwise write source
    const mdSource = opts.json ? treeToMarkdown(parseJSON(input)) : input;
    const tmpDir = mkdtempSync(join(tmpdir(), 'mindmap-'));
    const tmpMd = join(tmpDir, 'source.md');
    writeFileSync(tmpMd, mdSource, 'utf8');
    try {
      execSync(`npx markmap-cli "${tmpMd}" --no-open --offline -o "${outFile}"`, { stdio: 'pipe' });
      console.log(`HTML mind map written to: ${outFile}`);
    } catch (e) {
      console.error('markmap-cli failed. Install with: npm install -g markmap-cli');
      console.error(e.stderr?.toString() || e.message);
      process.exit(1);
    } finally {
      try { unlinkSync(tmpMd); } catch {}
    }
    return;
  }

  // Parse input into tree
  let tree;
  if (opts.json) {
    tree = parseJSON(input);
  } else {
    tree = parseMarkdown(input);
  }

  // Render
  if (opts.compact) {
    const output = renderCompact(tree, { color: opts.color, maxDepth: opts.depth });
    console.log(output);
  } else if (opts.horizontal) {
    const output = renderMindmap(tree, {
      maxWidth: opts.width,
      maxDepth: opts.depth,
      color: opts.color,
    });
    console.log(output);
  } else {
    // Default: vertical layout (fits narrow panels like Claude Code)
    const output = renderVertical(tree, {
      color: opts.color,
      maxDepth: opts.depth,
    });
    console.log(output);
  }
}

function treeToMarkdown(node, depth = 1) {
  const prefix = '#'.repeat(Math.min(depth, 6));
  let md = `${prefix} ${node.label}\n`;
  for (const child of node.children || []) {
    md += treeToMarkdown(child, depth + 1);
  }
  return md;
}

function parseArgs(args) {
  const opts = {
    file: null,
    width: process.stdout.columns || 120,
    depth: Infinity,
    color: true,
    json: false,
    compact: false,
    horizontal: false,
    html: false,
    htmlOutput: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--width' && i + 1 < args.length) {
      opts.width = parseInt(args[++i], 10);
    } else if (arg === '--depth' && i + 1 < args.length) {
      opts.depth = parseInt(args[++i], 10);
    } else if (arg === '--no-color') {
      opts.color = false;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--compact') {
      opts.compact = true;
    } else if (arg === '--horizontal') {
      opts.horizontal = true;
    } else if (arg === '--html') {
      opts.html = true;
      // Next arg might be output path (if it doesn't start with -)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        opts.htmlOutput = args[++i];
      }
    } else if (!arg.startsWith('-')) {
      opts.file = arg;
    }
  }

  return opts;
}

main();

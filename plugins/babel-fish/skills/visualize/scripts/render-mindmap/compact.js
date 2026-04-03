/**
 * compact.js — Compact tree renderer (no boxes)
 *
 * Renders a tree as an indented list with Unicode connectors:
 *
 *   Content Pipeline
 *   ├── Data Sources
 *   │   ├── Gmail API
 *   │   ├── RSS feeds
 *   │   └── Twitter/X
 *   ├── Processing
 *   │   ├── Signal scoring
 *   │   └── Deduplication
 *   └── Output
 *       ├── Newsletter
 *       └── Blog ideas
 */

import chalk from 'chalk';

const DEPTH_COLORS = [
  (t) => chalk.bold.white.bgBlue(` ${t} `),
  (t) => chalk.bold.cyan(t),
  (t) => chalk.green(t),
  (t) => chalk.yellow(t),
  (t) => chalk.dim(t),
];

/**
 * Render a tree as a compact indented list with connectors.
 *
 * @param {{ label: string, children: any[] }} tree
 * @param {Object} [opts]
 * @param {boolean} [opts.color=true]
 * @param {number} [opts.maxDepth=Infinity]
 * @returns {string}
 */
export function renderCompact(tree, opts = {}) {
  const useColor = opts.color !== false;
  const maxDepth = opts.maxDepth ?? Infinity;
  const lines = [];

  renderNode(lines, tree, '', true, 0, maxDepth, useColor);
  return lines.join('\n');
}

function renderNode(lines, node, prefix, isLast, depth, maxDepth, useColor) {
  const label = node.label || '';

  if (depth === 0) {
    // Root node — no connector
    lines.push(useColor ? colorize(label, 0) : label);
  } else {
    const connector = isLast ? '└── ' : '├── ';
    const styledLabel = useColor ? colorize(label, depth) : label;
    lines.push(prefix + connector + styledLabel);
  }

  const children = node.children || [];
  if (depth >= maxDepth && children.length > 0) {
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');
    const hint = useColor ? chalk.dim(`[+${children.length} more]`) : `[+${children.length} more]`;
    lines.push(childPrefix + '└── ' + hint);
    return;
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childIsLast = i === children.length - 1;
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');
    renderNode(lines, child, childPrefix, childIsLast, depth + 1, maxDepth, useColor);
  }
}

function colorize(text, depth) {
  const fn = DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
  return fn(text);
}

/**
 * vertical.js — Vertical mind map renderer
 *
 * Renders a tree vertically (top-to-bottom flow, left-aligned).
 * Root and depth-1 nodes get Unicode boxes. Deeper nodes use compact ├──/└── notation.
 * Optimized for narrow output areas like Claude Code's response text.
 *
 * Width: ~40-60 chars. Height: unlimited (uses vertical space).
 */

import chalk from 'chalk';

const BOX = {
  topLeft: '╭', top: '─', topRight: '╮',
  left: '│', right: '│',
  bottomLeft: '╰', bottom: '─', bottomRight: '╯',
};

const DEPTH_COLORS = [
  (t) => chalk.bold.cyan(t),           // root box border
  (t) => chalk.green(t),               // depth 1 box border
  (t) => chalk.yellow(t),              // depth 2 leaves
  (t) => chalk.dim(t),                 // depth 3+
];

const LABEL_COLORS = [
  (t) => chalk.bold.white(t),          // root label
  (t) => chalk.bold.cyan(t),           // depth 1 label
  (t) => chalk.green(t),               // depth 2 label
  (t) => chalk.yellow(t),              // depth 3+ label
];

function colorBox(char, depth, useColor) {
  if (!useColor) return char;
  const fn = DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
  return fn(char);
}

function colorLabel(text, depth, useColor) {
  if (!useColor) return text;
  const fn = LABEL_COLORS[Math.min(depth, LABEL_COLORS.length - 1)];
  return fn(text);
}

function colorTree(char, depth, useColor) {
  if (!useColor) return char;
  const fn = DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
  return fn(char);
}

/**
 * Render a box around text.
 * Returns array of lines.
 */
function renderBox(label, indent, depth, useColor) {
  const pad = 2;
  const innerWidth = label.length + pad * 2;
  const topLine = colorBox(BOX.topLeft + BOX.top.repeat(innerWidth) + BOX.topRight, depth, useColor);
  const midLine = colorBox(BOX.left, depth, useColor)
    + ' '.repeat(pad) + colorLabel(label, depth, useColor) + ' '.repeat(pad)
    + colorBox(BOX.right, depth, useColor);
  const botLine = colorBox(BOX.bottomLeft + BOX.bottom.repeat(innerWidth) + BOX.bottomRight, depth, useColor);
  return [
    indent + topLine,
    indent + midLine,
    indent + botLine,
  ];
}

/**
 * Render the vertical mind map.
 *
 * @param {{ label: string, children: any[] }} tree
 * @param {Object} [opts]
 * @param {boolean} [opts.color=true]
 * @param {number} [opts.maxDepth=Infinity]
 * @param {number} [opts.boxDepth=1] — max depth for boxed nodes (deeper = compact)
 * @returns {string}
 */
export function renderVertical(tree, opts = {}) {
  const useColor = opts.color !== false;
  const maxDepth = opts.maxDepth ?? Infinity;
  const boxDepth = opts.boxDepth ?? 1;
  const lines = [];

  renderNode(lines, tree, '', true, 0, maxDepth, boxDepth, useColor, true);
  return lines.join('\n');
}

function renderNode(lines, node, prefix, isLast, depth, maxDepth, boxDepth, useColor, isRoot) {
  const label = node.label || '';
  const children = node.children || [];

  if (isRoot) {
    // Root: centered box, no prefix
    const boxLines = renderBox(label, '', depth, useColor);
    lines.push(...boxLines);

    if (children.length > 0) {
      const connector = colorTree('  │', depth, useColor);
      lines.push(connector);
    }
  } else if (depth <= boxDepth) {
    // Boxed node: prefix + connector + box
    const branch = isLast ? '└─' : '├─';
    const cont = isLast ? '  ' : '│ ';

    // Box with branch connector
    const boxLines = renderBox(label, '', depth, useColor);
    const branchChar = colorTree(prefix + branch, depth - 1, useColor);
    lines.push(branchChar + boxLines[0]);
    lines.push(colorTree(prefix + cont, depth - 1, useColor) + boxLines[1]);
    lines.push(colorTree(prefix + cont, depth - 1, useColor) + boxLines[2]);

    if (children.length > 0 && depth < maxDepth) {
      lines.push(colorTree(prefix + cont + '  │', depth, useColor));
    }
  } else {
    // Compact leaf: prefix + ├── label
    const branch = isLast ? '└── ' : '├── ';
    lines.push(colorTree(prefix + branch, depth - 1, useColor) + colorLabel(label, depth, useColor));
  }

  // Render children
  if (depth >= maxDepth) {
    if (children.length > 0) {
      const cont = isRoot ? '  ' : (isLast ? '    ' : '│   ');
      const childPrefix = isRoot ? '  ' : prefix + cont;
      const hint = `+${children.length} more`;
      lines.push(colorTree(childPrefix + '└── ', depth, useColor) + colorLabel(hint, depth + 1, useColor));
    }
    return;
  }

  const maxChildren = depth === 0 ? 8 : (depth <= boxDepth ? 6 : 5);
  let visibleChildren = children;
  let overflow = 0;

  if (children.length > maxChildren) {
    overflow = children.length - maxChildren + 1;
    visibleChildren = children.slice(0, maxChildren - 1);
  }

  for (let i = 0; i < visibleChildren.length; i++) {
    const child = visibleChildren[i];
    const childIsLast = (i === visibleChildren.length - 1) && overflow === 0;

    let childPrefix;
    if (isRoot) {
      childPrefix = '  ';
    } else if (depth <= boxDepth) {
      childPrefix = prefix + (isLast ? '  ' : '│ ') + '  ';
    } else {
      childPrefix = prefix + (isLast ? '    ' : '│   ');
    }

    renderNode(lines, child, childPrefix, childIsLast, depth + 1, maxDepth, boxDepth, useColor, false);

    // Add spacing between boxed siblings (not after last)
    if (depth + 1 <= boxDepth && !childIsLast) {
      const cont = isRoot ? '  │' : prefix + (isLast ? '  ' : '│ ') + '  │';
      lines.push(colorTree(cont, depth, useColor));
    }
  }

  if (overflow > 0) {
    let childPrefix;
    if (isRoot) {
      childPrefix = '  ';
    } else if (depth <= boxDepth) {
      childPrefix = prefix + (isLast ? '  ' : '│ ') + '  ';
    } else {
      childPrefix = prefix + (isLast ? '    ' : '│   ');
    }
    const hint = `+${overflow} more`;
    lines.push(colorTree(childPrefix + '└── ', depth, useColor) + colorLabel(hint, depth + 1, useColor));
  }
}

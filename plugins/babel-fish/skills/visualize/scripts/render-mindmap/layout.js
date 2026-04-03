/**
 * layout.js — Tree layout algorithm for character grids
 *
 * Implements a top-down tree layout with these properties:
 * - Parent centered above children
 * - No node overlap
 * - Siblings evenly spaced
 * - Deterministic output
 *
 * Outputs character-grid coordinates (integers) for each node.
 */

const NODE_PAD_X = 2;       // horizontal padding inside box (each side)
const NODE_PAD_Y = 0;       // vertical padding inside box (each side)
const SIBLING_GAP = 4;      // horizontal gap between sibling nodes
const LEVEL_GAP = 2;        // vertical gap between levels (for connectors)
const MIN_NODE_WIDTH = 5;   // minimum box inner width

/**
 * @typedef {Object} LayoutNode
 * @property {string} label
 * @property {LayoutNode[]} children
 * @property {number} x - left edge in character coords
 * @property {number} y - top edge in character coords
 * @property {number} width - box width in characters
 * @property {number} height - box height in characters
 * @property {number} depth - depth in tree (0 = root)
 */

const MAX_LABEL = 20;       // max characters for a node label
const MAX_CHILDREN = 5;     // max visible children per node

/**
 * Compute layout for a tree, placing nodes on a character grid.
 *
 * @param {{ label: string, children: any[] }} tree
 * @param {Object} [opts]
 * @param {number} [opts.maxWidth=120] - max terminal width
 * @param {number} [opts.maxDepth=Infinity] - max depth to render
 * @returns {LayoutNode} - root node with x,y,width,height set on all nodes
 */
export function computeLayout(tree, opts = {}) {
  const maxDepth = opts.maxDepth ?? Infinity;

  const maxWidth = opts.maxWidth || 120;

  // Step 0: Prune tree — cap children count, truncate labels
  // Auto-detect depth: try deeper layouts, fall back if too wide
  let effectiveDepth = maxDepth;
  if (maxDepth === Infinity) {
    // Try depths 3, 2, 1 — pick the deepest that fits maxWidth
    for (const tryDepth of [3, 2, 1]) {
      const trial = measure(pruneTree(tree, tryDepth), 0, tryDepth);
      computeSubtreeWidths(trial);
      if (trial.subtreeWidth <= maxWidth || tryDepth === 1) {
        effectiveDepth = tryDepth;
        break;
      }
    }
  }

  const pruned = pruneTree(tree, effectiveDepth);

  // Step 1: Measure all nodes (compute box dimensions from labels)
  const measured = measure(pruned, 0, effectiveDepth);

  // Step 2: Compute x positions using a bottom-up approach
  // Each subtree's width is the sum of its children's widths + gaps
  computeSubtreeWidths(measured);

  // Step 3: Assign x positions top-down
  assignX(measured, 0);

  // Step 4: Assign y positions based on depth
  assignY(measured, 0);

  // Step 5: Normalize — shift everything so minimum x is 0
  const minX = findMinX(measured);
  shiftX(measured, -minX);

  return measured;
}

function pruneTree(node, maxDepth, depth = 0) {
  let label = (node.label || '').trim();
  // Truncate long labels — shorter at deeper levels
  const labelLimit = depth === 0 ? MAX_LABEL : Math.max(12, MAX_LABEL - depth * 3);
  if (label.length > labelLimit) {
    label = label.slice(0, labelLimit - 1) + '…';
  }

  let children = (node.children || []);
  if (depth >= maxDepth) {
    children = [];
  }

  // Fewer children allowed at deeper levels
  const childLimit = Math.max(3, MAX_CHILDREN - depth);

  // Cap children and add overflow indicator
  if (children.length > childLimit) {
    const overflow = children.length - childLimit + 1;
    children = [
      ...children.slice(0, childLimit - 1).map(c => pruneTree(c, maxDepth, depth + 1)),
      { label: `+${overflow} more`, children: [] }
    ];
  } else {
    children = children.map(c => pruneTree(c, maxDepth, depth + 1));
  }

  return { label, children };
}

function measure(node, depth, maxDepth) {
  const label = node.label || '';
  const innerWidth = Math.max(label.length, MIN_NODE_WIDTH);
  const boxWidth = innerWidth + NODE_PAD_X * 2 + 2; // +2 for border chars
  const boxHeight = 3 + NODE_PAD_Y * 2; // top border + content + bottom border

  const children = depth < maxDepth
    ? (node.children || []).map(c => measure(c, depth + 1, maxDepth))
    : [];

  // If children were truncated, add a placeholder
  if (depth >= maxDepth && node.children && node.children.length > 0) {
    children.push({
      label: `[+${node.children.length}]`,
      children: [],
      boxWidth: `[+${node.children.length}]`.length + NODE_PAD_X * 2 + 2,
      boxHeight: boxHeight,
      depth: depth + 1,
      subtreeWidth: `[+${node.children.length}]`.length + NODE_PAD_X * 2 + 2,
      x: 0, y: 0,
      width: `[+${node.children.length}]`.length + NODE_PAD_X * 2 + 2,
      height: boxHeight,
    });
  }

  return {
    label,
    children,
    boxWidth,
    boxHeight,
    depth,
    subtreeWidth: 0, // computed next
    x: 0,
    y: 0,
    width: boxWidth,
    height: boxHeight,
  };
}

function computeSubtreeWidths(node) {
  if (node.children.length === 0) {
    node.subtreeWidth = node.boxWidth;
    return;
  }

  for (const child of node.children) {
    computeSubtreeWidths(child);
  }

  const childrenTotalWidth = node.children.reduce(
    (sum, c) => sum + c.subtreeWidth, 0
  ) + SIBLING_GAP * (node.children.length - 1);

  node.subtreeWidth = Math.max(node.boxWidth, childrenTotalWidth);
}

function assignX(node, leftEdge) {
  // Distribute children first (bottom-up centering)
  let childLeft = leftEdge;
  for (const child of node.children) {
    assignX(child, childLeft);
    childLeft += child.subtreeWidth + SIBLING_GAP;
  }

  if (node.children.length > 0) {
    // Center parent precisely between first and last child centers
    const firstChildCenter = node.children[0].x + Math.floor(node.children[0].width / 2);
    const lastChild = node.children[node.children.length - 1];
    const lastChildCenter = lastChild.x + Math.floor(lastChild.width / 2);
    const midpoint = Math.floor((firstChildCenter + lastChildCenter) / 2);
    node.x = midpoint - Math.floor(node.boxWidth / 2);
  } else {
    // Leaf node: center within its subtree width
    node.x = leftEdge + Math.floor((node.subtreeWidth - node.boxWidth) / 2);
  }
}

function assignY(node, y) {
  node.y = y;
  const childY = y + node.boxHeight + LEVEL_GAP;
  for (const child of node.children) {
    assignY(child, childY);
  }
}

function findMinX(node) {
  let min = node.x;
  for (const child of node.children) {
    min = Math.min(min, findMinX(child));
  }
  return min;
}

function shiftX(node, dx) {
  node.x += dx;
  for (const child of node.children) {
    shiftX(child, dx);
  }
}

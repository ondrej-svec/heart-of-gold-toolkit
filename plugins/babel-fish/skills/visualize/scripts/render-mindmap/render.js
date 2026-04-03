/**
 * render.js — Orchestrator: layout → grid → colored output
 *
 * Takes a tree structure, computes layout, draws boxes and connectors
 * on a character grid, then applies ANSI colors for the final output.
 */

import { computeLayout } from './layout.js';
import { Grid } from './grid.js';
import { colorLabel, colorLine, colorConnector } from './color.js';

// Box-drawing characters (must match grid.js)
const BOX_CHARS = new Set(['╭', '╮', '╰', '╯', '─', '│']);
const CONNECTOR_CHARS = new Set(['─', '│', '┬', '┴', '├', '┤', '┼', '┌', '┐', '└', '┘']);

/**
 * Render a tree as a colored Unicode mind map string.
 *
 * @param {{ label: string, children: any[] }} tree
 * @param {Object} [opts]
 * @param {number} [opts.maxWidth=120]
 * @param {number} [opts.maxDepth=Infinity]
 * @param {boolean} [opts.color=true]
 * @returns {string}
 */
export function renderMindmap(tree, opts = {}) {
  const useColor = opts.color !== false;
  const maxDepth = opts.maxDepth ?? Infinity;

  // Step 1: Compute layout
  const layoutRoot = computeLayout(tree, { maxWidth: opts.maxWidth, maxDepth });

  // Step 2: Draw on grid
  const grid = new Grid();
  drawNode(grid, layoutRoot);
  drawConnectors(grid, layoutRoot);

  // Step 3: Apply colors if enabled
  if (useColor) {
    return applyColors(grid, layoutRoot);
  }

  return grid.toString();
}

/**
 * Draw a node's box and label on the grid.
 */
function drawNode(grid, node) {
  grid.drawBox(node.x, node.y, node.width, node.height);

  // Center label inside box
  const innerWidth = node.width - 2; // minus borders
  const label = node.label.length > innerWidth
    ? node.label.slice(0, innerWidth - 1) + '…'
    : node.label;
  const padLeft = Math.floor((innerWidth - label.length) / 2);
  grid.writeText(node.x + 1 + padLeft, node.y + 1, label);

  // Recurse into children
  for (const child of node.children) {
    drawNode(grid, child);
  }
}

/**
 * Draw connector lines between parent and children.
 * Pattern: vertical line down from parent's bottom center,
 * horizontal line spanning all children, vertical lines down to each child.
 */
function drawConnectors(grid, node) {
  if (node.children.length === 0) return;

  const parentCenterX = node.x + Math.floor(node.width / 2);
  const parentBottomY = node.y + node.height - 1;

  // Single child: straight vertical line
  if (node.children.length === 1) {
    const child = node.children[0];
    const childCenterX = child.x + Math.floor(child.width / 2);
    const connectorY = parentBottomY + 1;

    // Vertical from parent
    grid.drawVerticalLine(parentCenterX, parentBottomY + 1, child.y - 1);

    // If child isn't directly below, add horizontal jog
    if (childCenterX !== parentCenterX) {
      const midY = parentBottomY + 1;
      grid.drawHorizontalLine(
        Math.min(parentCenterX, childCenterX),
        Math.max(parentCenterX, childCenterX),
        midY
      );
      grid.drawVerticalLine(childCenterX, midY, child.y - 1);
    }
  } else {
    // Multiple children: connector with horizontal bar
    const midY = parentBottomY + 1; // row for the horizontal connector

    // Find child centers
    const childCenters = node.children.map(c => c.x + Math.floor(c.width / 2));
    const leftmost = Math.min(...childCenters);
    const rightmost = Math.max(...childCenters);

    // Build set of all junction points on the horizontal bar
    const junctions = new Set(childCenters);
    junctions.add(parentCenterX);

    // Draw horizontal line spanning all junctions
    const barLeft = Math.min(leftmost, parentCenterX);
    const barRight = Math.max(rightmost, parentCenterX);
    grid.drawHorizontalLine(barLeft, barRight, midY);

    // Place junction characters
    // Sort all junction x positions
    const sortedJunctions = [...junctions].sort((a, b) => a - b);
    for (let i = 0; i < sortedJunctions.length; i++) {
      const jx = sortedJunctions[i];
      const isLeftEnd = (jx === barLeft);
      const isRightEnd = (jx === barRight);
      const isParent = (jx === parentCenterX);
      const isChild = childCenters.includes(jx);

      if (isLeftEnd && !isParent) {
        // Left end, going down to child only
        grid.set(jx, midY, '┌');
      } else if (isRightEnd && !isParent) {
        // Right end, going down to child only
        grid.set(jx, midY, '┐');
      } else {
        // Internal junction or parent connection: T-down
        grid.set(jx, midY, '┬');
      }
    }

    // Vertical lines from horizontal bar down to each child
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childCenterX = childCenters[i];

      if (child.y - 1 > midY) {
        grid.drawVerticalLine(childCenterX, midY + 1, child.y - 1);
      }
    }
  }

  // Recurse
  for (const child of node.children) {
    drawConnectors(grid, child);
  }
}

/**
 * Apply ANSI colors to the grid output.
 * Each node's box and label get colored by depth.
 * Connector lines get colored by parent depth.
 */
function applyColors(grid, layoutRoot) {
  // Build a map of (x,y) → depth for all node box cells
  const depthMap = new Map();
  const connectorDepthMap = new Map();
  mapNodeCells(layoutRoot, depthMap, connectorDepthMap);

  const lines = [];
  for (let y = 0; y < grid.height; y++) {
    let line = '';
    for (let x = 0; x < grid.width; x++) {
      const char = grid.get(x, y);
      const key = `${x},${y}`;

      if (char === ' ') {
        line += ' ';
      } else if (depthMap.has(key)) {
        const { depth, isLabel } = depthMap.get(key);
        if (isLabel) {
          line += colorLabel(char, depth);
        } else {
          line += colorLine(char, depth);
        }
      } else if (connectorDepthMap.has(key)) {
        line += colorConnector(char, connectorDepthMap.get(key));
      } else {
        line += char;
      }
    }
    lines.push(line.replace(/\s+$/, ''));
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Map all cells belonging to node boxes → depth.
 * Map connector cells → parent depth.
 */
function mapNodeCells(node, depthMap, connectorDepthMap) {
  // Map box border cells
  for (let y = node.y; y < node.y + node.height; y++) {
    for (let x = node.x; x < node.x + node.width; x++) {
      const isLabel = (y > node.y && y < node.y + node.height - 1 &&
                       x > node.x && x < node.x + node.width - 1);
      depthMap.set(`${x},${y}`, { depth: node.depth, isLabel });
    }
  }

  // Map connector cells (between this node and its children)
  if (node.children.length > 0) {
    const parentBottomY = node.y + node.height - 1;
    const midY = parentBottomY + 1;
    const parentCenterX = node.x + Math.floor(node.width / 2);

    // The connector row and vertical stubs belong to this node's depth
    const childCenters = node.children.map(c => c.x + Math.floor(c.width / 2));

    if (node.children.length === 1) {
      const childCenterX = childCenters[0];
      for (let y = midY; y < node.children[0].y; y++) {
        connectorDepthMap.set(`${parentCenterX},${y}`, node.depth);
        if (childCenterX !== parentCenterX) {
          connectorDepthMap.set(`${childCenterX},${y}`, node.depth);
        }
      }
      if (childCenterX !== parentCenterX) {
        const left = Math.min(parentCenterX, childCenterX);
        const right = Math.max(parentCenterX, childCenterX);
        for (let x = left; x <= right; x++) {
          connectorDepthMap.set(`${x},${midY}`, node.depth);
        }
      }
    } else {
      const leftmost = Math.min(...childCenters);
      const rightmost = Math.max(...childCenters);
      // Horizontal bar
      for (let x = leftmost; x <= rightmost; x++) {
        connectorDepthMap.set(`${x},${midY}`, node.depth);
      }
      // Vertical stubs to children
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        for (let y = midY; y < child.y; y++) {
          connectorDepthMap.set(`${childCenters[i]},${y}`, node.depth);
        }
      }
    }
  }

  for (const child of node.children) {
    mapNodeCells(child, depthMap, connectorDepthMap);
  }
}

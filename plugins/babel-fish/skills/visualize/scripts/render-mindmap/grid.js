/**
 * grid.js — Character grid abstraction
 *
 * A 2D array of characters with utilities for drawing boxes and lines.
 * Auto-expands as needed. Handles junction character resolution.
 */

// Box-drawing characters (rounded style)
const BOX = {
  topLeft: '╭', top: '─', topRight: '╮',
  left: '│', right: '│',
  bottomLeft: '╰', bottom: '─', bottomRight: '╯',
};

// Line-drawing characters
const LINE = {
  h: '─',      // horizontal
  v: '│',      // vertical
  tDown: '┬',  // T pointing down (horizontal line with branch down)
  tUp: '┴',    // T pointing up
  tRight: '├', // T pointing right
  tLeft: '┤',  // T pointing left
  cross: '┼',  // cross
  cornerDR: '┌', // down-right
  cornerDL: '┐', // down-left
  cornerUR: '└', // up-right
  cornerUL: '┘', // up-left
};

// Characters that have connections in each direction
const CONNECTS = {
  up: new Set(['│', '┬', '┤', '├', '┼', '┌', '┐', '╭', '╮', BOX.left, BOX.right]),
  down: new Set(['│', '┴', '┤', '├', '┼', '└', '┘', '╰', '╯', BOX.left, BOX.right]),
  left: new Set(['─', '┬', '┴', '┤', '┼', '┐', '┘', '╮', '╯', BOX.top, BOX.bottom]),
  right: new Set(['─', '┬', '┴', '├', '┼', '┌', '└', '╭', '╰', BOX.top, BOX.bottom]),
};

export class Grid {
  constructor() {
    this.cells = [];  // cells[y][x] = character
    this.width = 0;
    this.height = 0;
  }

  /**
   * Set a character at (x, y). Auto-expands grid.
   */
  set(x, y, char) {
    if (x < 0 || y < 0) return; // ignore out-of-bounds
    while (this.cells.length <= y) {
      this.cells.push([]);
    }
    while (this.cells[y].length <= x) {
      this.cells[y].push(' ');
    }
    if (y >= this.height) this.height = y + 1;
    if (x >= this.width) this.width = x + 1;
    this.cells[y][x] = char;
  }

  /**
   * Get character at (x, y). Returns ' ' if out of bounds.
   */
  get(x, y) {
    if (y < 0 || y >= this.cells.length) return ' ';
    if (x < 0 || x >= (this.cells[y]?.length || 0)) return ' ';
    return this.cells[y][x] || ' ';
  }

  /**
   * Write a string horizontally starting at (x, y).
   */
  writeText(x, y, text) {
    for (let i = 0; i < text.length; i++) {
      this.set(x + i, y, text[i]);
    }
  }

  /**
   * Draw a box with rounded corners.
   * @param {number} x - left edge
   * @param {number} y - top edge
   * @param {number} w - total width (including borders)
   * @param {number} h - total height (including borders)
   */
  drawBox(x, y, w, h) {
    // Top border
    this.set(x, y, BOX.topLeft);
    for (let i = 1; i < w - 1; i++) this.set(x + i, y, BOX.top);
    this.set(x + w - 1, y, BOX.topRight);

    // Sides
    for (let j = 1; j < h - 1; j++) {
      this.set(x, y + j, BOX.left);
      this.set(x + w - 1, y + j, BOX.right);
    }

    // Bottom border
    this.set(x, y + h - 1, BOX.bottomLeft);
    for (let i = 1; i < w - 1; i++) this.set(x + i, y + h - 1, BOX.bottom);
    this.set(x + w - 1, y + h - 1, BOX.bottomRight);
  }

  /**
   * Draw a vertical line from (x, y1) to (x, y2).
   * Handles junction resolution with existing characters.
   */
  drawVerticalLine(x, y1, y2) {
    const [start, end] = y1 < y2 ? [y1, y2] : [y2, y1];
    for (let y = start; y <= end; y++) {
      const existing = this.get(x, y);
      this.set(x, y, this._resolveJunction(existing, LINE.v));
    }
  }

  /**
   * Draw a horizontal line from (x1, y) to (x2, y).
   * Handles junction resolution with existing characters.
   */
  drawHorizontalLine(x1, x2, y) {
    const [start, end] = x1 < x2 ? [x1, x2] : [x2, x1];
    for (let x = start; x <= end; x++) {
      const existing = this.get(x, y);
      this.set(x, y, this._resolveJunction(existing, LINE.h));
    }
  }

  /**
   * Resolve junction when two line characters overlap.
   */
  _resolveJunction(existing, incoming) {
    if (existing === ' ') return incoming;
    if (existing === incoming) return existing;

    // Horizontal meets vertical → cross or T
    if (existing === LINE.h && incoming === LINE.v) return LINE.cross;
    if (existing === LINE.v && incoming === LINE.h) return LINE.cross;

    // T-junction resolutions
    if (existing === LINE.h && incoming === LINE.tDown) return LINE.tDown;
    if (existing === LINE.h && incoming === LINE.tUp) return LINE.tUp;
    if (existing === LINE.v && incoming === LINE.tRight) return LINE.tRight;
    if (existing === LINE.v && incoming === LINE.tLeft) return LINE.tLeft;

    // T meets T → cross
    if ((existing === LINE.tDown && incoming === LINE.tUp) ||
        (existing === LINE.tUp && incoming === LINE.tDown)) return LINE.cross;

    return incoming; // default: overwrite
  }

  /**
   * Convert grid to string output.
   * Trims trailing whitespace per line, trailing empty lines.
   */
  toString() {
    const lines = [];
    for (let y = 0; y < this.height; y++) {
      const row = this.cells[y] || [];
      lines.push(row.join('').replace(/\s+$/, ''));
    }
    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines.join('\n');
  }
}

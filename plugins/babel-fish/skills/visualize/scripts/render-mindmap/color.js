/**
 * color.js — ANSI color application by depth
 *
 * Depth 0 (root): bold white on blue background
 * Depth 1: bold cyan
 * Depth 2: green
 * Depth 3: yellow
 * Depth 4+: dim white
 */

import chalk from 'chalk';

const DEPTH_STYLES = [
  (text) => chalk.bold.white.bgBlue(text),           // root
  (text) => chalk.bold.cyan(text),                    // depth 1
  (text) => chalk.green(text),                        // depth 2
  (text) => chalk.yellow(text),                       // depth 3
  (text) => chalk.dim(text),                          // depth 4+
];

const DEPTH_LINE_STYLES = [
  (text) => chalk.blue(text),
  (text) => chalk.cyan(text),
  (text) => chalk.green(text),
  (text) => chalk.yellow(text),
  (text) => chalk.dim(text),
];

/**
 * Apply color to a label based on its depth.
 * @param {string} text
 * @param {number} depth
 * @returns {string} ANSI-colored string
 */
export function colorLabel(text, depth) {
  const styleFn = DEPTH_STYLES[Math.min(depth, DEPTH_STYLES.length - 1)];
  return styleFn(text);
}

/**
 * Apply color to box border characters based on depth.
 * @param {string} char
 * @param {number} depth
 * @returns {string} ANSI-colored string
 */
export function colorLine(char, depth) {
  const styleFn = DEPTH_LINE_STYLES[Math.min(depth, DEPTH_LINE_STYLES.length - 1)];
  return styleFn(char);
}

/**
 * Apply color to connector lines based on parent depth.
 * @param {string} char
 * @param {number} depth
 * @returns {string} ANSI-colored string
 */
export function colorConnector(char, depth) {
  // Connectors are colored based on the parent depth (slightly dimmer)
  const styleFn = DEPTH_LINE_STYLES[Math.min(depth + 1, DEPTH_LINE_STYLES.length - 1)];
  return styleFn(char);
}

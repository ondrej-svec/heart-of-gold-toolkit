/**
 * parse.js — Markdown headings → tree structure
 *
 * Input: markdown string with # headings
 * Output: { label: string, children: TreeNode[] }
 *
 * Also accepts JSON tree directly.
 */

/**
 * @typedef {Object} TreeNode
 * @property {string} label
 * @property {TreeNode[]} children
 */

/**
 * Parse markdown headings into a tree structure.
 * # becomes root, ## becomes depth 1, ### depth 2, etc.
 * Lines without headings under a heading become part of that node's label
 * or children depending on structure (bullet points become children).
 *
 * @param {string} markdown
 * @returns {TreeNode}
 */
export function parseMarkdown(markdown) {
  const lines = markdown.split('\n');
  const root = { label: 'root', children: [] };
  const stack = [{ node: root, level: 0 }];

  for (const line of lines) {
    // Skip empty lines and frontmatter
    if (line.trim() === '' || line.trim() === '---') continue;

    // Check for heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const label = headingMatch[2].replace(/\*\*/g, '').trim();
      const node = { label, children: [] };

      // Pop stack until we find a parent at a lower level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, level });
      continue;
    }

    // Check for bullet points (- or *) — become children of current heading
    const bulletMatch = line.match(/^(\s*)[*-]\s+(.+)$/);
    if (bulletMatch && stack.length > 1) {
      const label = bulletMatch[2]
        .replace(/\*\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // strip markdown links
        .replace(/`([^`]+)`/g, '$1')                // strip inline code
        .trim();
      if (label.length > 0 && label.length < 60) {  // skip very long bullets (prose)
        const node = { label, children: [] };
        const currentHeading = stack[stack.length - 1].node;
        currentHeading.children.push(node);
      }
    }
  }

  // If root has exactly one child, promote it
  if (root.children.length === 1) {
    return root.children[0];
  }

  // If root has multiple children, keep the wrapper
  if (root.children.length === 0) {
    return { label: '(empty)', children: [] };
  }

  return root;
}

/**
 * Parse JSON tree input. Expects { label, children } format.
 * Also accepts { name, children } format (d3-style).
 *
 * @param {string} jsonString
 * @returns {TreeNode}
 */
export function parseJSON(jsonString) {
  const data = JSON.parse(jsonString);
  return normalizeNode(data);
}

function normalizeNode(node) {
  const label = node.label || node.name || node.text || String(node);
  const children = (node.children || []).map(normalizeNode);
  return { label, children };
}

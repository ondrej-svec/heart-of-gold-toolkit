#!/usr/bin/env node

import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, 'agent-artifact-template.html');
const providedPath = process.argv[2] ? resolve(process.argv[2]) : null;

const outPath = (() => {
  if (providedPath) return providedPath;
  const tempDir = mkdtempSync(join(tmpdir(), 'hog-visualize-artifact-'));
  return join(tempDir, 'artifact.html');
})();

mkdirSync(dirname(outPath), { recursive: true });
copyFileSync(templatePath, outPath);
process.stdout.write(`${outPath}\n`);

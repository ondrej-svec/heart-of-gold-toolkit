import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Always creates a fresh disposable artifact; never overwrites a supplied path.
const here = path.dirname(fileURLToPath(import.meta.url));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'hog-ask-visual-preview-'));
for (const file of ['index.html', 'preview.css']) fs.copyFileSync(path.join(here, file), path.join(output, file));
// The share server serves .js with a module-compatible MIME type; .mjs is octet-stream.
fs.copyFileSync(path.join(here, 'preview.mjs'), path.join(output, 'preview.js'));
const core = fs.readFileSync(path.resolve(here, '../../../extensions/pi/hog-ask-core.mjs'));
fs.writeFileSync(path.join(output, 'hog-ask-core.js'), core);
const manifest = { kind: 'browser-design-preview', productionChanges: false, coreSha256: crypto.createHash('sha256').update(core).digest('hex'), files: {} };
for (const file of fs.readdirSync(output)) manifest.files[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex');
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(output);

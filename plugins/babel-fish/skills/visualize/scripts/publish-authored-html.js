#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';

function fail(code, message, status = 1) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
  process.exit(status);
}

function parseArgs(argv) {
  const opts = {
    htmlPath: null,
    configPath: resolve(homedir(), '.agent-share', 'config.json'),
    slug: '',
    title: '',
    alias: '',
    urlOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--config' && i + 1 < argv.length) opts.configPath = resolve(argv[++i]);
    else if (arg === '--slug' && i + 1 < argv.length) opts.slug = argv[++i];
    else if (arg === '--title' && i + 1 < argv.length) opts.title = argv[++i];
    else if (arg === '--alias' && i + 1 < argv.length) opts.alias = argv[++i];
    else if (arg === '--url-only') opts.urlOnly = true;
    else if (arg === '--help') {
      process.stdout.write('Usage: publish-authored-html.js <html-file> [--config PATH] [--slug STEM] [--title TITLE] [--alias ALIAS] [--url-only]\n');
      process.exit(0);
    } else if (!arg.startsWith('-') && !opts.htmlPath) {
      opts.htmlPath = resolve(arg);
    } else {
      fail('INVALID_ARGS', `Unknown or misplaced argument: ${arg}`);
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.htmlPath) fail('MISSING_PATH', 'HTML file path is required.');
  if (!existsSync(opts.configPath)) fail('MISSING_CONFIG', 'Share server config not found. Run share-server-setup first.');
  if (!existsSync(opts.htmlPath)) fail('MISSING_PATH', `HTML file does not exist: ${opts.htmlPath}`);
  if (!opts.htmlPath.toLowerCase().endsWith('.html')) fail('UNSUPPORTED_ARTIFACT', 'Only .html files are supported for authored artifact publishing.');

  const cfg = JSON.parse(readFileSync(opts.configPath, 'utf8'));
  const apiUrl = String(cfg?.server?.apiUrl || '').replace(/\/$/, '');
  if (!apiUrl) fail('INVALID_CONFIG', 'share server apiUrl missing from config.');

  const htmlBuffer = readFileSync(opts.htmlPath);
  const form = new FormData();
  form.append('artifact', new Blob([htmlBuffer], { type: 'text/html' }), basename(opts.htmlPath));
  form.append('artifactType', 'html-file');
  if (opts.slug) form.append('slug', opts.slug);
  if (opts.title) form.append('title', opts.title);
  if (opts.alias) form.append('alias', opts.alias);

  const response = await fetch(`${apiUrl}/publish`, { method: 'POST', body: form });
  const text = await response.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail('INVALID_RESPONSE', `Share server returned non-JSON response: ${text}`, 1);
  }

  if (!response.ok || payload?.ok === false) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exit(1);
  }

  if (opts.urlOnly) {
    process.stdout.write(`${payload.url || payload.viewerUrl || ''}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

main().catch((error) => {
  fail('PUBLISH_FAILED', error instanceof Error ? error.message : String(error));
});

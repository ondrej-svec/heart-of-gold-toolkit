#!/usr/bin/env node
import { constants } from 'node:fs';
import { lstat, readlink, open, mkdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CONFIG_FILES = Object.freeze([
  'CHEATSHEET.md', 'zsh/.zshrc', 'tmux/main.conf',
  'nvim/lua/llm-filter.lua', 'nvim/lua/plugins/which-key.lua',
]);
const ROOT_LINKS = Object.freeze({ '.zshrc': 'zsh/.zshrc', '.tmux.conf': 'tmux/main.conf' });
const MAX_BYTES = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mode = stat => (stat.mode & 0o7777).toString(8).padStart(4, '0');
const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);

async function statOrMissing(file) {
  try { return await lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Never follow directory symlinks, including a relocated XDG root. The caller's
// HOME is canonicalized once to accommodate OS-level aliases (e.g. macOS /var).
async function directories(directory, create = false) {
  const root = path.parse(directory).root;
  let current = root;
  for (const part of path.relative(root, directory).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat = await statOrMissing(current);
    if (!stat && create) {
      await mkdir(current, { mode: 0o700 });
      stat = await lstat(current);
    }
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error('Directory symlink refused');
    if (!stat.isDirectory()) throw new Error('Expected a directory');
  }
}

function absolute(value, label) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${label} must be an absolute path`);
  return path.resolve(value);
}

async function capture(root, relative, expectedTarget) {
  const file = path.join(root, relative);
  await directories(path.dirname(file));
  const before = await statOrMissing(file);
  const entry = { root: expectedTarget ? 'home' : 'config', path: relative, kind: 'missing' };
  if (!before) return { entry };
  entry.mode = mode(before);
  let bytes;
  if (before.isSymbolicLink()) {
    if (!expectedTarget) throw new Error('Configuration file symlink refused');
    const target = await readlink(file);
    if (path.resolve(path.dirname(file), target) !== expectedTarget) {
      throw new Error('Refusing unrecognized symlink');
    }
    await directories(path.dirname(expectedTarget));
    const targetStat = await statOrMissing(expectedTarget);
    if (targetStat && !targetStat.isFile()) throw new Error('Symlink target is not a regular file');
    entry.kind = 'symlink';
    entry.target = target;
    bytes = Buffer.from(target);
  } else {
    if (!before.isFile()) throw new Error('Only regular files or approved root symlinks may be backed up');
    if (before.size > MAX_BYTES) throw new Error('Source exceeds backup size limit');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev || opened.size > MAX_BYTES) {
        throw new Error('Source identity changed during backup');
      }
      // A bounded read also fails closed if a source grows after stat.
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const read = await handle.read(buffer, length, buffer.length - length, null);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > MAX_BYTES) throw new Error('Source exceeds backup size limit');
      bytes = buffer.subarray(0, length);
    } finally { await handle.close(); }
    entry.kind = 'file';
  }
  const after = await lstat(file);
  if (before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs || before.mode !== after.mode || before.size !== after.size) {
    throw new Error('Source changed during backup');
  }
  entry.bytes = bytes.length;
  entry.sha256 = hash(bytes);
  return { entry, bytes };
}

/** Fixed allowlist only. No credential discovery, recursive copying, or restoration. */
export async function backup({ env = process.env, apply = false, destination } = {}) {
  if (typeof apply !== 'boolean') throw new Error('apply must be boolean');
  const requestedHome = absolute(env.HOME, 'HOME');
  const home = await realpath(requestedHome);
  const normalizeHome = value => inside(requestedHome, value)
    ? path.join(home, path.relative(requestedHome, value)) : value;
  const config = normalizeHome(absolute(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'XDG_CONFIG_HOME'));
  const state = normalizeHome(absolute(env.XDG_STATE_HOME || path.join(home, '.local/state'), 'XDG_STATE_HOME'));
  const output = normalizeHome(absolute(destination || path.join(state, 'workstation-guide/backups', randomUUID()), 'destination'));
  if (inside(config, output) || inside(output, config) || inside(output, home) ||
      Object.keys(ROOT_LINKS).some(name => inside(path.join(home, name), output))) {
    throw new Error('Backup must be outside the configuration tree and source paths');
  }
  await directories(config);
  const captured = [];
  for (const file of CONFIG_FILES) captured.push(await capture(config, file));
  for (const [name, target] of Object.entries(ROOT_LINKS)) captured.push(await capture(home, name, path.join(config, target)));
  await directories(path.dirname(output));
  if (await statOrMissing(output)) throw new Error('Backup destination already exists; never overwritten');
  const manifest = {
    schemaVersion: 1, applied: apply, createdAt: new Date().toISOString(),
    roots: { home, config }, destination: output,
    entries: captured.map(({ entry }, index) => ({ ...entry, ...(entry.kind !== 'missing' ? { payload: `${index}.bin` } : {}) })),
  };
  if (!apply) return manifest;
  await directories(path.dirname(output), true);
  // mkdir is exclusive: a repeat or competing run cannot overwrite a snapshot.
  await mkdir(output, { mode: 0o700 });
  for (const [index, { bytes }] of captured.entries()) {
    if (bytes) await writeFile(path.join(output, `${index}.bin`), bytes, { flag: 'wx', mode: 0o600 });
  }
  // The manifest is the completion marker. Failed snapshots are deliberately
  // retained, never swept recursively; without this marker they are incomplete.
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--apply', '--dry-run'].includes(args[0]))) {
    console.error('Usage: node workstation/scripts/backup.mjs [--dry-run | --apply]');
    process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(await backup({ apply: args[0] === '--apply' }), null, 2)); }
    catch { console.error('Scoped backup refused or failed; no source configuration was modified. Check paths, symlinks, permissions and existing destinations.'); process.exitCode = 1; }
  }
}

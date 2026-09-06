import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, symlink, readlink, chmod, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { backup } from '../scripts/backup.mjs';

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'guide backup ')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'other user');
  await mkdir(home);
  return { root, home, env: { HOME: home }, destination: path.join(home, 'private', 'snapshot') };
}
async function put(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

test('dry-run defaults to ten missing records, creates nothing', async t => {
  const f = await fixture(t);
  const result = await backup(f);
  assert.equal(result.applied, false);
  assert.equal(result.entries.length, 10);
  assert.ok(result.entries.every(e => e.kind === 'missing'));
  assert.deepEqual(await readdir(f.home), []);
});

test('live-help targets capture prior absence or exact ignore/loader/profile bytes only', async t => {
  const f = await fixture(t);
  const paths = ['.gitignore', 'nvim/after/plugin/workstation-help.lua', 'workstation/profile.json'];
  const initial = await backup(f);
  for (const name of paths) assert.equal(initial.entries.find(e => e.path === name)?.kind, 'missing', name);
  for (const name of paths) await put(path.join(f.home, '.config', name), `synthetic ${name}\n`);
  // An adjacent credential-shaped symlink must not be visited.
  await symlink('/do-not-read/credentials', path.join(f.home, '.config/workstation/auth.json'));
  const result = await backup({ ...f, apply: true });
  for (const name of paths) {
    const entry = result.entries.find(e => e.path === name);
    assert.equal(entry.kind, 'file');
    assert.equal(await readFile(path.join(result.destination, entry.payload), 'utf8'), `synthetic ${name}\n`);
  }
  assert.equal(result.entries.filter(e => e.kind === 'file').length, paths.length);
});

test('new loader/profile target symlinks fail closed before backup writes', async t => {
  const f = await fixture(t);
  for (const name of ['nvim/after/plugin/workstation-help.lua', 'workstation/profile.json']) {
    const target = path.join(f.home, '.config', name);
    await mkdir(path.dirname(target), { recursive: true });
    await symlink('/do-not-read/credentials', target);
    await assert.rejects(backup({ ...f, apply: true }), /symlink/);
    assert.equal(await lstat(f.destination).catch(error => error.code), 'ENOENT');
    await rm(target);
  }
});

test('preserves exact bytes and original mode in private non-clobbering snapshot', async t => {
  const f = await fixture(t);
  const source = path.join(f.home, '.config/CHEATSHEET.md');
  const bytes = Buffer.from([0, 255, 10, 32, 65]);
  await put(source, bytes);
  await chmod(source, 0o640);
  await put(path.join(f.home, '.zshrc'), 'regular root config\n');
  const before = await lstat(source);
  const result = await backup({ ...f, apply: true });
  const manifest = JSON.parse(await readFile(path.join(result.destination, 'manifest.json')));
  const entry = manifest.entries.find(e => e.path === 'CHEATSHEET.md');
  assert.equal(entry.mode, '0640');
  assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(entry.bytes, bytes.length);
  assert.deepEqual(await readFile(path.join(result.destination, entry.payload)), bytes);
  assert.equal((await lstat(result.destination)).mode & 0o777, 0o700);
  assert.equal((await lstat(path.dirname(result.destination))).mode & 0o777, 0o700);
  for (const name of await readdir(result.destination)) {
    assert.equal((await lstat(path.join(result.destination, name))).mode & 0o777, 0o600);
  }
  assert.equal((await lstat(source)).mtimeMs, before.mtimeMs);
  assert.equal((await lstat(source)).mode, before.mode);
  await assert.rejects(backup({ ...f, apply: true }), /already exists/);
  assert.deepEqual(await readFile(source), bytes);
});

test('HOME and XDG are explicit; approved root symlinks retain identity, not dereferenced copies', async t => {
  const f = await fixture(t);
  const config = path.join(f.root, 'alternate config');
  const state = path.join(f.root, 'alternate state');
  await put(path.join(config, 'zsh/.zshrc'), 'synthetic\n');
  await symlink(path.join(config, 'zsh/.zshrc'), path.join(f.home, '.zshrc'));
  await symlink('../alternate config/tmux/main.conf', path.join(f.home, '.tmux.conf'));
  const result = await backup({ env: { HOME: f.home, XDG_CONFIG_HOME: config, XDG_STATE_HOME: state }, apply: true });
  assert.ok(result.destination.startsWith(state + path.sep));
  const entry = result.entries.find(e => e.path === '.tmux.conf');
  assert.equal(entry.kind, 'symlink');
  assert.equal(entry.target, '../alternate config/tmux/main.conf');
  assert.equal(await readlink(path.join(f.home, '.tmux.conf')), entry.target);
  assert.equal(await readFile(path.join(result.destination, entry.payload), 'utf8'), entry.target);
});

test('unrecognized root symlink is refused even in dry-run', async t => {
  const f = await fixture(t);
  await symlink('/do-not-read/credentials', path.join(f.home, '.zshrc'));
  await assert.rejects(backup(f), /unrecognized symlink/);
  assert.deepEqual(await readdir(f.home), ['.zshrc']);
});

test('config leaf and ancestor symlinks fail closed', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.home, '.config'));
  await symlink(f.root, path.join(f.home, '.config/nvim'));
  await assert.rejects(backup({ ...f, apply: true }), /symlink/);
  await rm(path.join(f.home, '.config/nvim'));
  await symlink('/do-not-read/auth.json', path.join(f.home, '.config/CHEATSHEET.md'));
  await assert.rejects(backup(f), /symlink/);
});

test('destination symlink and existing directory cannot clobber other data', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.home, 'private'));
  await symlink(f.root, f.destination);
  await assert.rejects(backup({ ...f, apply: true }), /already exists/);
  await rm(f.destination);
  await rm(path.dirname(f.destination), { recursive: true });
  await symlink(f.root, path.dirname(f.destination));
  await assert.rejects(backup({ ...f, apply: true }), /symlink/);
});

test('excluded neighboring credentials are not opened or copied', async t => {
  const f = await fixture(t);
  await put(path.join(f.home, '.config/CHEATSHEET.md'), 'safe fixture');
  await symlink('/do-not-read', path.join(f.home, '.config/pi'));
  await symlink('/do-not-read', path.join(f.home, '.env'));
  const result = await backup({ ...f, apply: true });
  assert.equal(result.entries.filter(e => e.kind !== 'missing').length, 1);
  assert.equal((await readdir(result.destination)).length, 2);
});

test('invalid roots and backup locations fail before writes', async t => {
  const f = await fixture(t);
  await assert.rejects(backup({ env: {} }), /HOME/);
  await assert.rejects(backup({ ...f, env: { HOME: f.home, XDG_CONFIG_HOME: 'relative' } }), /absolute/);
  await assert.rejects(backup({ ...f, destination: path.join(f.home, '.config/backup'), apply: true }), /configuration tree/);
});

test('oversize files and nonregular sources fail before creating a snapshot', async t => {
  const f = await fixture(t);
  const file = path.join(f.home, '.config/CHEATSHEET.md');
  await put(file, Buffer.alloc(8 * 1024 * 1024 + 1));
  await assert.rejects(backup({ ...f, apply: true }), /size limit/);
  await rm(file);
  await mkdir(file);
  await assert.rejects(backup({ ...f, apply: true }), /regular files/);
  assert.equal(await lstat(f.destination).catch(error => error.code), 'ENOENT');
});

test('symlinked XDG root is rejected without following it', async t => {
  const f = await fixture(t);
  await symlink(f.root, path.join(f.home, '.config'));
  await assert.rejects(backup(f), /symlink/);
});

test('CLI requires exact flags; default is dry-run and unknown options fail', async t => {
  const f = await fixture(t);
  const script = new URL('../scripts/backup.mjs', import.meta.url);
  const env = { ...process.env, HOME: f.home, XDG_CONFIG_HOME: '', XDG_STATE_HOME: '' };
  const run = args => spawnSync(process.execPath, [script.pathname, ...args], { env, encoding: 'utf8' });
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).applied, false);
  assert.notEqual(run(['--apply=yes']).status, 0);
  assert.deepEqual(await readdir(f.home), []);
});

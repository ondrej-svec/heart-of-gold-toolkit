import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, join, sep, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

export const BINDINGS = Object.freeze({
  'shell.file-picker': ['zsh/.zshrc'],
  'shell.history': ['zsh/.zshrc'],
  'tmux.prefix': ['tmux/main.conf'],
  'tmux.menu': ['tmux/main.conf'],
  'tmux.cockpit': ['tmux/main.conf'],
  'nvim.leader': ['nvim/lua/vim-options.lua'],
  'nvim.discovery': ['nvim/lua/plugins/which-key.lua'],
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const emptyProfile = () => ({ schemaVersion: 1, bindings: {} });
export function keys(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      Object.keys(object).some(key => !allowed.includes(key))) throw new Error(`Invalid ${label} fields`);
}
export function text(value, label, max = 500, multiline = false) {
  const controls = multiline ? /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/ : /[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/;
  if (typeof value !== 'string' || !value.trim() || value.length > max || controls.test(value)) throw new Error(`Invalid ${label}`);
}
export function readBounded(file, max = 256 * 1024) {
  const info = statSync(file);
  if (!info.isFile() || info.size > max) throw new Error('Expected a bounded regular file');
  const bytes = readFileSync(file);
  if (bytes.length > max) throw new Error('File exceeds size limit');
  return bytes;
}
export function validateProfile(profile) {
  keys(profile, ['schemaVersion', 'bindings', 'tldr'], 'profile');
  if (profile.schemaVersion !== 1) throw new Error('Unsupported profile schemaVersion');
  const bindings = profile.bindings ?? {};
  keys(bindings, Object.keys(BINDINGS), 'bindings');
  for (const [name, binding] of Object.entries(bindings)) {
    keys(binding, ['value', 'source', 'sha256', 'verifiedAt'], 'binding');
    text(binding.value, 'binding value', 120);
    if (/[`{}<>]/.test(binding.value)) throw new Error('Binding values cannot contain markup/templates');
    if (!BINDINGS[name].includes(binding.source)) throw new Error('Unapproved binding source');
    if (!/^[a-f0-9]{64}$/.test(binding.sha256 ?? '')) throw new Error('Invalid source hash');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(binding.verifiedAt ?? '') || Number.isNaN(Date.parse(binding.verifiedAt))) throw new Error('Invalid verification date');
  }
  if (profile.tldr !== undefined) {
    keys(profile.tldr, ['client', 'sha256'], 'tldr');
    if (profile.tldr.client !== 'tldr-c-1.6.1' || !/^[a-f0-9]{64}$/.test(profile.tldr.sha256 ?? '')) {
      throw new Error('Command examples require a reviewed, fingerprinted tldr C client 1.6.1');
    }
  }
  return { ...profile, bindings };
}
export function profilePaths(env = process.env, explicit) {
  if (!env.HOME || !isAbsolute(env.HOME)) throw new Error('HOME must be absolute');
  const configRoot = env.XDG_CONFIG_HOME || join(env.HOME, '.config');
  if (!isAbsolute(configRoot)) throw new Error('XDG_CONFIG_HOME must be absolute');
  if (explicit && !isAbsolute(explicit)) throw new Error('--profile must be an absolute path');
  return { configRoot, profilePath: explicit || join(configRoot, 'workstation/profile.json') };
}
export function loadProfile(env = process.env, explicit) {
  const paths = profilePaths(env, explicit);
  try {
    const profile = validateProfile(JSON.parse(readBounded(paths.profilePath, 64 * 1024)));
    return { ...paths, profile, status: 'loaded' };
  } catch (error) {
    if (error.code === 'ENOENT' && !explicit) return { ...paths, profile: emptyProfile(), status: 'absent' };
    // Do not include JSON parser snippets: malformed private profiles can contain secrets.
    throw new Error('Profile could not be read or validated; check schemaVersion, allowed fields and file size');
  }
}
export function bindingStatus(name, profile, configRoot) {
  const binding = profile.bindings[name];
  if (!binding || !configRoot) return { status: 'unknown' };
  try {
    const root = realpathSync(configRoot);
    const file = realpathSync(resolve(root, binding.source));
    if (!file.startsWith(root + sep)) return { status: 'unknown' };
    if (sha256(readBounded(file)) !== binding.sha256) return { status: 'stale' };
    // A matching inspected source is not proof that the running shell/editor loaded it.
    return { status: 'recorded', value: binding.value, verifiedAt: binding.verifiedAt };
  } catch { return { status: 'unknown' }; }
}
export function interpolate(body, profile, configRoot) {
  return body.replace(/\{\{binding\.([a-z.-]+)\}\}/g, (_, name) => {
    const state = bindingStatus(name, profile, configRoot);
    return state.status === 'recorded' ? `${state.value} [recorded; confirm loaded]`
      : `[${state.status} binding: ${name}; check your setup]`;
  });
}

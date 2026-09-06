import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fixture, choice, model } from './writing-fixture.mjs';
import { listWritingActions, prepareWriting, runWriting, WRITING_LIMITS } from '../src/writing.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const prepare = f => prepareWriting('improve-writing', { env: f.env });
const run = (f, options = {}, input = 'Synthetic input') => runWriting('improve-writing', input, { env: f.env, expectedFingerprint: prepare(f).fingerprint, ...options });
const errorCode = code => e => { assert.equal(e.code, code); assert.doesNotMatch(e.message, /PRIVATE|secret|fixture-|\/Users\//); return true; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(file) { for (let i = 0; i < 200 && !existsSync(file); i++) await sleep(10); assert.ok(existsSync(file)); }
function dead(pid) { try { process.kill(pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } }

test('actions are owned contracts with exact pinned Fabric bytes and provenance', () => {
  const actions = listWritingActions();
  assert.deepEqual(actions.map(a => [a.id, a.disposition]), [['improve-writing', 'review-rewrite'], ['analyze-prose', 'scratch'], ['summarize-micro', 'scratch']]);
  const root = new URL('../vendor/fabric/', import.meta.url);
  const source = JSON.parse(readFileSync(new URL('SOURCE.json', root)));
  assert.equal(source.revision, '6b0914d1bb0dbf54facec1743838c7312e945634');
  for (const a of actions) {
    const file = `${a.id.replaceAll('-', '_')}/system.md`;
    assert.equal(a.prompt.sha256, hash(readFileSync(new URL(file, root))));
    assert.equal(a.prompt.revision, source.revision);
    assert.equal(source.files[file].sha256, a.prompt.sha256);
  }
  assert.match(readFileSync(new URL('LICENSE', root), 'utf8'), /MIT License/);
  assert.equal(source.files.LICENSE.sha256, hash(readFileSync(new URL('LICENSE', root))));
});

test('prepare is passive, JSON-safe and uses saved choices, never session env', t => {
  const f = fixture(t); Object.assign(f.env, { PI_PROVIDER: 'secret', PI_MODEL: 'secret', PI_REASONING_LEVEL: 'off' });
  const p = prepare(f);
  assert.equal(p.provider, choice.provider); assert.equal(p.model, choice.model); assert.equal(p.thinking, choice.thinking);
  assert.equal(p.piVersion, '0.85.1'); assert.match(p.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(p, JSON.parse(JSON.stringify(p)));
  assert.doesNotMatch(JSON.stringify(p), /fixture-|secret|\/Users\//);
  assert.match(p.notice, /multiple|retries/); assert.match(p.notice, /not.*sandbox|not.*isolation/i);
  assert.equal(existsSync(join(f.root, 'capture.json')), false);
  assert.deepEqual(readdirSync(f.agent), ['settings.json']);
});

test('per-model saved thinking wins; preferences are complete, strict and explicit', t => {
  const f = fixture(t); f.put(f.settings, { defaultProvider: choice.provider, defaultModel: choice.model, defaultThinkingLevel: 'high', modelThinkingLevels: { 'openai-codex/gpt-6-astra': 'max' } });
  assert.equal(prepare(f).thinking, 'max');
  assert.equal(prepareWriting('improve-writing', { env: f.env, preferences: choice }).thinking, 'xhigh');
  for (const preferences of [{}, { ...choice, extra: true }, { ...choice, thinking: 'off' }, { ...choice, model: 'gpt-*' }, { ...choice, model: 'gpt-6-astra:high' }, { ...choice, provider: 'openai' }, null, []]) {
    assert.throws(() => prepareWriting('improve-writing', { env: f.env, preferences }), errorCode('WRITING_CHOICE'));
  }
  f.put(f.settings, {}); assert.throws(() => prepare(f), errorCode('WRITING_CHOICE'));
  assert.equal(prepareWriting('improve-writing', { env: f.env, preferences: choice }).model, choice.model);
});

test('model-specific thinking maps are checked, not silently clamped', t => {
  const f = fixture(t);
  f.put(f.catalog, { 'openai-codex-responses': { [model.id]: { ...model, thinkingLevelMap: { low: null } } } });
  for (const thinking of ['low', 'xhigh', 'max', 'bogus']) assert.throws(() => prepareWriting('improve-writing', { env: f.env, preferences: { ...choice, thinking } }), errorCode('WRITING_CHOICE'));
  assert.equal(prepareWriting('improve-writing', { env: f.env, preferences: { ...choice, thinking: 'high' } }).thinking, 'high');
});

test('unsupported installs, custom models and routing overrides fail passively', async t => {
  for (const change of [
    f => f.put(join(f.pkg, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '0.85.2', bin: { pi: 'dist/bundle/cli.js' } }),
    f => f.put(join(f.agent, 'models.json'), {}),
    f => { f.env.PI_PACKAGE_DIR = '/private/secret'; },
    f => { f.env.OPENAI_BASE_URL = 'https://unreviewed.invalid'; },
    f => f.put(f.catalog, { 'openai-codex-responses': { [model.id]: { ...model, baseUrl: 'https://unreviewed.invalid' } } }),
    f => f.put(join(f.agent, 'models-store.json'), { 'openai-codex': { lastModified: Date.now(), models: [{ ...model, baseUrl: 'https://unreviewed.invalid' }] } }),
    f => f.put(join(f.agent, 'models-store.json'), { 'openai-codex': { models: [{ ...model, headers: { private: '!danger' } }] } }),
  ]) await t.test('reject', t => { const f = fixture(t); change(f); assert.throws(() => prepare(f), e => { assert.match(e.code, /^WRITING_(INSTALL|ROUTING)$/); return true; }); assert.equal(existsSync(join(f.root, 'capture.json')), false); });
});

test('identical cached built-in catalog is allowed; changed and added models are rejected', t => {
  const f = fixture(t), path = join(f.agent, 'models-store.json');
  f.put(path, { 'openai-codex': { models: [model], checkedAt: 1, lastModified: 1 } });
  assert.equal(prepare(f).model, model.id);
  f.put(path, { 'openai-codex': { models: [{ ...model, id: 'new-model' }] } });
  assert.throws(() => prepare(f), errorCode('WRITING_ROUTING'));
});

test('Pi creating an empty models store is not a routing change', async t => {
  const f = fixture(t), p = prepareWriting('improve-writing', { env: f.env });
  f.put(join(f.agent, 'models-store.json'), {});
  assert.equal(prepareWriting('improve-writing', { env: f.env }).fingerprint, p.fingerprint);
  assert.equal((await run(f, { expectedFingerprint: p.fingerprint })).text, 'Rewritten café 🙂\u2028next');
});

test('confirmation is mandatory and config/install/env/action drift prevents spawn', async t => {
  const f = fixture(t), expectedFingerprint = prepare(f).fingerprint;
  for (const fp of [undefined, '', 'wrong']) await assert.rejects(runWriting('improve-writing', 'text', { env: f.env, expectedFingerprint: fp }), errorCode('WRITING_CONFIRMATION'));
  await assert.rejects(runWriting('analyze-prose', 'text', { env: f.env, expectedFingerprint }), errorCode('WRITING_CONFIRMATION'));
  f.env.HTTPS_PROXY = 'https://proxy.invalid';
  await assert.rejects(run(f, { expectedFingerprint }), errorCode('WRITING_CONFIRMATION'));
  delete f.env.HTTPS_PROXY;
  appendFileSync(f.cli, '\n// changed install\n');
  await assert.rejects(run(f, { expectedFingerprint }), errorCode('WRITING_CONFIRMATION'));
  const updated = prepare(f).fingerprint; appendFileSync(f.settings, ' ');
  await assert.rejects(run(f, { expectedFingerprint: updated }), errorCode('WRITING_CONFIRMATION'));
  assert.equal(existsSync(join(f.root, 'capture.json')), false);
});

test('prompt byte drift is detected before spawning, using an isolated copy', async t => {
  const f = fixture(t), copy = join(f.root, 'workstation');
  cpSync(new URL('../src/', import.meta.url), join(copy, 'src'), { recursive: true });
  cpSync(new URL('../vendor/fabric/', import.meta.url), join(copy, 'vendor/fabric'), { recursive: true });
  const api = await import(pathToFileURL(join(copy, 'src/writing.mjs')));
  const expectedFingerprint = api.prepareWriting('improve-writing', { env: f.env }).fingerprint;
  appendFileSync(join(copy, 'vendor/fabric/improve_writing/system.md'), '\nchanged');
  await assert.rejects(api.runWriting('improve-writing', 'text', { env: f.env, expectedFingerprint }), errorCode('WRITING_PROMPT'));
  assert.equal(existsSync(join(f.root, 'capture.json')), false);
});

test('exact shell-free argv/env/private cwd/envelope preserve hostile input bytes', async t => {
  const f = fixture(t);
  Object.assign(f.env, { PI_CODING_AGENT_DIR: f.agent, PI_SESSION_ID: 'PRIVATE', PI_SESSION_FILE: '/private/secret', PI_MODEL: 'PRIVATE', PI_CONTROL_SOCKET: '/private/secret', NODE_OPTIONS: '--require /private/secret', NODE_PATH: '/private/secret', OPENAI_API_KEY: 'PRIVATE', EDITOR: 'danger', PAGER: 'danger', DEBUG: '*', HTTPS_PROXY: 'https://proxy.invalid', NODE_EXTRA_CA_CERTS: '/synthetic/ca.pem' });
  // Avoid Node's own missing-CA startup warning while still verifying intentional CA preservation separately.
  delete f.env.NODE_EXTRA_CA_CERTS;
  const input = '/llama download @file\r\n  🙂 café\u2028\t$(touch bad); `bad` --api-key secret\n\n';
  const p = prepare(f), result = await run(f, {}, input), c = f.capture();
  assert.equal(result.text, 'Rewritten café 🙂\u2028next');
  assert.deepEqual({ ...result, text: undefined, durationMs: undefined }, { ...p, text: undefined, durationMs: undefined });
  const base = ['-p', '--mode', 'json', '--no-session', '--no-tools', '--no-extensions', '--no-skills', '--no-context-files', '--no-prompt-templates', '--no-themes', '--no-approve', '--offline', '--provider', 'openai-codex', '--model', 'gpt-6-astra', '--models', 'openai-codex/gpt-6-astra', '--thinking', 'xhigh'];
  assert.deepEqual(c.argv.slice(0, base.length), base);
  assert.equal(c.argv[base.length], '--system-prompt'); assert.match(c.argv[base.length + 1], /^Workstation writing contract\n/);
  assert.match(c.argv[base.length + 1], /meaning.*language.*voice/);
  assert.deepEqual(c.argv.slice(base.length + 2), ['--append-system-prompt', '']);
  assert.ok(!c.argv.some(a => a.includes(input)));
  const observedEnv = { ...c.env };
  if (process.platform === 'darwin' && observedEnv.__CF_USER_TEXT_ENCODING !== undefined) {
    // CoreFoundation can introduce this native locale value after exec, not our environment builder.
    assert.match(observedEnv.__CF_USER_TEXT_ENCODING, /^0x[0-9a-f]+:0x[0-9a-f]+:0x[0-9a-f]+$/i);
    delete observedEnv.__CF_USER_TEXT_ENCODING;
  }
  assert.deepEqual(observedEnv, { HOME: f.home, PATH: f.env.PATH, LANG: f.env.LANG, PI_CODING_AGENT_DIR: f.agent, HTTPS_PROXY: 'https://proxy.invalid' });
  assert.equal(c.mode, 0o700); assert.deepEqual(c.files, []); assert.ok(!c.cwd.startsWith(f.home));
  const lines = c.input.split('\n'); assert.equal(lines[0], 'Workstation writing input (JSON follows).');
  assert.deepEqual(JSON.parse(lines[1]), { action: 'improve-writing', input });
  assert.equal(lines[2], 'End of workstation writing input.'); assert.equal(lines.length, 3);
  assert.equal(existsSync(c.cwd), false); assert.deepEqual(readdirSync(f.agent), ['settings.json']);
});

test('bytewise Unicode, large valid record and final phase filtering without duplication', async t => {
  const f = fixture(t, { bytewise: true }); assert.equal((await run(f)).text, 'Rewritten café 🙂\u2028next');
  const g = fixture(t, { largeRecord: 1024 * 1024 }); assert.ok((await run(g)).text);
  const h = fixture(t, { content: [
    { type: 'text', text: 'ordinary' },
    { type: 'text', text: 'PRIVATE commentary', textSignature: JSON.stringify({ v: 1, id: '1', phase: 'commentary' }) },
    { type: 'thinking', thinking: 'PRIVATE thinking' },
    { type: 'text', text: 'final ', textSignature: JSON.stringify({ v: 1, id: '2', phase: 'final_answer' }) },
    { type: 'text', text: 'answer', textSignature: JSON.stringify({ v: 1, id: '3', phase: 'final_answer' }) },
  ] }); assert.equal((await run(h)).text, 'final answer');
});

test('only validated lifecycle, successful stop and clean closure can return text', async t => {
  const scenarios = [
    ...['error', 'aborted', 'length', 'toolUse', 'deferred', 'unknown'].map(stopReason => ({ stopReason })),
    ...['session', 'agent_start', 'turn_start', 'message_start', 'message_end', 'turn_end', 'agent_end', 'agent_settled'].map(remove => ({ remove })),
    { provider: 'other' }, { model: 'other' }, { mismatchTurn: true }, { mismatchEnd: true }, { willRetry: true }, { tools: true },
    { text: '' }, { text: ' \n ' }, { errorMessage: true }, { content: [{ type: 'toolCall', name: 'bash' }] },
    { extra: { type: 'auto_retry_start' } }, { extra: { type: 'compaction_start' } },
    { extra: { type: 'tool_execution_start' } }, { extra: { type: 'message_update', assistantMessageEvent: { type: 'error', error: 'PRIVATE' } } },
    { late: { type: 'compaction_start' } }, { exitCode: 2 }, { truncated: true },
    { raw: Buffer.from('{"type":"session"}\nnot json\n').toString('base64') },
    { raw: Buffer.from([0xc3, 0x28, 10]).toString('base64') },
  ];
  for (const scenario of scenarios) await t.test(JSON.stringify(scenario), async t => {
    const f = fixture(t, scenario); await assert.rejects(run(f), e => { assert.match(e.code, /^WRITING_(PROTOCOL|PROCESS)$/); assert.doesNotMatch(e.message, /PRIVATE/); return true; });
    assert.equal(existsSync(f.capture().cwd), false);
  });
});

test('input, result, stderr and aggregate stream have byte caps', async t => {
  const f = fixture(t);
  await assert.rejects(run(f, {}, '🙂'.repeat(WRITING_LIMITS.inputBytes / 4 + 1)), errorCode('WRITING_INPUT'));
  assert.equal(existsSync(join(f.root, 'capture.json')), false);
  for (const scenario of [{ text: 'x'.repeat(WRITING_LIMITS.responseBytes + 1) }, { stderrBytes: WRITING_LIMITS.stderrBytes + 1 }, { largeRecord: WRITING_LIMITS.streamBytes + 1 }]) {
    const g = fixture(t, scenario); await assert.rejects(run(g), errorCode('WRITING_LIMIT')); assert.equal(existsSync(g.capture().cwd), false);
  }
});

test('closure delay and config changes during generation never leak an early success', async t => {
  const f = fixture(t, { closeDelay: 180 }); const start = Date.now(); await run(f); assert.ok(Date.now() - start >= 180);
  const g = fixture(t, { drift: true }); await assert.rejects(run(g), errorCode('WRITING_CONFIRMATION'));
});

test('timeout and AbortSignal escalate, close, clean up and kill owned grandchildren', async t => {
  for (const cancel of [false, true]) {
    const f = fixture(t, { hang: true, grandchild: true }), controller = new AbortController();
    const promise = run(f, { timeoutMs: cancel ? 10000 : 500, signal: controller.signal });
    const rejection = assert.rejects(promise, errorCode(cancel ? 'WRITING_CANCELLED' : 'WRITING_TIMEOUT'));
    await waitFor(join(f.root, 'grandchild')); if (cancel) controller.abort('PRIVATE');
    await rejection;
    assert.equal(existsSync(f.capture().cwd), false); assert.ok(dead(f.capture().pid));
    const pid = Number(readFileSync(join(f.root, 'grandchild'), 'utf8'));
    for (let i = 0; i < 100 && !dead(pid); i++) await sleep(10);
    assert.ok(dead(pid), 'grandchild reaped by the operating system');
  }
});

test('parent SIGINT and SIGTERM are forwarded to the owned group and suppress success', async t => {
  for (const sig of ['SIGINT', 'SIGTERM']) {
    const f = fixture(t, { hang: true, grandchild: true });
    const script = `import { prepareWriting, runWriting } from ${JSON.stringify(new URL('../src/writing.mjs', import.meta.url).href)}; const env=${JSON.stringify(f.env)}; const p=prepareWriting('improve-writing',{env}); try { await runWriting('improve-writing','synthetic',{env,expectedFingerprint:p.fingerprint}); process.exitCode=9; } catch(e) { console.log(e.code); }`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: { HOME: f.home, PATH: f.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', c => { output += c; });
    const closed = once(child, 'close');
    await waitFor(join(f.root, 'grandchild')); child.kill(sig);
    const [code] = await closed; assert.equal(code, 0); assert.equal(output.trim(), 'WRITING_CANCELLED');
    assert.ok(dead(f.capture().pid)); assert.equal(existsSync(f.capture().cwd), false);
  }
});

test('cooperative parent exit cannot cancel escalation for a stubborn owned grandchild', async t => {
  const f = fixture(t, { hang: true, grandchild: true, cooperativeParent: true });
  const promise = run(f, { timeoutMs: 500 });
  const rejection = assert.rejects(promise, errorCode('WRITING_TIMEOUT'));
  await waitFor(join(f.root, 'grandchild'));
  const pid = Number(readFileSync(join(f.root, 'grandchild'), 'utf8'));
  t.after(() => { if (!dead(pid)) process.kill(pid, 'SIGKILL'); });
  await rejection;
  for (let i = 0; i < 100 && !dead(pid); i++) await sleep(10);
  assert.ok(dead(pid), 'escalation must outlive cooperative leader closure');
});

test('a disappeared working directory produces only a sanitized cleanup error', async t => {
  const f = fixture(t, { removeCwd: true });
  await assert.rejects(run(f), e => errorCode('WRITING_CLEANUP')(e) && !String(e).includes(f.root));
});

test('pre-aborted signals and invalid run options fail without spawn', async t => {
  const f = fixture(t), controller = new AbortController(); controller.abort();
  await assert.rejects(run(f, { signal: controller.signal }), errorCode('WRITING_CANCELLED'));
  for (const timeoutMs of [0, -1, Infinity, '100']) await assert.rejects(run(f, { timeoutMs }), errorCode('WRITING_OPTIONS'));
  assert.equal(existsSync(join(f.root, 'capture.json')), false);
});

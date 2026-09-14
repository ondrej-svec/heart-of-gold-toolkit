import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const ANSWER = process.env.HOG_TEST_WORKSTATION_ANSWER ?? join(ROOT, '../pi-workstation/extensions/answer.ts');
function startRpc(profile = 'standalone', mode = 'rpc') {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hog-pi-rpc-'));
  const agentDir = join(tempRoot, 'agent');
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    join(agentDir, 'settings.json'),
    JSON.stringify({
      packages: [profile === 'proof' || profile === 'skills-only' ? { source: ROOT, extensions: [] } : ROOT],
      extensions: profile === 'proof' ? [join(ROOT, 'tests/fixtures/pi-hog-ask-proof.ts')] : profile === 'combined' ? [ANSWER] : [],
    }, null, 2),
  );

  const child = spawn(
    process.env.PI_BIN ?? 'pi',
    ['--mode', mode, '--no-session', '--offline', '--no-context-files', ...(mode === 'json' ? ['--print', '/hog-ask-proof decision'] : [])],
    {
      cwd: tempRoot,
      env: {
        ...process.env,
        PI_CODING_AGENT_DIR: agentDir,
        PI_OFFLINE: '1',
        PI_SKIP_VERSION_CHECK: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  let stdout = '';
  let stderr = '';
  const events = [];
  const waiters = [];

  function dispatch(event) {
    events.push(event);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(event)) continue;
      clearTimeout(waiter.timeout);
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(event);
    }
  }

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    while (stdout.includes('\n')) {
      const newline = stdout.indexOf('\n');
      const line = stdout.slice(0, newline).replace(/\r$/, '');
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      try {
        dispatch(JSON.parse(line));
      } catch (error) {
        dispatch({ type: 'invalid-json', line, error: error.message });
      }
    }
  });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  function waitFor(predicate, label, timeoutMs = 10_000) {
    const found = events.find(predicate);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        timeout: setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1);
          reject(new Error(`Timed out waiting for ${label}. stderr: ${stderr}`));
        }, timeoutMs),
      };
      waiters.push(waiter);
    });
  }

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((resolve) => child.once('close', resolve));
      child.kill('SIGTERM');
      await closed;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }

  if (mode === 'json') child.stdin.end(); // print mode reads piped stdin to EOF
  return { child, events, getStderr: () => stderr, send, stop, waitFor };
}

test('temporary Pi RPC profile loads skills and uses a standard editor request', { timeout: 20_000 }, async () => {
  const rpc = startRpc();
  try {
    rpc.send({ id: 'commands', type: 'get_commands' });
    const response = await rpc.waitFor(
      (event) => event.type === 'response' && event.id === 'commands',
      'get_commands response',
    );
    assert.equal(response.success, true, response.error);
    const names = new Set(response.data.commands.map((command) => command.name));
    for (const name of [
      'deep-thought-brainstorm',
      'deep-thought-plan',
      'marvin-work',
      'skill:brainstorm',
      'skill:plan',
      'skill:work',
    ]) {
      assert.ok(names.has(name), `${name} is missing from the temporary RPC profile`);
    }

    assert.equal(names.has('deep-thought-guided-debug'), false);
    assert.equal(names.has('answer'), false, 'standalone toolkit does not claim the workstation command');

    rpc.send({ id: 'plan', type: 'prompt', message: '/deep-thought-plan' });
    const editor = await rpc.waitFor(
      (event) => event.type === 'extension_ui_request' && event.method === 'editor' && event.title === 'Plan topic or brainstorm path',
      'standard editor request',
    );
    rpc.send({ type: 'extension_ui_response', id: editor.id, cancelled: true });
    const promptResponse = await rpc.waitFor(
      (event) => event.type === 'response' && event.id === 'plan',
      'plan command response',
    );
    assert.equal(promptResponse.success, true, promptResponse.error);
    assert.equal(rpc.events.some((event) => event.type === 'invalid-json'), false);
    assert.equal(rpc.events.some((event) => event.type === 'extension_error'), false);
    assert.doesNotMatch(rpc.getStderr(), /failed to load|extension error/i);
  } finally {
    await rpc.stop();
  }
});

for (const profile of ['skills-only', 'combined']) {
  test(`isolated ${profile} profile retains portable skills without duplicate launchers`, { timeout: 20_000, skip: profile === 'combined' && !existsSync(ANSWER) ? 'Set HOG_TEST_WORKSTATION_ANSWER to a local workstation answer.ts' : false }, async () => {
    const rpc = startRpc(profile);
    try {
      rpc.send({ id: 'commands', type: 'get_commands' });
      const response = await rpc.waitFor((e) => e.type === 'response' && e.id === 'commands', 'commands');
      assert.equal(response.success, true);
      const names = response.data.commands.map((command) => command.name);
      assert.ok(names.includes('skill:plan'));
      assert.equal(names.filter((name) => name === 'answer').length, profile === 'combined' ? 1 : 0);
      assert.equal(names.filter((name) => name === 'deep-thought-plan').length, profile === 'combined' ? 1 : 0);
      assert.doesNotMatch(rpc.getStderr(), /failed to load|extension error|already registered|duplicate/i);
    } finally { await rpc.stop(); }
  });
}

test('real print/JSON run returns unavailable without any model or UI request', { timeout: 20_000 }, async () => {
  const rpc = startRpc('proof', 'json');
  try {
    const result = await rpc.waitFor((e) => e.type === 'message_end' && e.message?.customType === 'hog-ask-proof', 'print proof result');
    assert.equal(result.message.details.status, 'unavailable');
    assert.equal(result.message.details.approved, false);
    assert.equal(rpc.events.some((e) => e.type === 'agent_start' || e.type === 'extension_ui_request'), false);
    assert.doesNotMatch(rpc.getStderr(), /failed to load|extension error/i);
  } finally { await rpc.stop(); }
});

const preset = labels => labels.find(label => label.startsWith('Option [internal]:'));
for (const scenario of [
  { name: 'one-response preset', responses: [preset], expected: { optionId: 'internal', note: '' } },
  { name: 'direct custom', responses: ['Action: Write a different answer', 'Support 🦊'], expected: { text: 'Support 🦊', note: '' } },
  { name: 'preset with optional note', responses: ['Action: Answer with a note', preset, 'Include support'], expected: { optionId: 'internal', note: 'Include support' }, noteFor: 'Internal only' },
  { name: 'custom with optional note', responses: ['Action: Answer with a note', 'Action: Write a different answer', 'Support 🦊', 'Dry run'], expected: { text: 'Support 🦊', note: 'Dry run' }, noteFor: 'Support 🦊' },
  { name: 'invalid note then correction', responses: ['Action: Answer with a note', preset, 'n'.repeat(1001), 'Corrected'], expected: { optionId: 'internal', note: 'Corrected' }, noteFor: 'Internal only', invalidNote: true },
  { name: 'note cancellation', responses: ['Action: Answer with a note', preset, undefined], dismissed: true },
]) {
  test(`real offline RPC ordinary ${scenario.name} has no mandatory review`, { timeout: 20_000 }, async () => {
    const rpc = startRpc('proof'), seen = new Set(), dialogs = [];
    try {
      rpc.send({ id: 'ordinary', type: 'prompt', message: '/hog-ask-proof decision' });
      for (const value of scenario.responses) {
        const dialog = await rpc.waitFor(e => e.type === 'extension_ui_request' && ['select', 'input'].includes(e.method) && !seen.has(e.id), 'ordinary dialog');
        seen.add(dialog.id); dialogs.push(dialog);
        assert.doesNotMatch(dialog.title, /Review before sending/);
        rpc.send({ type: 'extension_ui_response', id: dialog.id, ...(value === undefined ? { cancelled: true } : { value: typeof value === 'function' ? value(dialog.options) : value }) });
      }
      const event = await rpc.waitFor(e => e.type === 'message_end' && e.message?.customType === 'hog-ask-proof', 'ordinary outcome');
      const result = event.message.details;
      assert.equal(result.status, scenario.dismissed ? 'dismissed' : 'answered');
      assert.equal(result.approved, false);
      if (scenario.dismissed) assert.equal(result.answer, null);
      else for (const [key, value] of Object.entries(scenario.expected)) assert.equal(result.answer[key], value);
      assert.equal((await rpc.waitFor(e => e.type === 'response' && e.id === 'ordinary', 'ordinary completed')).success, true);
      assert.equal(rpc.events.filter(e => e.type === 'extension_ui_request').length, scenario.responses.length);
      if (scenario.noteFor) assert.ok(dialogs.at(-1).title.includes(`Note for: ${scenario.noteFor}`));
      if (scenario.invalidNote) { assert.match(dialogs.at(-1).title, /note must be/); assert.ok(dialogs.at(-1).title.includes('n'.repeat(1001))); }
      assert.equal(rpc.events.some(e => ['agent_start', 'extension_error', 'invalid-json'].includes(e.type)), false);
      assert.doesNotMatch(rpc.getStderr(), /failed to load|extension error/i);
    } finally { await rpc.stop(); }
  });
}

test('real offline RPC presents approval feedback separately and preserves cancellation', { timeout: 20_000 }, async () => {
  const rpc = startRpc('proof');
  const seen = new Set();
  const nextDialog = () => rpc.waitFor((e) => e.type === 'extension_ui_request' && ['select', 'input'].includes(e.method) && !seen.has(e.id), 'hog_ask dialog').then((e) => { seen.add(e.id); return e; });
  const answer = (dialog, value) => rpc.send({ type: 'extension_ui_response', id: dialog.id, ...(value === undefined ? { cancelled: true } : { value }) });
  try {
    rpc.send({ id: 'ask1', type: 'prompt', message: '/hog-ask-proof approval' });
    const choose = await nextDialog();
    assert.equal(choose.method, 'select');
    assert.match(choose.title, /No real-world operation is authorized/);
    assert.match(choose.options.find((label) => label.startsWith('Option [approve]:')), /Approve as written/);
    assert.match(choose.options.find((label) => label.startsWith('Option [revise]:')), /Request changes/);
    answer(choose, choose.options.find((label) => label.startsWith('Option [revise]:')));
    const input = await nextDialog(); assert.equal(input.method, 'input');
    answer(input, 'yes, but only after a dry run');
    const qualified = await nextDialog();
    assert.match(qualified.title, /Request changes: yes, but only after a dry run/);
    assert.ok(!qualified.options.includes('Action: Add / edit note'));
    assert.equal(qualified.options[0], 'Action: Send feedback');
    answer(qualified, 'Action: Send feedback');
    const result = await rpc.waitFor((e) => e.type === 'message_end' && e.message?.customType === 'hog-ask-proof', 'proof result');
    assert.equal(result.message.details.status, 'needs_discussion');
    assert.equal(result.message.details.approved, false);
    assert.equal(result.message.details.answer.kind, 'custom');
    assert.equal(result.message.details.answer.text, 'yes, but only after a dry run');
    const response = await rpc.waitFor((e) => e.type === 'response' && e.id === 'ask1', 'first command');
    assert.equal(response.success, true);

    rpc.send({ id: 'ask2', type: 'prompt', message: '/hog-ask-proof decision' });
    const second = await nextDialog();
    answer(second, 'Action: Write a different answer');
    answer(await nextDialog(), undefined);
    const dismissed = await rpc.waitFor((e) => e.type === 'message_end' && e.message?.customType === 'hog-ask-proof' && e.message.details.status === 'dismissed', 'dismissal');
    assert.equal(dismissed.message.details.approved, false);
    assert.equal(dismissed.message.details.answer, null);
    assert.equal(rpc.events.some((e) => e.type === 'agent_start'), false, 'proof never invokes a model');
    assert.equal(rpc.events.some((e) => e.type === 'extension_error' || e.type === 'invalid-json'), false);
    assert.doesNotMatch(rpc.getStderr(), /failed to load|extension error/i);
  } finally { await rpc.stop(); }
});

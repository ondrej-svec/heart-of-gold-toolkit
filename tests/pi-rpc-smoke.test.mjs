import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function startRpc() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hog-pi-rpc-'));
  const agentDir = join(tempRoot, 'agent');
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    join(agentDir, 'settings.json'),
    JSON.stringify({ packages: [ROOT] }, null, 2),
  );

  const child = spawn(
    process.env.PI_BIN ?? 'pi',
    ['--mode', 'rpc', '--no-session', '--offline', '--no-context-files'],
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
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise((resolve) => child.once('close', resolve));
    rmSync(tempRoot, { recursive: true, force: true });
  }

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

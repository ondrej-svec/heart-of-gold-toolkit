import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess, toolEnv } from '../src/process.mjs';

test('timeouts are failures rather than user interrupts, and await closure', async () => {
  const result = await runProcess(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], {
    env: toolEnv(), timeout: 100, graceMs: 100,
  });
  assert.equal(result.code, 1);
  assert.equal(result.interrupted, undefined);
});

test('oversized stdout is bounded and is not a user cancellation', async () => {
  const result = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(1024*1024));"], {
    env: toolEnv(), maxBytes: 1024,
  });
  assert.equal(result.code, 1);
  assert.ok(Buffer.byteLength(result.stdout) <= 1024);
  assert.equal(result.interrupted, undefined);
});

test('missing process fails once without an unhandled rejection', async () => {
  const result = await runProcess('/definitely-not-a-guide-tool', [], { env: toolEnv() });
  assert.equal(result.code, 1);
});

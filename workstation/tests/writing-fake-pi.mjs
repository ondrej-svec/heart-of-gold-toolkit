import { readFileSync, readdirSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function fakePi(root) {
  const s = JSON.parse(readFileSync(join(root, 'scenario.json'), 'utf8'));
  let input = '';
  if (s.stdinError) process.stdin.destroy();
  else for await (const chunk of process.stdin) input += chunk;
  const capture = { argv: process.argv.slice(2), env: process.env, cwd: process.cwd(), input,
    files: readdirSync(process.cwd()), mode: statSync(process.cwd()).mode & 0o777, pid: process.pid };
  writeFileSync(join(root, 'capture.json'), JSON.stringify(capture));
  if (s.hang) {
    if (!s.cooperativeParent) { process.on('SIGTERM', () => {}); process.on('SIGINT', () => {}); }
    if (s.grandchild) {
      const grandchild = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); process.on('SIGINT',()=>{}); setInterval(()=>{},1000)"], { stdio: ['ignore', 'pipe', 'pipe'] });
      // Keep it in the owned process group, retaining pipes to test inherited-descriptor shutdown.
      await once(grandchild, 'spawn');
      writeFileSync(join(root, 'grandchild'), String(grandchild.pid));
    }
    setInterval(() => {}, 1000); return;
  }
  if (s.stderrBytes) {
    const data = Buffer.alloc(s.stderrBytes, 120);
    if (!process.stderr.write(data)) await once(process.stderr, 'drain');
  }
  if (s.raw) { process.stdout.write(Buffer.from(s.raw, 'base64')); return; }
  const user = { role: 'user', content: [{ type: 'text', text: input }], timestamp: 1 };
  const content = s.content ?? [{ type: 'thinking', thinking: 'PRIVATE THINKING' }, { type: 'text', text: s.text ?? 'Rewritten café 🙂\u2028next' }];
  const assistant = { role: 'assistant', content, provider: s.provider ?? 'openai-codex', model: s.model ?? 'gpt-6-astra', api: 'openai-codex-responses', stopReason: s.stopReason ?? 'stop', timestamp: 2 };
  if (s.errorMessage) assistant.errorMessage = 'PRIVATE ERROR /private/secret';
  let events = [
    { type: 'session', version: 3, id: 'synthetic', timestamp: '2026-01-01T00:00:00Z', cwd: process.cwd() },
    { type: 'agent_start' }, { type: 'turn_start' },
    { type: 'message_start', message: user }, { type: 'message_end', message: user },
    { type: 'message_start', message: { ...assistant, content: [] } },
    { type: 'message_update', usage: {}, assistantMessageEvent: { type: 'text_delta', contentIndex: 1, delta: 'DO NOT DUPLICATE' } },
    { type: 'message_end', message: assistant },
    { type: 'turn_end', message: s.mismatchTurn ? { ...assistant, timestamp: 9 } : assistant, toolResults: s.tools ? [{ role: 'toolResult' }] : [] },
    { type: 'agent_end', messages: s.mismatchEnd ? [user, { ...assistant, content: [] }] : [user, assistant], willRetry: s.willRetry ?? false },
    { type: 'agent_settled' },
  ];
  if (s.largeRecord) events[6].assistantMessageEvent.delta = 't'.repeat(s.largeRecord);
  if (s.remove) events = events.filter(e => e.type !== s.remove);
  if (s.extra) events.splice(8, 0, s.extra);
  if (s.late) events.push(s.late);
  if (s.drift) writeFileSync(join(root, 'home/.pi/agent/settings.json'), JSON.stringify({ defaultProvider: 'openai-codex', defaultModel: 'gpt-6-astra', defaultThinkingLevel: 'high' }));
  const data = Buffer.from(events.map(e => JSON.stringify(e)).join('\n') + (s.truncated ? '' : '\n'));
  if (s.bytewise) {
    for (let i = 0; i < data.length; i++) {
      if (!process.stdout.write(data.subarray(i, i + 1))) await once(process.stdout, 'drain');
      if (i % 127 === 0) await sleep(1);
    }
  } else if (!process.stdout.write(data)) await once(process.stdout, 'drain');
  if (s.removeCwd) rmdirSync(process.cwd());
  if (s.closeDelay) await sleep(s.closeDelay);
  process.exitCode = s.exitCode ?? 0;
}

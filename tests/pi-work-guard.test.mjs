// Named failure: the bare-dot regex blocked .pi paths while allowing the bare dot.
// Retire when Pi supplies an equivalent argument-aware guard with these regression cases.
// Only invoke the registered handler: no shell, Git operation, model or real UI runs here.
import test from 'node:test';
import assert from 'node:assert/strict';
import workExtension from '../extensions/pi/work.ts';

function guard(options = {}) {
  const { hasUI = false } = options;
  const choice = Object.hasOwn(options, 'choice') ? options.choice : 'Allow';
  let handler;
  const prompts = [];
  workExtension({
    on(name, callback) { assert.equal(name, 'tool_call'); handler = callback; },
    registerCommand() {},
  });
  const ctx = { hasUI, ui: {
    notify() {},
    async select(title, options) { prompts.push({ title, options }); return choice; },
  } };
  return { call: (toolName, input) => handler({ toolName, input }, ctx), prompts };
}

const allowed = [
  'git add .pi/extensions/lib/query-capture.mjs',
  'git add .claude/agents/reviewer.md',
  'git add .gitignore',
  'git add ./src/file.ts',
  'git add ../file.ts',
  'git add .config-file',
  'git add ".pi/file.ts"',
  "git add '.claude/file.md'",
  'git add "."/src/file.ts',
  "git add '.'suffix",
  'git add -- .pi/file.ts',
  'git add README.md',
];
for (const command of allowed) {
  test(`explicit path is not bare-dot staging: ${command}`, async () => {
    const g = guard({ hasUI: true });
    assert.equal(await g.call('bash', { command }), undefined);
    assert.deepEqual(g.prompts, []);
  });
}

const blocked = [
  'git add .', 'git add . ', 'git\tadd\t.\t',
  'git add .\ngit status', 'git add .&&git status',
  'git add .;git status', 'git add .|tee log', 'git add .>log',
  'git add .<input', '(git add .)', 'git add .&',
  'git add "."', "git add '.'", 'git add -- .',
  'git add -- "."&&git status', "git add -- '.';git status",
];
for (const command of blocked) {
  test(`bare-dot staging is hard-blocked: ${command}`, async () => {
    for (const hasUI of [false, true]) {
      const g = guard({ hasUI });
      assert.deepEqual(await g.call('bash', { command }), {
        block: true, reason: `Blocked unsafe command: ${command}`,
      });
      assert.deepEqual(g.prompts, []);
    }
  });
}

test('the original explicit five-file add and commit chain is allowed', async () => {
  const files = [
    '.pi/extensions/lib/query-capture.mjs', 'harness/crates/bph/src/record_io.rs',
    'harness/crates/bph/tests/query_inputs_export.rs', 'scripts/query-capture-selftest.mjs',
    'operations/plans/2026-09-07-cli-native-delegation-migration.md',
  ];
  const command = `git add ${files.join(' ')} && git commit --only -m "feat(harness): retain original query root directory witnesses" -- ${files.join(' ')}`;
  assert.equal(await guard().call('bash', { command }), undefined);
});

test('destructive commands and protected edit/write paths remain blocked', async () => {
  for (const command of ['rm -rf folder', 'rm -r folder', 'rm --recursive folder']) {
    assert.equal((await guard().call('bash', { command })).block, true);
  }
  for (const tool of ['edit', 'write']) {
    for (const path of ['.env', 'project/.git/config', 'node_modules/pkg/file.js']) {
      assert.deepEqual(await guard().call(tool, { path }), {
        block: true, reason: `Protected path: ${path}`,
      });
    }
    assert.equal(await guard().call(tool, { path: 'src/file.ts' }), undefined);
  }
  assert.equal(await guard().call('read', { path: '.env' }), undefined);
});

test('publication commands retain their existing confirmation policy', async () => {
  for (const command of ['git push', 'npm publish', 'bun publish', 'gh pr create']) {
    assert.deepEqual(await guard().call('bash', { command }), {
      block: true, reason: `Interactive confirmation required for: ${command}`,
    });
    for (const choice of ['Allow', 'Block', undefined]) {
      const g = guard({ hasUI: true, choice });
      const result = await g.call('bash', { command });
      assert.deepEqual(result, choice === 'Allow' ? undefined : {
        block: true, reason: `Blocked by user: ${command}`,
      });
      assert.deepEqual(g.prompts, [{ title: `Confirm: ${command}`, options: ['Allow', 'Block'] }]);
    }
  }
});

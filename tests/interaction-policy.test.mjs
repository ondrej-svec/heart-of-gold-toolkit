import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { transformContentForCodex, transformContentForOpenCode, transformContentForPi } from '../src/utils/transform.ts';

// Static authoring regressions, not a simulation of a model's interpretation.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const targets = [['source', (text) => text], ['Codex', transformContentForCodex], ['Pi', transformContentForPi], ['OpenCode', transformContentForOpenCode]];

const skills = [
  'plugins/deep-thought/skills/brainstorm/SKILL.md',
  'plugins/deep-thought/skills/plan/SKILL.md',
  'plugins/deep-thought/skills/architect/SKILL.md',
  'plugins/deep-thought/skills/think/SKILL.md',
  'plugins/deep-thought/skills/investigate/SKILL.md',
  'plugins/deep-thought/skills/review/SKILL.md',
  'plugins/marvin/skills/work/SKILL.md',
];
const required = ['natural conversation is the default', 'evidence before questioning', 'agent investigation', 'later verification', 'structured ui', 'prose', 'authoriz'];
const retired = ['AskUserQuestion', 'Prefer the harness\'s structured'];

for (const path of skills) {
  test(`${path}: self-contained portable interaction policy`, () => {
    const text = read(path);
    const frontmatter = yaml.load(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '');
    assert.equal(frontmatter?.name, path.split('/').at(-2));
    assert.equal(typeof frontmatter.description, 'string');
    assert.ok(Array.isArray(frontmatter['allowed-tools']));
    const normalized = text.toLowerCase();
    for (const phrase of required) assert.ok(normalized.includes(phrase), `missing ${phrase}`);
    for (const phrase of retired) assert.equal(text.includes(phrase), false, `retired phrase: ${phrase}`);
    assert.ok(text.includes('not a selectable') || text.includes('not a choice') || text.includes('not alternatives') || text.includes('not a selection') || text.includes('never an option') || text.includes('not optional scope'), 'required work is not an alternative');
    assert.ok(text.split('\n').length <= 500, 'skill line budget');
  });

  test(`${path}: target transforms preserve policy`, () => {
    const source = read(path);
    for (const [name, transform] of targets) {
      const installed = transform(source);
      const normalized = installed.toLowerCase();
      for (const phrase of required) assert.ok(normalized.includes(phrase), `${name} lost ${phrase}`);
      for (const phrase of retired) assert.equal(installed.includes(phrase), false, `${name} restored ${phrase}`);
    }
  });
}

test('Codex transform converts legacy blanket UI wording to the conditional policy', () => {
  const fixture = read('tests/fixtures/interaction-policy/legacy-ui.md');
  const installed = transformContentForCodex(fixture);
  assert.equal(installed.includes("Prefer the harness's structured"), false);
  assert.match(installed, /Use structured UI only for a meaningful decision or approval/);
  assert.equal(installed.includes('In Codex, prefer'), false);
});

for (const scenario of JSON.parse(read('tests/fixtures/interaction-policy/readiness.json'))) {
  test(`static scenario: ${scenario.name}`, () => {
    // Check complete production directives, not booleans inside our own fixtures.
    // These excerpts deliberately avoid command aliases, so they must survive verbatim.
    for (const [target, transform] of targets) {
      const installed = transform(read(scenario.path));
      for (const passage of scenario.contains) assert.ok(installed.includes(passage), `${target}: missing directive for ${scenario.input}: ${passage}`);
      for (const passage of scenario.excludes) assert.equal(installed.includes(passage), false, `${target}: conflicting directive: ${passage}`);
    }
  });
}

for (const { source, codex } of JSON.parse(read('tests/fixtures/interaction-policy/command-aliases.json'))) {
  test(`Codex command-token boundary: ${source}`, () => {
    assert.equal(transformContentForCodex(source), codex);
    assert.equal(transformContentForPi(source), source);
    assert.equal(transformContentForOpenCode(source), source);
  });
}

test('changed plugin manifests and marketplace versions stay in sync', () => {
  const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  for (const name of ['deep-thought', 'marvin']) {
    const manifest = JSON.parse(read(`plugins/${name}/.claude-plugin/plugin.json`));
    assert.equal(manifest.version, marketplace.plugins.find((plugin) => plugin.name === name)?.version);
  }
});

test('Pi and OpenCode only translate their documented settings paths', () => {
  const source = 'Inspect ~/.claude/settings.json and .claude/project.md; read/review with /plan.';
  assert.equal(transformContentForPi(source), 'Inspect ~/.pi/agent/settings.json and .pi/agent/project.md; read/review with /plan.');
  assert.equal(transformContentForOpenCode(source), 'Inspect ~/.agents/settings.json and .agents/project.md; read/review with /plan.');
});

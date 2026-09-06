// Synthetic Pi layout only. No real Pi executable, credentials, or network.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

export const choice = { provider: 'openai-codex', model: 'gpt-6-astra', thinking: 'xhigh' };
export const model = {
  id: choice.model, name: 'Synthetic Astra', provider: choice.provider,
  api: 'openai-codex-responses', baseUrl: 'https://chatgpt.com/backend-api', reasoning: true,
  input: ['text'], thinkingLevelMap: { off: null, minimal: 'low', xhigh: 'xhigh', max: 'max' },
};
export function fixture(t, scenario = {}) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'writing-fixture-'));
  const home = join(root, 'home'), agent = join(home, '.pi/agent'), bin = join(root, 'bin');
  const pkg = join(root, 'node_modules/@earendil-works/pi-coding-agent');
  const cli = join(pkg, 'dist/bundle/cli.js');
  const catalog = join(pkg, 'node_modules/@earendil-works/pi-ai/dist/providers/data/openai-codex.json');
  for (const dir of [agent, bin, dirname(cli), dirname(catalog)]) mkdirSync(dir, { recursive: true });
  const put = (path, value) => writeFileSync(path, JSON.stringify(value));
  put(join(pkg, 'package.json'), { name: '@earendil-works/pi-coding-agent', version: '0.85.1', type: 'module', bin: { pi: 'dist/bundle/cli.js' }, piConfig: { configDir: '.pi' } });
  put(join(pkg, 'node_modules/@earendil-works/pi-ai/package.json'), { name: '@earendil-works/pi-ai', version: '0.85.1', type: 'module' });
  put(catalog, { 'openai-codex-responses': { [model.id]: model } });
  const settings = join(agent, 'settings.json');
  put(settings, { defaultProvider: choice.provider, defaultModel: choice.model, defaultThinkingLevel: choice.thinking });
  put(join(root, 'scenario.json'), scenario);
  // Fake transport configuration is compiled into the synthetic executable, not a production hook.
  writeFileSync(cli, `#!/usr/bin/env node\nimport { fakePi } from ${JSON.stringify(new URL('./writing-fake-pi.mjs', import.meta.url).href)};\nawait fakePi(${JSON.stringify(root)});\n`);
  chmodSync(cli, 0o755);
  symlinkSync(cli, join(bin, 'pi'));
  const env = { HOME: home, PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, LANG: 'en_US.UTF-8' };
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, home, agent, bin, pkg, cli, catalog, settings, env, put,
    capture: () => JSON.parse(readFileSync(join(root, 'capture.json'), 'utf8')) };
}

// Tests load the same Pi-bundled peers as the CLI, without installing a second TUI.
// Set PI_BIN to an npm-installed Pi CLI path if it is not on PATH.
import { registerHooks } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const bin = process.env.PI_BIN ?? 'pi';
const cli = (bin.includes('/') ? [resolve(bin)] : (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, bin))).find(existsSync);
if (!cli) throw new Error('Pi is required for runtime tests; install it or set PI_BIN');
const cliUrl = pathToFileURL(realpathSync(cli)).href;
const bundled = new Set(['typebox', '@earendil-works/pi-ai', '@earendil-works/pi-tui', '@earendil-works/pi-coding-agent']);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (bundled.has(specifier) || specifier.startsWith('typebox/')) {
      return nextResolve(specifier, { ...context, parentURL: cliUrl });
    }
    return nextResolve(specifier, context);
  },
});

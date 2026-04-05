import { defineCommand } from "citty";
import { loadAllPlugins, loadPlugin } from "../parsers/claude";
import { targets } from "../targets/index";
import { resolve } from "path";

export const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Install skills into a target tool (codex, opencode, etc.)",
  },
  args: {
    plugin: {
      type: "positional",
      description: "Plugin name to install (omit for all plugins)",
      required: false,
    },
    to: {
      type: "string",
      description: "Target tool: codex, opencode, pi",
      required: true,
    },
    dest: {
      type: "string",
      description: "Override output root directory",
      required: false,
    },
  },
  async run({ args }) {
    const targetName = args.to;
    const target = targets[targetName];
    if (!target) {
      const available = Object.keys(targets).join(", ");
      console.error(`Unknown target: ${targetName}. Available: ${available}`);
      process.exit(1);
    }

    const outputRoot = args.dest ? resolve(args.dest) : target.defaultRoot;

    let plugins;
    if (args.plugin) {
      // Install a specific plugin
      const all = loadAllPlugins();
      const match = all.find((p) => p.name === args.plugin);
      if (!match) {
        const available = all.map((p) => p.name).join(", ");
        console.error(`Plugin not found: ${args.plugin}. Available: ${available}`);
        process.exit(1);
      }
      plugins = [match];
    } else {
      // Install all plugins
      plugins = loadAllPlugins();
    }

    let totalInstalled = 0;
    for (const plugin of plugins) {
      if (plugin.skills.length === 0) {
        console.log(`  ${plugin.name}: no skills found, skipping`);
        continue;
      }
      const count = await target.write(outputRoot, plugin);
      console.log(`  ${plugin.name}: ${count} skills installed`);
      totalInstalled += count;
    }

    console.log(
      `\nInstalled ${totalInstalled} skills to ${outputRoot}/skills/`
    );
    console.log(`Restart ${targetName} to pick them up.`);
  },
});

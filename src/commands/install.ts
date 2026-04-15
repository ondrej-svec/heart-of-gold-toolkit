import { defineCommand } from "citty";
import { loadAllPlugins, loadPlugin } from "../parsers/claude";
import { targets } from "../targets/index";
import { resolve } from "path";
import { findHeartOfGoldPiPackageInstalls } from "../utils/pi-package-detection.js";

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
    force: {
      type: "boolean",
      description: "Proceed even if Pi already loads @heart-of-gold/toolkit as a package",
      required: false,
      default: false,
    },
  },
  async run({ args }) {
    const targetName = args.to;

    if (targetName === "pi") {
      const matches = findHeartOfGoldPiPackageInstalls(process.cwd());
      if (matches.length > 0) {
        const locations = matches
          .map(({ settingsPath, source }) => `  - ${settingsPath} → ${source}`)
          .join("\n");

        const message = [
          "Refusing to install duplicate Pi skills.",
          "Pi is already configured to load @heart-of-gold/toolkit as a package from:",
          locations,
          "",
          "Choose one Pi install path:",
          "  1. keep the Pi package:    pi install npm:@heart-of-gold/toolkit",
          "  2. keep native skill copy: bunx @heart-of-gold/toolkit install --to pi",
          "",
          "Remove one side before continuing, or rerun with --force if you really want both.",
        ].join("\n");

        if (!args.force) {
          console.error(message);
          process.exit(1);
        }

        console.warn(`${message}\n`);
      }
    }
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

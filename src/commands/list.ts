import { defineCommand } from "citty";
import { loadAllPlugins } from "../parsers/claude";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List available plugins and skills",
  },
  args: {
    plugin: {
      type: "positional",
      description: "Plugin name (omit for all)",
      required: false,
    },
  },
  async run({ args }) {
    const plugins = loadAllPlugins();

    if (args.plugin) {
      const match = plugins.find((p) => p.name === args.plugin);
      if (!match) {
        const available = plugins.map((p) => p.name).join(", ");
        console.error(`Plugin not found: ${args.plugin}. Available: ${available}`);
        process.exit(1);
      }
      printPlugin(match, true);
      return;
    }

    const totalSkills = plugins.reduce((n, p) => n + p.skills.length, 0);
    console.log(`Heart of Gold Toolkit v0.1.0 — ${totalSkills} skills across ${plugins.length} plugins\n`);
    for (const plugin of plugins) {
      printPlugin(plugin, false);
    }
  },
});

function printPlugin(plugin: { name: string; description: string; skills: { name: string; description: string }[] }, verbose: boolean) {
  console.log(`${plugin.name} (${plugin.skills.length} skills) — ${plugin.description}`);
  if (verbose) {
    for (const skill of plugin.skills) {
      console.log(`  /${skill.name} — ${skill.description}`);
    }
  } else {
    const names = plugin.skills.map((s) => s.name).join(", ");
    console.log(`  ${names}`);
  }
  console.log();
}

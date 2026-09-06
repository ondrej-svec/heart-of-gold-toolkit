#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { installCommand } from "./commands/install";
import { listCommand } from "./commands/list";
import { targetsCommand } from "./commands/targets";
import { shareServerCommand } from "./commands/share-server";

const main = defineCommand({
  meta: {
    name: "heart-of-gold",
    version: "0.1.43",
    description:
      "Cross-platform installer for Heart of Gold skills — Codex, OpenCode, Pi, Claude Code, and more",
  },
  subCommands: {
    install: installCommand,
    list: listCommand,
    targets: targetsCommand,
    "share-server": shareServerCommand,
    workstation: {
      meta: { name: "workstation", description: "Learn your workstation — offline reference, not a launcher" },
    },
  },
});

// citty consumes --help even after --. Forward this command's untouched tail
// before its parser; lazy import keeps unrelated commands independent of setup.
if (process.argv[2] === "workstation") {
  const { runWorkstation } = await import("./commands/workstation");
  process.exitCode = await runWorkstation(process.argv.slice(3));
} else {
  runMain(main);
}

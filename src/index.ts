#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { installCommand } from "./commands/install";
import { listCommand } from "./commands/list";
import { targetsCommand } from "./commands/targets";
import { shareServerCommand } from "./commands/share-server";

const main = defineCommand({
  meta: {
    name: "heart-of-gold",
    version: "0.1.28",
    description:
      "Cross-platform installer for Heart of Gold skills — Codex, OpenCode, Pi, Claude Code, and more",
  },
  subCommands: {
    install: installCommand,
    list: listCommand,
    targets: targetsCommand,
    "share-server": shareServerCommand,
  },
});

runMain(main);

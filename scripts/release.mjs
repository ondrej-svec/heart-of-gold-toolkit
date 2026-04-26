#!/usr/bin/env node
// One-shot release tool. Bumps a plugin (plugin.json + marketplace.json) and
// the root package.json in lockstep, runs the prepublish checks, commits, and
// — only with --ship — pushes and publishes to NPM.
//
// Usage:
//   node scripts/release.mjs <plugin|root>:<patch|minor|major> [flags]
//
// Examples:
//   node scripts/release.mjs marvin:patch                      # bump + commit, no push/publish
//   node scripts/release.mjs marvin:minor --ship -m "new skill"  # bump + commit + push + npm publish
//   node scripts/release.mjs root:patch                        # root only (CLI fix; no plugin)
//   node scripts/release.mjs --dry-run marvin:patch            # preview, mutate nothing
//
// Flags:
//   --ship              after commit, run `git push` and `npm publish --access public`
//   --dry-run           print the plan, change no files
//   -m, --message TEXT  description after the standard "Release X.Y.Z — " prefix
//   -h, --help          this text

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_PKG = join(ROOT, "package.json");
const MARKETPLACE = join(ROOT, ".claude-plugin/marketplace.json");
const PLUGINS = ["guide", "deep-thought", "marvin", "babel-fish", "quellis"];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
const shRead = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" });

function bump(version, kind) {
  const [maj, min, pat] = version.split(".").map(Number);
  if (kind === "patch") return `${maj}.${min}.${pat + 1}`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  if (kind === "major") return `${maj + 1}.0.0`;
  throw new Error(`Unknown bump kind: ${kind} (use patch, minor, or major)`);
}

function help() {
  console.log(`One-shot release tool. Bumps a plugin (plugin.json + marketplace.json) and
the root package.json in lockstep, runs prepublish checks, commits, and —
only with --ship — pushes and publishes to NPM.

Usage:
  node scripts/release.mjs <plugin|root>:<patch|minor|major> [flags]

Examples:
  node scripts/release.mjs marvin:patch                      # bump + commit, no push/publish
  node scripts/release.mjs marvin:minor --ship -m "new skill"  # bump + commit + push + npm publish
  node scripts/release.mjs root:patch                        # root only (CLI fix; no plugin)
  node scripts/release.mjs --dry-run marvin:patch            # preview, mutate nothing

Flags:
  --ship              after commit, run \`git push\` and \`npm publish --access public\`
  --dry-run           print the plan, change no files
  -m, --message TEXT  description after the standard "Release X.Y.Z — " prefix
  -h, --help          this text

Plugins: ${PLUGINS.join(" | ")} | root`);
}

function parse(argv) {
  const out = { target: null, kind: null, dryRun: false, ship: false, message: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { help(); process.exit(0); }
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--ship") out.ship = true;
    else if (a === "--message" || a === "-m") out.message = argv[++i] ?? "";
    else if (a.includes(":")) [out.target, out.kind] = a.split(":");
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!out.target || !out.kind) { help(); process.exit(1); }
  if (out.target !== "root" && !PLUGINS.includes(out.target)) {
    throw new Error(`Unknown plugin: ${out.target}. Known: ${PLUGINS.join(", ")}, root`);
  }
  if (!["patch", "minor", "major"].includes(out.kind)) {
    throw new Error(`Unknown bump kind: ${out.kind}. Use patch | minor | major`);
  }
  if (out.target === "root" && out.kind !== "patch") {
    throw new Error("Root bumps are reserved for patch releases (plugin changes drive minor/major).");
  }
  return out;
}

function ensureNoDrift(target, marketplace) {
  if (target === "root") return;
  const pluginPath = join(ROOT, `plugins/${target}/.claude-plugin/plugin.json`);
  const pluginVersion = readJson(pluginPath).version;
  const marketplaceVersion = marketplace.plugins.find((p) => p.name === target).version;
  if (pluginVersion !== marketplaceVersion) {
    throw new Error(
      `Version drift on ${target}: plugin.json=${pluginVersion}, marketplace.json=${marketplaceVersion}. ` +
        `Reconcile both files before releasing.`,
    );
  }
}

function ensureGitClean(allowedRelativePaths) {
  const status = shRead("git status --porcelain").split("\n").filter(Boolean);
  const offending = status.filter((line) => {
    const file = line.slice(3);
    return !allowedRelativePaths.some((a) => file === a);
  });
  if (offending.length) {
    throw new Error(
      `Working tree has changes outside the release scope. Commit or stash them first:\n${offending.join("\n")}`,
    );
  }
}

function main() {
  const { target, kind, dryRun, ship, message } = parse(process.argv.slice(2));

  const rootPkg = readJson(ROOT_PKG);
  const marketplace = readJson(MARKETPLACE);
  ensureNoDrift(target, marketplace);

  const oldRoot = rootPkg.version;
  const newRoot = bump(oldRoot, "patch");
  let pluginPlan = null;
  if (target !== "root") {
    const pluginPath = join(ROOT, `plugins/${target}/.claude-plugin/plugin.json`);
    const pluginJson = readJson(pluginPath);
    const oldPlugin = pluginJson.version;
    const newPlugin = bump(oldPlugin, kind);
    pluginPlan = { name: target, pluginPath, pluginJson, oldPlugin, newPlugin };
  }

  console.log("\nRelease plan");
  console.log("------------");
  if (pluginPlan) console.log(`  plugin ${pluginPlan.name}: ${pluginPlan.oldPlugin} → ${pluginPlan.newPlugin}`);
  console.log(`  root @heart-of-gold/toolkit: ${oldRoot} → ${newRoot}`);
  console.log(`  prepublish checks: will run`);
  console.log(`  commit: yes`);
  console.log(`  push: ${ship ? "yes" : "no"}`);
  console.log(`  npm publish: ${ship ? "yes" : "no"}`);
  if (dryRun) {
    console.log("\n[dry-run] Nothing changed.");
    return;
  }

  const allowed = [
    "package.json",
    ".claude-plugin/marketplace.json",
    pluginPlan ? `plugins/${pluginPlan.name}/.claude-plugin/plugin.json` : null,
  ].filter(Boolean);
  ensureGitClean(allowed);

  if (pluginPlan) {
    pluginPlan.pluginJson.version = pluginPlan.newPlugin;
    writeJson(pluginPlan.pluginPath, pluginPlan.pluginJson);
    const idx = marketplace.plugins.findIndex((p) => p.name === pluginPlan.name);
    marketplace.plugins[idx].version = pluginPlan.newPlugin;
    writeJson(MARKETPLACE, marketplace);
  }
  rootPkg.version = newRoot;
  writeJson(ROOT_PKG, rootPkg);

  console.log("\nRunning prepublish checks…");
  sh("npm run check:publish-safety && npm run check:compat");

  const subject = pluginPlan
    ? `Release ${newRoot} — bump ${pluginPlan.name} to ${pluginPlan.newPlugin}${message ? `: ${message}` : ""}`
    : `Release ${newRoot} — root patch${message ? `: ${message}` : ""}`;
  sh(`git add ${allowed.map((p) => `"${p}"`).join(" ")}`);
  sh(`git commit -m ${JSON.stringify(subject)}`);
  console.log(`\nCommit created: ${subject}`);

  if (!ship) {
    console.log("\nNot shipping. To finish:");
    console.log("  git push && npm publish --access public");
    return;
  }

  console.log("\nPushing to origin…");
  sh("git push");
  console.log("\nPublishing to NPM…");
  sh("npm publish --access public");
  console.log(`\nReleased @heart-of-gold/toolkit@${newRoot}.`);
}

try {
  main();
} catch (err) {
  console.error(`\nrelease: ${err.message}\n`);
  process.exit(1);
}

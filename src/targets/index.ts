import type { TargetHandler } from "../types";
import { codexTarget } from "./codex";
import { opencodeTarget } from "./opencode";
import { piTarget } from "./pi";

export const targets: Record<string, TargetHandler> = {
  codex: codexTarget,
  opencode: opencodeTarget,
  pi: piTarget,
};

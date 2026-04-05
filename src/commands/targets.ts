import { defineCommand } from "citty";
import { targets } from "../targets/index";

export const targetsCommand = defineCommand({
  meta: {
    name: "targets",
    description: "List supported target tools",
  },
  async run() {
    console.log("Supported targets:\n");
    for (const [key, target] of Object.entries(targets)) {
      console.log(`  ${key} — ${target.description}`);
      console.log(`    default: ${target.defaultRoot}/skills/`);
    }
  },
});

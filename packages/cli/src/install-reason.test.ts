import { describe, expect, it } from "vitest";
import { installReason } from "./generate.js";

// A hosted change that installed for 24 s said only how long (T1703): the log now says why.
describe("installReason", () => {
  it("names the manifests a change wrote", () => {
    expect(installReason(["src/app.tsx", "package.json"], true)).toBe("package.json changed");
    expect(installReason(["package.json", "pnpm-workspace.yaml"], true)).toBe(
      "package.json and pnpm-workspace.yaml changed",
    );
  });
  it("says when node_modules is missing", () => {
    expect(installReason(["src/app.tsx"], false)).toBe("node_modules is missing");
  });
  it("says when the run does not know what changed", () => {
    expect(installReason(undefined, true)).toBe("the changed files are not known");
  });
  it("needs none when only other files changed and node_modules is there", () => {
    expect(installReason(["src/app.tsx", "src/db/schema.ts"], true)).toBeUndefined();
  });
});

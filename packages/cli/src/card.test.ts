import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { cardTexts } from "./card.js";
import { run } from "./cli.js";
import { git } from "./git.js";
import { tempDir } from "./test-dir.js";
import { captureIo } from "./test-io.js";

const examples = new URL("../../../examples/", import.meta.url).pathname;

test("card prints the app card with the project's facts; its JSON is the spec files' alone", async () => {
  const dir = tempDir("smithable-card-");
  cpSync(join(examples, "crm"), dir, { recursive: true });
  mkdirSync(join(dir, "src", "custom", "actions"), { recursive: true });
  writeFileSync(join(dir, "src", "custom", "actions", "schedule.ts"), "// UNREAD-CONTENT\n");
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "start"]);

  const io = captureIo();
  expect(await run(["card", dir], io)).toBe(0);
  expect(io.stdout).toMatch(/^# Acme CRM\n/);
  expect(io.stdout).toMatch(/From the project: commit [0-9a-f]{12} of \d{4}-\d\d-\d\d\./);
  expect(io.stdout).toContain("src/custom/actions/schedule.ts, 18 bytes");
  expect(io.stdout).not.toContain("UNREAD-CONTENT");
  expect(io.stdout).toContain("It is not a security review or legal advice.");

  const json = captureIo();
  expect(await run(["card", dir, "--format", "json"], json)).toBe(0);
  const facts = JSON.parse(json.stdout);
  expect(facts.card).toBe(1);
  expect(json.stdout).not.toContain("schedule.ts");

  const html = captureIo();
  expect(await run(["card", dir, "--format", "html"], html)).toBe(0);
  expect(html.stdout).toMatch(/^<!doctype html>/);

  const bad = captureIo();
  expect(await run(["card", dir, "--format", "pdf"], bad)).toBe(2);
  expect(await run(["card", dir, "--language", "fi"], bad)).toBe(2);
});

test("Studio's card is the command's, in Markdown and HTML, or what stops it (A 233)", () => {
  const dir = tempDir("smithable-card-studio-");
  cpSync(join(examples, "crm"), dir, { recursive: true });
  const card = cardTexts(dir);
  if ("error" in card) throw new Error(card.error);
  expect(card.md).toMatch(/^# Acme CRM\n/);
  expect(card.html).toMatch(/^<!doctype html>/);
  writeFileSync(join(dir, "smithable.yml"), "app: [\n");
  expect(cardTexts(dir)).toHaveProperty("error");
});

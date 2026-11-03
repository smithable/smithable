import { stripTypeScriptTypes } from "node:module";
import { generateApp } from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Mail fixture }
models:
  Request:
    fields: { title: string!, email: email!, body: text, attachments: files }
pages:
  requests: { crud: Request }
incoming:
  support:
    mail: true
    create: Request
    fields: { from: email, subject: title, body: body, attachments: attachments }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((file) => file.path === path);
test("mail attachment admission failure cleans earlier stored attachments", async () => {
  const route = file("src/routes/incoming/support.ts")?.content ?? "";
  const source = /async function saved\([\s\S]*?^}/m.exec(route)?.[0];
  expect(source).toBeTruthy();
  const removed: string[] = [];
  const released: unknown[] = [];
  let admissions = 0;
  const failure = new Error("quota scan failed");
  const saved = new Function(
    "Buffer",
    "text",
    "reserveUpload",
    "FILE_MAX_BYTES",
    "deleteFile",
    "answer",
    "scanned",
    "saveFile",
    "BadFile",
    "release",
    `${stripTypeScriptTypes(source ?? "")}; return saved;`,
  )(
    Buffer,
    (v: unknown) => String(v ?? ""),
    async () => {
      if (++admissions === 2) throw failure;
      return { active: true };
    },
    100,
    (file: { file: string }) => removed.push(file.file),
    (status: number, body: unknown) => ({ status, body }),
    async () => {},
    () => ({ file: "record/stored.txt" }),
    class BadFile extends Error {},
    (held: unknown) => released.push(held),
  ) as (mail: unknown, model: string, uses: () => boolean) => Promise<unknown>;
  await expect(
    saved({ attachments: [{ data: "eA==" }, { data: "eQ==" }] }, "record", () => false),
  ).rejects.toBe(failure);
  expect(removed).toEqual(["record/stored.txt"]);
  expect(released).toHaveLength(2);
});

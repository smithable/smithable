// An app with no sign-in, as its owner must hear it (T769): what anyone can use, nothing else.
import { type AuthIR, emptyContent, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { noSignIn, summarize } from "./index.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Blog }
models:
  Post:
    fields: { title: string!, status: draft | published }
  Note:
    fields: { text: string! }
pages:
  posts: { crud: Post }
  notes: { crud: Note }
`,
}).ir;
if (!ir) throw new Error("spec");
const auth = (text: string) =>
  validateAuth({ path: "smithable.auth.yml", text: `smithableAuth: 0.1\n${text}` }, ir)
    .auth as AuthIR;

test("no sign-in: what anyone can use, and that nothing else works for anyone until it has sign-in", () => {
  const open = auth(
    "signIn: none\npublic: { pages: [posts], read: [{ Post: { where: { status: published } } }] }\n",
  );
  expect(noSignIn(ir, open)).toBe(
    "This app has no sign-in. Anyone with the address can use the Posts page and read posts (some of them); nothing else can be used by anyone, you included, until you add sign-in (smithable op setProviders email).",
  );
  // The summary says the same, in its sign-in part.
  const section = summarize(ir, open, emptyContent()).find((s) => s.concept === "auth");
  expect(section?.sentences[0]).toMatch(/^This app has no sign-in\./);
  // Nothing public: nothing in it can be used.
  expect(noSignIn(ir, auth("signIn: none\n"))).toBe(
    "This app has no sign-in. Nothing in it can be used by anyone, you included, until you add sign-in (smithable op setProviders email).",
  );
  // With sign-in, nothing to say.
  expect(noSignIn(ir, { ...open, signIn: { providers: ["email"] } } as AuthIR)).toBeUndefined();
});

test("what anyone can add is said too, and the summary does not repeat it", () => {
  const withForm = auth(
    "signIn: none\npublic: { pages: [posts], read: [{ Post: { where: { status: published } } }], create: [Note] }\n",
  );
  expect(noSignIn(ir, withForm)).toBe(
    "This app has no sign-in. Anyone with the address can use the Posts page, read posts (some of them) and add notes; nothing else can be used by anyone, you included, until you add sign-in (smithable op setProviders email).",
  );
  const sentences = summarize(ir, withForm, emptyContent()).find(
    (s) => s.concept === "auth",
  )?.sentences;
  expect(sentences?.some((s) => s.startsWith("Open to anyone"))).toBe(false);
});

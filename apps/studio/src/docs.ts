// Where the spec reference explains each file Code mode edits (docs/spec/v0.1.md, published as
// docs.smithable.ai/spec.html with GitHub's heading anchors). docs.test.ts finds each anchor in
// the reference, so a reworded heading fails a test instead of a link landing at the top.
import type { EditableFile } from "@smithable/core";

export const SPEC_REFERENCE = "https://docs.smithable.ai/spec.html";

export const FILE_DOCS: Record<EditableFile, string> = {
  "smithable.yml": SPEC_REFERENCE,
  "smithable.content.yml": `${SPEC_REFERENCE}#smithablecontentyml-visible-text`,
  "smithable.auth.yml": `${SPEC_REFERENCE}#smithableauthyml-sign-in-roles-and-what-is-public`,
  "smithable.ux.yml": `${SPEC_REFERENCE}#smithableuxyml-how-the-app-looks`,
  "smithable.context.yml": `${SPEC_REFERENCE}#smithablecontextyml-how-the-app-is-built`,
};

/** The docs on custom code: what it is for, how to write it, and that the file is the person's to keep. */
export const CUSTOM_CODE_DOCS = "https://docs.smithable.ai/code.html";

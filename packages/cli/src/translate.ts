// `smithable translate <language>`: a language file's first draft by the configured model
// (docs/design/languages.md §1). The texts still empty in that language are put into it in one
// request and saved with setTexts as one change, which undo takes back.

import { draftTranslation } from "@smithable/ai";
import { LANGUAGES, type Language, textPaths, textsToTranslate } from "@smithable/core";
import { providersFor } from "./ask.js";
import type { Io } from "./io.js";
import { runOperation } from "./op.js";
import { loadSpec } from "./validate.js";

export async function translate(
  dir: string,
  io: Io,
  language: string | undefined,
): Promise<number> {
  if (!language || !LANGUAGES.includes(language as Language)) {
    io.err(`translate needs one of the app's other languages, like: smithable translate sv\n`);
    return 2;
  }
  const { ir, content } = loadSpec(dir, io);
  if (!ir || !content) return 1;
  const translation = content.translations?.[language as Language];
  if (!content.languages?.includes(language as Language) || !translation) {
    io.err(
      `The app is not in "${language}": add it first (smithable op addLanguage ${language}).\n`,
    );
    return 1;
  }
  const said = textPaths(translation);
  const empty = Object.fromEntries(
    [...textsToTranslate(content, ir)].filter(([path]) => !said.get(path)?.trim()),
  );
  const count = Object.keys(empty).length;
  if (!count) {
    io.out(`Every text already has its words in ${language}.\n`);
    return 0;
  }
  const providers = providersFor();
  if (!providers.length) {
    io.err(
      `No model is configured to draft the texts (docs/ai.md); fill them in with setText, or in Studio's Languages tab.\n`,
    );
    return 1;
  }
  const draft = await draftTranslation({
    texts: empty,
    from: content.language,
    to: language,
    providers,
  });
  const drafted = Object.keys(draft.texts).length;
  if (!drafted) {
    io.err("The model gave no texts back; nothing was changed.\n");
    return 1;
  }
  const last = draft.usage.at(-1);
  const trailer = `Smithable-AI: ${JSON.stringify({
    request: `translate ${language}`,
    tier: last?.tier,
    model: last?.model,
    tokens: draft.usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0),
    cost: Number(draft.usage.reduce((n, u) => n + u.cost, 0).toFixed(6)),
    currency: last?.currency,
  })}`;
  const code = await runOperation(
    dir,
    io,
    "setTexts",
    { texts: draft.texts, language },
    {
      yes: true,
      trailer,
    },
  );
  if (code === 0)
    io.out(
      `${drafted} of ${count} texts drafted in ${language} by ${last?.model ?? "the model"}: read them in Studio's Languages tab or smithable.content.${language}.yml.\n`,
    );
  return code;
}

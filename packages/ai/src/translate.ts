// A language file's first draft (docs/design/languages.md §1): the app's texts a person reads,
// given in its own language by their paths, put into another by the configured model in one
// request. Only the paths asked for come back; the person reads and changes them after.
import { completeJson, type Provider, type Usage } from "./provider.js";

const SYSTEM = `You translate the interface texts of a small business app.
You get the app's language, the language to translate into, and a list of texts, each with its path.
Translate each text: keep it as short as the original, in the register an app's buttons, labels and page titles use.
Keep names of people, places, products and the app itself as they are. Keep placeholders like {name} unchanged.
Answer with every path you were given and its translation, nothing else.`;

const SCHEMA = {
  type: "object",
  required: ["texts"],
  additionalProperties: false,
  properties: {
    texts: {
      type: "array",
      items: {
        type: "object",
        required: ["path", "text"],
        additionalProperties: false,
        properties: { path: { type: "string" }, text: { type: "string" } },
      },
    },
  },
};

/** A language's name in English, for the model: "Swedish". */
const nameOf = (code: string) =>
  new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;

/**
 * The texts in another language, by path: only the paths given, each a non-empty text.
 * Without a model, or when it fails, nothing (the person fills them in).
 */
export async function draftTranslation(options: {
  /** Path in dots → the text in the app's own language. */
  texts: Record<string, string>;
  from: string;
  to: string;
  providers: Provider[];
}): Promise<{ texts: Record<string, string>; usage: Usage[] }> {
  const usage: Usage[] = [];
  const provider = options.providers[0];
  const paths = Object.keys(options.texts);
  if (!provider || !paths.length) return { texts: {}, usage };
  const user = `From ${nameOf(options.from)} into ${nameOf(options.to)}.\n\n${paths
    .map((path) => `${path}: ${options.texts[path]}`)
    .join("\n")}`;
  try {
    const answer = (await completeJson(
      provider,
      { system: SYSTEM, user, schema: SCHEMA },
      usage,
    )) as {
      texts?: unknown;
    };
    const texts: Record<string, string> = {};
    for (const item of Array.isArray(answer.texts) ? answer.texts : []) {
      const { path, text } = (item ?? {}) as { path?: unknown; text?: unknown };
      if (
        typeof path === "string" &&
        path in options.texts &&
        typeof text === "string" &&
        text.trim()
      )
        texts[path] = text.trim();
    }
    return { texts, usage };
  } catch {
    return { texts: {}, usage };
  }
}

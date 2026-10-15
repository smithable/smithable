// The description's language, where a word count can tell: a model guessed Spanish for an English
// description that named a town (Mariehamn), and asked and drafted in Spanish. The languages the
// app kit has words in are told apart the same way, so a first build can set the app's language.

import type { Language } from "@smithable/core";

/** Short words that any sentence about an app has a few of, per language the kit has words in. */
const SHORT_WORDS: Record<Language, Set<string>> = {
  en: new Set(
    "a an the and or but of to for in on at by with from as is are be can may should will who what when where which that this these those our we us you your they their it its my me i people only each all some see sign list want need things others".split(
      " ",
    ),
  ),
  sv: new Set(
    "och att det en ett är som för på med av till inte om har de den jag vi kan ska skall vill man sig från eller när där sina våra alla varje bara också så här vara blir finns ser över under efter mellan hos än mycket ingen inga några någon vem vad vilka vilken dem deras oss min mitt mina våra er sin sitt".split(
      " ",
    ),
  ),
};

/** Each language by its English name, for prompts and messages. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", sv: "Swedish" };
const NAMES = LANGUAGE_NAMES;

/** The language a description is written in, when a sixth of its words or more are that language's short ones; else undefined. */
export function writtenIn(text: string): Language | undefined {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 5) return undefined;
  let best: { language: Language; share: number } | undefined;
  for (const [language, set] of Object.entries(SHORT_WORDS) as [Language, Set<string>][]) {
    const share = words.filter((w) => set.has(w)).length / words.length;
    if (share >= 0.15 && (!best || share > best.share)) best = { language, share };
  }
  return best?.language;
}

/** Whether a description is written in English: a sixth of its words or more are short English ones. */
export const writtenInEnglish = (text: string): boolean => writtenIn(text) === "en";

/** Where a description is a page's (`new --from`, `read-page`): its first words. */
export const PAGE_START = "The app behind a site like this one";

/** The question when a page's language is not the person's: which one the app's texts are in. */
export function languageQuestion(site: Language, person: Language = "en") {
  return {
    question: `The site is in ${NAMES[site]}. Should the app's texts be in ${NAMES[site]} or ${NAMES[person]}?`,
    options: [NAMES[site], NAMES[person]],
  };
}

/**
 * The language of the app's texts, where it can be told: the answer to the language question;
 * else the description's own words, without the answers folded into it, and for a page's
 * description without its English frame.
 */
export function textLanguage(description: string): Language | undefined {
  // Asked, the answer follows the question; answered in order (--answers), it is a language's
  // name on its own after the question's number.
  const answer = (/^- The site is in \w+\. Should the app's texts be in \w+ or \w+\? (.+)$/m.exec(
    description,
  ) ??
    new RegExp(`^- \\(\\d+\\) (${Object.values(NAMES).join("|")})$`, "im").exec(description))?.[1]
    ?.trim()
    .toLowerCase();
  const named = (Object.entries(NAMES) as [Language, string][]).find(([, name]) =>
    answer?.startsWith(name.toLowerCase()),
  );
  if (named) return named[0];
  const own = description.split("\n\nAnswers:\n")[0] ?? "";
  return writtenIn(own.startsWith(PAGE_START) ? own.slice(own.indexOf("\n") + 1) : own);
}

/** A language's names as a description may write them: in English, in itself, in Finnish. */
const SAID: Record<Language, string> = {
  en: "english|engelska|englanti",
  sv: "swedish|svenska|svensk|ruotsi|ruotsiksi",
};

/**
 * The other languages a description asks the app to be in besides `main` (languages.md §6
 * step 6): only when it names two together ("in Swedish and English", "på svenska och
 * engelska", "both English and Swedish"), so a word like "Swedish customers" adds none.
 */
export function otherLanguages(description: string, main: Language): Language[] {
  const any = Object.values(SAID).join("|");
  const pair = new RegExp(
    `\\b(${any})\\s*(?:,|and|och|ja|&|\\+)\\s*(?:also\\s+|även\\s+|också\\s+)?(${any})\\b`,
    "giu",
  );
  const named = new Set<Language>();
  for (const m of description.toLowerCase().matchAll(pair))
    for (const word of [m[1], m[2]])
      for (const [code, names] of Object.entries(SAID) as [Language, string][])
        if (names.split("|").includes(word ?? "")) named.add(code);
  return named.has(main) || named.size > 1 ? [...named].filter((code) => code !== main) : [];
}

/** What the prompts say about the language, when it can be told; else nothing. */
export function languageNote(description: string): string {
  const language = textLanguage(description);
  return language
    ? `\n\nThe app's texts are in ${NAMES[language]}: write every question, suggested answer and text a person reads in ${NAMES[language]}, whatever names of places or people the description mentions.`
    : "";
}

/** What the questions' prompt says about their language: `askIn` when the person's language is known (a page's description is not theirs), else the description's. */
export function questionsNote(description: string, askIn?: Language): string {
  return askIn
    ? `\n\nWrite every question and suggested answer in ${NAMES[askIn]}, the language of the person you ask, whatever language the description is in.`
    : languageNote(description);
}

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

/** What the prompts say about the language, when a word count can tell; else nothing. */
export function languageNote(description: string): string {
  const language = writtenIn(description);
  return language
    ? `\n\nThe description is written in ${NAMES[language]}: write every question, suggested answer and text a person reads in ${NAMES[language]}, whatever names of places or people it mentions.`
    : "";
}

/** What the questions' prompt says about their language: `askIn` when the person's language is known (a page's description is not theirs), else the description's. */
export function questionsNote(description: string, askIn?: Language): string {
  return askIn
    ? `\n\nWrite every question and suggested answer in ${NAMES[askIn]}, the language of the person you ask, whatever language the description is in.`
    : languageNote(description);
}

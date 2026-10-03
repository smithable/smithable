// The description's language, where a word count can tell: a model guessed Spanish for an English
// description that named a town (Mariehamn), and asked and drafted in Spanish.

// Short words of English that any sentence about an app has a few of.
const ENGLISH = new Set(
  "a an the and or but of to for in on at by with from as is are be can may should will who what when where which that this these those our we us you your they their it its my me i people only each all some see sign list want need things others".split(
    " ",
  ),
);

/** Whether a description is written in English: a sixth of its words or more are short English ones. */
export function writtenInEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 5) return false;
  return words.filter((w) => ENGLISH.has(w)).length / words.length >= 0.15;
}

/** What the prompts say about the language, when a word count can tell; else nothing. */
export function languageNote(description: string): string {
  return writtenInEnglish(description)
    ? "\n\nThe description is written in English: write every question, suggested answer and text a person reads in English, whatever names of places or people it mentions."
    : "";
}

// An app's initials, the letters on its tile (docs/design/app-logo.md §0): the same rule in
// generation, validation and `validate --explain`.

/**
 * A letter: a Unicode letter or decimal digit with the combining marks that follow it. Fractions
 * and other numerals are signs; a digit drawn as a keycap emoji (1️⃣, a variation selector or
 * the enclosing keycap after it) is an emoji, and both are passed over.
 */
const LETTERS = /([\p{L}\p{Nd}])(\p{M}*)/gu;
const EMOJI = /[\u{FE0F}\u{20E3}]/u;
/** At most this many marks on a letter: a tile has room for a few, not for hundreds. */
const MARKS = 3;
/** Of an upper case, its first letter that is no modifier (ŉ upper-cases to ʼN: N) and its marks. */
const UPPER = /(?!\p{Lm})[\p{L}\p{Nd}]\p{M}*/u;

/** The first letter of a word, upper-cased without a locale: of the upper case, only its first
 * letter and the marks on it are kept (ß gives S, ǰ gives J̌, ŉ gives N), the word's own marks
 * after, at most three marks in all. */
function first(word: string): string | undefined {
  for (const [, base = "", marks = ""] of word.matchAll(LETTERS)) {
    if (EMOJI.test(marks)) continue;
    const [letter = base, ...on] = Array.from(
      (UPPER.exec(base.toUpperCase())?.[0] ?? base) + marks,
    );
    return letter + on.slice(0, MARKS).join("");
  }
  return undefined;
}

/**
 * The initials by rule: the first letter of the first word that has one and of the next word
 * that has one, words being what whitespace separates; emoji and signs are passed over. A name
 * with no letter gives "".
 */
export function initialsOf(name: string): string {
  const letters: string[] = [];
  for (const word of name.split(/\s+/)) {
    const letter = first(word);
    if (letter) letters.push(letter);
    if (letters.length === 2) break;
  }
  return letters.join("");
}

/** Whether a given `initials` is one or two letters by the rule's own idea of a letter, each
 * with at most three marks. */
export const initialsForm = (value: string) =>
  /^(?:[\p{L}\p{Nd}]\p{M}{0,3}){1,2}$/u.test(value) && !EMOJI.test(value);

/** The app's initials: the content file's `initials` when it gives them, else by rule. */
export const appInitials = (name: string, given?: string) => given ?? initialsOf(name);

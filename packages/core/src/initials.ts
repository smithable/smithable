// An app's initials, the letters on its tile (docs/design/app-logo.md §0): the same rule in
// generation, validation and `validate --explain`.

/** A letter: a Unicode letter or digit with the combining marks that follow it. */
const LETTER = /[\p{L}\p{N}]\p{M}*/u;

/** A letter upper-cased without a locale, of which only the first character is kept (ß gives S). */
const upper = (letter: string) => {
  const up = letter.toUpperCase();
  return LETTER.exec(up)?.[0] ?? up;
};

/**
 * The initials by rule: the first letter of the first word that has one and of the next word
 * that has one, words being what whitespace separates; emoji and signs are passed over. A name
 * with no letter gives "".
 */
export function initialsOf(name: string): string {
  const letters: string[] = [];
  for (const word of name.split(/\s+/)) {
    const letter = LETTER.exec(word)?.[0];
    if (letter) letters.push(upper(letter));
    if (letters.length === 2) break;
  }
  return letters.join("");
}

/** Whether a given `initials` is one or two letters by the rule's own idea of a letter. */
export const initialsForm = (value: string) => /^(?:[\p{L}\p{N}]\p{M}*){1,2}$/u.test(value);

/** The app's initials: the content file's `initials` when it gives them, else by rule. */
export const appInitials = (name: string, given?: string) => given ?? initialsOf(name);

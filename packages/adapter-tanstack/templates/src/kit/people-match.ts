// Smithable app kit: people by part of their name (docs/design/api-only.md §3.6), folded alike on
// both sides in JavaScript, since SQLite's lower() folds only A to Z ("ås" would miss "Åsa").

/** How a name and the words looked for are compared: composed, then in lower case. */
const fold = (text: string) => text.normalize("NFC").toLowerCase();

/** The words looked for, folded; under two letters, none (no list of everyone). */
export function lookedFor(words: string): string | undefined {
  const text = fold(words.trim());
  return [...text].length >= 2 ? text : undefined;
}

/** The people whose name holds the words, in the order given, at most ten. */
export function namesHolding<T extends { name: string | null }>(people: T[], text: string): T[] {
  return people.filter((person) => fold(person.name ?? "").includes(text)).slice(0, 10);
}

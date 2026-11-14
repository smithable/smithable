/**
 * The words of other languages the search reads as the words of the docs and the starters (T844 E):
 * a Swedish stem (an inflected word starts with it; one under five letters must be the whole word)
 * and the English words it stands for. Data only: a line here, never a rule in code.
 */
export const SEARCH_WORDS: Record<string, Record<string, readonly string[]>> = {
  sv: {
    appar: ["app"],
    publicer: ["publish"],
    lagra: ["stored", "data", "live"],
    data: ["data"],
    datan: ["data"],
    kosta: ["cost", "price"],
    exporter: ["export"],
    importer: ["import"],
    excel: ["spreadsheet", "csv"],
    server: ["server", "host"],
    behöver: ["need"],
    modell: ["model"],
    sandlåd: ["sandbox"],
    mejl: ["mail", "email"],
    skicka: ["send"],
    besökar: ["visitor"],
    utkast: ["draft"],
    blogg: ["blog"],
    pass: ["session"],
    personal: ["staff"],
    kunder: ["customer"],
    lämna: ["hand", "over", "leave"],
  },
};

const ENTRIES = Object.values(SEARCH_WORDS).flatMap((words) => Object.entries(words));

/** The English words a word stands for, from the lists above; none when it is in none. */
export function standsFor(word: string): readonly string[] {
  return ENTRIES.filter(([stem]) =>
    stem.length < 5 ? word === stem : word.startsWith(stem),
  ).flatMap(([, words]) => words);
}

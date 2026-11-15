// Instruction words are data, shared by the narrow wording rules and the model router.
const WORDS = {
  en: {
    information: [
      "show me",
      "show how",
      "show where",
      "show what",
      "show why",
      "show who",
      "show which",
      "show whether",
    ],
    openers: [
      "please",
      "let me",
      "let us",
      "allow me to",
      "help me",
      "i need to",
      "i need",
      "we would like to",
      "we'd like to",
      "can you",
      "could you",
      "would you",
      "i want to",
      "i want",
      "i would like to",
      "i'd like to",
      "we want to",
      "we need to",
      "we want",
      "we need",
      "let's",
      "lets",
      "make it possible to",
      "it should be possible to",
      "make sure that",
      "make sure",
    ],
    verbs: [
      "add",
      "remove",
      "delete",
      "rename",
      "set",
      "change",
      "make",
      "show",
      "hide",
      "use",
      "apply",
      "turn off",
      "turn on",
      "sort",
      "move",
      "let",
    ],
  },
  sv: {
    information: ["visa mig", "visa hur", "visa vem", "visa vilka", "visa var", "visa om"],
    openers: ["snälla", "kan du", "skulle du kunna", "jag vill att du", "jag vill", "vi vill"],
    verbs: [
      "lägg till",
      "lägga till",
      "ta bort",
      "radera",
      "byt",
      "byta",
      "ändra",
      "sätt",
      "sätta",
      "gör",
      "göra",
      "visa",
      "dölj",
      "använd",
      "använda",
      "stäng av",
      "slå på",
      "sortera",
      "flytta",
      "låt",
    ],
  },
  fi: {
    information: [
      "näytä minulle",
      "näyttää minulle",
      "näytä miten",
      "näyttää miten",
      "näytä missä",
      "näyttää missä",
      "näytä kuka",
      "näyttää kuka",
    ],
    openers: ["voisitko", "voitko", "haluan että", "haluan", "haluamme"],
    verbs: [
      "lisää",
      "lisätä",
      "poista",
      "poistaa",
      "muuta",
      "muuttaa",
      "vaihda",
      "vaihtaa",
      "aseta",
      "asettaa",
      "näytä",
      "näyttää",
      "piilota",
      "piilottaa",
      "käytä",
      "käyttää",
      "järjestä",
      "järjestää",
      "siirrä",
      "siirtää",
    ],
  },
};

const starts = (text: string, word: string) => text.startsWith(`${word} `);
const OPENERS = Object.values(WORDS)
  .flatMap((w) => w.openers)
  .sort((a, b) => b.length - a.length);

export function stripRequestOpeners(text: string): string {
  for (;;) {
    const opener = OPENERS.find((word) => starts(text, word));
    if (!opener) return text;
    text = text.slice(opener.length).trim();
  }
}

/** A polite question can be an instruction; this routes it, never resolves its missing names. */
export function looksLikeInstruction(request: string): boolean {
  const text = stripRequestOpeners(request.trim().toLowerCase().replace(/\s+/g, " "));
  if (Object.values(WORDS).some((w) => w.information.some((phrase) => starts(text, phrase))))
    return false;
  return Object.values(WORDS).some((w) => w.verbs.some((verb) => starts(text, verb)));
}

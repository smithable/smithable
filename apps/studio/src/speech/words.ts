// Speech for Smith, the rules that need no browser (docs/design/smith-speech.md §3, §5): what of
// a line is read and in which pieces, which voices the policy allows, and the line that says where
// the voice goes. The browser provider and the controls build on these.

/** What a line says aloud: no code, links or tables; a list read to five items and "and N more". */
export function spoken(text: string): string {
  const lines = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .split("\n")
    .filter((l) => !/^\s*\|/.test(l));
  const out: string[] = [];
  let items = 0;
  let skipped = 0;
  for (const line of lines) {
    const item = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (!item) {
      if (skipped) out.push(`and ${skipped} more.`);
      items = 0;
      skipped = 0;
      out.push(line);
      continue;
    }
    if (++items <= 5) out.push(item[1] ?? "");
    else skipped++;
  }
  if (skipped) out.push(`and ${skipped} more.`);
  return out
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The pieces a text is spoken in, so speech starts at once and no utterance runs long enough for
 * a browser to cut it off: sentence by sentence, a long one split at a comma.
 */
export function sentences(text: string, longest = 180): string[] {
  const out: string[] = [];
  // Without lookbehind, which Safari before 16.4 cannot parse.
  for (const sentence of (spoken(text).match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).map((t) => t.trim())) {
    if (sentence.length <= longest) {
      if (sentence) out.push(sentence);
      continue;
    }
    let piece = "";
    for (const part of (sentence.match(/[^,]+(?:,|$)/g) ?? []).map((t) => t.trim())) {
      if (piece && piece.length + part.length + 1 > longest) {
        out.push(piece);
        piece = part;
      } else piece = piece ? `${piece} ${part}` : part;
    }
    if (piece) out.push(piece);
  }
  return out;
}

/** A voice as the browser describes it. */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
}

/**
 * The voices Smith may speak with: Studio's language (English now), and under a policy that keeps
 * everything on the device only the ones the browser says run there.
 */
export function usableVoices<V extends VoiceInfo>(voices: V[], onDeviceOnly: boolean): V[] {
  return voices.filter((v) => /^en\b/i.test(v.lang) && (!onDeviceOnly || v.localService));
}

/** Which browser, for the line that says where the voice goes. */
export type Browser = "chrome" | "edge" | "safari" | "firefox" | "other";

export function browserOf(userAgent: string): Browser {
  if (/Edg\//.test(userAgent)) return "edge";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/Chrome\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "other";
}

/** Where the voice goes, in one line, shown when the mic is first turned on and in the voice menu. */
export function whereLine(
  provider: "browser" | "service",
  browser: Browser,
  onDevice: boolean,
): string {
  if (provider === "service")
    return "Your voice is sent to Smithable's service, which uses Amazon's speech service in Frankfurt. Nothing is kept but the words.";
  if (onDevice) return "Your voice is written out on this computer.";
  const maker =
    browser === "chrome"
      ? "Google"
      : browser === "edge"
        ? "Microsoft"
        : browser === "safari"
          ? "Apple"
          : "your browser's maker";
  return `Your voice is sent to ${maker} to be written out, and kept under ${maker === "your browser's maker" ? "its" : `${maker}'s`} terms.`;
}

// The preview's outbox for Studio: the mails an app kept instead of sending (a preview has no
// mail settings), so a creator can open an invitation's link or read a sign-in code there. Only
// Studio reads it, behind its own token; the app itself never serves data/.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface KeptMail {
  file: string;
  at: string;
  to: string;
  subject: string;
  text: string;
}

/** The newest mails first, at most `limit`, with their headers and text decoded. */
export function readOutbox(dir: string, limit = 50): KeptMail[] {
  const outbox = join(dir, "data", "mail", "outbox");
  let files: string[];
  try {
    files = readdirSync(outbox)
      .filter((f) => f.endsWith(".eml"))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
  return files.map((file) => parseMail(file, readFileSync(join(outbox, file), "utf8")));
}

/** One mail as the kit's mailer writes it: headers, a blank line, a text body. */
export function parseMail(file: string, raw: string): KeptMail {
  const eml = raw.replace(/\r\n/g, "\n");
  const at = eml.indexOf("\n\n");
  // A long header goes on over lines that start with a space.
  const headers = (at === -1 ? eml : eml.slice(0, at)).replace(/\n[ \t]+/g, " ");
  const header = (name: string) =>
    words(new RegExp(`^${name}: (.*)$`, "im").exec(headers)?.[1]?.trim() ?? "");
  const body = at === -1 ? "" : eml.slice(at + 2);
  const encoding = header("Content-Transfer-Encoding").toLowerCase();
  const text =
    encoding === "quoted-printable"
      ? quotedPrintable(body)
      : encoding === "base64"
        ? Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8")
        : body;
  return {
    file,
    at: header("Date"),
    to: header("To"),
    subject: header("Subject"),
    text: text.trim(),
  };
}

/** Header words in another charset (=?UTF-8?Q?…?= and =?UTF-8?B?…?=), as plain text. */
function words(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(
      /=\?([\w-]+)\?([QB])\?([^?]*)\?=/gi,
      (_, _charset: string, kind: string, text: string) =>
        kind.toUpperCase() === "B"
          ? Buffer.from(text, "base64").toString("utf8")
          : quotedPrintable(text.replace(/_/g, " ")),
    );
}

function quotedPrintable(text: string): string {
  const bytes = text
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => `%${hex}`)
    .replace(/%(?![0-9A-F]{2})/gi, "%25");
  try {
    return decodeURIComponent(bytes);
  } catch {
    return text;
  }
}

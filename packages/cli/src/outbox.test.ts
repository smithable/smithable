import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseMail, readOutbox } from "./outbox.js";
import { tempDir } from "./test-dir.js";

describe("the preview's outbox", () => {
  test("a mail's headers and quoted-printable text are decoded", () => {
    const mail = parseMail(
      "a.eml",
      [
        "From: app@localhost",
        "To: anna@example.com",
        "Subject: =?UTF-8?Q?You=E2=80=99re_invited_to_Acme?=",
        "Date: Thu, 08 Oct 2026 10:00:00 +0000",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "Hej Anna, v=C3=A4lkommen. Open http://localhost:4173/sign-in?invite=3Dab=",
        "c to sign in.",
        "",
      ].join("\r\n"),
    );
    expect(mail).toEqual({
      file: "a.eml",
      at: "Thu, 08 Oct 2026 10:00:00 +0000",
      to: "anna@example.com",
      subject: "You’re invited to Acme",
      text: "Hej Anna, välkommen. Open http://localhost:4173/sign-in?invite=abc to sign in.",
    });
  });

  test("the newest mails come first, and an app without an outbox has none", () => {
    const dir = tempDir("outbox-");
    expect(readOutbox(dir)).toEqual([]);
    const outbox = join(dir, "data", "mail", "outbox");
    mkdirSync(outbox, { recursive: true });
    for (const [file, subject] of [
      ["2026-10-08T10-00-00-000Z-a.eml", "first"],
      ["2026-10-08T11-00-00-000Z-b.eml", "second"],
    ] as const)
      writeFileSync(join(outbox, file), `To: a@example.com\nSubject: ${subject}\n\nText\n`);
    writeFileSync(join(outbox, "notes.txt"), "not a mail");
    expect(readOutbox(dir).map((m) => m.subject)).toEqual(["second", "first"]);
  });
});

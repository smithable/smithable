// Reserved reader stand-ins are display values, never destinations. Real owner-entered
// contacts pass through unchanged; this is not a general URL or script sanitizer.
export function contactHref(href: string | undefined, value = href): string | undefined {
  const sample = (input: string | undefined) => {
    let text =
      input
        ?.normalize("NFKC")
        .replace(/\p{Cf}/gu, "")
        .trim() ?? "";
    for (let round = 0; round <= 6; round++) {
      let url: URL | undefined;
      try {
        url = new URL(text.startsWith("//") ? `https:${text}` : text);
      } catch {
        /* A displayed contact need not be a URL. */
      }
      // Match destinations, not a lookalike substring in an ordinary mailbox or URL path.
      const hostname = url?.hostname.toLowerCase().replace(/\.$/, "");
      const reservedHost =
        hostname === "source.invalid" ||
        hostname?.endsWith(".source.invalid") ||
        /^(?:[a-z\d-]+\.)*source\.invalid\.?(?=$|[/:?#])/i.test(text);
      const mailbox =
        (!url || url.protocol === "mailto:") && !text.startsWith("/")
          ? (text.replace(/^mailto:/i, "").split(/[?#]/, 1)[0] ?? "")
          : "";
      const sampleMail = mailbox.split(/[,;]/).some((mail) => {
        const domain = mail.trim().split("@").at(-1)?.toLowerCase().replace(/\.$/, "");
        return (
          /^sample-\d+@example\.com\.?$/i.test(mail.trim()) ||
          domain === "source.invalid" ||
          domain?.endsWith(".source.invalid")
        );
      });
      const address =
        hostname === "www.openstreetmap.org" || hostname === "openstreetmap.org"
          ? (url?.searchParams.get("query") ?? "")
          : /^[a-z][a-z\d+.-]*:/i.test(text) || text.startsWith("/")
            ? ""
            : text;
      if (
        /^(?:tel:)?(?:\+|00)999/i.test(text.replace(/[\s().-]/g, "")) ||
        sampleMail ||
        reservedHost ||
        /\b(?:sample[\s+_-]+street[\s,+_-]+\d+|\d+[\s,+_-]+sample[\s+_-]+street)\b/i.test(address)
      )
        return true;
      if (round === 6) break;
      const entities = text
        .replace(/&#(x[a-f\d]+|\d+);?/gi, (whole, code: string) => {
          const n =
            code[0]?.toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number(code);
          return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
        })
        .replace(
          /&(?:amp|plus|commat|period|hyphen|nbsp);/gi,
          (entity) =>
            ({
              "&amp;": "&",
              "&plus;": "+",
              "&commat;": "@",
              "&period;": ".",
              "&hyphen;": "-",
              "&nbsp;": " ",
            })[entity.toLowerCase()] ?? entity,
        );
      let decoded = entities;
      try {
        decoded = decodeURIComponent(entities);
      } catch {
        // Decode valid octets only for recognition; the returned destination is never rewritten.
        decoded = entities.replace(/%([a-f\d]{2})/gi, (_whole, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        );
      }
      if (decoded === text) break;
      text = decoded
        .normalize("NFKC")
        .replace(/\p{Cf}/gu, "")
        .trim();
    }
    return false;
  };
  return sample(href) || sample(value) ? undefined : href;
}

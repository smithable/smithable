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
      const query = new URLSearchParams(
        text.includes("?") ? text.slice(text.indexOf("?") + 1).split("#", 1)[0] : "",
      );
      const mailto = /^mailto:/i.test(text);
      const mailbox =
        (!url || mailto) && !text.startsWith("/")
          ? (text.replace(/^mailto:/i, "").split(/[?#]/, 1)[0] ?? "")
          : "";
      const recipients = [
        mailbox,
        ...(mailto
          ? [...query]
              .filter(([key]) => ["to", "cc", "bcc"].includes(key.toLowerCase()))
              .map(([, value]) => value)
          : []),
      ];
      const sampleMail = recipients.some((value) =>
        (value?.match(/[^\s<>,;]+@[^\s<>,;]+/g) ?? []).some((mail) => {
          const domain = mail.split("@").at(-1)?.toLowerCase().replace(/\.$/, "");
          return (
            /^sample-\d+(?:-preview)?@example\.com\.?$/i.test(mail) ||
            domain === "source.invalid" ||
            domain?.endsWith(".source.invalid")
          );
        }),
      );
      const phoneScheme = /^(?:tel|sms|smsto|callto|whatsapp):/i.test(text);
      const phoneTargets = [
        ...(phoneScheme || /^[+\d\s().,;-]+$/.test(text)
          ? [text.replace(/^(?:tel|sms|smsto|callto|whatsapp):\/*/i, "").split(/[?&#]/, 1)[0] ?? ""]
          : []),
        ...[...query]
          .filter(([key]) =>
            ["phone", ...(phoneScheme ? ["number", "to"] : [])].includes(key.toLowerCase()),
          )
          .map(([, value]) => value),
        ...(hostname === "wa.me" ? [url?.pathname.slice(1)] : []),
      ];
      const samplePhone = phoneTargets.some((value) =>
        value?.split(/[,;]/).some((number) => {
          const digits = number.replace(/[\s().-]/g, "");
          // Reader collision slots are n + offset * 2000, at most 2000 + 2001 * 2000.
          const allocated = /^999000([1-9]\d{6})$/.exec(digits);
          return (
            /^(?:\+|00)999/.test(digits) ||
            /^99900[01]\d{6}$/.test(digits) ||
            Boolean(allocated && Number(allocated[1]) <= 4_004_000)
          );
        }),
      );
      // Explicit international sample numbers are inert in every URI or query context.
      // Bare sample digits stay limited to phone contexts above, never arbitrary numeric IDs.
      const destination = text.split(/[?#]/, 1)[0] ?? "";
      const rawInternational =
        /^[a-z][a-z\d+.-]*:/i.test(destination) && !mailto ? [destination] : [];
      const internationalSample = [...rawInternational, ...query.values()].some((value) =>
        /(?:^|[^\p{L}\p{N}_])(?:\+|00)[\s().-]*9[\s().-]*9[\s().-]*9[\s().-]*\d/u.test(value),
      );
      // A bare relative route is not a street address; explicit queries and URI destinations are.
      const addresses = [...query.values(), ...(url || /[\s,]/.test(text) ? [text] : [])];
      const sampleAddress = addresses.some((address) =>
        /\b(?:sample[\s+_-]+street[\s,+_-]+\d+|\d+[\s,+_-]+sample[\s+_-]+street)\b/i.test(address),
      );
      if (samplePhone || internationalSample || sampleMail || reservedHost || sampleAddress)
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

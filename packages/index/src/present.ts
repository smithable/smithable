// Smith's presentation of an app (docs/design/smith-first.md §3): five short parts, each built
// from the spec, the auth file and the content file by rule, so nothing Smith says about the app
// can be wrong. Each part names the concepts of Behavior it covers, so "that page" in the next
// line resolves without a model, and the mascot's expression for it.
import {
  type AuthIR,
  type ContentIR,
  emptyContent,
  humanize,
  pageAccess,
  pageModel,
  plural,
  type SpecIR,
} from "@smithable/core";
import { grantWords, list, wordsFor } from "./summary.js";

/** One part of the presentation, in Smith's words. */
export interface Part {
  part: "app" | "pages" | "roles" | "visitors" | "signedIn";
  /** One to three plain sentences. */
  text: string;
  /** Behavior's concepts the part covers: "app", "page:home", "role:member", "public", "signIn". */
  concepts: string[];
  /** The mascot's expression beside it. */
  expression: "happy" | "pointing" | "waiting" | "proud";
}

/** A page as a visitor would name it, with its kind in a word where the title does not say it. */
function pageWords(ir: SpecIR, content: ContentIR, id: string): string {
  const page = ir.pages.find((p) => p.id === id);
  if (!page) return humanize(id).toLowerCase();
  const { pluralLabel, modelNamed } = wordsFor(ir, content);
  const title = content.pages[id]?.title;
  const crud = pageModel(page);
  const model = crud === undefined ? undefined : modelNamed(crud);
  if (title) return title.toLowerCase();
  if (page.pattern.kind === "landing") return `the ${humanize(id).toLowerCase()} page`;
  if (model) return pluralLabel(model).toLowerCase();
  const kind = page.pattern.kind;
  const named = humanize(id).toLowerCase();
  return kind === "calendar"
    ? `a ${named} calendar`
    : kind === "dashboard"
      ? `the ${named} dashboard`
      : kind === "articles"
        ? `the ${named}`
        : named;
}

/** The five parts of Smith's presentation of the app. */
export function present(ir: SpecIR, auth?: AuthIR, content: ContentIR = emptyContent()): Part[] {
  const parts: Part[] = [];
  const name = ir.app.name;
  const kinds = (names: string[]) => names.map((m) => humanize(plural(m)).toLowerCase());

  // 1. The app.
  parts.push({
    part: "app",
    text: ir.app.description
      ? `This is ${name}. ${ir.app.description.replace(/\.?$/, ".")}`
      : ir.models.length
        ? `This is ${name}, an app with ${list(kinds(ir.models.map((m) => m.name)))}.`
        : `This is ${name}.`,
    concepts: ["app"],
    expression: "happy",
  });

  // 2. The pages: the public ones first, then the signed-in ones.
  if (ir.pages.length) {
    const ordered = [...ir.pages].sort((a, b) => Number(b.route === "/") - Number(a.route === "/"));
    const open = ordered.filter((p) => !auth || auth.public.pages.includes(p.id));
    const closed = ordered.filter((p) => !open.includes(p));
    const words = (pages: typeof ordered) => list(pages.map((p) => pageWords(ir, content, p.id)));
    const text =
      open.length && closed.length
        ? `It has ${words(open)} for everyone, and for those who sign in: ${words(closed)}.`
        : open.length
          ? `It has ${words(open)}, open to everyone.`
          : `It has ${words(closed)}, for those who sign in.`;
    parts.push({
      part: "pages",
      text,
      concepts: ordered.map((p) => `page:${p.id}`),
      expression: "pointing",
    });
  }

  // 3. The roles, and how one signs in.
  if (auth) {
    if (auth.signIn === "none") {
      parts.push({
        part: "roles",
        text: `Nobody signs in: everything is on the public pages${
          auth.public.read.length ? `, where anyone reads ${list(kinds(auth.public.read))}` : ""
        }.`,
        concepts: ["signIn"],
        expression: "pointing",
      });
    } else {
      const roles = auth.roles.filter((r) => r.name !== "admin");
      const how = list(
        auth.signIn.providers.map((p) =>
          p === "email" ? "a code sent to their email" : humanize(p),
        ),
        "or",
      );
      const who = auth.signIn.selfSignUp === false ? "Invited people" : "People";
      // The admin role first, then the others with what they are for (Johan, 2026-10-30), by the
      // description's shape: a noun phrase ("A student who books classes.") as an appositive, a
      // verb phrase ("Works with customers.") after "which".
      const what = (r: (typeof roles)[number]) => {
        const d = r.description?.trim().replace(/\.$/, "");
        if (!d) return "";
        return /^(A|An|The) /.test(d)
          ? `, ${d.charAt(0).toLowerCase()}${d.slice(1)}`
          : `, which ${d.charAt(0).toLowerCase()}${d.slice(1)}`;
      };
      const article = (name: string) => (/^[aeiou]/i.test(name) ? "an" : "a");
      const each = roles.map((r) => `${article(r.name)} ${r.name} role${what(r)}`);
      const named =
        roles.length === 1
          ? `There is an admin role, which can do everything, and ${each[0]}.`
          : roles.length
            ? `There is an admin role, which can do everything; ${each.slice(0, -1).join("; ")}; and ${each.at(-1)}.`
            : "Everyone who signs in has the same role; admins do everything.";
      parts.push({
        part: "roles",
        text: `${who} sign in with ${how}. ${named}`,
        concepts: ["signIn", ...auth.roles.map((r) => `role:${r.name}`)],
        expression: "pointing",
      });
    }
  }

  // 4. Visitors: what is open without signing in (with no sign-in at all, part 3 said it).
  if (auth && auth.signIn !== "none") {
    const open = [
      ...(auth.public.pages.length
        ? [`see ${list(auth.public.pages.map((p) => pageWords(ir, content, p)))}`]
        : []),
      ...(auth.public.read.length ? [`read ${list(kinds(auth.public.read))}`] : []),
      ...(auth.public.create.length ? [`add ${list(kinds(auth.public.create))}`] : []),
    ];
    const rest = ir.pages.filter((p) => !auth.public.pages.includes(p.id)).length
      ? " Everything else needs an account."
      : "";
    parts.push({
      part: "visitors",
      text: open.length
        ? `Anyone on the internet can ${list(open)}.${rest}`
        : "Nothing is open without signing in.",
      concepts: ["public"],
      expression: "waiting",
    });
  }

  // 5. Signed in: what each role may do, the record rule included.
  if (auth && auth.signIn !== "none") {
    const rule =
      auth.defaultAccess === "shared"
        ? "Everyone who signs in sees all records and changes the ones they own"
        : "Everyone who signs in works on their own records only";
    const roles = auth.roles
      .filter((r) => r.name !== "admin")
      .map((r) => `the ${r.name} role ${list(grantWords(r).split("; "))}`);
    const pages = auth.roles.length
      ? ir.pages.filter(
          (p) => !auth.public.pages.includes(p.id) && pageAccess(p, auth).roles.length,
        )
      : [];
    parts.push({
      part: "signedIn",
      text: `${rule}${roles.length ? `; ${roles.join("; ")}` : ""}. Admins do everything.`,
      concepts: [...auth.roles.map((r) => `role:${r.name}`), ...pages.map((p) => `page:${p.id}`)],
      expression: "proud",
    });
  }
  return parts;
}

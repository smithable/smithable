// The privacy page's review for Studio (docs/design/legal-page.md §6.4): each page's state, and
// for one that changed since its review, the parts that changed, by comparing its description
// now with the one the project's files gave at the change that recorded the review. No stored
// copy: the facts as reviewed are computed again from that change's files.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { privacyReviews } from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  analyticsOf,
  type ContentIR,
  paymentProviderOf,
  type SpecIR,
  type UxIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { loadSpec } from "./validate.js";

/** Each of the page's parts, by the facts it says, in the page's own headings. */
const PARTS: [string, string[]][] = [
  ["Who runs it", ["app", "purpose", "operator"]],
  ["Your account", ["signIn"]],
  ["The assistant", ["assistant"]],
  ["Information in records", ["records", "uploads"]],
  ["What visitors are asked for", ["forms"]],
  ["What comes in", ["mailInto", "calls"]],
  ["Other services", ["services", "ownServices"]],
  ["Cookies", ["analytics"]],
  ["Mail", ["mailAbout"]],
  ["Payments", ["payAbout", "payProvider"]],
  ["Texts to your phone", ["smsAbout"]],
  ["Notifications in your browser", ["pushAbout"]],
  ["The owner's own functions", ["custom"]],
  ["More", ["more"]],
];

export interface PrivacyState {
  page: string;
  state: "reviewed" | "changed" | "never";
  /** The fingerprint now, for reviewing it. */
  facts: string;
  /** The day of the review on record, when there is one. */
  on?: string;
  /** For a changed page: the parts that changed, or the wording when no fact did. */
  changed?: string[];
}

type Files = { spec?: string; auth?: string; content?: string; ux?: string; context?: string };

/** The reviews' facts and states of the project's files, as given. */
function reviewsOf(files: Files) {
  if (!files.spec || !files.auth) return [];
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir as SpecIR | undefined;
  if (!ir) return [];
  const auth = validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).auth as
    | AuthIR
    | undefined;
  if (!auth) return [];
  const content = files.content
    ? (validateContent({ path: "smithable.content.yml", text: files.content }, ir).content as
        | ContentIR
        | undefined)
    : undefined;
  const ux = files.ux
    ? (validateUx({ path: "smithable.ux.yml", text: files.ux }, ir).ux as UxIR | undefined)
    : undefined;
  return reviewsFor(ir, auth, content, ux, files.context);
}

function reviewsFor(
  ir: SpecIR,
  auth: AuthIR,
  content: ContentIR | undefined,
  ux: UxIR | undefined,
  context: string | undefined,
) {
  const analytics = context ? analyticsOf(context) : undefined;
  const paymentProvider = paymentProviderOf(context);
  return privacyReviews(ir, {
    smithableVersion: "0.0.0",
    auth,
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
    ...(analytics ? { analytics } : {}),
    ...(paymentProvider ? { paymentProvider } : {}),
  });
}

const git = (dir: string, args: string[]): string | undefined => {
  try {
    return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: dir,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 16 * 1024 * 1024,
    }).toString("utf8");
  } catch {
    return undefined;
  }
};

/** The project's files at a commit, as they were. */
const filesAt = (dir: string, commit: string): Files => {
  const read = (name: string) => git(dir, ["show", `${commit}:${name}`]);
  return {
    spec: read("smithable.yml"),
    auth: read("smithable.auth.yml"),
    content: read("smithable.content.yml"),
    ux: read("smithable.ux.yml"),
    context: read("smithable.context.yml"),
  };
};

/** The parts whose facts differ between two descriptions, in the page's headings. */
export function changedParts(
  then: Record<string, unknown> | undefined,
  now: Record<string, unknown>,
): string[] {
  if (!then) return [];
  const differs = (key: string) => JSON.stringify(then[key]) !== JSON.stringify(now[key]);
  return PARTS.filter(([, keys]) => keys.some(differs)).map(([title]) => title);
}

/** Each privacy page's review for Studio: its state, and what changed since its review. */
export function privacyStates(dir: string): PrivacyState[] {
  const loaded = loadSpec(dir, { out: () => {}, err: () => {} });
  if (!loaded.ir || !loaded.auth) return [];
  const contextPath = join(dir, "smithable.context.yml");
  const context = existsSync(contextPath) ? readFileSync(contextPath, "utf8") : undefined;
  return reviewsFor(loaded.ir, loaded.auth, loaded.content, loaded.ux, context).map((r) => {
    const state: PrivacyState = {
      page: r.page,
      state: r.state,
      facts: r.facts,
      ...(r.reviewed ? { on: r.reviewed.on } : {}),
    };
    if (r.state !== "changed" || !r.reviewed) return state;
    // The change that recorded the review: the oldest commit that wrote its fingerprint.
    const commits = git(dir, [
      "log",
      "--format=%H",
      "-S",
      `facts: ${r.reviewed.facts}`,
      "--",
      "smithable.content.yml",
    ])
      ?.trim()
      .split("\n")
      .filter(Boolean);
    const recorded = commits?.at(-1);
    const then = recorded
      ? reviewsOf(filesAt(dir, recorded)).find((x) => x.page === r.page)?.described
      : undefined;
    // Without the reviewed change in the history (squashed, or merged in from elsewhere) the
    // parts that changed cannot be told: none are named, rather than a guess.
    if (!then) return state;
    const parts = changedParts(then, r.described);
    return { ...state, changed: parts.length ? parts : ["The page's wording"] };
  });
}

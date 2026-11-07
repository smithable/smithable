// Milestones (backlog A 232): a point in the change trace a person names, to find it again. Each
// is an annotated Git tag milestone/<slug> on the change's commit, its message the name as given,
// so it lives in the project's own history. A change has one name at most: naming it again
// renames it, and an empty name takes the milestone away.
import { git, ownRepository } from "./git.js";

interface Tag {
  /** The commit it names. */
  sha: string;
  /** The tag, e.g. milestone/first-bookings. */
  tag: string;
  name: string;
}

function tags(dir: string): Tag[] {
  if (!ownRepository(dir)) return [];
  // An annotated tag's commit is %(*objectname); its name, the tag's message.
  const listed = git(dir, [
    "for-each-ref",
    "--format=%(*objectname)%00%(refname:strip=2)%00%(contents:subject)",
    "refs/tags/milestone/",
  ]);
  if (!listed.ok) return [];
  return listed.out.split("\n").flatMap((line) => {
    const [sha = "", tag = "", name = ""] = line.split("\0");
    return /^[0-9a-f]{40}$/.test(sha) ? [{ sha, tag, name }] : [];
  });
}

/** The milestones by the commit they name. */
export function milestones(dir: string): Map<string, string> {
  return new Map(tags(dir).map((t) => [t.sha, t.name]));
}

/** The tag's name for a milestone's name: lower case, words joined by hyphens. */
export function milestoneSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}

/** Names the change `change` (a commit) as a milestone, renames it, or (an empty name) unnames it. */
export function nameMilestone(
  dir: string,
  change: string,
  name: string,
): { ok: boolean; output: string } {
  if (!ownRepository(dir)) return { ok: false, output: "This project has no history yet." };
  const sha = /^[0-9a-f]{7,40}$/.test(change)
    ? git(dir, ["rev-parse", "--verify", "--quiet", `${change}^{commit}`])
    : { ok: false, out: "" };
  if (!sha.ok) return { ok: false, output: `There is no change ${change} in the history.` };
  const text = name.trim().replace(/\s+/g, " ");
  const slug = milestoneSlug(text);
  if (text && !slug) return { ok: false, output: "A milestone's name needs a letter or a digit." };
  const all = tags(dir);
  const other = all.find((t) => t.tag === `milestone/${slug}` && t.sha !== sha.out);
  if (slug && other)
    return { ok: false, output: `Another change is the milestone "${other.name}".` };
  const own = all.filter((t) => t.sha === sha.out);
  if (!text) {
    for (const t of own) git(dir, ["tag", "-d", t.tag]);
    return {
      ok: true,
      output: own[0]
        ? `"${own[0].name}" is no longer a milestone.`
        : "That change is not a milestone.",
    };
  }
  // The new name first, the old one taken away only once it stands: a failure loses nothing.
  const tag = `milestone/${slug}`;
  const same = own.some((t) => t.tag === tag);
  const tagged = git(dir, ["tag", "-a", ...(same ? ["-f"] : []), tag, "-m", text, sha.out]);
  if (!tagged.ok) return { ok: false, output: tagged.out };
  for (const t of own) if (t.tag !== tag) git(dir, ["tag", "-d", t.tag]);
  return { ok: true, output: `Named the milestone "${text}".` };
}

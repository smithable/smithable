// The sample export on docs.smithable.ai (docs/site/leave.md): the booking starter as smithable.ai's
// "Download everything (.zip)" makes it, for anyone to try leaving with: the code with its history
// (a Git bundle, with one page customized as hand-written code), the data with its uploads, each
// table as a CSV and the README, in docs/site/leave/stillwater-export.zip. The data is the starter's
// sample records; sign-in sessions, codes and tokens are left out as in a real export.
// Run after `pnpm build`: `node scripts/sample-export.mjs`. Not part of `check`.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cli, repo, run } from "./dev-app.mjs";

const slug = "stillwater";
const work = mkdtempSync(join(tmpdir(), "smithable-sample-export-"));
const app = join(work, "app");
// The history's author is the sample's own, never whoever runs this script: none of their Git
// settings (name, signing key, hooks) apply, and the times are in UTC.
const who = { name: "Studio", email: "studio@smithable.invalid" };
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  TZ: "UTC",
  GIT_AUTHOR_NAME: who.name,
  GIT_AUTHOR_EMAIL: who.email,
  GIT_COMMITTER_NAME: who.name,
  GIT_COMMITTER_EMAIL: who.email,
});

// Its administrator is a sample address, not the Git user of whoever runs this.
run(["node", cli, "new", app, "--starter", "booking", "--admin", "owner@sample.example"]);
// The hosted workspace's first commit, as the export makes it for a project with no history yet.
run(["git", "init", "-q"], app);
run(["git", "add", "-A"], app);
run(["git", "commit", "-qm", "smithable: start of history"], app);
run(["node", cli, "customize", "page:instructors"], app);

const w = join(work, slug);
mkdirSync(join(w, "data", "db"), { recursive: true });
run(["git", "bundle", "create", "-q", join(w, "project.bundle"), "--all"], app);

// The database as the export leaves it: no sessions or codes, no tokens or password hashes.
const db = join(w, "data", "db", "app.db");
new DatabaseSync(join(app, "data", "db", "app.db"), { readOnly: true }).exec(
  `VACUUM INTO '${db.replaceAll("'", "''")}'`,
);
const con = new DatabaseSync(db);
const has = (table, column) =>
  con
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .some((c) => c.name === column);
if (has("session", "id")) con.exec("DELETE FROM session");
if (has("verification", "id")) con.exec("DELETE FROM verification");
for (const column of ["access_token", "refresh_token", "id_token", "password"])
  if (has("account", column)) con.exec(`UPDATE account SET ${column} = NULL`);
if (has("invitation", "token"))
  con.exec("UPDATE invitation SET token = lower(hex(randomblob(16)))");
con.exec("VACUUM");

mkdirSync(join(w, "tables"));
const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const tables = con
  .prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' AND name NOT IN ('account', 'session', 'verification') AND name NOT LIKE '%!_favorites' ESCAPE '!' ORDER BY name",
  )
  .all();
for (const { name } of tables) {
  const statement = con.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`);
  const columns = statement.columns().map((c) => c.name);
  const lines = [columns, ...statement.all().map((row) => columns.map((c) => row[c]))];
  writeFileSync(
    join(w, "tables", `${name}.csv`),
    `${lines.map((l) => l.map(cell).join(",")).join("\r\n")}\r\n`,
  );
}
con.close();
cpSync(join(app, "data", "uploads"), join(w, "data", "uploads"), { recursive: true });

const when = new Date().toISOString().slice(0, 16).replace("T", " ");
writeFileSync(
  join(w, "README.md"),
  `# Stillwater Yoga

Everything of this app as of ${when} UTC.

This is a sample: the booking starter, with one page (\`src/custom/pages/instructors.tsx\`) made the
owner's own, exported the way smithable.ai's "Download everything" exports an app. Its records are
the starter's sample data, standing in for an app's real records. What to do with it, step by step:
https://docs.smithable.ai/leave.html

- \`project.bundle\`: the project's code with its whole Git history.
- \`data/\`: the data in Studio (the app is not published): the database (\`db/app.db\`, SQLite) and any uploaded files (\`uploads/\`). Sign-in sessions, codes and links are left out, so everyone signs in again.
- \`tables/\`: each table of that database as a CSV file, for a spreadsheet (not the sign-in tables or people's favorites). Dates are milliseconds since 1970, money is in cents.

## Open it

\`\`\`sh
git clone project.bundle ${slug}
cp -r data ${slug}/
cd ${slug}
pnpm install
smithable studio
\`\`\`

It is an ordinary TypeScript app (TanStack Start, Drizzle, SQLite), so it also runs without Smithable: \`pnpm dev\`. \`smithable detach\` removes what only Smithable uses, leaving the changes for you to review and commit.
`,
);

const out = join(repo, "docs/site/leave");
mkdirSync(out, { recursive: true });
rmSync(join(out, `${slug}-export.zip`), { force: true });
// Python's zip, as the service's export makes it (no zip tool needed).
run([
  "python3",
  "-c",
  "import shutil, sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2], sys.argv[3])",
  join(out, `${slug}-export`),
  work,
  slug,
]);
rmSync(work, { recursive: true, force: true });
console.log(`Wrote docs/site/leave/${slug}-export.zip`);

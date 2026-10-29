// The development door for sample users (docs/design/sample-users.md §4–§5): the people of
// samples/people.yml as users of the development database, and the door the host acts through.
import {
  type ActionIR,
  type Actor,
  type AuthIR,
  kebab,
  type Move,
  movesFor,
  type PersonIR,
  type SpecIR,
  type StandardActionIR,
} from "@smithable/core";
import { actionNames, askedFields } from "./actions.js";
import { hasSignIn } from "./auth.js";
import { columnOf } from "./migrations.js";
import { dataKey, HEADER, literal, modelNamed, names, ownerKey, type Texts } from "./shared.js";
import { splitList } from "./split.js";

/** A sample user as the development database has them: who signs in nowhere, the door acts as. */
export interface SampleUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * The project's sample users who sign in (a visitor has no user), each with an id and an address
 * made from the name in plain letters: `sample-maja-lindqvist`, `maja-lindqvist@sample.example`.
 */
export function samplePeople(people: readonly PersonIR[] = []): SampleUser[] {
  const taken = new Set<string>();
  return people.flatMap((p) => {
    if (p.role === "visitor") return [];
    const plain = kebab(p.name.normalize("NFKD").replace(/\p{M}/gu, "")) || "person";
    // Two names with one spelling in plain letters (Åsa and Asa) get one each.
    let slug = plain;
    for (let n = 2; taken.has(slug); n++) slug = `${plain}-${n}`;
    taken.add(slug);
    return [{ id: `sample-${slug}`, name: p.name, email: `${slug}@sample.example`, role: p.role }];
  });
}

/**
 * src/generated/people.ts: the sample users, in a development or demo build only (empty in any
 * other): the people the development door acts as, marked on the users page.
 */
export function peopleModule(people: readonly SampleUser[]): string {
  return `${HEADER}// The project's sample users (samples/people.yml), in a development or demo build only: the
// people the development door acts as (docs/design/sample-users.md §4), marked on the users page.
export const SAMPLE_PEOPLE: { id: string; name: string; email: string; role: string }[] =
  import.meta.env.DEV || process.env.DEMO_SIGN_IN === "1"
    ? [
${people.map((u) => `        ${literal(u)},`).join("\n")}
      ]
    : [];
`;
}

/** An arrow function's parameters, each one the body does not use named with an underscore. */
const params = (body: string, ...names: string[]) =>
  names.map((name) => (new RegExp(`\\b${name}\\b`).test(body) ? name : `_${name}`)).join(", ");

/** Every move of every actor once, by id: the same move is the same code whoever makes it. */
function allMoves(byActor: Record<string, Move[]>): Move[] {
  const seen = new Map<string, Move>();
  for (const moves of Object.values(byActor)) for (const m of moves) seen.set(m.id, m);
  return [...seen.values()];
}

/**
 * src/generated/dev-door.server.ts: the moves each role and a visitor may make (core's, written as
 * data: the app depends on no Smithable package), what each is open to now, and each performed as
 * the user's session through the same data and action functions the pages' server functions call.
 */
export function doorModule(
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
  people: readonly SampleUser[],
): string {
  const signedIn = hasSignIn(auth);
  const actors: [string, Actor][] = [
    ...(signedIn ? auth.roles.map((r) => [r.name, { role: r.name }] as [string, Actor]) : []),
    ["visitor", "visitor"],
  ];
  const byActor = Object.fromEntries(
    actors.map(([key, actor]) => [key, movesFor(ir, auth, actor)]),
  );
  const moves = allMoves(byActor);
  const actionOf = (name: string) => ir.actions.find((a) => a.name === name) as ActionIR;
  // The models whose records a move reads or writes, and those its references choose among.
  const models = new Set<string>();
  for (const m of moves) {
    if (m.kind === "add" || m.kind === "change" || m.kind === "delete") models.add(m.model);
    if (m.kind === "run" && m.model) models.add(m.model);
    if (m.kind === "merge") models.add(m.model);
    if (m.kind === "split") {
      models.add(m.model);
      models.add(splitList(ir, actionOf(m.action) as StandardActionIR).child.name);
    }
    if ("slots" in m) for (const s of m.slots) if (s.model) models.add(s.model);
  }
  const used = [...models].map((name) => ({
    model: modelNamed(ir, name),
    n: names(modelNamed(ir, name), t),
  }));
  const n = (model: string) => names(modelNamed(ir, model), t);
  const runs = moves.filter((m): m is Extract<Move, { kind: "run" }> => m.kind === "run");
  // A model's stored keys by field name: a reference is stored as its id (customerId).
  const keysOf = (model: string) =>
    Object.fromEntries(modelNamed(ir, model).fields.map((f) => [f.name, dataKey(f)]));
  const writes = moves.some((m) => m.kind !== "open");

  // What each move is open to now: its records, and each reference's choices.
  const open = moves.map((m) => {
    const refs = "slots" in m ? m.slots.filter((s) => s.model) : [];
    const choices = refs.length
      ? `\n      candidates: await choices(viewer, ${literal(refs.map((s) => [s.field, s.model, s.required]))}),`
      : "";
    const records = (model: string, rule: string, fits?: string) =>
      `\n      records: (await ${n(model).data}.list(viewer)).filter((row) => allows(${rule}, viewer, row.${ownerKey(modelNamed(ir, model))} as string | null)${fits ? ` && ${fits}(row as never, viewer)` : ""}).slice(0, 50).map((row) => row.id),`;
    let body: string;
    if (m.kind === "open")
      return `  ${JSON.stringify(m.id)}: async (viewer, move) => (allows(pageAccess[${JSON.stringify(m.page)}], viewer) ? move : undefined),`;
    // A merge: two records the person may change (the app picks the other when it acts).
    if (m.kind === "merge")
      return `  ${JSON.stringify(m.id)}: async (viewer, move) => {
    const records = (await ${n(m.model).data}.list(viewer)).filter((row) => allows(${n(m.model).access}.write, viewer, row.${ownerKey(modelNamed(ir, m.model))} as string | null)).slice(0, 50).map((row) => row.id);
    return records.length > 1 ? { ...move, records } : undefined;
  },`;
    // A split: a record with two or more in its list (at least one goes, one stays).
    if (m.kind === "split") {
      const { child, backKey } = splitList(ir, actionOf(m.action) as StandardActionIR);
      return `  ${JSON.stringify(m.id)}: async (viewer, move) => {
    if (!allows(${actionNames(actionOf(m.action)).access}, viewer)) return undefined;
    const counts = new Map<number, number>();
    for (const row of await ${n(child.name).data}.list(viewer)) counts.set(row.${backKey} as number, (counts.get(row.${backKey} as number) ?? 0) + 1);
    const records = (await ${n(m.model).data}.list(viewer)).filter((row) => (counts.get(row.id) ?? 0) > 1).slice(0, 50).map((row) => row.id);
    return records.length ? { ...move, records } : undefined;
  },`;
    }
    if (m.kind === "add") body = choices;
    else if (m.kind === "change") body = records(m.model, `${n(m.model).access}.write`) + choices;
    else if (m.kind === "delete") body = records(m.model, `${n(m.model).access}.delete`);
    else {
      const action = actionOf(m.action);
      const a = actionNames(action);
      body =
        action.custom && m.rows && m.model
          ? `\n      records: (await ${n(m.model).data}.list(viewer)).slice(0, 50).map((row) => row.id),${choices}`
          : !action.custom && m.model
            ? records(m.model, a.access, a.fits) + choices
            : choices;
    }
    return `  ${JSON.stringify(m.id)}: async (${params(body, "viewer")}, move) => ready({ ...move,${body}\n    }),`;
  });

  // Each move performed as the viewer.
  const acts = moves.map((m) => {
    const id = JSON.stringify(m.id);
    const arrow = (body: string) =>
      `  ${id}: async (${params(body, "viewer", "move", "body")}) => ${body},`;
    if (m.kind === "open")
      return `  ${id}: async (viewer) => {
    if (!allows(pageAccess[${JSON.stringify(m.page)}], viewer)) throw new AccessDenied(viewer !== null);
    return { route: ${JSON.stringify(m.route)} };
  },`;
    if (m.kind === "add")
      return arrow(
        `${n(m.model).data}.create(viewer, ${n(m.model).schema}.parse(stored(move.slots ?? [], body.values, ${literal(keysOf(m.model))})))`,
      );
    if (m.kind === "change")
      return arrow(
        `${n(m.model).data}.update(viewer, record(body), ${n(m.model).settable}.partial().parse(stored(move.slots ?? [], body.values, ${literal(keysOf(m.model))})))`,
      );
    if (m.kind === "delete") return arrow(`${n(m.model).data}.remove(viewer, record(body))`);
    if (m.kind === "merge") {
      const a = actionNames(actionOf(m.action));
      const model = modelNamed(ir, m.model);
      return `  ${id}: async (viewer, _move, body) => {
    // The other: another record the person may change; the kept one first, as the merge's keep says.
    // The other: another record the person may change; the kept one first, as the person picked.
    const other = (await ${n(m.model).data}.list(viewer)).find((row) => row.id !== kept && allows(${n(m.model).access}.write, viewer, row.${ownerKey(model)} as string | null))?.id;
    if (other === undefined) throw new Conflict(w.mergeSame);
    const [first, second] = [kept, other];
    // Each field the two differ in: the kept one's.
    const facts = await ${a.preview}(viewer, first, second);
    return ${a.run}(viewer, first, second, Object.fromEntries(facts.asked.map((f) => [f.key, "keep" as const])));
  },`;
    }
    if (m.kind === "split") {
      const a = actionNames(actionOf(m.action));
      const { child, backKey } = splitList(ir, actionOf(m.action) as StandardActionIR);
      return `  ${id}: async (viewer, _move, body) => {
    // About half of its list goes to the new record; at least one goes and one stays.
    const on = (await ${n(child.name).data}.list(viewer)).filter((row) => row.${backKey} === record(body)).map((row) => row.id);
    return ${a.run}(viewer, record(body), on.slice(0, Math.max(1, Math.floor(on.length / 2))));
  },`;
    }
    const action = actionOf(m.action);
    const a = actionNames(action);
    if (action.custom)
      return arrow(
        `${a.run}(viewer, ${a.input}.parse({ ...stored(move.slots ?? [], body.values)${action.rows ? `, ${action.rows.field}: body.records ?? []` : ""} }))`,
      );
    const asked = askedFields(action as StandardActionIR).length > 0;
    return arrow(
      `${a.run}(viewer, record(body)${asked ? `, ${a.asks}.parse(stored(move.slots ?? [], body.values, ${literal(keysOf(action.on))}))` : ""})`,
    );
  });
  const code = [...open, ...acts].join("\n");
  const uses = (name: string) => new RegExp(`\\b${name}\\(`).test(code);
  const hasOpen = moves.some((m) => m.kind === "open");
  const anyRefs = code.includes("choices(");

  const actionImports = runs.map((m) => {
    const action = actionOf(m.action);
    const a = actionNames(action);
    const file = `./actions/${kebab(action.name)}`;
    if (action.custom)
      return `import { ${a.run} } from "${file}.server";\nimport { ${a.input} } from "${file}.input";`;
    const fromModule = [
      a.access,
      a.fits,
      ...(askedFields(action as StandardActionIR).length ? [a.asks] : []),
    ];
    return `import { ${a.run} } from "${file}.server";\nimport { ${fromModule.join(", ")} } from "${file}";`;
  });
  const modelImports = used.map(({ model, n: mn }) => {
    const write = moves.some(
      (m) => (m.kind === "add" || m.kind === "change") && m.model === model.name,
    );
    const ruled = moves.some(
      (m) =>
        (m.kind === "change" || m.kind === "delete" || m.kind === "merge") &&
        m.model === model.name,
    );
    return `import { ${ruled ? `${mn.access}, ` : ""}${mn.data} } from "${mn.module}.server";${write ? `\nimport { ${[...(moves.some((m) => m.kind === "add" && m.model === model.name) ? [mn.schema] : []), ...(moves.some((m) => m.kind === "change" && m.model === model.name) ? [mn.settable] : [])].join(", ")} } from "${mn.module}.schema";` : ""}`;
  });

  // A unique value taken, in the words a form says it: each written model's unique fields by the
  // column the database names (a reference is stored in <field>_id); the labels are its UI's.
  const taken = Object.fromEntries(
    used.flatMap(({ model }) => {
      if (!moves.some((m) => (m.kind === "add" || m.kind === "change") && m.model === model.name))
        return [];
      const fields = model.fields.filter((f) => f.unique || f.sequence);
      if (!fields.length) return [];
      return [
        [
          model.name,
          Object.fromEntries(
            fields.map((f) => [
              columnOf(model.name, f.name, f.type.kind === "relation").column,
              dataKey(f),
            ]),
          ),
        ],
      ];
    }),
  );
  const merging = moves.some((m) => m.kind === "merge");
  const words = Object.keys(taken).length > 0 || merging;

  return `${HEADER}// The development door (docs/design/sample-users.md §4): the moves each role and a visitor may
// make, read from the spec by rule, what each is open to now for a sample user, and each performed
// as their session through the same functions the pages' server functions call, so grants,
// validation, Activity and what the app tells hold as for a person at the keyboard.
${people.length ? 'import { eq } from "drizzle-orm";\nimport { db } from "#/db";\nimport { user } from "#/db/schema";\n' : ""}import { ${hasOpen ? "AccessDenied, " : ""}${uses("allows") ? "allows, " : ""}${words ? "Conflict, " : ""}type Viewer } from "#/kit/access";
import { type DoorMove, type OpenMove${uses("stored") ? ", stored" : ""} } from "#/kit/dev-door.server";
import { BadInput, NotFound } from "#/kit/refusal";
${writes ? 'import { writeAllowed } from "#/kit/limit";\n' : ""}${words ? 'import { w } from "#/kit/words";\n' : ""}import { pageAccess } from "./pages";
${people.length ? 'import { SAMPLE_PEOPLE } from "./people";\n' : ""}${modelImports.join("\n")}
${Object.keys(taken)
  .map((model) => {
    const mn = names(modelNamed(ir, model), t);
    return `import { ${mn.ui} } from "${mn.module}";\n`;
  })
  .join("")}${actionImports.join("\n")}${moves
  .flatMap((m) => {
    if (m.kind !== "merge" && m.kind !== "split") return [];
    const a = actionNames(actionOf(m.action));
    const file = `./actions/${kebab(m.action)}`;
    return m.kind === "merge"
      ? [`\nimport { ${a.preview}, ${a.run} } from "${file}.server";`]
      : [`\nimport { ${a.run} } from "${file}.server";\nimport { ${a.access} } from "${file}";`];
  })
  .join("")}

/** The moves of each role, and of a visitor without a session. */
const MOVES: Record<string, DoorMove[]> = ${literal(byActor)};
${
  words
    ? `
/** Each written model's unique fields by column, and its UI: a value taken, in words. */
const TAKEN: Record<string, { ui: { label: string; fields: { name: string; label: string }[] }; fields: Record<string, string> }> = {
${Object.entries(taken)
  .map(
    ([model, fields]) =>
      `  ${JSON.stringify(model)}: { ui: ${names(modelNamed(ir, model), t).ui}, fields: ${literal(fields)} },`,
  )
  .join("\n")}
};
`
    : ""
}

/** The viewer a door call acts as: a sample user by id, or a visitor (null); anyone else, none. */
export function viewerFor(who: unknown): Viewer | null | undefined {
  if (who === "visitor") return null;${
    people.length
      ? `
  const person = SAMPLE_PEOPLE.find((p) => p.id === who);
  if (!person) return undefined;
  // The role as the database has it: a change on the users page counts.
  const viewer = () => db.select({ id: user.id, name: user.name, email: user.email, role: user.role }).from(user).where(eq(user.id, person.id)).get();
  const found = viewer();
  if (found) return found;
  // One added since the seed (Smith's "add three customers") becomes a user the first time.
  db.insert(user).values({ ...person, emailVerified: true }).onConflictDoNothing().run();
  return viewer();`
      : `
  return undefined;`
  }
}

${
  anyRefs
    ? `/** The ids of each reference's records the viewer may choose, at most fifty. */
async function choices(viewer: Viewer | null, refs: [string, string, boolean][]): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  for (const [field, model] of refs) out[field] = (await (CHOOSE[model]?.(viewer) ?? Promise.resolve([]))).slice(0, 50);
  return out;
}

const CHOOSE: Record<string, (viewer: Viewer | null) => Promise<number[]>> = {
${used.map(({ model, n: mn }) => `  ${JSON.stringify(model.name)}: async (viewer) => (await ${mn.data}.list(viewer)).map((row) => row.id),`).join("\n")}
};

`
    : ""
}${
  uses("ready")
    ? `/** A move is open when it has a record to be made on, if it needs one, and a choice for each required reference. */
function ready(move: OpenMove): OpenMove | undefined {
  if (move.records && !move.records.length) return undefined;
  for (const slot of move.slots ?? [])
    if (slot.model && slot.required && !move.candidates?.[slot.field]?.length) return undefined;
  return move;
}
`
    : ""
}
const OPEN: Record<string, (viewer: Viewer | null, move: DoorMove) => Promise<OpenMove | undefined>> = {
${open.join("\n")}
};

/** The moves open to the viewer now, each with its records and choices. */
export async function doorMoves(viewer: Viewer | null): Promise<OpenMove[]> {
  const open: OpenMove[] = [];
  for (const move of MOVES[viewer?.role ?? "visitor"] ?? []) {
    const made = await OPEN[move.id]?.(viewer, move);
    if (made) open.push(made);
  }
  return open;
}

/** What a move is given: its slots' values, and the record (or, for rows, the records) it is made on. */
export interface DoorBody {
  move: string;
  values: Record<string, unknown>;
  record?: number;
  records?: number[];
}

${
  uses("record")
    ? `const record = (body: DoorBody): number => {
  if (typeof body.record !== "number") throw new BadInput("This move needs a record.");
  return body.record;
};
`
    : ""
}
const ACTS: Record<string, (viewer: Viewer | null, move: DoorMove, body: DoorBody) => Promise<unknown>> = {
${acts.join("\n")}
};

/** Performs one move as the viewer: a refusal is thrown as the app gives it. */
export async function doorAct(viewer: Viewer | null, body: DoorBody, ${writes ? "headers" : "_headers"}: Headers): Promise<unknown> {
  const { values, record, records } = body ?? {};
  if (
    (values !== undefined && (typeof values !== "object" || values === null || Array.isArray(values))) ||
    (record !== undefined && typeof record !== "number") ||
    (records !== undefined && !(Array.isArray(records) && records.every((id) => typeof id === "number")))
  )
    throw new BadInput("A move is { user, move, values, and its record or records }.");
  const move = (MOVES[viewer?.role ?? "visitor"] ?? []).find((m) => m.id === body.move);
  const act = move && ACTS[move.id];
  if (!move || !act) throw new NotFound(\`No move "\${String(body.move)}" for this user.\`);
${writes ? '  if (move.kind !== "open") writeAllowed(viewer, headers);\n' : ""}${
  words
    ? `  try {
    return await act(viewer, move, { ...body, values: body.values ?? {} });
  } catch (error) {
    // A unique value taken, as the form says it ("Another booking already has this session.").
    const column = error instanceof Conflict ? /^taken:(\\w+)$/.exec(error.message)?.[1] : undefined;
    const taken = move.model ? TAKEN[move.model] : undefined;
    const name = column && taken?.fields[column];
    const field = name ? taken?.ui.fields.find((f) => f.name === name) : undefined;
    throw field && taken ? new Conflict(w.alreadyHas(taken.ui.label, field.label)) : error;
  }`
    : "  return act(viewer, move, { ...body, values: body.values ?? {} });"
}
}
`;
}

/** The door's routes, at /_dev/… (a bracketed segment is a literal one, not a layout). */
export function doorRoutes(
  ir: SpecIR,
  auth: AuthIR,
  people: readonly SampleUser[] = [],
): Record<string, string> {
  const refusedUser =
    'Response.json({ refused: true, status: 403, message: "Not a sample user of this app." }, { status: 403 })';
  const files: Record<string, string> = {
    "src/routes/[_dev]/moves.ts": `${HEADER}// The development door (docs/design/sample-users.md §4): the moves open to a sample user now.
import { createFileRoute } from "@tanstack/react-router";
import { doorMoves, viewerFor } from "#/generated/dev-door.server";
import { doorShut } from "#/kit/dev-door.server";
import { now } from "#/kit/now";

export const Route = createFileRoute("/_dev/moves")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const shut = doorShut(request);
        if (shut) return shut;
        const user = new URL(request.url).searchParams.get("user");
        const viewer = viewerFor(user);
        if (viewer === undefined) return ${refusedUser};
        return Response.json({ now: now().toISOString(), user, moves: await doorMoves(viewer) });
      },
    },
  },
});
`,
    "src/routes/[_dev]/act.ts": `${HEADER}// The development door (docs/design/sample-users.md §4): one move, performed as a sample user's session.
import { createFileRoute } from "@tanstack/react-router";
import { type DoorBody, doorAct, viewerFor } from "#/generated/dev-door.server";
import { doorShut, refused } from "#/kit/dev-door.server";

export const Route = createFileRoute("/_dev/act")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const shut = doorShut(request);
        if (shut) return shut;
        const body = (await request.json().catch(() => ({}))) as DoorBody & { user?: unknown };
        const viewer = viewerFor(body.user);
        if (viewer === undefined) return ${refusedUser};
        try {
          return Response.json({ ok: true, result: (await doorAct(viewer, body, request.headers)) ?? null });
        } catch (error) {
          return refused(error);
        }
      },
    },
  },
});
`,
    "src/routes/[_dev]/clock.ts": `${HEADER}// The development door (docs/design/sample-users.md §3–§4): the development build's clock, moved
// so "a week later" is a call; a demo has no such call.
import { createFileRoute } from "@tanstack/react-router";
import { doorShut } from "#/kit/dev-door.server";
import { now, setClockOffset } from "#/kit/now";${ir.timers.length ? '\nimport { tick } from "#/generated/timers.server";' : ""}

/** At most a year either way. */
const MOST = 366 * 86_400_000;

export const Route = createFileRoute("/_dev/clock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const shut = doorShut(request, true);
        if (shut) return shut;
        const { offset } = (await request.json().catch(() => ({}))) as { offset?: unknown };
        if (typeof offset !== "number" || !Number.isFinite(offset) || Math.abs(offset) > MOST)
          return Response.json({ refused: true, status: 400, message: "offset: milliseconds from now, within a year." }, { status: 400 });
        setClockOffset(offset);${
          ir.timers.length
            ? `
        // A development build has no tick of its own: what came due by the new "now" runs here.
        await tick(now());`
            : ""
        }
        return Response.json({ now: now().toISOString() });
      },
    },
  },
});
`,
  };
  if (auth.assistant)
    files["src/routes/[_dev]/ask.ts"] =
      `${HEADER}// The development door (docs/design/ask-words.md §3.2): Ask, answered as a sample user's session,
// or as a role no sample user has, by a session made for the call and written nowhere.
import { createFileRoute } from "@tanstack/react-router";
import { ask } from "#/generated/ask.server";
import { viewerFor } from "#/generated/dev-door.server";
import type { Viewer } from "#/kit/access";
import { doorShut, refused } from "#/kit/dev-door.server";

/** The roles no sample user has: Ask answers as one of those by a session made for the call. */
const ROLES: string[] = ${literal(hasSignIn(auth) ? auth.roles.map((r) => r.name).filter((r) => !people.some((p) => p.role === r)) : [])};

export const Route = createFileRoute("/_dev/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const shut = doorShut(request);
        if (shut) return shut;
        const { user, question } = (await request.json().catch(() => ({}))) as { user?: unknown; question?: unknown };
        const role = typeof user === "string" && user.startsWith("role:") ? user.slice(5) : undefined;
        const viewer: Viewer | null | undefined =
          role && ROLES.includes(role)
            ? { id: \`dev-door-\${role}\`, name: \`Sample \${role}\`, email: \`\${role}@sample.example\`, role }
            : viewerFor(user);
        if (viewer === undefined) return ${refusedUser};
        if (typeof question !== "string" || !question.trim())
          return Response.json({ refused: true, status: 400, message: "question: the words to ask." }, { status: 400 });
        try {
          return Response.json(await ask(viewer, question));
        } catch (error) {
          return refused(error);
        }
      },
    },
  },
});
`;
  return files;
}

// Builder's Who can tab (docs/design/who-can.md): sign-in, the record rule, a grid of what each
// role and anyone may do, and the roles. Each control applies one operation at once (grant,
// setPublic, setRoles, …), undoable like any change; the summary stays the map, this the controls.
import {
  ASSISTANT_TEXTS,
  type AssistantTexts,
  type AuthIR,
  type GrantKey,
  humanize,
  PROVIDERS,
  plural,
  type RoleGrants,
  type SpecIR,
  type Voice,
  validateAuth,
} from "@smithable/core";
import { useEffect, useRef, useState } from "react";
import type { Spec } from "../engine";
import { Button, cx, Input, Select } from "../ui";
import type { Run } from "./ChangeForms";
import { WhyAccess } from "./WhyAccess";
import {
  adminPage,
  cellSentence,
  type GridWarning,
  grantChoices,
  granted,
  gridWarnings,
  headerState,
  roleSentence,
  ticked,
  visitorSentence,
  warningText,
} from "./who-can";

const GRID_CODES = [
  "write-without-read",
  "role-opens-nothing",
  "public-personal-data",
  "public-page-closed-records",
];

const PROVIDER_NAMES: Record<(typeof PROVIDERS)[number], string> = {
  email: "A code by email",
  google: "Google",
  facebook: "Facebook",
};

export function WhoCan({
  spec,
  run,
  authText,
  marked,
}: {
  spec: Spec;
  run: Run;
  /** smithable.auth.yml as written, for the validator's other diagnostics under the grid. */
  authText?: string;
  /** A column to mark for a moment: a role's name, or "anyone" (a click in the summary). */
  marked?: string;
}) {
  const { ir, auth } = spec;
  const [advanced, setAdvanced] = useAdvanced();
  if (!ir || !auth)
    return (
      <p className="p-3 text-sm text-quiet">
        {ir ? "This app has no smithable.auth.yml." : "The spec has errors; fix them in Code mode."}
      </p>
    );
  const others = authText
    ? validateAuth({ path: "smithable.auth.yml", text: authText }, ir).diagnostics.filter(
        (d) => !GRID_CODES.includes(d.code),
      )
    : [];
  // Simple first: sign-in, a sentence for each role and for visitors, the roles and Ask; every
  // grant per kind of record, page and action is Advanced, closed until asked for (A 166). Both
  // write the same file.
  const notes = others.length + gridWarnings(ir, auth).length;
  const open = advanced || marked !== undefined;
  return (
    <div className="space-y-6 p-3 text-sm">
      <SignIn auth={auth} run={run} />
      <Block title="What each can do">
        <ul aria-label="What each can do" className="space-y-1.5">
          <li>
            <span className="font-medium">Visitors</span>: {visitorSentence(auth)}
          </li>
          {auth.signIn !== "none" &&
            auth.roles.map((r) => (
              <li key={r.name}>
                <span className="font-medium">{humanize(plural(r.name))}</span>:{" "}
                {roleSentence(ir, r.grants)}
              </li>
            ))}
        </ul>
        <p className="text-xs text-muted">
          To change one, tick it in Advanced, or ask Smith ("sales may delete orders").
        </p>
      </Block>
      {auth.signIn !== "none" && <Roles auth={auth} run={run} />}
      <Assistant
        auth={auth}
        run={run}
        texts={spec.content?.assistant}
        voice={spec.ux?.assistant.voice}
      />
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => setAdvanced(!open)}
        className="px-0 text-accent"
      >
        {open ? "Hide advanced" : "Advanced: every grant per kind of record, page and action"}
        {!open && notes > 0 && ` (${notes} ${notes === 1 ? "note" : "notes"})`}
      </Button>
      {open && (
        <>
          {auth.signIn !== "none" && <Records auth={auth} run={run} />}
          <Grid ir={ir} auth={auth} run={run} marked={marked} />
          <WhyAccess ir={ir} auth={auth} />
          {others.length > 0 && (
            <ul aria-label="Other notes on who can" className="space-y-1 text-xs text-muted">
              {others.map((d) => (
                <li key={`${d.code}:${d.message}`}>{d.message}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const ADVANCED = "smithable:who-can-advanced";

/** Whether Advanced is open, kept in this browser. */
function useAdvanced(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(ADVANCED) === "1";
    } catch {
      return false;
    }
  });
  return [
    open,
    (next) => {
      setOpen(next);
      try {
        localStorage.setItem(ADVANCED, next ? "1" : "0");
      } catch {}
    },
  ];
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-quiet">{title}</h3>
      {children}
    </section>
  );
}

function SignIn({ auth, run }: { auth: AuthIR; run: Run }) {
  const signIn = auth.signIn;
  const [domains, setDomains] = useState(
    signIn === "none" ? "" : (signIn.allowedDomains ?? []).join(", "),
  );
  if (signIn === "none")
    return (
      <Block title="Sign-in">
        <p className="text-muted">
          This app has no sign-in: only what anyone may do, in the last column, applies.
        </p>
      </Block>
    );
  const written = (signIn.allowedDomains ?? []).join(", ");
  const saveDomains = () => {
    const list = domains.split(/[\s,]+/).filter(Boolean);
    if (list.join(", ") !== written)
      void run("setDomains", { domains: list.length ? list : ["none"] });
  };
  return (
    <Block title="Sign-in">
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 text-xs font-medium text-muted">People sign in with</legend>
        {PROVIDERS.map((p) => {
          const on = signIn.providers.includes(p);
          return (
            <label key={p} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={on}
                disabled={on && signIn.providers.length === 1}
                onChange={() =>
                  void run("setProviders", {
                    providers: on
                      ? signIn.providers.filter((x) => x !== p)
                      : [...signIn.providers, p],
                  })
                }
              />
              {PROVIDER_NAMES[p]}
            </label>
          );
        })}
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <span>Who may sign up</span>
        <Select
          aria-label="Who may sign up"
          value={signIn.selfSignUp ? "anyone" : "invited"}
          onChange={(e) => void run("setSignUp", { who: e.target.value })}
          options={[
            ["anyone", "Anyone"],
            ["invited", "Only people who are invited"],
          ]}
          className="w-56"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span>Only these email domains</span>
        <Input
          aria-label="Only these email domains"
          value={domains}
          placeholder="Any domain"
          onChange={(e) => setDomains(e.target.value)}
          onBlur={saveDomains}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveDomains();
          }}
          className="w-56"
        />
      </div>
      {auth.defaultAccess === "shared" && signIn.selfSignUp && !signIn.allowedDomains && (
        <p role="note" className="text-xs text-warning">
          Anyone with an account can sign up and see all records: choose who may sign up, the email
          domains, or that everyone sees only their own records.
        </p>
      )}
    </Block>
  );
}

const RULES: [AuthIR["defaultAccess"], string][] = [
  ["shared", "Everyone who signs in sees all records, and changes and deletes the ones they own"],
  ["private", "Everyone sees, changes and deletes only their own records"],
];

function Records({ auth, run }: { auth: AuthIR; run: Run }) {
  return (
    <Block title="Records">
      <fieldset className="space-y-1">
        <legend className="sr-only">The record rule</legend>
        {RULES.map(([value, text]) => (
          <label key={value} className="flex items-start gap-2">
            <input
              type="radio"
              name="record-rule"
              checked={auth.defaultAccess === value}
              onChange={() => void run("setDefaultAccess", { access: value })}
              className="mt-1"
            />
            {text}
          </label>
        ))}
      </fieldset>
    </Block>
  );
}

/** A model's record kinds, as the grid's columns name them for a role and for anyone. */
const ROLE_KINDS: [GrantKey, string][] = [
  ["read", "See"],
  ["create", "Add"],
  ["write", "Change"],
  ["delete", "Delete"],
];

function Grid({ ir, auth, run, marked }: { ir: SpecIR; auth: AuthIR; run: Run; marked?: string }) {
  const roles = auth.signIn === "none" ? [] : auth.roles.filter((r) => r.name !== "admin");
  const warnings = gridWarnings(ir, auth);
  const shared = auth.defaultAccess === "shared";
  const actions = grantChoices(ir, "actions");
  const reviewed = grantChoices(ir, "review");
  // A column a sentence of the summary pointed at, marked for a moment.
  const [mark, setMark] = useState(marked);
  useEffect(() => {
    setMark(marked);
    const t = setTimeout(() => setMark(undefined), 2500);
    return () => clearTimeout(t);
  }, [marked]);
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (marked)
      tableRef.current
        ?.querySelector(`[data-column="${marked}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [marked]);

  const grant = (role: string, key: GrantKey, names: string[]) =>
    void run("grant", { role, what: key, names });
  const setPublic = (key: "pages" | "read" | "create", list: string[]) =>
    void run("setPublic", { [key]: list });
  const markOf = (w: (x: GridWarning) => boolean) => warnings.find(w);

  /** One role's tick box for a name of a grant. */
  const roleBox = ({
    role,
    grants,
    k,
    name,
    label,
  }: {
    role: string;
    grants: "all" | RoleGrants;
    k: GrantKey;
    name: string;
    label?: string;
  }) => {
    const on = granted(ir, grants, k, name);
    const fixed = grants === "all" || (k === "read" && shared);
    const warning =
      (k === "write" || k === "delete") &&
      markOf(
        (w) =>
          w.kind === "write-without-read" && w.role === role && w.key === k && w.model === name,
      );
    return (
      <label
        className={cx("inline-flex items-center gap-1", fixed && "opacity-50")}
        title={
          k === "read" && shared
            ? "Everyone who signs in sees all records"
            : cellSentence(role, k, name, on)
        }
      >
        <input
          type="checkbox"
          aria-label={cellSentence(role, k, name, true)}
          checked={on || (k === "read" && shared)}
          disabled={fixed}
          onChange={() =>
            grant(role, k, ticked(ir, grants === "all" ? "all" : grants[k], k, name, !on))
          }
        />
        {label && <span className="text-xs">{label}</span>}
        {warning && (
          <span role="note" className="text-xs text-warning" title={warningText(warning)}>
            ⚠<span className="sr-only">{warningText(warning)}</span>
          </span>
        )}
      </label>
    );
  };

  /** A group's "all" box for a role: all (also ones added later), every one today (a dash), some. */
  const allBox = ({
    role,
    grants,
    k,
    words,
  }: {
    role: string;
    grants: "all" | RoleGrants;
    k: GrantKey;
    words: string;
  }) => {
    const state = grants === "all" ? "all" : headerState(ir, grants[k], k);
    return (
      <input
        type="checkbox"
        aria-label={`${role}: ${words}`}
        title={state === "every" ? "Every one today, not ones added later" : words}
        checked={state === "all"}
        ref={(el) => {
          if (el) el.indeterminate = state === "every";
        }}
        disabled={grants === "all"}
        onChange={() => grant(role, k, state === "all" ? ["none"] : ["all"])}
      />
    );
  };

  const column = (name: string) =>
    cx("px-2 py-1 text-left align-top", mark === name && "bg-accent/10 transition-colors");
  const group = (title: string, note?: string) => (
    <tr>
      <th
        colSpan={roles.length + 3}
        className="bg-subtle px-2 py-1 text-left text-xs font-semibold"
      >
        {title}
        {note && <span className="ml-2 font-normal text-muted">{note}</span>}
      </th>
    </tr>
  );
  const headerRow = (k: GrantKey, words: string) => (
    <tr>
      <td className="sticky left-0 bg-panel px-2 py-1 text-xs text-muted">{words}</td>
      {roles.map((r) => (
        <td key={r.name} className={column(r.name)}>
          {allBox({ role: r.name, grants: r.grants, k: k, words: words })}
        </td>
      ))}
      <td className="px-2 py-1" />
      <td className="px-2 py-1" />
    </tr>
  );
  const admins = (
    <td className="px-2 py-1 opacity-50">
      <input type="checkbox" checked disabled aria-label="Admins may do everything" />
    </td>
  );

  return (
    <Block title="Who can">
      <div className="overflow-x-auto">
        <table ref={tableRef} className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-panel px-2 py-1" />
              {roles.map((r) => {
                const empty = markOf((w) => w.kind === "role-opens-nothing" && w.role === r.name);
                return (
                  <th key={r.name} data-column={r.name} className={column(r.name)}>
                    {humanize(r.name)}
                    {empty && (
                      <p role="note" className="max-w-40 text-xs font-normal text-warning">
                        {warningText(empty)}
                      </p>
                    )}
                  </th>
                );
              })}
              <th className="px-2 py-1 text-left">Admins</th>
              <th data-column="anyone" className={column("anyone")}>
                Anyone
                <p className="text-xs font-normal text-muted">without signing in</p>
              </th>
            </tr>
          </thead>
          <tbody>
            {group("Pages")}
            {roles.length > 0 && headerRow("pages", "Every page (also pages added later)")}
            {ir.pages.map((page) => {
              const open = auth.public.pages.includes(page.id);
              const closed = markOf(
                (w) => w.kind === "public-page-closed-records" && w.page === page.id,
              );
              return (
                <tr key={page.id} className="border-t border-line">
                  <th className="sticky left-0 bg-panel px-2 py-1 text-left font-normal">
                    {humanize(page.id)}
                    {adminPage(page) && (
                      <span className="block text-xs text-muted">administrators' page</span>
                    )}
                  </th>
                  {roles.map((r) => (
                    <td key={r.name} className={column(r.name)}>
                      {roleBox({ role: r.name, grants: r.grants, k: "pages", name: page.id })}
                    </td>
                  ))}
                  {admins}
                  <td className={column("anyone")}>
                    <label
                      className="inline-flex items-center gap-1"
                      title={cellSentence("Anyone", "pages", page.id, open)}
                    >
                      <input
                        type="checkbox"
                        aria-label={cellSentence("Anyone", "pages", page.id, true)}
                        checked={open}
                        onChange={() =>
                          setPublic(
                            "pages",
                            ir.pages
                              .map((p) => p.id)
                              .filter((id) =>
                                id === page.id ? !open : auth.public.pages.includes(id),
                              ),
                          )
                        }
                      />
                      {closed && (
                        <span
                          role="note"
                          className="text-xs text-warning"
                          title={warningText(closed)}
                        >
                          ⚠<span className="sr-only">{warningText(closed)}</span>
                        </span>
                      )}
                    </label>
                  </td>
                </tr>
              );
            })}
            {group("Records")}
            {roles.length > 0 &&
              ROLE_KINDS.filter(([k]) => k !== "read" || !shared).map(([k, label]) =>
                headerRow(k, `${label}: every kind of record (also kinds added later)`),
              )}
            {roles.length > 0 && (
              <tr className="border-t border-line text-muted">
                <th className="sticky left-0 bg-panel px-2 py-1 text-left font-normal">
                  Their own records
                  <span className="block text-xs">
                    {RULES.find(([v]) => v === auth.defaultAccess)?.[1]}
                  </span>
                </th>
                {roles.map((r) => (
                  <td key={r.name} className={cx(column(r.name), "text-xs")}>
                    See, change, delete
                  </td>
                ))}
                <td className="px-2 py-1 text-xs">Everything</td>
                <td className="px-2 py-1" />
              </tr>
            )}
            {ir.models.map((model) => {
              const name = model.name;
              const reads = auth.public.read.includes(name);
              const adds = auth.public.create.includes(name);
              const where = auth.public.readWhere[name];
              const personal = markOf((w) => w.kind === "public-personal-data" && w.model === name);
              const anyone = (k: "read" | "create", on: boolean) =>
                setPublic(
                  k,
                  ir.models
                    .map((m) => m.name)
                    .filter((m) => (m === name ? !on : auth.public[k].includes(m))),
                );
              return (
                <tr key={name} className="border-t border-line">
                  <th className="sticky left-0 bg-panel px-2 py-1 text-left font-normal">
                    {humanize(plural(name))}
                  </th>
                  {roles.map((r) => (
                    <td key={r.name} className={column(r.name)}>
                      <span className="flex flex-wrap gap-x-2">
                        {ROLE_KINDS.map(([k, label]) => (
                          <span key={k}>
                            {roleBox({
                              role: r.name,
                              grants: r.grants,
                              k,
                              name: name,
                              label: label,
                            })}
                          </span>
                        ))}
                      </span>
                    </td>
                  ))}
                  {admins}
                  <td className={column("anyone")}>
                    <span className="flex flex-wrap gap-x-2">
                      <label
                        className="inline-flex items-center gap-1"
                        title={cellSentence("Anyone", "read", name, reads)}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Anyone may read ${humanize(plural(name)).toLowerCase()}`}
                          checked={reads}
                          onChange={() => anyone("read", reads)}
                        />
                        <span className="text-xs">Read</span>
                        {personal && (
                          <span
                            role="note"
                            className="text-xs text-warning"
                            title={warningText(personal)}
                          >
                            ⚠<span className="sr-only">{warningText(personal)}</span>
                          </span>
                        )}
                      </label>
                      <label
                        className="inline-flex items-center gap-1"
                        title={cellSentence("Anyone", "create", name, adds)}
                      >
                        <input
                          type="checkbox"
                          aria-label={cellSentence("Anyone", "create", name, true)}
                          checked={adds}
                          onChange={() => anyone("create", adds)}
                        />
                        <span className="text-xs">Add</span>
                      </label>
                    </span>
                    {reads && where && (
                      <span className="block text-xs text-muted">
                        only where{" "}
                        {Object.entries(where)
                          .map(
                            ([f, v]) =>
                              `${humanize(f).toLowerCase()} is ${[v].flat().join(" or ")}`,
                          )
                          .join(" and ")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {actions.length > 0 && (
              <>
                {group(
                  "Custom actions",
                  "Standard actions (edit, archive…) follow Change on their records.",
                )}
                {roles.length > 0 && headerRow("actions", "Every action")}
                {actions.map((name) => (
                  <tr key={name} className="border-t border-line">
                    <th className="sticky left-0 bg-panel px-2 py-1 text-left font-normal">
                      {humanize(name)}
                    </th>
                    {roles.map((r) => (
                      <td key={r.name} className={column(r.name)}>
                        {roleBox({ role: r.name, grants: r.grants, k: "actions", name: name })}
                      </td>
                    ))}
                    {admins}
                    <td className="px-2 py-1" />
                  </tr>
                ))}
              </>
            )}
            {reviewed.length > 0 && roles.length > 0 && (
              <>
                {group("Files to approve")}
                {reviewed.map((name) => (
                  <tr key={name} className="border-t border-line">
                    <th className="sticky left-0 bg-panel px-2 py-1 text-left font-normal">
                      {humanize(plural(name))}
                    </th>
                    {roles.map((r) => (
                      <td key={r.name} className={column(r.name)}>
                        {roleBox({ role: r.name, grants: r.grants, k: "review", name: name })}
                      </td>
                    ))}
                    {admins}
                    <td className="px-2 py-1" />
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

function Roles({ auth, run }: { auth: AuthIR; run: Run }) {
  const roles = auth.roles.filter((r) => r.name !== "admin");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // setRoles takes every role with its description; "" keeps the one written.
  const all = (extra: Record<string, string> = {}, without?: string) =>
    Object.fromEntries([
      ...roles.filter((r) => r.name !== without).map((r): [string, string] => [r.name, ""]),
      ...Object.entries(extra),
    ]);
  const keep = (list: Record<string, string>) =>
    list[auth.defaultRole] !== undefined ? auth.defaultRole : Object.keys(list)[0];
  return (
    <Block title="Roles">
      <ul className="space-y-2">
        {roles.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-medium">{humanize(r.name)}</span>
            <Input
              aria-label={`Description of ${r.name}`}
              defaultValue={r.description ?? ""}
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (text && text !== (r.description ?? ""))
                  void run("setRoles", {
                    roles: all({ [r.name]: text }),
                    defaultRole: auth.defaultRole,
                  });
              }}
              className="flex-1"
            />
            <Button
              variant="ghost"
              onClick={() => {
                const rest = all({}, r.name);
                if (!Object.keys(rest).length) return;
                if (
                  confirm(
                    `Remove the ${r.name} role? It loses what it may do here. People who have it keep signing in; change their role on the users page.`,
                  )
                )
                  void run("setRoles", { roles: rest, defaultRole: keep(rest) });
              }}
              disabled={roles.length === 1}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const role = name.trim();
          const list = all({ [role]: description.trim() });
          if (await run("setRoles", { roles: list, defaultRole: keep(list) })) {
            setName("");
            setDescription("");
          }
        }}
      >
        <Input
          aria-label="New role's name"
          placeholder="teacher"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-32"
        />
        <Input
          aria-label="New role's description"
          placeholder="What they do"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={!name.trim()}>
          Add a role
        </Button>
      </form>
      {roles.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span>New users get</span>
          <Select
            aria-label="New users get"
            value={auth.defaultRole}
            onChange={(e) => void run("setRoles", { roles: all(), defaultRole: e.target.value })}
            options={roles.map((r): [string, string] => [r.name, humanize(r.name)])}
            className="w-44"
          />
        </div>
      )}
      <p className="text-xs text-muted">
        Keys for other programs are not people: set what they reach in Code mode, in
        smithable.auth.yml (api).
      </p>
    </Block>
  );
}

/**
 * "Ask", the assistant in the app (docs/design/assistant.md §6): who gets it and whether it may
 * change things, written with setAssistant; off unless chosen.
 */
function Assistant({
  auth,
  run,
  texts = {},
  voice = "plain",
}: {
  auth: AuthIR;
  run: Run;
  /** Its texts (smithable.content.yml) and its voice (smithable.ux.yml). */
  texts?: AssistantTexts;
  voice?: Voice;
}) {
  const now = auth.assistant;
  const who = !now ? "off" : Array.isArray(now.for) ? "roles" : now.for;
  const roles = auth.roles.map((r) => r.name);
  const chosen = Array.isArray(now?.for) ? now.for : [];
  const set = (to: string[], may: string = now?.may ?? "read") =>
    void run("setAssistant", to.length ? { for: to, may } : { for: [] });
  return (
    <Block title="Ask, the assistant in the app">
      <div className="flex items-center justify-between gap-3">
        <span>Who gets it</span>
        <Select
          aria-label="Who gets Ask"
          value={who}
          onChange={(e) => {
            const v = e.target.value;
            set(v === "off" ? [] : v === "roles" ? [roles[0] ?? "admin"] : [v]);
          }}
          options={[
            ["off", "Nobody"],
            ...(auth.signIn !== "none"
              ? ([
                  ["roles", "These roles"],
                  ["signed-in", "Everyone who signs in"],
                ] as [string, string][])
              : []),
            ["anyone", "Anyone, visitors too"],
          ]}
          className="w-56"
        />
      </div>
      {who === "roles" && (
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">The roles that get Ask</legend>
          {roles.map((r) => {
            const on = chosen.includes(r);
            return (
              <label key={r} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={on && chosen.length === 1}
                  onChange={() => set(on ? chosen.filter((x) => x !== r) : [...chosen, r])}
                />
                {humanize(r)}
              </label>
            );
          })}
        </fieldset>
      )}
      {now && (
        <div className="flex items-center justify-between gap-3">
          <span>It may</span>
          <Select
            aria-label="What Ask may do"
            value={now.may}
            onChange={(e) => set(Array.isArray(now.for) ? now.for : [now.for], e.target.value)}
            options={[
              ["read", "Find and count"],
              ["change", "Also add, change and run actions, each confirmed"],
            ]}
            className="w-56"
          />
        </div>
      )}
      {now && (
        <>
          {ASSISTANT_TEXTS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span>{TEXT_LABELS[key]}</span>
              <Input
                aria-label={`Ask's ${key}`}
                defaultValue={texts[key] ?? ""}
                placeholder={TEXT_HINTS[key]}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (text !== (texts[key] ?? "")) void run("setAssistantTexts", { [key]: text });
                }}
                className="w-56"
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <span>Its voice</span>
            <Select
              aria-label="Ask's voice"
              value={voice}
              onChange={(e) => void run("setAssistantVoice", { voice: e.target.value })}
              options={[
                ["plain", "Plain: short, no pleasantries"],
                ["friendly", "Friendly"],
                ["formal", "Formal"],
              ]}
              className="w-56"
            />
          </div>
        </>
      )}
      <p className="text-xs text-muted">
        {who === "anyone"
          ? "Visitors are answered by the wording rules only, never by a model. "
          : ""}
        On the hosted service a question uses the owner's allowance, about €0.001 on the current
        model; a self-hosted app sets ASSISTANT_URL, ASSISTANT_KEY and ASSISTANT_MODEL.
      </p>
    </Block>
  );
}

const TEXT_LABELS: Record<(typeof ASSISTANT_TEXTS)[number], string> = {
  name: "Its name",
  greeting: "Its first line",
  placeholder: "In the question box",
  about: "What it is for",
};
const TEXT_HINTS: Record<(typeof ASSISTANT_TEXTS)[number], string> = {
  name: "Ask",
  greeting: "Ask me about your orders.",
  placeholder: "How many orders are open?",
  about: "Finds and counts orders.",
};

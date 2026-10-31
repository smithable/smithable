// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).

import {
  type AuthIR,
  camel,
  type FieldIR,
  fieldsUsed,
  humanize,
  inlineFields,
  kebab,
  type ModelIR,
  type OnboardingStep,
  type PageIR,
  pageModel,
  pascal,
  recordSummary,
  type SpecIR,
  type StandardActionIR,
  threadBindings,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { actionNames, askedFields, askOptions } from "../actions.js";
import { hasSignIn } from "../auth.js";
import { cancelNames, reserveElement, savedToggle, trashNames } from "../data.js";
import { hasKeys } from "../keys.js";
import { nameFunction } from "../names.js";
import {
  addable,
  appStart,
  attr,
  composedName,
  dataKey,
  dataRoute,
  fieldOrder,
  guard,
  HEADER,
  hasChoices,
  hasFavorites,
  importList,
  indexPath,
  inlineLists,
  join,
  keyOf,
  lists,
  literal,
  longTitle,
  mergeActions,
  modelNamed,
  names,
  optionsFor,
  ownerKey,
  parentRefs,
  references,
  splitActions,
  standardActions,
  type Texts,
  threadLists,
  titleField,
  trashedLists,
  type Within,
} from "../shared.js";
import { splitList } from "../split.js";
import { calendarStart } from "./calendar.js";

/**
 * A settings page edits the viewer's one record of a model (their own when the model's
 * records are private, the app's when shared); an onboarding fills it in steps and hands
 * over to the app once it exists.
 */
export function recordPageRoute(
  page: PageIR,
  pattern: { kind: "settings" | "onboarding"; model: string; steps?: OnboardingStep[] },
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
): string {
  const model = modelNamed(ir, pattern.model);
  const n = names(model, t);
  const component = `${pascal(page.id)}Page`;
  const fn = `get${pascal(page.id)}`;
  const options = hasChoices(model) ? optionsFor(model, t, ir) : undefined;
  const start = appStart(ir)?.route ?? "/";
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("@tanstack/react-start", "createServerFn")
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageAccess")
    .add(n.module, n.create, n.ui)
    .add(`${n.module}.schema`, n.schema)
    .add(`#/generated/${kebab(model.name)}.server`, n.access, n.data)
    .add("#/kit/access", "allows")
    .add("#/kit/page-guard", "guardPage")
    .add("#/kit/ModelForm", "ModelForm")
    .add("#/kit/words", "w")
    .add("#/lib/viewer.server", "currentViewer");
  const writeCheck = `allows(${n.access}.write, viewer${hasSignIn(auth) ? `, row.${ownerKey(model)}` : ""})`;
  const server = `
/** The viewer's ${n.label.toLowerCase()}: the first one they may read. */
const ${fn} = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  const row = (await ${n.data}.list(viewer)).at(-1) ?? null;
  return {
    row,
    canSave: row ? ${writeCheck} : allows(${n.access}.create, viewer),${
      options
        ? `
    options: ${options.expr},`
        : ""
    }
  };
});
`;
  const optionImports = options ? `${options.imports.join("\n")}\n` : "";
  if (pattern.kind === "settings") {
    imports
      .add("@tanstack/react-router", "useRouter")
      .add("react", "useState")
      .add(n.module, n.update);
    imports.add("#/kit/AppShell", "PageHeader");
    return `${HEADER}${imports.render()}${optionImports}${server}
export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: () => ${fn}(),
  component: ${component},
});

function ${component}() {
  const { row, canSave${options ? ", options" : ""} } = Route.useLoaderData();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id)} />
      <ModelForm
        key={row?.id ?? "new"}
        ui={${n.ui}}
        app={app}
        schema={${n.schema}}
        initial={row ?? undefined}
        readOnly={!canSave}${options ? "\n        options={options}" : ""}
        submitLabel={w.saveChanges}
        onSubmit={async (values) => {
          setSaved(false);
          if (row) await ${n.update}({ data: { id: row.id, values } });
          else await ${n.create}({ data: values });
          await router.invalidate();
          setSaved(true);
        }}
      />
      <p role="status" className="mt-4 text-sm font-semibold">
        {saved ? "Saved." : ""}
      </p>
    </>
  );
}
`;
  }
  const steps = (pattern.steps ?? []).map((step) => {
    const own = t.section(page.id, step.name);
    const keys = step.fields.map((name) => keyOf(model, name));
    return `  {
    title: ${JSON.stringify(own.title ?? humanize(step.name))},${own.text ? `\n    text: ${JSON.stringify(own.text)},` : ""}
    fields: ${literal(keys)},
    schema: ${n.schema}.pick({ ${keys.map((k) => `${k}: true`).join(", ")} }),
  },`;
  });
  imports
    .add("@tanstack/react-router", "Link", "redirect", "useNavigate")
    .add("react", "useState")
    .add("#/kit/Onboarding", "OnboardingLayout")
    .add(n.module, `type ${n.values}`);
  if (t.pageTitle(page.id) === humanize(page.id)) imports.add("#/generated/app", "app");
  const title =
    t.pageTitle(page.id) === humanize(page.id)
      ? "{w.welcomeTo(app.name)}"
      : `{${t.pageTitleOf(page.id)}}`;
  return `${HEADER}${imports.render()}${optionImports}${server}
const steps = [
${steps.join("\n")}
];

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: async () => {
    const found = await ${fn}();
    // Set up already: on to the app.
    if (found.row) throw redirect({ to: ${JSON.stringify(start)} });
    return found;
  },
  component: ${component},
});

function ${component}() {
${options ? "  const { options } = Route.useLoaderData();\n" : ""}  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<${n.values}>>({});
  const current = steps[step] as (typeof steps)[number];
  return (
    <OnboardingLayout
      title=${title}${t.pageSubtitle(page.id, 6)}
      step={step}
      count={steps.length}
      stepTitle={current.title}${steps.some((s) => s.includes("text:")) ? '\n      stepText={"text" in current ? current.text : undefined}' : ""}
      footer={
        <Link to=${attr(start)} className="font-semibold underline-offset-4 hover:underline">
          Do this later
        </Link>
      }
    >
      <ModelForm
        key={step}
        ui={{ ...${n.ui}, fields: ${n.ui}.fields.filter((f) => current.fields.includes(f.name)) }}
        app={app}
        schema={current.schema}
        initial={current.fields.some((f) => f in values) ? values : undefined}${options ? "\n        options={options}" : ""}
        submitLabel={step === steps.length - 1 ? "Finish" : "Continue"}
        onSubmit={async (stepValues) => {
          const all = { ...values, ...stepValues };
          if (step < steps.length - 1) {
            setValues(all);
            setStep(step + 1);
            return;
          }
          // Every required field is asked for in some step (smithable validate checks it).
          await ${n.create}({ data: all as ${n.values} });
          await navigate({ to: ${JSON.stringify(start)} });
        }}${'\n        onCancel={step > 0 ? () => setStep(step - 1) : undefined}\n        cancelLabel="Back"'}
      />
    </OnboardingLayout>
  );
}
`;
}

export function newRoute(page: PageIR, model: ModelIR, t: Texts, ir: SpecIR, ux: UxIR): string {
  const n = names(model, t);
  const order = fieldOrder(page, model, ux, t);
  const component = `New${model.name}Page`;
  const options = hasChoices(model) ? optionsFor(model, t, ir) : undefined;
  // A model on a calendar: the new form can start at the hour chosen there (?startsAt=…).
  const start = calendarStart(model, ir);
  const timed = start?.type.kind === "scalar" && start.type.name === "datetime";
  // Opened from a record's related list ("Add line" on an invoice): the reference to that record
  // is filled in and fixed (?invoice=12), and the form goes back to it.
  const parents = parentRefs(model, ir);
  const searched = [
    ...(start ? [`${start.name}: text(s.${start.name}, 40)`] : []),
    ...parents.map(({ field }) => `${field.name}: count(s.${field.name})`),
  ];
  const presets = [
    ...(start
      ? [
          `...(search.${start.name} ? { ${start.name}: ${timed ? `instantOf(search.${start.name}, app.timeZone)` : `search.${start.name}`} } : {})`,
        ]
      : []),
    ...parents.map(
      ({ field }) => `...(search.${field.name} ? { ${dataKey(field)}: search.${field.name} } : {})`,
    ),
  ];
  const preset = presets.length ? `\n        preset={{ ${presets.join(", ")} }}` : "";
  const fixed = parents.length
    ? `\n        fixed={[${parents.map(({ field }) => `...(search.${field.name} ? [${JSON.stringify(dataKey(field))}] : [])`).join(", ")}]}`
    : "";
  const back = parents.reduceRight(
    (otherwise, { field, route }) =>
      `search.${field.name} ? navigate({ to: ${JSON.stringify(join(route, "$id"))}, params: { id: String(search.${field.name}) } }) : ${otherwise}`,
    `navigate({ to: ${JSON.stringify(page.route)} })`,
  );
  // An article's address, when left empty, is made from its title (docs/design/articles.md).
  const articles = ir.pages.find(
    (p) => p.pattern.kind === "articles" && p.pattern.model === model.name && p.pattern.address,
  )?.pattern as { address: string; title: string } | undefined;
  const create = articles
    ? `await ${n.create}({ data: { ...values, ${articles.address}: values.${articles.address} || addressFrom(values.${articles.title}) } });`
    : `await ${n.create}({ data: values });`;
  return `${HEADER}import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
import { ${n.create}, ${n.ui} } from "${n.module}";
import { ${n.schema} } from "${n.module}.schema";
${options ? `${options.imports.join("\n")}\n` : ""}import { guardPage } from "#/kit/page-guard";
import { PageHeader } from "#/kit/AppShell";
import { ModelForm } from "#/kit/ModelForm";
import { w } from "#/kit/words";
${timed ? 'import { instantOf } from "#/kit/zoned";\n' : ""}${searched.length ? `import { ${[...(parents.length ? ["count"] : []), "optional", "type Search", ...(start ? ["text"] : [])].join(", ")} } from "#/kit/params";\n` : ""}
export const Route = createFileRoute(${JSON.stringify(join(page.route, "new"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}${searched.length ? `  validateSearch: (s: Search) => optional({ ${searched.join(", ")} }),\n` : ""}${options ? `  loader: async () => ({ options: ${options.expr} }),\n` : ""}  component: ${component},
});

function ${component}() {
${options ? "  const { options } = Route.useLoaderData();\n" : ""}${searched.length ? "  const search = Route.useSearch();\n" : ""}  const navigate = useNavigate();
  const back = () => ${back};
  return (
    <>
      <PageHeader title={w.newOne(${JSON.stringify(n.label.toLowerCase())})} />
      <ModelForm
        ui={${n.ui}}
        app={app}
        schema={${n.schema}}${order}${preset}${fixed}
${options ? "        options={options}\n" : ""}        submitLabel={w.createOne(${JSON.stringify(n.label.toLowerCase())})}
        onSubmit={async (values) => {
          ${create}
          await back();
        }}
        onCancel={back}
      />
    </>
  );
}
${
  articles
    ? `
/** An address from a title: lowercase letters, digits and dashes ("Hello, World!" → hello-world). */
function addressFrom(title: unknown): string {
  return String(title ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
`
    : ""
}`;
}

/**
 * What a thread reads from the related model, by rule (conversation.md §2): the first long text
 * is the message, the first person (else email) the writer, the first two-valued choice the side
 * (its first value ours), files and pictures the attachments, other choices badges. `replies`:
 * whether the reply box can fill every required field (defaults, the app, the reference back).
 */
function threadOf(target: ModelIR, owner: ModelIR) {
  // What the model's `thread` says, the rest by rule (core's threadBindings).
  const { body: text, author: writer, side, files, badges } = threadBindings(target);
  if (!text) return undefined;
  const replies = target.fields.every(
    (f) =>
      f === text ||
      !f.required ||
      f.formula ||
      f.default !== undefined ||
      f.defaultMe ||
      f.defaultFormula ||
      (f.type.kind === "relation" && f.type.model === owner.name && !f.type.many) ||
      files.includes(f),
  );
  return {
    text: dataKey(text),
    ...(writer ? { writer: dataKey(writer) } : {}),
    ...(side ? { side: { field: side.field.name, ours: side.ours } } : {}),
    files: files.map(dataKey),
    badges: badges.map(dataKey),
    replies,
  };
}

export function detailRoute(
  page: PageIR,
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  ux: UxIR,
  within?: Within,
  auth?: AuthIR,
): string {
  const n = names(model, t);
  const order = fieldOrder(page, model, ux, t);
  const tells = changeTells(model, t, ir);
  const component = `${model.name}Page`;
  const title = titleField(model);
  // A long title (a message's words) heads the page cut to its first line.
  // A name made of parts (record-names.md) by its function, from the columns the record came with.
  const heading = composedName(model)
    ? `${nameFunction(model)}(row as Record<string, unknown>)`
    : title === "id"
      ? `\`${n.label} #\${row.id}\``
      : `${longTitle(model) ? `titleOf(row.${title})` : `row.${title}`} || \`${n.label} #\${row.id}\``;
  const options = hasChoices(model) ? optionsFor(model, t, ir) : undefined;
  // The trash (docs/design/trash.md): Move to trash, and a trashed record read-only with Restore.
  const trash = Boolean(model.trash && !within);
  const imports = new Map<string, string[]>([
    // Only where the heading writes it: a name of parts heads the page by its function instead.
    ...(longTitle(model) && !composedName(model) && title !== "id"
      ? ([["#/kit/format", ["titleOf"]]] as [string, string[]][])
      : []),
    [n.module, [n.remove, n.get, n.ui, n.update, ...(trash ? [trashNames(model).restore] : [])]],
    [`${n.module}.schema`, [n.schema]],
    ...(composedName(model)
      ? ([[`${n.module}.name`, [nameFunction(model)]]] as [string, string[]][])
      : []),
    ...(trash
      ? ([["#/kit/Trash", ["rememberTrashed", "TrashedBanner"]]] as [string, string[]][])
      : []),
    ...(model.review ? ([["#/kit/Review", ["ReviewNotice"]]] as [string, string[]][]) : []),
  ]);
  // Places on this record (a session's bookings): staff book and cancel here too.
  const reserve =
    auth && !within
      ? reserveElement(
          model,
          { ir, t, auth },
          (m, ...ns) => imports.set(m, [...(imports.get(m) ?? []), ...ns]),
          "row.id",
        )
      : undefined;
  // The owner's own Cancel on a booking of someone's time (appointments.md §4).
  const cancelOwn = Boolean(auth && hasSignIn(auth) && !within && model.occupies?.cancel);
  if (cancelOwn) {
    imports.set(n.module, [
      ...(imports.get(n.module) ?? []),
      cancelNames(model).state,
      cancelNames(model).cancel,
    ]);
    imports.set("#/kit/Slots", ["CancelOwn"]);
  }
  // A heart for the viewer's saved records (marketplace.md §2.3).
  const favorite = Boolean(auth && !within && page.favorites && hasFavorites(model, ir, auth));
  if (favorite) imports.set(n.module, [...(imports.get(n.module) ?? []), savedToggle(model)]);
  // Standard actions: a button on a record they fit, for viewers who may run them.
  const offered = within ? [] : standardActions(page, ir);
  for (const action of offered)
    imports.set(`#/generated/actions/${kebab(action.name)}`, [
      action.name,
      `${action.name}Access`,
      `${action.name}Fits`,
      ...(askedFields(action).length ? [`${action.name}AskUi`, `${action.name}Asks`] : []),
      ...(askOptions(action, ir, t) ? [actionNames(action).askOptions] : []),
    ]);
  // A merge: "Merge into…" the record picked, which stays (intents.md §3).
  const merges = within ? [] : mergeActions(page, ir).filter((a) => a.merge?.into !== "new");
  // A combine's new record says, once, what it was made from (intents.md §3).
  const combined =
    !within && ir.actions.some((a) => !a.custom && a.merge?.into === "new" && a.on === model.name);
  for (const action of merges)
    imports.set(`#/generated/actions/${kebab(action.name)}`, [
      action.name,
      actionNames(action).access,
      actionNames(action).keep,
      actionNames(action).previewFn,
    ]);
  if (merges.length || combined)
    imports.set("#/kit/MergeDialog", [
      ...(merges.length ? ["MergeButton"] : []),
      ...(combined ? ["CombineNotice"] : []),
    ]);
  if (merges.length) {
    imports.set(n.module, [...(imports.get(n.module) ?? []), n.options]);
  }
  // A split: "Split…" with the records of its list, then the new record's page (intents.md §4).
  const splits = within
    ? []
    : splitActions(page, ir)
        .filter((a) => a.on === model.name)
        .slice(0, 1);
  for (const action of splits)
    imports.set(`#/generated/actions/${kebab(action.name)}`, [
      action.name,
      actionNames(action).access,
      ...(model.trash ? [actionNames(action).undoFn] : []),
    ]);
  if (splits.length) imports.set("#/kit/SplitDialog", ["SplitButton", "SplitNotice"]);
  for (const action of splits) {
    const cn = names(splitList(ir, action).child, t);
    imports.set(cn.module, [...new Set([...(imports.get(cn.module) ?? []), cn.ui])]);
  }
  const contact =
    page.contact && auth && hasSignIn(auth) && !within
      ? contactParts(page, model, t, ir)
      : undefined;
  const adds = within
    ? []
    : addable(model, ir, [...threadLists(model, ir, ux), ...inlineLists(model, ir, ux)]);
  // A list shown as a conversation (docs/design/conversation.md), read by rule.
  const threadFor = (field: FieldIR) =>
    !within && field.type.kind === "relation" && ux.pages[page.id]?.lists?.[field.name] === "thread"
      ? threadOf(modelNamed(ir, field.type.model), model)
      : undefined;
  // An Add button to the related model's own form, where one is written: a table's, or a
  // thread's whose reply box cannot fill every required field.
  const links = adds.some((a) => a.route && !threadFor(a.list)?.replies);
  if (links)
    imports.set("#/components/ui/button", [
      ...(imports.get("#/components/ui/button") ?? []),
      "buttonVariants",
    ]);
  let tables = false;
  let threads = false;
  let inlines = false;
  let totals = false;
  // Each inline list's choices for its rows' references, loaded with the record.
  const rowOptions: string[] = [];
  const sections = lists(model).map((field) => {
    const target = modelNamed(ir, field.type.model);
    const tn = names(target, t);
    imports.set(tn.module, [...(imports.get(tn.module) ?? []), tn.ui]);
    const back = references(target)
      .filter((f) => f.type.model === model.name)
      .map(dataKey);
    // A related record opens on its own page; inside a data page, in the data page.
    const targetRoute = within
      ? within.models.includes(target.name)
        ? dataRoute(within, target.name)
        : undefined
      : ir.pages.find((p) => pageModel(p) === target.name)?.route;
    const open = targetRoute
      ? `\n          onOpen={(item) => navigate({ to: ${JSON.stringify(join(targetRoute, "$id"))}, params: { id: String(item.id) } })}`
      : "";
    const label = t.field(model, field).label ?? humanize(field.name);
    // "Add line" on an invoice, for whoever may create one: the new form with this record filled
    // in. Without it, the list says only that there are none.
    const add = adds.find((a) => a.list === field);
    // A list shown as a thread may have no page of its own to add on: then no Add button.
    const button = add?.route
      ? `canAdd?.${field.name} && (
              <Link to=${attr(join(add.route, "new"))} search={{ ${add.ref.name}: row.id }} className={buttonVariants({ variant: "outline" })}>
                {w.addOne(${JSON.stringify(tn.label.toLowerCase())})}
              </Link>
            )`
      : "";
    // A conversation (docs/design/conversation.md): read from the related model by rule, with a
    // reply box when the box can fill every required field.
    const thread = threadFor(field);
    if (thread) {
      threads = true;
      const ref = add?.ref;
      if (thread.replies && ref)
        imports.set(tn.module, [...(imports.get(tn.module) ?? []), tn.create]);
      const reply =
        thread.replies && ref
          ? `canAdd?.${field.name} ? async (text) => {
              await ${tn.create}({ data: { ${thread.text}: text, ${dataKey(ref)}: row.id } as never });
              await router.invalidate();
            } : undefined`
          : "undefined";
      return `      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">${label}</h2>
          ${add?.route && !thread.replies ? `{${button}}` : ""}
        </div>
        <Thread
          ui={${tn.ui}}
          app={app}
          rows={row.${field.name}}
          text="${thread.text}"${thread.writer ? `\n          writer="${thread.writer}"` : ""}${thread.side ? `\n          side={${literal(thread.side)}}` : ""}${thread.files.length ? `\n          files={${literal(thread.files)}}` : ""}${thread.badges.length ? `\n          badges={${literal(thread.badges)}}` : ""}
          empty={w.noneYet(${JSON.stringify(tn.pluralLabel.toLowerCase())})}
          reply={${reply}}
        />
      </section>`;
    }
    // Rows edited in place (A 215), each saved on its own through the related model's own
    // create, change and delete; the parent's total of them under the table, from its own field.
    if (!within && add && ux.pages[page.id]?.lists?.[field.name] === "inline") {
      inlines = true;
      imports.set(tn.module, [
        ...new Set([...(imports.get(tn.module) ?? []), tn.create, tn.update, tn.remove]),
      ]);
      const ref = dataKey(add.ref);
      const shown = inlineFields(target, model.name);
      const picks = shown.filter((f) => f.type.kind === "relation");
      if (picks.length) {
        rowOptions.push(
          `${field.name}: { ${picks
            .map((f) => {
              const to = (f.type as { model: string }).model;
              if (to === USER_MODEL) {
                imports.set("#/generated/users", [
                  ...new Set([...(imports.get("#/generated/users") ?? []), "userOptions"]),
                ]);
                return `${dataKey(f)}: await userOptions()`;
              }
              const o = names(modelNamed(ir, to), t);
              imports.set(o.module, [...new Set([...(imports.get(o.module) ?? []), o.options])]);
              return `${dataKey(f)}: await ${o.options}()`;
            })
            .join(", ")} }`,
        );
      }
      const total = model.fields.find(
        (f) =>
          f.formula &&
          f.type.kind === "scalar" &&
          f.type.name === "money" &&
          fieldsUsed(f.formula).includes(field.name),
      );
      if (total) totals = true;
      const changes = (call: string) => `canAdd?.${field.name}
              ? async (${call}) => {
                  await ${call === "values" ? `${tn.create}({ data: { ...values, ${ref}: row.id } as never })` : call === "id, values" ? `${tn.update}({ data: { id, values: { ...values, ${ref}: row.id } as never } })` : `${tn.remove}({ data: { id } })`};
                  await router.invalidate();
                }
              : undefined`;
      return `      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">${label}</h2>
        <InlineRows
          ui={${tn.ui}}
          app={app}
          rows={row.${field.name}}
          fields={${JSON.stringify(shown.map(dataKey))}}${picks.length ? `\n          options={rowOptions.${field.name}}` : ""}
          label=${attr(tn.label.toLowerCase())}
          create={${changes("values")}}
          update={${changes("id, values")}}
          remove={${changes("id")}}${
            total
              ? `
          sum={{ label: ${n.ui}.fields.find((f) => f.name === "${total.name}")?.label ?? "", value: formatValue(${n.ui}.fields.find((f) => f.name === "${total.name}") as never, row.${total.name}, app) }}`
              : ""
          }
        />
      </section>`;
    }
    tables = true;
    return `      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">${label}</h2>
          ${add ? `{row.${field.name}.length > 0 && ${button}}` : ""}
        </div>
        <ModelTable
          ui={${tn.ui}}
          app={app}
          rows={row.${field.name}}
          hide={${JSON.stringify(back)}}${open}
          ${add ? `emptyAction={${button}}\n          emptyMessage={canAdd?.${field.name} ? undefined : w.noneYet(${JSON.stringify(tn.pluralLabel.toLowerCase())})}` : `emptyMessage={w.noneYet(${JSON.stringify(tn.pluralLabel.toLowerCase())})}`}
        />
      </section>`;
  });
  // The record's summary (A 215): its status, amount and key dates, by type (recordSummary).
  const look = within ? undefined : ux.pages[page.id];
  const summary =
    look?.recordHeader || look?.formAside ? recordSummary(model, ux.tones) : undefined;
  const summaryOf = (place: "header" | "aside") =>
    summary
      ? `<RecordSummary
          ui={${n.ui}}
          app={app}
          row={row}${summary.status ? `\n          status="${summary.status.name}"` : ""}${summary.amount ? `\n          amount="${summary.amount.name}"` : ""}${summary.dates.length ? `\n          dates={${JSON.stringify(summary.dates.map((d) => d.name))}}` : ""}
          place="${place}"
        />`
      : "";
  if (summary) imports.set("#/kit/RecordSummary", ["RecordSummary"]);
  if (threads) imports.set("#/kit/Thread", ["Thread"]);
  if (inlines) imports.set("#/kit/InlineRows", ["InlineRows"]);
  if (totals) imports.set("#/kit/format", [...(imports.get("#/kit/format") ?? []), "formatValue"]);
  // A copy opens the new record instead of reloading this one: it needs no router.
  const router = favorite || trash || threads || inlines || offered.some((a) => !a.copy);
  // The record's own lines in the audit log (docs/design/logging.md §3.3), for administrators.
  const history = Boolean(auth && hasSignIn(auth) && !within);
  const keys = history && auth ? hasKeys(ir, auth) : false;
  const viewer =
    contact || favorite || offered.length > 0 || merges.length > 0 || splits.length > 0;
  const buttons = [
    ...offered.map(
      (a) =>
        `{allows(${a.name}Access, viewer, row.${ownerKey(model)}) && ${a.name}Fits(row, viewer) && (
              ${actionButton(a, "row", page.route, t, ir)}
            )}`,
    ),
    ...merges.map(
      (a) => `{allows(${actionNames(a).access}, viewer) && (
              <MergeButton
                label=${attr(t.action(a))}${t.actionHelp(a) ? `\n                help=${attr(t.actionHelp(a) as string)}` : ""}
                concept="action:${a.name}"
                ui={${n.ui}}
                app={app}
                model=${attr(model.name)}
                mode={${actionNames(a).keep}}
                into={{ record: { id: row.id, title: String(${heading}) }, loadOptions: ${n.options} as never }}
                preview={(ids) => ${actionNames(a).previewFn}({ data: { ids } })}
                run={(ids, choices) => ${a.name}({ data: { ids, choices } })}
                onDone={async (merged) => {${model.trash ? `\n                  const [other] = merged.others;\n                  if (merged.goes === "trash" && other) rememberTrashed(${JSON.stringify(model.name)}, other.id, other.title);` : ""}
                  await navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(merged.kept.id) } });
                }}
              />
            )}`,
    ),
    ...splits.map((a) => {
      const { list, child, titleKey } = splitList(ir, a);
      return `{allows(${actionNames(a).access}, viewer) && (
              <SplitButton
                label=${attr(t.action(a))}${t.actionHelp(a) ? `\n                help=${attr(t.actionHelp(a) as string)}` : ""}
                concept="action:${a.name}"
                model=${attr(model.name)}
                title={String(${heading})}
                plural={${names(child, t).ui}.pluralLabel}
                children={(row.${list.name} ?? []).map((item: { id: number } & Record<string, unknown>) => ({ id: item.id, title: String(item[${JSON.stringify(titleKey)}] ?? item.id) }))}
                run={(picked) => ${a.name}({ data: { id: row.id, picked } })}
                onDone={(id) => navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(id) } })}
              />
            )}`;
    }),
    ...(favorite
      ? [`<SaveButton saved={saved} label={String(${heading})} onToggle={toggleSaved} />`]
      : []),
  ];
  return `${HEADER}import { createFileRoute, ${links ? "Link, " : ""}notFound, useNavigate${router ? ", useRouter" : ""} } from "@tanstack/react-router";
${
  // The contact block imports some of the same: each name once.
  history
    ? contact
      ? 'import { and, desc } from "drizzle-orm";\nimport { ' +
        (keys ? "apiKey, auditLog" : "auditLog") +
        ' } from "#/db/schema";\n'
      : 'import { createServerFn } from "@tanstack/react-start";\nimport { and, desc, eq } from "drizzle-orm";\nimport { db } from "#/db";\nimport { ' +
        (keys ? "apiKey, auditLog, user" : "auditLog, user") +
        ' } from "#/db/schema";\n'
    : ""
}import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
${[...imports].map(([module, fns]) => `import { ${[...new Set(fns)].sort().join(", ")} } from "${module}";`).join("\n")}
${options ? `${options.imports.join("\n")}\n` : ""}${offered.length || merges.length || splits.length ? 'import { allows } from "#/kit/access";\n' : ""}import { guardPage } from "#/kit/page-guard";${offered.length ? '\nimport { ActionButton } from "#/kit/ActionButton";' : ""}
${history ? 'import { ActivityLog } from "#/kit/ActivityLog";\n' : ""}import { PageHeader } from "#/kit/AppShell";
import { ModelForm } from "#/kit/ModelForm";
${buttons.length > 3 ? 'import { Overflow } from "#/kit/Overflow";\n' : ""}import { w } from "#/kit/words";
${history && !contact ? 'import { currentViewer } from "#/lib/viewer.server";\n' : ""}${tables || favorite ? `import { ${[...(tables ? ["ModelTable"] : []), ...(favorite ? ["SaveButton"] : [])].join(", ")} } from "#/kit/ModelTable";\n` : ""}${contact ? contact.imports : ""}
${contact ? contact.fn : ""}${
  history
    ? `/** The record's lines in the audit log, newest first: administrators only, nobody else. */
const getHistory = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const viewer = await currentViewer();
    if (viewer?.role !== "admin") return null;
    const people = new Map(db.select({ id: user.id, name: user.name }).from(user).all().map((p) => [p.id, p.name]));${
      keys
        ? `
    // A key's lines name the key ("key:3" is the key made as "Uptime monitor").
    for (const k of db.select({ id: apiKey.id, name: apiKey.name }).from(apiKey).all())
      people.set(\`key:\${k.id}\`, \`key "\${k.name}"\`);`
        : ""
    }
    return db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.model, ${JSON.stringify(model.name)}), eq(auditLog.recordId, id)))
      .orderBy(desc(auditLog.id))
      .limit(50)
      .all()
      .map((r) => ({
        id: r.id,
        at: r.at,
        who: r.who === "visitor" || r.who === "the app" ? r.who : (people.get(r.who) ?? (r.who.startsWith("key:") ? w.aKey(r.who.slice(4)) : r.who.startsWith("timer:") ? w.byTimer(r.who.slice(6)) : w.aRemovedUser(r.who))),
        action: r.action,
        fields: r.fields,
        details: r.details ? Object.fromEntries(Object.entries(r.details).map(([k, v]) => [k, String(v)])) : null,
      }));
  });

`
    : ""
}export const Route = createFileRoute(${JSON.stringify(join(page.route, "$id"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: async ({ params }) => {
    const found = await ${n.get}({ data: Number(params.id) });
    if (!found) throw notFound();
    return { ...found${options ? `, options: ${options.expr}` : ""}${rowOptions.length ? `, rowOptions: { ${rowOptions.join(", ")} }` : ""}${history ? ", history: await getHistory({ data: Number(params.id) })" : ""} };
  },
  component: ${component},
});

function ${component}() {
  const { row, canWrite, canDelete${sections.some((s) => s.includes("canAdd?.")) ? ", canAdd" : ""}${model.review ? ", review" : ""}${trash ? ", trashed" : ""}${options ? ", options" : ""}${favorite ? ", saved" : ""}${history ? ", history" : ""}${rowOptions.length ? ", rowOptions" : ""} } = Route.useLoaderData();${viewer ? "\n  const { viewer } = Route.useRouteContext();" : ""}
  const navigate = useNavigate();${router ? "\n  const router = useRouter();" : ""}
  const back = () => navigate({ to: ${JSON.stringify(page.route)} });${
    favorite
      ? `
  // The heart saves the record for the viewer; a visitor signs in first and comes back.
  const toggleSaved = async () => {
    if (!viewer) {
      await navigate({ to: "/sign-in", search: { redirect: location.pathname } });
      return;
    }
    await ${savedToggle(model)}({ data: row.id });
    await router.invalidate();
  };`
      : ""
  }
  return (
    <>
      ${
        buttons.length === 1 && favorite
          ? `<PageHeader
        title={${heading}}
        actions={${buttons[0]}}
      />`
          : buttons.length
            ? `<PageHeader
        title={${heading}}
        actions={
          ${buttons.length > 3 ? "<Overflow>" : "<>"}
            ${buttons.join("\n            ")}
          ${buttons.length > 3 ? "</Overflow>" : "</>"}
        }
      />`
            : `<PageHeader title={${heading}} />`
      }${
        look?.recordHeader
          ? `
      <div className="-mt-2 mb-6">
        ${summaryOf("header")}
      </div>`
          : ""
      }${
        model.review
          ? `
      <ReviewNotice notes={review} labels={${JSON.stringify(Object.fromEntries((model.review ?? []).map((f) => [f, t.field(model, model.fields.find((x) => x.name === f) as FieldIR).label ?? humanize(f)])))}} />`
          : ""
      }${
        combined
          ? `
      <CombineNotice key={row.id} model=${attr(model.name)} id={row.id} label={${n.ui}.label} />`
          : ""
      }${splits
        .map(
          (a) => `
      <SplitNotice
        key={\`\${row.id}-${a.name}\`}
        model=${attr(model.name)}
        id={row.id}${
          model.trash
            ? `
        onUndo={async () => {
          const undone = await ${actionNames(a).undoFn}({ data: row.id });
          await navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(undone.original) } });
          return undone;
        }}`
            : ""
        }
      />`,
        )
        .join("")}${
        trash
          ? `
      {trashed && (
        <TrashedBanner
          {...trashed}
          app={app}
          ui={${n.ui}}
          onRestore={async () => {
            await ${trashNames(model).restore}({ data: [row.id] });
            await router.invalidate();
          }}
        />
      )}`
          : ""
      }
      ${
        look?.formAside
          ? `<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      `
          : ""
      }<ModelForm
        key={String(row.updatedAt)}${trash ? "\n        trash" : ""}
        ui={${n.ui}}
        app={app}
        schema={${n.schema}}${order}
        initial={row}
        readOnly={!canWrite}${tells.length ? `\n        tells={${JSON.stringify(tells)}}` : ""}
${options ? "        options={options}\n" : ""}        submitLabel={w.saveChanges}
        onSubmit={async (values) => {
          await ${n.update}({ data: { id: row.id, values } });
          await back();
        }}
        onCancel={back}
        onDelete={
          canDelete
            ? async (together?: boolean) => {
                await ${n.remove}({ data: { id: row.id, together } });${trash ? `\n                rememberTrashed(${JSON.stringify(model.name)}, row.id, String(${heading}));` : ""}
                await back();
              }
            : undefined
        }
      />${
        look?.formAside
          ? `
        ${summaryOf("aside")}
      </div>`
          : ""
      }
${
  reserve
    ? `      <section className="mt-10 max-w-3xl">
        ${reserve}
      </section>
`
    : ""
}${
  cancelOwn
    ? `      <section className="mt-10 max-w-3xl">
        <CancelOwn id={row.id} load={${cancelNames(model).state}} cancel={${cancelNames(model).cancel}} />
      </section>
`
    : ""
}${contact ? `      ${contact.element}\n` : ""}${sections.join("\n")}${
  history
    ? `
      {history && history.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 text-lg font-semibold">{w.history}</h2>
          <ActivityLog lines={history} app={app} />
        </section>
      )}`
    : ""
}
    </>
  );
}
`;
}

/**
 * "Contact the owner" (marketplace.md §2.4): a server function that mails the record's owner (or
 * the user a field names) through the kit's sendMail, with the record's title and link in the
 * subject and the sender as reply-to, limited like other writes; the recipient's address never
 * leaves the server. With `keep`, a copy is stored through that model's create rule.
 */
/**
 * Who a change tells, for the form to ask first (A 134): each mail on a change (of its `fields`;
 * without them, of any field) that goes to the records of one of the record's lists, with that
 * list's label. An empty `fields` tells the form any changed field counts.
 */
function changeTells(model: ModelIR, t: Texts, ir: SpecIR) {
  return ir.outgoing.flatMap((o) => {
    const r = o.recipient;
    if (o.to !== "mail" || r?.kind !== "list") return [];
    if (!("event" in o.when) || o.when.event !== "changed" || o.when.model !== model.name)
      return [];
    const list = model.fields.find((f) => f.name === r.list) as FieldIR;
    return [
      {
        fields: o.fields ?? [],
        list: r.list,
        label: t.field(model, list).label ?? humanize(r.list),
      },
    ];
  });
}

function contactParts(page: PageIR, model: ModelIR, t: Texts, ir: SpecIR) {
  const contact = page.contact as { to: string; keep?: string };
  const n = names(model, t);
  const field = model.fields.find((f) => f.name === contact.to);
  const key = contact.to === "owner" ? ownerKey(model) : `${contact.to}Id`;
  const recipient = field
    ? (t.field(model, field).label ?? humanize(field.name)).toLowerCase()
    : "owner";
  const title = titleField(model);
  const keep = contact.keep ? modelNamed(ir, contact.keep) : undefined;
  const kn = keep ? names(keep, t) : undefined;
  // A kept copy: the keep model's name, email and message fields (it links to no other record).
  const kept = keep
    ? ["name", "email", "message"]
        .filter((f) => keep.fields.some((k) => k.name === f))
        .map((f) => `${f}: sender.${f}`)
    : [];
  return {
    imports: `import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { user } from "#/db/schema";
import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
${kn && keep ? `import { ${kn.data} } from "#/generated/${kebab(keep.name)}.server";\n` : ""}import { ContactOwner } from "#/kit/ContactOwner";
import { writeAllowed } from "#/kit/limit";
import { mailConfigured, sendMail } from "#/kit/mail";
import { currentViewer } from "#/lib/viewer.server";
`,
    fn: `
/** A message about this ${n.label.toLowerCase()} to its ${recipient}, by mail; their address stays here. */
const contact${model.name} = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.int(), name: z.string().trim().min(1).max(200), email: z.email().max(200), message: z.string().trim().min(1).max(2000) }))
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    writeAllowed(viewer, getRequestHeaders());
    const row = await ${n.data}.get(viewer, data.id);
    if (!row) throw new Error("This ${n.label.toLowerCase()} is not there any more.");
    const recipient = ${contact.to === "owner" && !model.ownedBy ? `${n.data}.ownerOf(viewer, row.id)` : `row.${key}`};
    const to = recipient ? db.select({ email: user.email }).from(user).where(eq(user.id, recipient)).get() : undefined;
    if (!to?.email) throw new Error("The ${recipient} cannot be reached.");
    const sender = viewer ? { name: viewer.name, email: viewer.email, message: data.message } : data;
    const name = ${title === "id" ? `\`${n.label} #\${row.id}\`` : `String(row.${title})`};
    const link = \`\${process.env.BETTER_AUTH_URL ?? ""}${page.route === "/" ? "" : page.route}/\${row.id}\`;
    await sendMail({
      to: to.email,
      replyTo: \`"\${sender.name.replace(/["\\\\<>\\r\\n]/g, "")}" <\${sender.email}>\`,
      subject: \`About “\${name}”\`,
      text: \`\${sender.name} (\${sender.email}) wrote about “\${name}”:\\n\\n\${sender.message}\\n\\n\${link}\\n\`,
    });${kn ? `\n    await ${kn.data}.create(viewer, { ${kept.join(", ")} });` : ""}
    return { sent: true, kept: !mailConfigured() };
  });

`,
    element: `<ContactOwner
        recipient=${JSON.stringify(recipient)}
        viewer={viewer}
        onSend={(values) => contact${model.name}({ data: { id: row.id, ...values } })}
      />`,
  };
}

/** A standard action's button on a record: it acts at once, or asks first in a dialog. */
export function actionButton(
  action: StandardActionIR,
  row: string,
  route: string,
  t: Texts,
  ir: SpecIR,
): string {
  const asks = askedFields(action).length > 0;
  // A copy opens the new record, to be looked over; a change shows this one as it is now.
  const after = action.copy
    ? `await navigate({ to: ${JSON.stringify(join(route, "$id"))}, params: { id: String(copy) } });`
    : "await router.invalidate();";
  const help = t.actionHelp(action);
  return `<ActionButton
                label=${attr(t.action(action))}${help ? `\n                help=${attr(help)}` : ""}
                concept="action:${action.name}"${
                  asks
                    ? `
                ask={{ ui: ${action.name}AskUi, schema: ${action.name}Asks, initial: ${row}, app${askOptions(action, ir, t) ? `, loadOptions: ${actionNames(action).askOptions}` : ""} }}`
                    : ""
                }
                onRun={async (${asks ? "values" : ""}) => {
                  ${action.copy ? "const copy = " : ""}await ${action.name}({ data: ${asks ? `{ id: ${row}.id, values: values as never }` : `${row}.id`} });
                  ${after}
                }}
              />`;
}

/**
 * The Team page's Trash (docs/design/admin.md): every model's trash on one page, each under its
 * name, with Restore and Delete for good, so an administrator needs no list's own Trash page.
 */
export function allTrashRoute(team: PageIR, ir: SpecIR, t: Texts): string {
  const lists = trashedLists(ir).map(({ model, page }) => ({
    model,
    page,
    n: names(model, t),
    fns: trashNames(model),
  }));
  return `${HEADER}import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
${lists.map(({ n, fns }) => `import { ${[fns.erase, fns.restore, fns.list, n.ui].sort().join(", ")} } from "${n.module}";`).join("\n")}
import { guardPage } from "#/kit/page-guard";
import { PageHeader } from "#/kit/AppShell";
import { TrashTable } from "#/kit/Trash";
import { w } from "#/kit/words";

export const Route = createFileRoute(${JSON.stringify(join(team.route, "trash"))})({
${guard(`pageAccess[${JSON.stringify(team.id)}]`)}  loader: async () => {
    const [${lists.map(({ model }) => camel(model.name)).join(", ")}] = await Promise.all([${lists.map(({ fns }) => `${fns.list}()`).join(", ")}]);
    return { ${lists.map(({ model }) => `${camel(model.name)}: ${camel(model.name)}.rows`).join(", ")} };
  },
  component: TrashPage,
});

function TrashPage() {
  const rows = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const empty = Object.values(rows).every((list) => list.length === 0);
  return (
    <>
      <PageHeader title={w.trashView} subtitle={w.trashLead} />
      {empty && <p className="text-muted-foreground">{w.trashEmpty}</p>}
${lists
  .map(
    ({ model, page, n, fns }) => `      {rows.${camel(model.name)}.length > 0 && (
        <section data-model=${JSON.stringify(model.name)} className="space-y-3 pb-8">
          <h2 className="text-lg font-semibold">{${n.ui}.pluralLabel}</h2>
          <TrashTable
            ui={${n.ui}}
            app={app}
            rows={rows.${camel(model.name)}}
            restore={(ids) => ${fns.restore}({ data: ids })}
            erase={(ids) => ${fns.erase}({ data: ids })}
            onDone={() => router.invalidate()}
            onOpen={(row) => navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(row.id) } })}
          />
        </section>
      )}`,
  )
  .join("\n")}
    </>
  );
}
`;
}

/**
 * A list's Trash page (docs/design/trash.md): what the viewer may delete that is in the trash,
 * with Restore, Delete for good and Empty trash.
 */
export function trashRoute(page: PageIR, model: ModelIR, t: Texts): string {
  const n = names(model, t);
  const fns = trashNames(model);
  return `${HEADER}import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
import { ${[fns.erase, fns.restore, fns.list, n.ui].sort().join(", ")} } from "${n.module}";
import { guardPage } from "#/kit/page-guard";
import { PageHeader } from "#/kit/AppShell";
import { TrashTable } from "#/kit/Trash";
import { w } from "#/kit/words";

export const Route = createFileRoute(${JSON.stringify(join(page.route, "trash"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: () => ${fns.list}(),
  component: ${model.name}TrashPage,
});

function ${model.name}TrashPage() {
  const { rows } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <>
      <PageHeader title={w.trashOf(${n.ui}.pluralLabel)} subtitle={w.trashLead} />
      <TrashTable
        ui={${n.ui}}
        app={app}
        rows={rows}
        restore={(ids) => ${fns.restore}({ data: ids })}
        erase={(ids) => ${fns.erase}({ data: ids })}
        onDone={() => router.invalidate()}
        onOpen={(row) => navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(row.id) } })}
      />
    </>
  );
}
`;
}

// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).

import {
  type AuthIR,
  humanize,
  kebab,
  type ModelIR,
  type OnboardingStep,
  type PageIR,
  pageModel,
  pascal,
  type SpecIR,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
import { reserveElement, savedToggle } from "../data.js";
import {
  appStart,
  attr,
  dataKey,
  dataRoute,
  fieldOrder,
  guard,
  HEADER,
  hasChoices,
  hasFavourites,
  importList,
  indexPath,
  join,
  keyOf,
  lists,
  literal,
  modelNamed,
  names,
  optionsFor,
  ownerKey,
  references,
  type Texts,
  titleField,
  type Within,
} from "../shared.js";
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
    .add(n.module, n.create, n.schema, n.ui)
    .add(`#/generated/${kebab(model.name)}.server`, n.access, n.data)
    .add("#/kit/access", "allows", "guardPage")
    .add("#/kit/ModelForm", "ModelForm")
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
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: () => ${fn}(),
  component: ${component},
});

function ${component}() {
  const { row, canSave${options ? ", options" : ""} } = Route.useLoaderData();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageHeader page=${attr(page.id)} title=${attr(t.pageTitle(page.id))}${t.pageSubtitle(page.id)} />
      <ModelForm
        key={row?.id ?? "new"}
        ui={${n.ui}}
        app={app}
        schema={${n.schema}}
        initial={row ?? undefined}
        readOnly={!canSave}${options ? "\n        options={options}" : ""}
        submitLabel="Save changes"
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
  const title =
    t.pageTitle(page.id) === humanize(page.id) ? `Welcome to ${ir.app.name}` : t.pageTitle(page.id);
  return `${HEADER}${imports.render()}${optionImports}${server}
const steps = [
${steps.join("\n")}
];

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: async () => {
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
      title=${attr(title)}${t.pageSubtitle(page.id, 6)}
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
  const preset = start
    ? `\n        preset={search.${start.name} ? { ${start.name}: ${timed ? `instantOf(search.${start.name}, app.timeZone)` : `search.${start.name}`} } : undefined}`
    : "";
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
import { ${n.create}, ${n.schema}, ${n.ui} } from "${n.module}";
${options ? `${options.imports.join("\n")}\n` : ""}import { guardPage } from "#/kit/access";
import { PageHeader } from "#/kit/AppShell";
import { ModelForm } from "#/kit/ModelForm";
${timed ? 'import { instantOf } from "#/kit/zoned";\n' : ""}${start ? 'import { z } from "zod";\n' : ""}
export const Route = createFileRoute(${JSON.stringify(join(page.route, "new"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${start ? `  validateSearch: z.object({ ${start.name}: z.string().max(40).optional().catch(undefined) }),\n` : ""}${options ? `  loader: async () => ({ options: ${options.expr} }),\n` : ""}  component: ${component},
});

function ${component}() {
${options ? "  const { options } = Route.useLoaderData();\n" : ""}${start ? "  const search = Route.useSearch();\n" : ""}  const navigate = useNavigate();
  const back = () => navigate({ to: ${JSON.stringify(page.route)} });
  return (
    <>
      <PageHeader title=${attr(`New ${n.label.toLowerCase()}`)} />
      <ModelForm
        ui={${n.ui}}
        app={app}
        schema={${n.schema}}${order}${preset}
${options ? "        options={options}\n" : ""}        submitLabel=${attr(`Create ${n.label.toLowerCase()}`)}
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
  const component = `${model.name}Page`;
  const title = titleField(model);
  const heading =
    title === "id" ? `\`${n.label} #\${row.id}\`` : `row.${title} || \`${n.label} #\${row.id}\``;
  const options = hasChoices(model) ? optionsFor(model, t, ir) : undefined;
  const imports = new Map<string, string[]>([
    [n.module, [n.remove, n.get, n.schema, n.ui, n.update]],
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
  // A heart for the viewer's saved records (marketplace.md §2.3).
  const favourite = Boolean(auth && !within && page.favourites && hasFavourites(model, ir, auth));
  if (favourite) imports.set(n.module, [...(imports.get(n.module) ?? []), savedToggle(model)]);
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
    return `      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">${label}</h2>
        <ModelTable
          ui={${tn.ui}}
          app={app}
          rows={row.${field.name}}
          hide={${JSON.stringify(back)}}${open}
        />
      </section>`;
  });
  return `${HEADER}import { createFileRoute, notFound, useNavigate${favourite ? ", useRouter" : ""} } from "@tanstack/react-router";
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
${[...imports].map(([module, fns]) => `import { ${[...new Set(fns)].sort().join(", ")} } from "${module}";`).join("\n")}
${options ? `${options.imports.join("\n")}\n` : ""}import { guardPage } from "#/kit/access";
import { PageHeader } from "#/kit/AppShell";
import { ModelForm } from "#/kit/ModelForm";
${sections.length || favourite ? `import { ${[...(sections.length ? ["ModelTable"] : []), ...(favourite ? ["SaveButton"] : [])].join(", ")} } from "#/kit/ModelTable";\n` : ""}
export const Route = createFileRoute(${JSON.stringify(join(page.route, "$id"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: async ({ params }) => {
    const found = await ${n.get}({ data: Number(params.id) });
    if (!found) throw notFound();
    return { ...found${options ? `, options: ${options.expr}` : ""} };
  },
  component: ${component},
});

function ${component}() {
  const { row, canWrite, canDelete${options ? ", options" : ""}${favourite ? ", saved" : ""} } = Route.useLoaderData();
  const navigate = useNavigate();
  const back = () => navigate({ to: ${JSON.stringify(page.route)} });${
    favourite
      ? `
  const { viewer } = Route.useRouteContext();
  const router = useRouter();
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
        favourite
          ? `<PageHeader
        title={${heading}}
        actions={<SaveButton saved={saved} label={String(${heading})} onToggle={toggleSaved} />}
      />`
          : `<PageHeader title={${heading}} />`
      }
      <ModelForm
        ui={${n.ui}}
        app={app}
        schema={${n.schema}}${order}
        initial={row}
        readOnly={!canWrite}
${options ? "        options={options}\n" : ""}        submitLabel="Save changes"
        onSubmit={async (values) => {
          await ${n.update}({ data: { id: row.id, values } });
          await back();
        }}
        onCancel={back}
        onDelete={
          canDelete
            ? async () => {
                await ${n.remove}({ data: row.id });
                await back();
              }
            : undefined
        }
      />
${
  reserve
    ? `      <section className="mt-10 max-w-3xl">
        ${reserve}
      </section>
`
    : ""
}${sections.join("\n")}
    </>
  );
}
`;
}

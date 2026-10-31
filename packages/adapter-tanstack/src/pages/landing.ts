// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  type Condition,
  camel,
  humanize,
  isPictures,
  kebab,
  type LandingSection,
  type PageIR,
  pageIcon,
  pageModel,
  pascal,
  plural,
  SECTION_LOOKS,
  type SpecIR,
  stagePage,
  storesPictures,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
import { calculatorModel } from "../calculators.js";
import {
  attr,
  code,
  guard,
  HEADER,
  importList,
  indexPath,
  keyOf,
  literal,
  modelNamed,
  names,
  type Texts,
  titleField,
} from "../shared.js";
import { LUCIDE, workspaceEntries } from "./root.js";

/**
 * A landing page: its sections in order, with texts from smithable.content.yml or derived ones.
 * A page of sections with no kind (docs/design/page-sections.md) is laid out the same way without
 * a frame of its own (framed false): the root gives it the page's frame. The parts beside a
 * kind's own page are a module of their own (framed "parts", partsModule).
 */
/**
 * An address's city, for a hero's line over its title: from its last part, the words that are
 * not a postcode (any word with a digit) or a state's short code ("IL"); "22100 Mariehamn" and
 * "Springfield, IL 62704" give Mariehamn and Springfield.
 */
function cityOf(address: string): string | undefined {
  const parts = address
    .trim()
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts.reverse()) {
    const words = part.split(/\s+/).filter((w) => !/\d/.test(w));
    if (words.length === 0 || (words.length === 1 && /^[A-Z]{2,3}$/.test(words[0] as string)))
      continue;
    return words.join(" ");
  }
  return undefined;
}

export function landingRoute(
  page: PageIR,
  sections: LandingSection[],
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
  ux: UxIR,
  framed: boolean | "parts" = true,
  /** The page's theme bands its sections (surfaces.sections: banded): every second one is muted. */
  banded = false,
): string {
  const text = (name: string) => t.section(page.id, name);
  const component = `${pascal(page.id)}Page`;
  const imports = importList();
  if (framed !== "parts")
    imports
      .add("@tanstack/react-router", "createFileRoute")
      .add("#/generated/pages", "pageAccess")
      .add("#/kit/page-guard", "guardPage");
  if (framed === true)
    imports
      .add("#/kit/Landing", "LandingLayout")
      .add("#/kit/words", "w")
      .add("#/generated/site", "site");
  const routeOf = (id: string | undefined) => ir.pages.find((p) => p.id === id)?.route;
  // Into the app: the first page in the navigation that is not a landing page.
  const appPage = ir.navigation
    .flatMap((m) => m.pages)
    .map((id) => ir.pages.find((p) => p.id === id))
    .find((p) => p && p.pattern.kind !== "landing");
  const start = sections.map((s) => routeOf(s.button)).find(Boolean) ?? appPage?.route;
  /** A link as a prop; the label is a literal, or an expression such as `w.openApp(app.name)`. */
  const link = (to: string | undefined, label: string, expression = false) =>
    to
      ? `{{ to: ${JSON.stringify(to)}, label: ${expression ? label : JSON.stringify(label)} }}`
      : "{undefined}";
  // A kind's own part (its list) is the kind's page, which loads its own records.
  const records = sections.filter((s) => s.model && !s.own);
  // Each model's list read once; the page gets each section's rows already filtered and cut to
  // what it shows (A 154), not the whole list.
  // The hero's facts (look-gap §4): each model's count, read with the same lists.
  const hero = sections.find((s) => s.kind === "hero");
  const facts = (hero && ux.pages[page.id]?.looks?.[hero.name]?.facts) || [];
  // A stage hero (look-breadth §3): its list page's first six records in the list's own order.
  const heroLook = hero ? ux.pages[page.id]?.looks?.[hero.name] : undefined;
  const staged = heroLook?.layout === "stage" ? stagePage(ir, heroLook.stage) : undefined;
  const stagedModel = staged ? pageModel(staged) : undefined;
  const lists = [
    ...new Set([
      ...records.map((s) => s.model as string),
      ...facts,
      ...(stagedModel ? [stagedModel] : []),
    ]),
  ].map((name) => {
    const n = names(modelNamed(ir, name), t);
    imports.add(n.module, n.list);
    return `    const ${camel(plural(name))} = (await ${n.list}()).rows;`;
  });
  const shown = records.map(
    (s) =>
      `${JSON.stringify(s.name)}: ${camel(plural(s.model as string))}${kept(s.where)}.slice(0, ${s.limit ?? 6})`,
  );
  if (hero && facts.length)
    shown.push(
      `${JSON.stringify(`${hero.name}Facts`)}: [${facts
        .map((name) => {
          // The model's own label, as its module has it (each word written once).
          const n = names(modelNamed(ir, name), t);
          imports.add(n.module, n.ui);
          return `{ label: ${n.ui}.pluralLabel, value: ${camel(plural(name))}.length }`;
        })
        .join(", ")}]`,
    );
  if (hero && staged && stagedModel) {
    // The list's own order: the ux file's sort, else the newest first.
    const sort = ux.pages[staged.id]?.sort;
    const field = sort?.replace(/^-/, "");
    const key = field ? keyOf(modelNamed(ir, stagedModel), field) : undefined;
    // Records without a value last, whichever way the list runs.
    const order = key
      ? `(a, b) => { const x = a.${key}; const y = b.${key}; if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; return (x < y ? -1 : x > y ? 1 : 0) * ${sort?.startsWith("-") ? -1 : 1}; }`
      : "(a, b) => b.id - a.id";
    shown.push(
      `${JSON.stringify(`${hero.name}Stage`)}: [...${camel(plural(stagedModel))}].sort(${order}).slice(0, 6)`,
    );
  }
  const loaded = records.length > 0 || facts.length > 0 || Boolean(staged);
  const loader = loaded
    ? `  loader: async () => {\n${lists.join("\n")}\n    return { ${shown.join(", ")} };\n  },\n`
    : "";
  const items = (name: string) => literal(text(name).items ?? []);
  // A banded theme's sections: every second one that can have a band, counting from the first
  // after the hero (the footer and a custom section not counted), is muted unless it says its own.
  const alternate = new Set<string>();
  const sectionParts = (section: LandingSection): string[] => {
    // A section's component, opened with where its texts are kept, so the preview can change
    // them in place.
    // Its look from smithable.ux.yml (layout, image, columns, highlight, band), checked by its kind.
    const given = ux.pages[page.id]?.looks?.[section.name] ?? {};
    const look = Object.entries(
      alternate.has(section.name) && given.band === undefined ? { ...given, band: "muted" } : given,
    )
      // A hero's facts and its line from the contact section are props of their own (below).
      .filter(([key]) => key !== "facts" && key !== "eyebrow")
      // The hero's "image" (which side) is imageSide: its image is the picture itself.
      .map(
        ([key, value]) =>
          `\n          ${key === "image" ? "imageSide" : key}=${typeof value === "number" ? `{${value}}` : attr(String(value))}`,
      )
      .join("");
    const own = text(section.name);
    // The short line over a section's title: the content file's, else (a hero) one read from the
    // page's contact section, its city or the first line of its hours (look-gap §4).
    const contact = sections.find((s) => s.kind === "contact");
    const read =
      given.eyebrow && contact
        ? given.eyebrow === "address"
          ? cityOf(text(contact.name).address ?? "")
          : (text(contact.name).hours ?? "").trim().split("\n")[0]?.trim()
        : undefined;
    const line = own.eyebrow ?? (read || undefined);
    const eyebrow = line ? `\n          eyebrow=${attr(line)}` : "";
    const open = (component: string) =>
      `<${component}\n          texts=${attr(`pages.${page.id}.${section.name}`)}${look}${eyebrow}`;
    switch (section.kind) {
      case "hero":
        imports.add("#/kit/Landing", "Hero");
        return [
          `${open("Hero")}
          title=${attr(own.title ?? ir.app.name)}${
            (own.subtitle ?? ir.app.description)
              ? `
          subtitle=${attr((own.subtitle ?? ir.app.description) as string)}`
              : ""
          }
          link=${link(routeOf(section.button) ?? start, own.button ?? "Get started")}${
            section.secondButton
              ? `
          secondLink=${
            own.secondButton
              ? link(routeOf(section.secondButton), own.secondButton)
              : (imports.add("#/generated/pages", "pageUi"),
                link(routeOf(section.secondButton), t.pageTitleOf(section.secondButton), true))
          }`
              : ""
          }${
            own.image
              ? `
          image={{ src: ${JSON.stringify(`/${own.image.src}`)}, alt: ${JSON.stringify(own.image.alt)}${own.image.generated ? ", generated: true" : ""} }}`
              : ""
          }${
            section.shortcuts?.length
              ? `
          shortcuts={[${section.shortcuts
            .map((id) => {
              const target = ir.pages.find((p) => p.id === id) as PageIR;
              const icon = LUCIDE[pageIcon(ux, target)];
              imports.add("lucide-react", icon);
              const shortcut = `{ to: ${JSON.stringify(target.route)}, label: ${t.pageTitleOf(id)}, icon: ${icon} }`;
              // A page behind sign-in is a shortcut only for those who may open it.
              if (!hasSignIn(auth) || auth.public.pages.includes(id)) return shortcut;
              imports.add("#/kit/access", "allows");
              // As const: the route stays its own literal, which a link's "to" takes.
              return `...(allows(pageAccess[${JSON.stringify(id)}], viewer) ? [${shortcut} as const] : [])`;
            })
            .join(", ")}]}`
              : ""
          }${
            sections.slice(sections.indexOf(section) + 1).some((s) => s.kind !== "footer")
              ? `
          more`
              : ""
          }${
            facts.length
              ? `
          facts={data[${JSON.stringify(`${section.name}Facts`)}]}`
              : ""
          }${
            staged && stagedModel
              ? (
                  () => {
                    const n = names(modelNamed(ir, stagedModel), t);
                    imports
                      .add(n.module, n.ui)
                      .add("#/generated/app", "app")
                      .add("#/generated/pages", "pageUi");
                    const columns = ux.pages[staged.id]?.columns;
                    const view = ux.pages[staged.id]?.view;
                    return `
          stage={{ ui: ${n.ui}, app, rows: data[${JSON.stringify(`${section.name}Stage`)}], label: pageUi[${JSON.stringify(staged.id)}].title${columns ? `, columns: ${literal(columns.map((c) => keyOf(modelNamed(ir, stagedModel), c)))}` : ""}${view === "cards" ? ', view: "cards"' : ""} }}`;
                  }
                )()
              : ""
          }
        />`,
        ];
      case "records": {
        const model = modelNamed(ir, section.model as string);
        const n = names(model, t);
        imports.add("#/kit/Landing", "RecordCards");
        const title = titleField(model);
        const summary = model.fields.find(
          (f) => f.type.kind === "scalar" && f.type.name === "text",
        );
        const choice = model.fields.find((f) => f.type.kind === "choice");
        // Its first amount of money, stored or computed: for a thing for sale, its price.
        const money = model.fields.find((f) => f.type.kind === "scalar" && f.type.name === "money");
        if (money) imports.add("#/generated/app", "app");
        // A card opens its article when the model has an articles page, and shows its picture.
        const article = ir.pages.find(
          (p) => p.pattern.kind === "articles" && p.pattern.model === model.name,
        );
        const address = article?.pattern.kind === "articles" ? article.pattern.address : undefined;
        const picture = model.fields.find(storesPictures);
        // A card without a picture shows the icon of the model's own list page, when the model
        // has pictures at all.
        const listPage = ir.pages.find(
          (p) => p.pattern.kind === "crud" && p.pattern.model === model.name,
        );
        const icon = picture ? LUCIDE[listPage ? pageIcon(ux, listPage) : "list"] : undefined;
        if (icon) imports.add("lucide-react", icon);
        // A catalog's door (marketplace.md §2.5): the box and chips open the list page with the
        // same address state, offering only what that page reads (its search, its choice filters).
        const searchLabels = (listPage?.search ?? []).map((name) => {
          const f = model.fields.find((x) => x.name === name);
          return (f ? (t.field(model, f).label ?? humanize(f.name)) : name).toLowerCase();
        });
        const chips = (section.filters ?? []).flatMap((name) => {
          const f = model.fields.find((x) => x.name === name);
          if (f?.type.kind !== "choice" || !listPage?.filters?.includes(name)) return [];
          const valueLabels = t.field(model, f).values ?? {};
          return [
            {
              name,
              label: t.field(model, f).label ?? humanize(f.name),
              options: f.type.values.map((v) => ({
                value: v,
                label: valueLabels[v] ?? humanize(v),
              })),
            },
          ];
        });
        const door =
          listPage && ((section.search && searchLabels.length) || chips.length)
            ? {
                to: listPage.route,
                ...(section.search && searchLabels.length
                  ? {
                      search: {
                        label: `Search ${n.pluralLabel.toLowerCase()}`,
                        placeholder: `Search by ${searchLabels.length > 1 ? `${searchLabels.slice(0, -1).join(", ")} or ${searchLabels.at(-1)}` : searchLabels[0]}`,
                      },
                    }
                  : {}),
                ...(chips.length ? { chips } : {}),
              }
            : undefined;
        // Without an article, a card opens the record on a list page visitors may open.
        const recordRoute =
          !article && listPage && auth.public.pages.includes(listPage.id)
            ? listPage.route
            : undefined;
        // The badge's words and the plural title as the model's module has them.
        if (choice || !own.title) imports.add(n.module, n.ui);
        // The badge's color by meaning, as in the model's tables.
        const tones =
          choice &&
          Object.fromEntries(
            Object.entries(ux.tones[`${model.name}.${choice.name}`] ?? {}).filter(
              ([, tone]) => tone !== "neutral",
            ),
          );
        return [
          `${open("RecordCards")}
          id=${attr(section.name)}${icon ? `\n          icon={${icon}}` : ""}${door ? `\n          door={${literal(door)}}` : ""}
          title=${own.title ? attr(own.title) : `{${n.ui}.pluralLabel}`}${
            own.text
              ? `
          text=${attr(own.text)}`
              : ""
          }
          cards={data[${JSON.stringify(section.name)}].map((row) => ({
            key: row.id,
            title: String(row.${title}),${
              article
                ? `
            href: \`${article.route === "/" ? "" : article.route}/\${encodeURIComponent(${address ? `row.${address} || ` : ""}String(row.id))}\`,`
                : recordRoute
                  ? `
            href: \`${recordRoute === "/" ? "" : recordRoute}/\${row.id}\`,`
                  : ""
            }${
              picture
                ? `
            picture: ${
              isPictures(picture)
                ? // Several pictures: the cover, the first.
                  `row.${picture.name}?.[0] ? { src: \`/files/${kebab(model.name)}/\${row.id}/${picture.name}/0\`, alt: row.${picture.name}[0].alt, width: row.${picture.name}[0].width, height: row.${picture.name}[0].height, generated: row.${picture.name}[0].generated } : undefined`
                : `row.${picture.name} ? { src: \`/files/${kebab(model.name)}/\${row.id}/${picture.name}\`, alt: row.${picture.name}.alt, width: row.${picture.name}.width, height: row.${picture.name}.height, generated: row.${picture.name}.generated } : undefined`
            },`
                : ""
            }${
              summary
                ? `
            text: row.${summary.name} ?? undefined,`
                : ""
            }${
              choice
                ? `
            badge: ${n.ui}.fields.find((f) => f.name === ${JSON.stringify(choice.name)})?.choices?.find((c) => c.value === row.${choice.name})?.label,`
                : ""
            }${
              money
                ? `
            amount: row.${money.name} == null ? undefined : new Intl.NumberFormat(undefined, { style: "currency", currency: app.currency }).format(row.${money.name} / 100),`
                : ""
            }${
              tones && Object.keys(tones).length
                ? `
            tone: (${literal(tones)} as Record<string, "success" | "warning" | "danger">)[row.${choice?.name}],`
                : ""
            }
          }))}
        />`,
        ];
      }
      case "contact": {
        imports.add("#/kit/Landing", "Contact");
        const props = (["title", "text", "address", "phone", "email", "hours", "thanks"] as const)
          .filter((k) => own[k])
          .map((k) => `\n          ${k}=${attr(own[k] as string)}`)
          .join("");
        if (!section.form) return [`${open("Contact")}${props}\n        />`];
        // The model's own form; visitors send it, and the thanks replace it.
        const model = modelNamed(ir, section.form);
        const n = names(model, t);
        imports.add(n.module, n.create).add(`${n.module}.schema`, n.schema).add(n.module, n.ui);
        imports.add("#/generated/app", "app").add("#/kit/ModelForm", "ModelForm");
        return [
          `${open("Contact")}${props}
          form={(sent, human) => (
            <ModelForm
              ui={${n.ui}}
              app={app}
              schema={${n.schema}}
              submitLabel=${attr(own.button ?? "Send")}
              onSubmit={async (values) => {
                if (human()) await ${n.create}({ data: values });
                sent();
              }}
            />
          )}
        />`,
        ];
      }
      case "gallery": {
        const pictures = (own.items ?? []).filter((i) => i.image);
        if (!pictures.length) return [];
        imports.add("#/kit/Landing", "Gallery");
        // Files in public/ are served from the site's root.
        const withRoot = (own.items ?? []).map((i) => {
          const image = i.image as { src: string; alt: string } | undefined;
          return image ? { ...i, image: { ...image, src: `/${image.src}` } } : i;
        });
        return [
          `${open("Gallery")}${own.title ? `\n          title=${attr(own.title)}` : ""}${own.text ? `\n          text=${attr(own.text)}` : ""}
          items={${literal(withRoot)}}
        />`,
        ];
      }
      case "text": {
        // A heading and paragraphs; nothing until the content file gives it words.
        if (!own.title && !own.text) return [];
        imports.add("#/kit/Landing", "TextSection");
        return [
          `${open("TextSection")}
          id=${attr(section.name)}${own.title ? `\n          title=${attr(own.title)}` : ""}${own.text ? `\n          text=${attr(own.text)}` : ""}
        />`,
        ];
      }
      case "custom": {
        // The project's own component (src/custom/sections/), with the section's texts.
        const c = section.component;
        if (!c) return [];
        imports.add(`#/custom/sections/${c}`, c);
        return [
          `<${c}
          name=${attr(section.name)}
          texts=${attr(`pages.${page.id}.${section.name}`)}${own.title ? `\n          title=${attr(own.title)}` : ""}${own.text ? `\n          text=${attr(own.text)}` : ""}
        />`,
        ];
      }
      // The footer is the layout's, wherever the section is listed.
      case "footer":
        return [];
      case "calculator": {
        if (!section.calculator) return [];
        const model = calculatorModel(`${page.id}.${section.name}`, section.calculator);
        const ui = `${camel(model.name)}Ui`;
        imports.add("#/kit/Landing", "Section").add("#/kit/Calculator", "Calculator");
        imports.add(`#/generated/${kebab(model.name)}`, ui).add("#/generated/app", "app");
        const results = t.section(page.id, section.name).results;
        return [
          `${open("Section")}
          id=${attr(section.name)}${own.title ? `\n          title=${attr(own.title)}` : ""}${own.text ? `\n          text=${attr(own.text)}` : ""}
        >
          <Calculator ui={${ui}} app={app}${results ? ` resultsTitle=${attr(results)}` : ""} />
        </Section>`,
        ];
      }
      case "callToAction":
        imports.add("#/kit/Landing", "CallToAction");
        return [
          `${open("CallToAction")}
          title=${attr(own.title ?? "Ready to get started?")}${
            own.text
              ? `
          text=${attr(own.text)}`
              : ""
          }
          link=${link(routeOf(section.button) ?? start, own.button ?? "Get started")}
        />`,
        ];
      default: {
        // Sections of items show nothing until smithable.content.yml gives them items.
        if (!own.items?.length) return [];
        const kit = (
          {
            features: "Features",
            pricing: "Pricing",
            testimonials: "Testimonials",
            faq: "Faq",
          } as Partial<Record<string, string>>
        )[section.kind];
        // A page kind's own part is the kind's page itself.
        if (!kit) return [];
        imports.add("#/kit/Landing", kit);
        const heading = own.title
          ? `
          title=${attr(own.title)}`
          : "";
        const lead = own.text
          ? `
          text=${attr(own.text)}`
          : "";
        return section.kind === "pricing"
          ? [
              `${open("Pricing")}${heading}${lead}
          plans={${items(section.name)}}
          link=${link(start, "Get started")}
        />`,
            ]
          : [
              `${open(kit)}${heading}${section.kind === "features" ? lead : ""}
          items={${items(section.name)}}
        />`,
            ];
      }
    }
  };
  if (banded)
    sections
      .filter(
        (s) => !s.own && SECTION_LOOKS[s.kind]?.band !== undefined && sectionParts(s).length > 0,
      )
      .forEach((s, i) => {
        if (i % 2 === 1) alternate.add(s.name);
      });
  const parts = sections.flatMap(sectionParts);
  const footerSection = sections.find((s) => s.kind === "footer");
  const footerTexts = footerSection ? text(footerSection.name) : undefined;
  const footer = footerSection
    ? ` footer={${literal({
        ...(footerTexts?.text ? { text: footerTexts.text } : {}),
        links: footerTexts?.items ?? [],
        texts: `pages.${page.id}.${footerSection.name}`,
      })}}`
    : "";
  if (framed === "parts") {
    // Before the kind's own part, and after it.
    const at = sections.findIndex((s) => s.own);
    const before = sections.slice(0, Math.max(at, 0)).flatMap(sectionParts);
    const after = sections.slice(at + 1).flatMap(sectionParts);
    const all = [...before, ...after];
    if (all.some((p) => p.includes("pageAccess["))) imports.add("#/generated/pages", "pageAccess");
    if (needsViewer(all)) imports.add("@tanstack/react-router", "useRouteContext");
    const viewer = needsViewer(all)
      ? `  const { viewer } = useRouteContext({ from: "__root__" });\n`
      : "";
    const part = (name: string, parts: string[]) => `
/** The page's parts ${name === "Before" ? "before" : "after"} its own. */
export function ${name}() {
${
  parts.length
    ? `${parts.some((p) => p.includes("viewer)")) ? viewer : ""}  return (
    <>
      ${parts.join("\n      ")}
    </>
  );`
    : "  return null;"
}
}
`;
    return `${HEADER}${imports.render()}${part("Before", before)}${part("After", after)}`;
  }
  // A page of sections without a hero is headed by its title, as other pages are.
  const headed = !framed && !sections.some((s) => s.kind === "hero");
  if (headed) imports.add("#/kit/AppShell", "PageHeader").add("#/generated/pages", "pageUi");
  if (!framed)
    return `${HEADER}${imports.render()}
export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}${loader}  component: ${component},
});

function ${component}() {
${loaded ? "  const data = Route.useLoaderData();\n" : ""}${needsViewer(parts) ? "  const { viewer } = Route.useRouteContext();\n" : ""}  return (
    <div data-kit="sections">${headed ? `\n      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id, 8)} />` : ""}
      ${parts.join("\n      ")}
    </div>
  );
}
`;
  // With pages in the site's frame (page-sections.md §4), one signed in is offered the workspace
  // when they may open a page of it, as the site frame does; otherwise the app's first page.
  const sited = ir.pages.some((p) => ux.pages[p.id]?.frame === "site");
  const workspace = sited && hasSignIn(auth) ? workspaceEntries(ir, ux, auth) : [];
  if (workspace.length) imports.add("#/kit/access", "allows");
  const header = workspace.length
    ? `viewer ? ((page) => (page ? { to: page.to, label: w.workspace } : undefined))(([${workspace.join(", ")}] as const).find((p) => allows(p.access, viewer))) : { to: "/sign-in", label: w.signIn }`
    : hasSignIn(auth)
      ? `viewer ? ${link(appPage?.route, "w.openApp(app.name)", true).slice(1, -1)} : { to: "/sign-in", label: w.signIn }`
      : link(appPage?.route, "w.openApp(app.name)", true).slice(1, -1);
  imports.add("#/generated/app", "app");
  // The header's look from smithable.ux.yml (HEADER_LOOKS), e.g. kept at the top as the page scrolls.
  const headerLook = Object.entries(ux.pages[page.id]?.header ?? {});
  const headerProp = headerLook.length
    ? ` header={{ ${headerLook.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")} }}`
    : "";
  return `${HEADER}${imports.render()}
export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}${loader}  component: ${component},
});

function ${component}() {
${loaded ? "  const data = Route.useLoaderData();\n" : ""}${hasSignIn(auth) ? "  const { viewer } = Route.useRouteContext();\n" : ""}  return (
    <LandingLayout appName={app.name}${t.logo} link={${header}}${headerProp}${footer} site={site}${hasSignIn(auth) ? " viewer={viewer}" : ""}>
      ${parts.join("\n      ")}
    </LandingLayout>
  );
}
`;
}

/**
 * The public site's frame, shared by its landing pages and public blogs: the menu (the pages
 * visitors may open, in the spec's order) and the contact details of the landing page's contact
 * section, for the header and the footer.
 */
export function siteModule(ir: SpecIR, t: Texts, auth: AuthIR, ux: UxIR): string {
  const landings = ir.pages.filter((p) => p.pattern.kind === "landing");
  const home = landings.find((p) => auth.public.pages.includes(p.id)) ?? landings[0];
  // With the pages in the site frame (page-sections.md §4): one visitors may not open is in the
  // menu of those who may.
  const inSite = (p: PageIR) => ux.pages[p.id]?.frame === "site";
  const menu = ir.pages
    .filter(
      (p) =>
        (auth.public.pages.includes(p.id) || inSite(p)) &&
        p.pattern.kind !== "landing" &&
        p.pattern.kind !== "legal" &&
        !["app", "none"].includes(ux.pages[p.id]?.frame ?? "") &&
        !p.route.includes("$"),
    )
    .map((p) => ({
      to: p.route,
      label: code(t.pageTitleOf(p.id)),
      ...(auth.public.pages.includes(p.id)
        ? {}
        : { access: code(`pageAccess[${JSON.stringify(p.id)}]`) }),
    }));
  const guarded = menu.some((m) => "access" in m);
  // The privacy page: a footer line, beside the cookie settings.
  const legal = ir.pages
    .filter((p) => p.pattern.kind === "legal" && auth.public.pages.includes(p.id))
    .map((p) => ({ to: p.route, label: code(t.pageTitleOf(p.id)) }));
  const section =
    home?.pattern.kind === "landing"
      ? home.pattern.sections.find((s) => s.kind === "contact")
      : undefined;
  const texts = home && section ? t.section(home.id, section.name) : undefined;
  const contact = Object.fromEntries(
    (["address", "phone", "email", "hours"] as const).flatMap((k) =>
      texts?.[k] ? [[k, texts[k] as string]] : [],
    ),
  );
  return `${HEADER}import type { LandingSite } from "#/kit/Landing";${guarded ? '\nimport { pageAccess } from "#/generated/pages";' : ""}

/** The public site's frame: the pages visitors may open, and how to reach the business. */
export const site: LandingSite = ${literal({
    ...(home ? { home: home.route } : {}),
    menu,
    ...(legal.length ? { legal } : {}),
    ...(Object.keys(contact).length ? { contact } : {}),
  })};
`;
}

/** A records section's `where` as a filter on the rows the viewer may read; none keeps them all. */
function kept(where: Condition | undefined): string {
  const conditions = Object.entries(where ?? {}).map(([key, value]) =>
    Array.isArray(value)
      ? `${JSON.stringify(value)}.includes(row.${key})`
      : `row.${key} === ${JSON.stringify(value)}`,
  );
  return conditions.length ? `.filter((row) => ${conditions.join(" && ")})` : "";
}

/** Whether the parts read the viewer (a shortcut shown only to those who may open its page). */
const needsViewer = (parts: string[]) => parts.some((p) => p.includes("viewer)"));

// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  camel,
  humanize,
  isPictures,
  kebab,
  type LandingSection,
  type PageIR,
  pageIcon,
  pascal,
  plural,
  type SpecIR,
  storesPictures,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
import { calculatorModel } from "../calculators.js";
import {
  attr,
  guard,
  HEADER,
  importList,
  indexPath,
  literal,
  modelNamed,
  names,
  type Texts,
  titleField,
} from "../shared.js";
import { LUCIDE } from "./root.js";

/** A landing page: its sections in order, with texts from smithable.content.yml or derived ones. */
export function landingRoute(
  page: PageIR,
  sections: LandingSection[],
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
  ux: UxIR,
): string {
  const text = (name: string) => t.section(page.id, name);
  const component = `${pascal(page.id)}Page`;
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage")
    .add("#/kit/Landing", "LandingLayout")
    .add("#/generated/site", "site");
  const routeOf = (id: string | undefined) => ir.pages.find((p) => p.id === id)?.route;
  // Into the app: the first page in the navigation that is not a landing page.
  const appPage = ir.navigation
    .flatMap((m) => m.pages)
    .map((id) => ir.pages.find((p) => p.id === id))
    .find((p) => p && p.pattern.kind !== "landing");
  const start = sections.map((s) => routeOf(s.button)).find(Boolean) ?? appPage?.route;
  const link = (to: string | undefined, label: string) =>
    to ? `{{ to: ${JSON.stringify(to)}, label: ${JSON.stringify(label)} }}` : "{undefined}";
  const records = sections.filter((s) => s.model);
  const loaders = [...new Set(records.map((s) => s.model as string))].map((name) => {
    const n = names(modelNamed(ir, name), t);
    imports.add(n.module, n.list);
    return `${camel(plural(name))}: (await ${n.list}()).rows`;
  });
  const items = (name: string) => literal(text(name).items ?? []);
  const sectionParts = (section: LandingSection): string[] => {
    // A section's component, opened with where its texts are kept, so the preview can change
    // them in place.
    // Its look from smithable.ux.yml (layout, image, columns, highlight), checked by its kind.
    const look = Object.entries(ux.pages[page.id]?.looks?.[section.name] ?? {})
      // The hero's "image" (which side) is imageSide: its image is the picture itself.
      .map(
        ([key, value]) =>
          `\n          ${key === "image" ? "imageSide" : key}=${typeof value === "number" ? `{${value}}` : attr(String(value))}`,
      )
      .join("");
    const open = (component: string) =>
      `<${component}\n          texts=${attr(`pages.${page.id}.${section.name}`)}${look}`;
    const own = text(section.name);
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
            own.image
              ? `
          image={{ src: ${JSON.stringify(`/${own.image.src}`)}, alt: ${JSON.stringify(own.image.alt)} }}`
              : ""
          }${
            section.shortcuts?.length
              ? `
          shortcuts={[${section.shortcuts
            .map((id) => {
              const target = ir.pages.find((p) => p.id === id) as PageIR;
              const icon = LUCIDE[pageIcon(ux, target)];
              imports.add("lucide-react", icon);
              return `{ to: ${JSON.stringify(target.route)}, label: ${JSON.stringify(t.pageTitle(id))}, icon: ${icon} }`;
            })
            .join(", ")}]}`
              : ""
          }${
            sections.slice(sections.indexOf(section) + 1).some((s) => s.kind !== "footer")
              ? `
          more`
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
        const labels =
          choice?.type.kind === "choice"
            ? Object.fromEntries(
                choice.type.values.map((v) => [
                  v,
                  t.field(model, choice).values?.[v] ?? humanize(v),
                ]),
              )
            : undefined;
        return [
          `${open("RecordCards")}
          id=${attr(section.name)}${icon ? `\n          icon={${icon}}` : ""}
          title=${attr(own.title ?? n.pluralLabel)}${
            own.text
              ? `
          text=${attr(own.text)}`
              : ""
          }
          cards={data.${camel(plural(model.name))}.slice(0, ${section.limit ?? 6}).map((row) => ({
            key: row.id,
            title: String(row.${title}),${
              article
                ? `
            href: \`${article.route === "/" ? "" : article.route}/\${encodeURIComponent(${address ? `row.${address} || ` : ""}String(row.id))}\`,`
                : ""
            }${
              picture
                ? `
            picture: ${
              isPictures(picture)
                ? // Several pictures: the cover, the first.
                  `row.${picture.name}?.[0] ? { src: \`/files/${kebab(model.name)}/\${row.id}/${picture.name}/0\`, alt: row.${picture.name}[0].alt, width: row.${picture.name}[0].width, height: row.${picture.name}[0].height } : undefined`
                : `row.${picture.name} ? { src: \`/files/${kebab(model.name)}/\${row.id}/${picture.name}\`, alt: row.${picture.name}.alt, width: row.${picture.name}.width, height: row.${picture.name}.height } : undefined`
            },`
                : ""
            }${
              summary
                ? `
            text: row.${summary.name} ?? undefined,`
                : ""
            }${
              labels && choice
                ? `
            badge: (${literal(labels)} as Record<string, string>)[row.${choice.name}],`
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
        imports.add(n.module, n.create).add(n.module, n.schema).add(n.module, n.ui);
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
        const kit = {
          features: "Features",
          pricing: "Pricing",
          testimonials: "Testimonials",
          faq: "Faq",
        }[section.kind];
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
  const header = hasSignIn(auth)
    ? `viewer ? ${link(appPage?.route, `Open ${ir.app.name}`).slice(1, -1)} : { to: "/sign-in", label: "Sign in" }`
    : link(appPage?.route, `Open ${ir.app.name}`).slice(1, -1);
  return `${HEADER}${imports.render()}
export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${loaders.length ? `  loader: async () => ({ ${loaders.join(", ")} }),\n` : ""}  component: ${component},
});

function ${component}() {
${loaders.length ? "  const data = Route.useLoaderData();\n" : ""}${hasSignIn(auth) ? "  const { viewer } = Route.useRouteContext();\n" : ""}  return (
    <LandingLayout appName=${attr(ir.app.name)} link={${header}}${footer} site={site}>
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
export function siteModule(ir: SpecIR, t: Texts, auth: AuthIR): string {
  const landings = ir.pages.filter((p) => p.pattern.kind === "landing");
  const home = landings.find((p) => auth.public.pages.includes(p.id)) ?? landings[0];
  const menu = ir.pages
    .filter(
      (p) =>
        auth.public.pages.includes(p.id) && p.pattern.kind !== "landing" && !p.route.includes("$"),
    )
    .map((p) => ({ to: p.route, label: t.pageTitle(p.id) }));
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
  return `${HEADER}import type { LandingSite } from "#/kit/Landing";

/** The public site's frame: the pages visitors may open, and how to reach the business. */
export const site: LandingSite = ${literal({
    ...(home ? { home: home.route } : {}),
    menu,
    ...(Object.keys(contact).length ? { contact } : {}),
  })};
`;
}

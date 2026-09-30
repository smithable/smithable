// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  camel,
  humanize,
  type LandingSection,
  type PageIR,
  pascal,
  plural,
  type SpecIR,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
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

/** A landing page: its sections in order, with texts from smithable.content.yml or derived ones. */
export function landingRoute(
  page: PageIR,
  sections: LandingSection[],
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
): string {
  const text = (name: string) => t.section(page.id, name);
  const component = `${pascal(page.id)}Page`;
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage")
    .add("#/kit/Landing", "LandingLayout");
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
    const open = (component: string) =>
      `<${component}\n          texts=${attr(`pages.${page.id}.${section.name}`)}`;
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
          id=${attr(section.name)}
          title=${attr(own.title ?? n.pluralLabel)}${
            own.text
              ? `
          text=${attr(own.text)}`
              : ""
          }
          cards={data.${camel(plural(model.name))}.slice(0, ${section.limit ?? 6}).map((row) => ({
            key: row.id,
            title: String(row.${title}),${
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
      // The footer is the layout's, wherever the section is listed.
      case "footer":
        return [];
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
    <LandingLayout appName=${attr(ir.app.name)} link={${header}}${footer}>
      ${parts.join("\n      ")}
    </LandingLayout>
  );
}
`;
}

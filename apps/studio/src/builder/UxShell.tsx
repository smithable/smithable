import type { PageIR, UxIR } from "@smithable/core";
import type { Run } from "./ChangeForms";
import { UxChoice } from "./UxChoice";

export function UxShell({ ux, page, run }: { ux: UxIR; page?: PageIR; run: Run }) {
  const hero =
    page?.pattern.kind === "landing"
      ? page.pattern.sections.find((s) => s.kind === "hero")
      : undefined;
  const layout = hero && ux.pages[page?.id ?? ""]?.looks?.[hero.name]?.layout;
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">App shell</legend>
        <UxChoice id="navigation" data={ux} run={run} />
        <UxChoice id="chrome" data={ux} run={run} />
        <UxChoice id="menuActive" data={ux} run={run} />
      </fieldset>
      {page?.pattern.kind === "landing" && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Page shell</legend>
          <UxChoice id="width" data={ux.pages[page.id] ?? {}} page={page.id} run={run} />
          <UxChoice id="headerPosition" data={ux.pages[page.id] ?? {}} page={page.id} run={run} />
          <UxChoice
            id="headerOver"
            data={ux.pages[page.id] ?? {}}
            page={page.id}
            context={{ kind: "landing", headerOverHero: layout === "cover" || layout === "photo" }}
            run={run}
          />
        </fieldset>
      )}
    </>
  );
}

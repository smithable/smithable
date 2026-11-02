// Project snapshots are read-only. Draft themes are substituted only in memory.
import {
  BUILT_IN_THEMES,
  type LookReset,
  lookAuthorship,
  type ProjectLook,
  parseTheme,
  resolveLook,
  sameLookTheme,
  stageThemeSelection,
  type ThemeIR,
  validateUx,
} from "@smithable/core";
import { themeText } from "./theme-text";

function read(project: ProjectLook, themes = project.themes) {
  const { ux, diagnostics } = validateUx(
    { path: "smithable.ux.yml", text: project.uxText },
    project.ir,
    themes,
    project.auth,
  );
  if (!ux) throw new Error(diagnostics.map((d) => d.message).join("\n"));
  return ux;
}

export function openProjectLook(project: ProjectLook, page: string | null = project.page ?? null) {
  const ux = read(project);
  const look = resolveLook(ux, project.themes, page ?? undefined, lookAuthorship(project.uxText));
  const text =
    project.themeFiles.find((file) => file.name === look.theme.name)?.text ?? themeText(look.theme);
  return { look, text };
}

export function previewProjectLook(
  project: ProjectLook,
  draft: ThemeIR,
  targetPage: string | null = project.page ?? null,
  activePage: string | null = targetPage,
  resets: LookReset[] = [],
) {
  const initial = openProjectLook(project, targetPage);
  const initialTheme = parseTheme({ path: "initial.yml", text: initial.text }).theme;
  if (!resets.length && initialTheme && sameLookTheme(initialTheme, draft)) {
    const ux = read(project);
    return {
      ux,
      themes: project.themes,
      draftName: initial.look.theme.name,
      look: resolveLook(
        ux,
        project.themes,
        activePage ?? undefined,
        lookAuthorship(project.uxText),
      ),
    };
  }
  // A built-in edit is previewed as an isolated in-memory fork until a project name is chosen.
  let name = draft.name;
  if (BUILT_IN_THEMES.some((theme) => theme.name === name)) {
    name = "draft-preview";
    while (project.themes.some((theme) => theme.name === name)) name += "-copy";
  }
  const themes = [...project.themes.filter((theme) => theme.name !== name), { ...draft, name }];
  const staged = stageThemeSelection(
    { ...project, themes },
    {
      preset: name,
      ...(targetPage ? { page: targetPage } : {}),
      resets,
    },
  );
  const ux = staged.ux;
  return {
    ux,
    themes,
    draftName: name,
    look: resolveLook(ux, themes, activePage ?? undefined, lookAuthorship(staged.uxText)),
  };
}

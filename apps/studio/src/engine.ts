// The Smithable engine in the browser tab (ARCHITECTURE §10.2): the spec, validated and
// summarized here, instantly and without a round trip to the daemon.
import {
  type AuthIR,
  type ContentIR,
  type Diagnostic,
  EDITABLE_FILES,
  type EditableFile,
  resolvePlugin,
  type SpecIR,
  type SpecPlugin,
  type ThemeIR,
  type UxIR,
  validateAuth,
  validateContent,
  validateContext,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "./api";

/**
 * The problems of one of the spec files as edited in the tab: its own, and what the edit does to
 * smithable.yml (a role it names gone). Each says which file it is in.
 */
export function checkFile(
  files: Project["files"],
  file: EditableFile,
  text: string,
  plugins: SpecPlugin[] = [],
  themes: ThemeIR[] = [],
): { diagnostics: Diagnostic[]; roles?: string[] } {
  if (file === "smithable.yml") {
    const { diagnostics, auth } = readSpec(files, text, plugins, themes);
    return { diagnostics, ...(auth ? { roles: auth.roles.map((r) => r.name) } : {}) };
  }
  const key = EDITABLE_FILES[file];
  const spec = readSpec({ ...files, [key]: text }, undefined, plugins, themes);
  const own =
    file === "smithable.auth.yml"
      ? validateAuth({ path: file, text }, spec.ir).diagnostics
      : file === "smithable.context.yml"
        ? validateContext({ path: file, text })
        : !spec.ir
          ? []
          : file === "smithable.ux.yml"
            ? validateUx({ path: file, text }, spec.ir, themes).diagnostics
            : validateContent({ path: file, text }, spec.ir).diagnostics;
  return { diagnostics: [...own, ...spec.diagnostics.filter((d) => d.severity === "error")] };
}

export interface Spec {
  ir?: SpecIR;
  auth?: AuthIR;
  content?: ContentIR;
  /** smithable.ux.yml: the theme, icons, columns and tones (Builder's Look tab). */
  ux?: UxIR;
  /** The project's plugins, loaded in this tab. */
  plugins?: SpecPlugin[];
  /** What validation says of smithable.yml, notes (advice with its fix) among them. */
  diagnostics?: Diagnostic[];
}

export function readSpec(
  files: Project["files"],
  specText = files.spec ?? "",
  plugins: SpecPlugin[] = [],
  themes: ThemeIR[] = [],
): Spec & { diagnostics: Diagnostic[] } {
  const auth = files.auth
    ? validateAuth({ path: "smithable.auth.yml", text: files.auth }).auth
    : undefined;
  const roles = auth?.roles.map((r) => r.name);
  const { ir, diagnostics } = validateSpec(
    { path: "smithable.yml", text: specText },
    { ...(roles ? { roles } : {}), plugins },
  );
  const content =
    ir && files.content
      ? validateContent({ path: "smithable.content.yml", text: files.content }, ir).content
      : undefined;
  const ux = ir
    ? validateUx({ path: "smithable.ux.yml", text: files.ux ?? "" }, ir, themes).ux
    : undefined;
  return {
    ...(ir ? { ir } : {}),
    ...(auth ? { auth } : {}),
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
    plugins,
    diagnostics,
  };
}

/**
 * The project's plugins (ARCHITECTURE §5.1), imported from Studio's server: each is one
 * module without imports, so the tab runs the same code as the CLI. Undefined while loading.
 */
function usePlugins(declared: Project["plugins"] = []): SpecPlugin[] | undefined {
  // The list as a string: a refresh brings a new but equal list, which loads nothing.
  const key = JSON.stringify(declared);
  const [loaded, setLoaded] = useState<{ key: string; plugins: SpecPlugin[] }>();
  useEffect(() => {
    let current = true;
    void Promise.all(
      (JSON.parse(key) as Project["plugins"]).map(async (p) =>
        resolvePlugin(
          (
            (await import(/* @vite-ignore */ `/api/plugins/${p.name}.mjs?v=${p.version}`)) as {
              default: unknown;
            }
          ).default,
          p.name,
        ),
      ),
    ).then((plugins) => current && setLoaded({ key, plugins }));
    return () => {
      current = false;
    };
  }, [key]);
  if (declared.length === 0) return [];
  return loaded?.key === key ? loaded.plugins : undefined;
}

export function useSpec(project?: Pick<Project, "files" | "plugins" | "ownThemes">): Spec {
  const plugins = usePlugins(project?.plugins);
  const files = project?.files;
  const themes = project?.ownThemes;
  // Until the plugins are in, nothing is validated: their sections would look unknown.
  return useMemo(
    () => (files && plugins ? readSpec(files, undefined, plugins, themes) : {}),
    [files, plugins, themes],
  );
}

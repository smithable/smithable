// The Smithable engine in the browser tab (ARCHITECTURE §10.2): the spec, validated and
// summarized here, instantly and without a round trip to the daemon.
import {
  type AuthIR,
  type ContentIR,
  type Diagnostic,
  type SpecIR,
  type SpecPlugin,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "./api";

export interface Spec {
  ir?: SpecIR;
  auth?: AuthIR;
  content?: ContentIR;
  /** The project's plugins, loaded in this tab. */
  plugins?: SpecPlugin[];
}

export function readSpec(
  files: Project["files"],
  specText = files.spec ?? "",
  plugins: SpecPlugin[] = [],
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
  return {
    ...(ir ? { ir } : {}),
    ...(auth ? { auth } : {}),
    ...(content ? { content } : {}),
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
      (JSON.parse(key) as Project["plugins"]).map(
        async (p) =>
          (
            (await import(/* @vite-ignore */ `/api/plugins/${p.name}.mjs?v=${p.version}`)) as {
              default: SpecPlugin;
            }
          ).default,
      ),
    ).then((plugins) => current && setLoaded({ key, plugins }));
    return () => {
      current = false;
    };
  }, [key]);
  if (declared.length === 0) return [];
  return loaded?.key === key ? loaded.plugins : undefined;
}

export function useSpec(project?: Pick<Project, "files" | "plugins">): Spec {
  const plugins = usePlugins(project?.plugins);
  const files = project?.files;
  // Until the plugins are in, nothing is validated: their sections would look unknown.
  return useMemo(
    () => (files && plugins ? readSpec(files, undefined, plugins) : {}),
    [files, plugins],
  );
}

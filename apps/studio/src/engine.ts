// The Smithable engine in the browser tab (ARCHITECTURE §10.2): the spec, validated and
// summarized here, instantly and without a round trip to the daemon.
import {
  type AuthIR,
  type ContentIR,
  type Diagnostic,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { useMemo } from "react";
import type { Project } from "./api";

export interface Spec {
  ir?: SpecIR;
  auth?: AuthIR;
  content?: ContentIR;
}

export function readSpec(
  files: Project["files"],
  specText = files.spec ?? "",
): Spec & { diagnostics: Diagnostic[] } {
  const auth = files.auth
    ? validateAuth({ path: "smithable.auth.yml", text: files.auth }).auth
    : undefined;
  const roles = auth?.roles.map((r) => r.name);
  const { ir, diagnostics } = validateSpec(
    { path: "smithable.yml", text: specText },
    roles ? { roles } : {},
  );
  const content =
    ir && files.content
      ? validateContent({ path: "smithable.content.yml", text: files.content }, ir).content
      : undefined;
  return {
    ...(ir ? { ir } : {}),
    ...(auth ? { auth } : {}),
    ...(content ? { content } : {}),
    diagnostics,
  };
}

export function useSpec(files: Project["files"]): Spec {
  return useMemo(() => readSpec(files), [files]);
}

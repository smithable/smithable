// The line that says a change needs custom code (Johan, 2026-10-11): the file a model writes,
// that Smithable never overwrites it, and so that it is the person's to keep working.
import { kebab } from "@smithable/core";
import { CUSTOM_CODE_DOCS } from "../docs";

/**
 * The file a change leads a model to write, when it needs custom code: a query's, or a custom
 * action's (an action without `on`). Smithable never overwrites it.
 */
export function customFile(op: string, args: Record<string, unknown>): string[] {
  if (op === "addQuery" && typeof args.query === "string")
    return [`src/custom/queries/${kebab(args.query)}.ts`];
  if (op === "addAction" && args.on === undefined && typeof args.action === "string")
    return [`src/custom/actions/${kebab(args.action)}.ts`];
  return [];
}

/** The one line that says a change needs code, and its one disadvantage, with the docs' answer. */
export function CustomCode({ files }: { files: string[] }) {
  return (
    <p className="text-xs text-muted">
      This needs custom code: a model writes {files.join(" and ")}, which Smithable never
      overwrites, so that file is yours to keep working.{" "}
      <a href={CUSTOM_CODE_DOCS} target="_blank" rel="noreferrer" className="text-accent underline">
        About custom code
      </a>
    </p>
  );
}

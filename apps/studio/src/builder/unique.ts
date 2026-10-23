// Where a field's value is unique, as the field forms offer it (docs/design/uniqueness.md).
import type { FieldIR } from "@smithable/core";

/**
 * Where a value is unique (docs/design/uniqueness.md): "yes" as the access says, the shorthand's
 * word; owner and app outright, the field's own key, set by setFieldRules.
 */
export type UniqueChoice = "no" | "yes" | "owner" | "app";

export const UNIQUE: [UniqueChoice, string][] = [
  ["no", "Not unique"],
  ["yes", "Unique"],
  ["owner", "Unique per owner"],
  ["app", "Unique in the whole app"],
];

export const uniqueOf = (unique: FieldIR["unique"] | undefined): UniqueChoice =>
  unique === true ? "yes" : unique ? unique : "no";

/**
 * The setFieldRules --unique a choice needs beside the shorthand: when it moves to or from a
 * scope, which only the field's key holds; undefined when the shorthand says it all.
 */
export function uniqueRule(choice: UniqueChoice, current?: FieldIR["unique"]): string | undefined {
  const was = uniqueOf(current);
  if (
    choice === was ||
    (choice !== "owner" && choice !== "app" && was !== "owner" && was !== "app")
  )
    return undefined;
  return { no: "false", yes: "true", owner: "owner", app: "app" }[choice];
}

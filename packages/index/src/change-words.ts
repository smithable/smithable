import {
  type ContentIR,
  type FieldIR,
  humanize,
  type ModelIR,
  parseFieldShorthand,
  plural,
  type SpecIR,
} from "@smithable/core";
import { whoCan, wordsFor } from "./summary.js";

const VERBS: Record<string, string> = {
  read: "see",
  create: "add",
  write: "change",
  delete: "delete",
};

/**
 * A change in the words of the Builder's summary ("Customers: added a website (a web
 * address)"), for the change list and proposals, instead of the operation's own description
 * ("Add field website (url) to Customer"). Undefined where the operation's description is
 * already plain, or the change no longer fits the app (e.g. its model is gone).
 */
export function describeChange(
  op: string,
  args: Record<string, unknown>,
  ir: SpecIR,
  content?: ContentIR,
): string | undefined {
  const w = wordsFor(ir, content);
  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "");
  const model = ir.models.find((m) => m.name === str("model"));
  const fieldText = (m: ModelIR, name: string) => {
    const f = m.fields.find((x) => x.name === name);
    return f ? w.fieldLabel(m, f) : humanize(name).toLowerCase();
  };
  /** A field as the summary lists it, from the shorthand an operation gives. */
  const item = (m: ModelIR, name: string, type: string) => {
    const parsed = parseFieldShorthand(type);
    if (!parsed.ok) return undefined;
    const field: FieldIR = {
      name,
      type: parsed.value.type,
      required: parsed.value.required,
      unique: parsed.value.unique,
      ...(parsed.value.defaultText !== undefined ? { default: parsed.value.defaultText } : {}),
    } as FieldIR;
    return w.item(m, field);
  };
  switch (op) {
    case "addField": {
      const line = model && item(model, str("field"), str("type"));
      return line && `${w.pluralLabel(model)}: added ${line}`;
    }
    case "changeField": {
      const line = model && item(model, str("field"), str("type"));
      return line && `${w.pluralLabel(model)}: now ${line}`;
    }
    case "removeField":
      return model && `${w.pluralLabel(model)}: removed the ${fieldText(model, str("field"))}`;
    case "renameField":
      return (
        model &&
        `${w.pluralLabel(model)}: the ${fieldText(model, str("from"))} is now called ${humanize(str("to")).toLowerCase()}`
      );
    case "addModel": {
      const plural = model ? w.pluralLabel(model) : humanize(str("model"));
      return `Added a new kind of record: ${plural.toLowerCase()}`;
    }
    case "addPage":
      return `Added the ${humanize(str("page"))} page${model ? `, listing ${w.pluralLabel(model).toLowerCase()}` : ""}`;
    case "removePage":
      return `Removed the ${humanize(str("page"))} page`;
    case "addLandingPage":
      return `Added the ${humanize(str("page"))} page, a landing page for visitors`;
    case "addSection":
      return `Added a ${humanize(str("section")).toLowerCase()} section to the ${humanize(str("page"))} page`;
    case "removeSection":
      return `Removed the ${humanize(str("section")).toLowerCase()} section from the ${humanize(str("page"))} page`;
    case "setAccess": {
      const [kind, name = ""] = str("target").split(":");
      const [modelName = "", verb = ""] = name.split(".");
      const target = ir.models.find((m) => m.name === modelName);
      const roles = Array.isArray(args.roles) ? (args.roles as string[]) : [];
      if (kind !== "model" || !target || !VERBS[verb]) return undefined;
      const things = w.pluralLabel(target).toLowerCase();
      return roles.length
        ? whoCan(roles, VERBS[verb], things)
        : `Everyone with access can ${VERBS[verb]} ${things} again`;
    }
    case "nameRecords": {
      const one = str("one").trim();
      const several = str("several").trim() || plural(one);
      return `${humanize(str("model"))} records are now called ${several.toLowerCase()} (one ${one.toLowerCase()})`;
    }
    case "setText":
      return str("text") ? `Changed a text to “${str("text")}”` : "Put back a text's default";
  }
  return undefined;
}

// A standard action's question before it runs (docs/design/record-documents.md §6): the content
// file's `confirm` text, filled from the record as it is before the action. The person pressing
// the button is on the record already, so its fields and worked-out values may be in it; a link,
// a pay page or a name are a mail's and are not.
import type { SpecIR, StandardActionIR } from "./ir.js";
import { notSendable } from "./sections/outgoing.js";
import { didYouMean } from "./suggest.js";

const MAIL_ONLY = ["view", "pay", "link", "by", "before"];

/** What is wrong with one placeholder of an action's confirm text, if anything. */
export function confirmPlaceholderProblem(
  path: string,
  action: StandardActionIR,
  ir: SpecIR,
): { message: string; hint?: string } | undefined {
  const model = ir.models.find((m) => m.name === action.on);
  if (!model) return undefined;
  const offered = () => [
    "title",
    ...model.fields.filter((f) => !notSendable(f)).map((f) => f.name),
  ];
  const parts = path.split(".");
  if (parts.length > 2 || parts.some((p) => !p))
    return {
      message: `"{${path}}" is not a field, or a reference's field one hop away, like {number} or {client.email}.`,
    };
  const [first = "", second] = parts;
  if (MAIL_ONLY.includes(first))
    return {
      message: `"{${path}}" belongs in a mail's text; the question is asked of the person pressing the button.`,
      hint: `The placeholders here: ${offered().join(", ")}.`,
    };
  if (first === "title" && second === undefined) return undefined;
  const f = model.fields.find((x) => x.name === first);
  if (!f)
    return {
      message: `${model.name} has no field named "${first}".`,
      hint: didYouMean(first, offered()) ?? `The placeholders here: ${offered().join(", ")}.`,
    };
  const why = notSendable(f);
  if (why) return { message: `${model.name}.${first} ${why}, so it cannot fill a placeholder.` };
  if (second === undefined) return undefined;
  if (f.type.kind !== "relation")
    return {
      message: `${model.name}.${first} is not a reference to one record, so "{${path}}" leads nowhere.`,
    };
  const target = f.type.model;
  const other = ir.models.find((m) => m.name === target);
  const g = other?.fields.find((x) => x.name === second);
  if (!other || !g) {
    const hint =
      other &&
      didYouMean(
        second,
        other.fields.map((x) => x.name),
      );
    return { message: `${target} has no field named "${second}".`, ...(hint ? { hint } : {}) };
  }
  const whyNot = notSendable(g);
  return whyNot
    ? { message: `${other.name}.${second} ${whyNot}, so it cannot fill a placeholder.` }
    : undefined;
}

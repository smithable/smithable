import { ACCESS_OPERATIONS } from "../ir.js";
import { humanize, plural } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { didYouMean } from "../suggest.js";

const VERBS: Record<string, string> = {
  read: "see",
  create: "create",
  update: "change",
  delete: "delete",
};

/** "model:Order.delete" → "delete orders", "page:class-types" → "open the Class types page". */
function accessText(target: string): string {
  const [kind, name = ""] = target.split(":");
  if (kind === "page") return `open the ${humanize(name)} page`;
  if (kind === "action") return `use ${humanize(name)}`;
  const [model = "", op = ""] = name.split(".");
  return `${VERBS[op] ?? op} ${humanize(plural(model)).toLowerCase()}`;
}

const setAccess: Operation<{ target: string; roles?: string[] }> = {
  name: "setAccess",
  summary: "Set which roles may do something, or return it to the default access.",
  schema: {
    type: "object",
    required: ["target"],
    additionalProperties: false,
    properties: {
      target: refTo(
        { ref: "accessTarget", label: "Who can" },
        {
          description:
            'e.g. "model:Customer.delete", "page:class-types" or "action:mergeCustomers".',
        },
      ),
      roles: refTo(
        { ref: "role", target: "target", label: "Only" },
        {
          description:
            'Roles from smithable.auth.yml; for models also "owner". None returns to the default.',
        },
        true,
      ),
    },
  },
  positional: ["target", "...roles"],
  describe: ({ target, roles }) => {
    const what = accessText(target);
    if (!roles?.length) return `Let the default access decide who may ${what}`;
    const who = roles.map((r) => (r === "owner" ? "the owner" : r));
    return `Only ${who.length > 1 ? `${who.slice(0, -1).join(", ")} and ${who.at(-1)}` : who[0]} may ${what}`;
  },
  destructive: () => false,
  apply({ spec }, { target, roles = [] }, ir) {
    const [kind, name = ""] = target.split(":");
    let path: string[];
    if (kind === "model") {
      const [model = "", op = ""] = name.split(".");
      if (!ir.models.some((m) => m.name === model)) {
        throw new OperationError(
          `There is no model named "${model}". ${
            didYouMean(
              model,
              ir.models.map((m) => m.name),
            ) ?? ""
          }`.trim(),
        );
      }
      if (!(ACCESS_OPERATIONS as readonly string[]).includes(op)) {
        throw new OperationError(
          `Say which operation: ${ACCESS_OPERATIONS.map((o) => `model:${model}.${o}`).join(", ")}.`,
        );
      }
      path = ["models", model, "access", op];
    } else if (kind === "page") {
      if (!ir.pages.some((p) => p.id === name)) {
        throw new OperationError(
          `There is no page named "${name}". ${
            didYouMean(
              name,
              ir.pages.map((p) => p.id),
            ) ?? ""
          }`.trim(),
        );
      }
      path = ["pages", name, "access"];
    } else if (kind === "action") {
      if (!ir.actions.some((a) => a.name === name)) {
        throw new OperationError(
          `There is no action named "${name}". ${
            didYouMean(
              name,
              ir.actions.map((a) => a.name),
            ) ?? ""
          }`.trim(),
        );
      }
      path = ["actions", name, "allow"];
    } else {
      throw new OperationError(
        `"${target}" is not a model operation, page or action. Use e.g. "model:Customer.delete", "page:customers" or "action:mergeCustomers".`,
      );
    }
    if (roles.length === 0) {
      // Back to the default: remove the exception, and a model's access if nothing is left.
      if (spec.has(path)) spec.removeAndPrune(path, 2);
    } else if (spec.has(path)) {
      spec.set(path, roles);
    } else {
      spec.add(path.slice(0, -1), path[path.length - 1] as string, roles);
    }
    return [];
  },
};

export const accessOperations: AnyOperation[] = [setAccess];

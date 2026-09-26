import { ACCESS_OPERATIONS } from "../ir.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
import { didYouMean } from "../suggest.js";

const setAccess: Operation<{ target: string; roles?: string[] }> = {
  name: "setAccess",
  summary: "Set which roles may do something, or return it to the default access.",
  schema: {
    type: "object",
    required: ["target"],
    additionalProperties: false,
    properties: {
      target: {
        type: "string",
        description: 'e.g. "model:Customer.delete", "page:class-types" or "action:mergeCustomers".',
      },
      roles: {
        type: "array",
        items: { type: "string" },
        description:
          'Roles from smithable.auth.yml; for models also "owner". None returns to the default.',
      },
    },
  },
  positional: ["target", "...roles"],
  describe: ({ target, roles }) =>
    roles?.length
      ? `Allow ${target} for ${roles.join(", ")}`
      : `Use the default access for ${target}`,
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

import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { FIELD_NAME_PATTERN } from "./names.js";

const fields = (description: string) => ({
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: { type: "string" },
  description,
});

/**
 * Adds a custom action: what it takes and returns, and who may run it. Its behaviour is code in
 * src/custom/actions/, which `smithable code` starts as a stub.
 */
const addAction: Operation<{
  action: string;
  input?: Record<string, string>;
  output?: Record<string, string>;
  allow?: string[];
  intent?: string;
}> = {
  name: "addAction",
  summary: "Add a custom action (its behaviour is code in src/custom/actions/).",
  schema: {
    type: "object",
    required: ["action"],
    additionalProperties: false,
    properties: {
      action: { type: "string", minLength: 1, description: "camelCase name, e.g. mergeCustomers." },
      input: fields('The values it needs, as field shorthand, e.g. { keep: "Customer!" }.'),
      output: fields("The values it returns, if any."),
      allow: refTo(
        { ref: "role", label: "Who may run it" },
        { description: "Roles from smithable.auth.yml; none means the default access." },
        true,
      ),
      intent: { type: "string", description: "What it is for, in a sentence." },
    },
  },
  positional: ["action", "...input"],
  describe: ({ action }) => `Add the custom action ${action}`,
  destructive: () => false,
  apply({ spec }, { action, input = {}, output = {}, allow = [], intent }, ir) {
    if (!FIELD_NAME_PATTERN.test(action))
      throw new OperationError(
        `Action name "${action}" must start with a lowercase letter and use only letters and digits, like "mergeCustomers".`,
      );
    if (ir.actions.some((a) => a.name === action))
      throw new OperationError(`Action "${action}" already exists.`);
    spec.add(["actions"], action, {
      custom: true,
      ...(Object.keys(input).length ? { input } : {}),
      ...(Object.keys(output).length ? { output } : {}),
      ...(allow.length ? { allow } : {}),
      ...(intent?.trim() ? { intent: intent.trim() } : {}),
    });
    return [];
  },
};

export const actionOperations: AnyOperation[] = [addAction];

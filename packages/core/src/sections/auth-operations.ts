import { type AnyOperation, type Operation, OperationError } from "../operation.js";

const setSignUp: Operation<{ who: "anyone" | "invited" }> = {
  name: "setSignUp",
  summary:
    "Choose who may sign in: anyone with an account at the sign-in provider (within allowedDomains, when set), or only invited people and the admins (needs a users page).",
  schema: {
    type: "object",
    required: ["who"],
    additionalProperties: false,
    properties: {
      who: {
        type: "string",
        enum: ["anyone", "invited"],
        description: "anyone: open sign-up; invited: only invited addresses and the admins.",
      },
    },
  },
  positional: ["who"],
  describe: ({ who }) =>
    who === "invited" ? "Only invited people may sign in" : "Anyone may sign up",
  destructive: () => false,
  apply({ auth }, { who }) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (auth.get(["signIn"]) === "none")
      throw new OperationError("This app has no sign-in, so nobody signs up.");
    const path = ["signIn", "selfSignUp"];
    if (who === "anyone") {
      if (auth.has(path)) auth.removeAndPrune(path, 1);
    } else if (auth.has(path)) {
      auth.set(path, false);
    } else {
      auth.add(["signIn"], "selfSignUp", false);
    }
    return [];
  },
};

export const authOperations: AnyOperation[] = [setSignUp];

import type { LineCounter } from "yaml";
import { type At, ParseContext } from "./context.js";
import type { PreparedUxDefaults } from "./look-defaults.js";
export class UxDefaultContext extends ParseContext {
  prepared?: PreparedUxDefaults;
  constructor(file: string, lines: LineCounter) {
    super(file, lines);
  }
  override error(at: At, code: string, message: string, hint?: string): void {
    const fact = at && typeof at === "object" ? this.prepared?.nodes.get(at) : undefined;
    if (fact) {
      if (!this.prepared?.skipped.has(fact)) this.prepared?.skipped.set(fact, message);
      return;
    }
    super.error(at, code, message, hint);
  }
  override warning(at: At, code: string, message: string, hint?: string): void {
    const fact = at && typeof at === "object" ? this.prepared?.nodes.get(at) : undefined;
    // Unusable inherited columns can be omitted; contrast warnings stay warnings.
    if (fact && code === "invalid-value") {
      if (!this.prepared?.skipped.has(fact)) this.prepared?.skipped.set(fact, message);
      return;
    }
    super.warning(at, code, message, hint);
  }
}

import type { LineCounter } from "yaml";
import { type At, ParseContext } from "./context.js";
import type { PreparedUxDefaults } from "./look-defaults.js";

/**
 * The warnings that make an inherited default unusable where it lands (an unusable column, a
 * stage whose records the page lists again). Any other warning on an inherited node stays a
 * warning: a band's contrast, a thread's ambiguity; the default is kept.
 */
const SKIPPING = new Set(["invalid-value", "stage-repeats"]);
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
    // A warning on an inherited node has no line in the file to stand on: a default it makes
    // unusable here is skipped with the warning as its reason.
    if (fact && SKIPPING.has(code)) {
      if (!this.prepared?.skipped.has(fact)) this.prepared?.skipped.set(fact, message);
      return;
    }
    super.warning(at, code, message, hint);
  }
  /** Whether `at` is a node a theme's default added, with no line in the file. */
  inherited(at: At): boolean {
    return Boolean(at && typeof at === "object" && this.prepared?.nodes.get(at));
  }
}

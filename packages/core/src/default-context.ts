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
    // A warning on an inherited node has no line in the file to stand on: the default is unusable
    // here and is skipped with the warning as its reason (an unusable column, a stage whose
    // records the page lists again). A band's contrast stays a warning: the band is drawn.
    if (fact && code !== "band-contrast") {
      if (!this.prepared?.skipped.has(fact)) this.prepared?.skipped.set(fact, message);
      return;
    }
    super.warning(at, code, message, hint);
  }
}

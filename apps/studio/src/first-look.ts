/** A picker owns one change at a time. Its exact revision travels with every write. */
export interface LookChange {
  ok: boolean;
  output: string;
  change?: string;
  revision?: string;
}

/**
 * A look panel's own changes, one per setting at most: choosing a setting again undoes its
 * previous change first when that change is the latest, and Cancel undoes them newest first.
 * Every write carries the exact revision, so another writer's change in between is refused,
 * never undone or guessed at.
 */
export class LookSession {
  private turn: Promise<unknown> = Promise.resolve();
  private changes: { key: string; change: string; before: string | undefined }[] = [];
  private revision: string;
  private readonly values: Record<string, string | undefined>;
  private refusal?: string;
  private closing = false;

  constructor(
    opening: { values: Record<string, string | undefined>; revision: string },
    private readonly undo: (change: string, revision: string) => Promise<LookChange>,
  ) {
    this.revision = opening.revision;
    this.values = { ...opening.values };
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.turn.then(work);
    this.turn = next.catch(() => undefined);
    return next;
  }

  private async undoLatest(): Promise<void> {
    const latest = this.changes.at(-1);
    if (!latest) return;
    const result = await this.undo(latest.change, this.revision);
    if (!result.ok || !result.revision) throw new Error(result.output);
    this.changes.pop();
    this.revision = result.revision;
    this.values[latest.key] = latest.before;
  }

  /** An opening value read after the session began (the picture style), unless already changed. */
  know(key: string, value: string): void {
    if (!this.changes.some((change) => change.key === key)) this.values[key] = value;
  }

  /** Whether an uncertain write stopped this session: it changes and undoes nothing more. */
  get refused(): boolean {
    return this.refusal !== undefined;
  }

  /** Whether this session has changes of its own that Cancel would undo. */
  get changed(): boolean {
    return this.changes.length > 0;
  }

  set(key: string, value: string, apply: (revision: string) => Promise<LookChange>): Promise<void> {
    if (this.closing) return Promise.resolve();
    return this.enqueue(async () => {
      if (this.refusal) throw new Error(this.refusal);
      if (this.values[key] === value) return;
      let result: LookChange;
      try {
        if (this.changes.at(-1)?.key === key) await this.undoLatest();
        if (this.values[key] === value) return;
        result = await apply(this.revision);
      } catch (error) {
        this.refusal = error instanceof Error ? error.message : String(error);
        throw error;
      }
      // A refused operation changed nothing (an offline picture library): the session goes on.
      // One that says it changed something without its change and revision cannot be undone.
      if (!result.ok) throw new Error(result.output);
      if (!result.change || !result.revision) {
        this.refusal = result.output;
        throw new Error(result.output);
      }
      this.changes.push({ key, change: result.change, before: this.values[key] });
      this.revision = result.revision;
      this.values[key] = value;
    });
  }

  finish(keep: boolean, apply?: (revision: string) => Promise<LookChange>): Promise<void> {
    this.closing = true;
    return this.enqueue(async () => {
      try {
        if (keep) {
          if (apply) {
            const result = await apply(this.revision);
            if (!result.ok) throw new Error(result.output);
          }
          return;
        }
        // A refused/uncertain mutation is never guessed at or undone by a generic Undo.
        if (this.refusal) throw new Error(this.refusal);
        while (this.changes.length) await this.undoLatest();
      } catch (error) {
        this.closing = false;
        throw error;
      }
    });
  }
}

/**
 * Keep in the first-look picker (T1164): a choice there was only tried on in the preview, so Keep
 * makes the look's real changes, one operation each, every one on the revision the last left.
 * The picture style goes first: it needs the picture library and is the one likely to be refused.
 */
export async function keepLook(
  revision: string,
  steps: ((revision: string) => Promise<LookChange>)[],
): Promise<void> {
  let at = revision;
  for (const step of steps) {
    const result = await step(at);
    if (!result.ok) throw new Error(result.output);
    if (result.revision) at = result.revision;
  }
}

/** Separate from the presentation and guide marks, scoped to this browser and app. */
export const lookSeenKey = (app: string) => `lookPickerSeen:${app}`;
export function seenLook(app: string): boolean {
  try {
    return localStorage.getItem(lookSeenKey(app)) === "1";
  } catch {
    return false;
  }
}

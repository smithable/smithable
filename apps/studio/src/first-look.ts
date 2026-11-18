/** A picker owns one change at a time. Its exact revision travels with every write. */
export interface LookChange {
  ok: boolean;
  output: string;
  change?: string;
  revision?: string;
}
export interface ThemePreviewHost {
  apply: (preset: string, revision: string) => Promise<LookChange>;
  undo: (change: string, revision: string) => Promise<LookChange>;
}

export class ThemePreview {
  private turn: Promise<unknown> = Promise.resolve();
  private ownChange?: string;
  private revision: string;
  private selected: string;
  private refusal?: string;
  private closing = false;

  constructor(
    private readonly opening: { preset: string; revision: string },
    private readonly host: ThemePreviewHost,
  ) {
    this.revision = opening.revision;
    this.selected = opening.preset;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.turn.then(work);
    this.turn = next.catch(() => undefined);
    return next;
  }

  private async restore(): Promise<void> {
    if (!this.ownChange) return;
    const result = await this.host.undo(this.ownChange, this.revision);
    if (!result.ok || !result.revision) throw new Error(result.output);
    this.ownChange = undefined;
    this.revision = result.revision;
    this.selected = this.opening.preset;
  }

  choose(preset: string): Promise<void> {
    if (this.closing) return Promise.resolve();
    return this.enqueue(async () => {
      if (this.refusal) throw new Error(this.refusal);
      if (preset === this.selected) return;
      try {
        await this.restore();
        if (preset === this.opening.preset) return;
        const result = await this.host.apply(preset, this.revision);
        if (!result.ok || !result.change || !result.revision) throw new Error(result.output);
        this.ownChange = result.change;
        this.revision = result.revision;
        this.selected = preset;
      } catch (error) {
        this.refusal = error instanceof Error ? error.message : String(error);
        throw error;
      }
    });
  }

  finish(keep: boolean): Promise<void> {
    this.closing = true;
    return this.enqueue(async () => {
      if (keep) return;
      // A refused/uncertain mutation is never guessed at or undone by a generic Undo.
      if (this.refusal) throw new Error(this.refusal);
      await this.restore();
    });
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

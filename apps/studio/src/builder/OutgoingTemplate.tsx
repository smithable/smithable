// An outgoing entry's words in Content (docs/design/outgoing-templates.md §8 step 3): the
// placeholders its texts may use, the fields its mail lists under the text (setOutgoingBody), and
// a preview of the mail filled from the model's sample record, so it reads right without a
// running app.
import {
  type FieldIR,
  fillText,
  humanize,
  type ModelIR,
  notSendable,
  type SpecIR,
  titleField,
} from "@smithable/core";
import { useState } from "react";
import { parse } from "yaml";
import type { Run } from "./ChangeForms";

/** A field a placeholder or a mail's list can name, as core's validator has it. */
const sendable = (f: FieldIR) => !f.formula && !notSendable(f);

/** A model's sample records (samples/<Model>.yml), or none when the file is missing or broken. */
function records(samples: Record<string, string>, model: string): Record<string, unknown>[] {
  try {
    const list = parse(samples[model] ?? "");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** The placeholders an entry on `model` may use, as the validator's list has them. */
function placeholders(model: ModelIR, changed: boolean): string[] {
  const fields = model.fields.filter(sendable).map((f) => f.name);
  return [...fields, "title", "link", "by", ...(changed ? fields.map((f) => `before.${f}`) : [])];
}

/** A sample value as text: a list or object compactly, a missing one as nothing. */
const shown = (value: unknown): string | undefined =>
  value == null ? undefined : typeof value === "object" ? JSON.stringify(value) : String(value);

export function OutgoingTemplate({
  entry,
  ir,
  contentText,
  samples,
  run,
}: {
  entry: string;
  ir: SpecIR;
  /** smithable.content.yml as it is, for the entry's subject and text. */
  contentText?: string;
  /** Each model's sample records file (samples/<Model>.yml), as text. */
  samples: Record<string, string>;
  run: Run;
}) {
  const o = ir.outgoing.find((x) => x.name === entry);
  const [copied, setCopied] = useState<string>();
  if (!o) return null;
  if ("custom" in o.when)
    return (
      <p className="w-full text-xs text-muted">
        A custom action's mail shows what it was given and what it gave back, so its texts take no
        placeholders.
      </p>
    );
  const on = o.when.model;
  const model = ir.models.find((m) => m.name === on);
  if (!model) return null;
  const changed = "event" in o.when && o.when.event === "changed";
  const offered = placeholders(model, changed);
  const fields = model.fields.filter(sendable);
  const listed = o.show === "none" ? [] : (o.show ?? fields.map((f) => f.name));
  // The entry's own words in the content file, and the model's first sample record.
  let words: { subject?: string; text?: string } = {};
  try {
    words =
      (parse(contentText ?? "") as { outgoing?: Record<string, typeof words> })?.outgoing?.[
        entry
      ] ?? {};
  } catch {}
  const sample = records(samples, on)[0] ?? {};
  // A sample names a referenced record by its title: {customer.name} is that record's field.
  const value = (path: string): string | undefined => {
    if (path === "title") return shown(sample[titleField(model)]);
    if (path === "link") return "https://your-app.example/…";
    if (path === "by") return "Sam Sample";
    const [first = "", second] = path.split(".");
    if (first === "before") return shown(sample[second ?? ""]);
    const v = sample[first];
    if (second === undefined) return shown(v);
    const type = model.fields.find((x) => x.name === first)?.type;
    const target =
      type?.kind === "relation" ? ir.models.find((m) => m.name === type.model) : undefined;
    if (!target) return undefined;
    const named = records(samples, target.name).find((r) => r[titleField(target)] === v);
    return shown(named?.[second]);
  };
  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`{${path}}`);
      setCopied(path);
    } catch {}
  };
  const setShow = (show: string[]) => void run("setOutgoingBody", { outgoing: entry, show });
  return (
    <section
      aria-label={`The words of ${entry}`}
      data-outgoing={entry}
      className="w-full space-y-3 rounded-md bg-subtle p-2 text-xs"
    >
      <div className="space-y-1">
        <p className="font-medium">Placeholders for the subject and text</p>
        <div className="flex flex-wrap gap-1">
          {offered.map((p) => (
            <button
              key={p}
              type="button"
              title="Copy, to paste into the subject or the text"
              onClick={() => void copy(p)}
              className="rounded-full border border-line bg-panel px-2 py-0.5 font-mono hover:border-accent hover:text-accent"
            >
              {`{${p}}`}
            </button>
          ))}
        </div>
        {copied && <p className="text-quiet">{`{${copied}}`} copied: paste it into a text.</p>}
      </div>
      {o.to === "mail" && (
        <fieldset className="space-y-1">
          <legend className="font-medium">Listed under the text</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {fields.map((f) => (
              <label key={f.name} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={listed.includes(f.name)}
                  onChange={(e) =>
                    setShow(
                      e.target.checked
                        ? fields
                            .map((x) => x.name)
                            .filter((n) => n === f.name || listed.includes(n))
                        : listed.filter((n) => n !== f.name).length
                          ? listed.filter((n) => n !== f.name)
                          : ["none"],
                    )
                  }
                />
                {humanize(f.name)}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setShow(["default"])}
            >
              As the record page shows it
            </button>
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setShow(["none"])}
            >
              The text alone
            </button>
          </div>
          {changed && (
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={Boolean(o.previous)}
                onChange={(e) =>
                  void run("setOutgoingBody", { outgoing: entry, previous: e.target.checked })
                }
              />
              Say what the changed fields were
            </label>
          )}
        </fieldset>
      )}
      {o.to === "mail" && (
        <div className="space-y-1" data-preview>
          <p className="font-medium">Preview, from the first sample {model.name.toLowerCase()}</p>
          <div className="space-y-2 rounded-md border border-line bg-panel p-2 whitespace-pre-wrap">
            <p className="font-semibold">
              {fillText(words.subject ?? `${humanize(model.name)}: {title}`, value, true)}
            </p>
            {words.text && <p>{fillText(words.text, value)}</p>}
            {listed.length > 0 && (
              <p className="text-muted">
                {listed.map((n) => `${humanize(n)}: ${value(n) ?? ""}`).join("\n")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

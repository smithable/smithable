// Smithable app kit: a create/edit form for any model, validated with the model's Zod schema.
// To customize a form, copy this file into src/custom/components/ and edit the copy.
import { Calculator, CircleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { FieldInput } from "./FieldInput";
import { fileSize, formatValue, fromInput, toInput } from "./format";
import {
  type AppUi,
  editorMarker,
  type FieldUi,
  fits,
  type ModelUi,
  type Options,
  textMarker,
} from "./model";
import { type InUse, inUseFacts, TogetherDialog } from "./Together";
import { w } from "./words";

interface ModelFormProps<S extends z.ZodType> {
  ui: ModelUi;
  app: AppUi;
  schema: S;
  /** The stored record when editing; omit to create a new one. */
  initial?: Record<string, unknown>;
  /** Values a new record starts with, e.g. the start of the hour chosen in a calendar. */
  preset?: Record<string, unknown>;
  /** Choices for reference fields, e.g. { customerId: [...] }. */
  options?: Options;
  submitLabel: string;
  onSubmit: (values: z.output<S>) => Promise<unknown>;
  onCancel?: () => void;
  /** The cancel button's text, e.g. "Back" in a step of an onboarding. */
  cancelLabel?: string;
  /** Deletes the record; `together` takes what points to it along (docs/design/delete-together.md). */
  onDelete?: (together?: boolean) => Promise<unknown>;
  /** Deleting moves the record to the trash (docs/design/trash.md): no confirmation, it can be restored. */
  trash?: boolean;
  /** Shows the record without letting it be changed. */
  readOnly?: boolean;
  /** Fields shown with their preset value but not changed here, e.g. the invoice a new line is on. */
  fixed?: string[];
  /** These fields first, in this order; the others follow. */
  fieldOrder?: string[];
  /** The form's groups, columns and controls, when the page chose them (the ux file). */
  sections?: { name: string; title: string; fields: string[] }[];
  formColumns?: 1 | 2;
  control?: Record<string, FieldUi["control"]>;
}

export function ModelForm<S extends z.ZodType>(props: ModelFormProps<S>) {
  const {
    app,
    schema,
    initial,
    options,
    submitLabel,
    onSubmit,
    onCancel,
    cancelLabel,
    onDelete,
    trash,
    readOnly,
    fixed,
  } = props;
  const all = presented(props.ui, props);
  // A field the app fills is never in the form, only on the record's page (record-rules.md §1).
  const ui =
    readOnly || !all.fields.some((f) => f.byApp)
      ? all
      : { ...all, fields: all.fields.filter((f) => !f.byApp) };
  const [inputs, setInputs] = useState(() =>
    initialInputs(ui, initial ?? props.preset, app.timeZone, !initial),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Computed fields follow what has been entered so far.
  // The record comes first so values that are not inputs (like related lines) are included.
  const computed = ui.compute?.({ ...initial, ...storedValues(ui, inputs, app.timeZone) }) ?? {};
  const [failure, setFailure] = useState<string>();
  // A delete refused because other records point to the record: the facts, for the dialog.
  const [inUse, setInUse] = useState<InUse>();
  const [busy, setBusy] = useState(false);
  const confirmDelete = useRef<HTMLDialogElement>(null);
  // Ids unique to this form: a page may show the same form twice (a row's action dialog in the
  // phone list and in the table), and a label must reach its own field.
  const formId = useId();
  const recordName = initial?.[ui.titleField];

  // A field locked on the record as it is (record-rules.md §2): shown, not changed.
  const locked = (field: FieldUi) =>
    typeof initial?.id === "number" &&
    field.locked !== undefined &&
    (field.locked === true || fits(field.locked, initial));
  // Required while the values fit the field's condition (record-rules.md §3).
  const requiredNow = (field: FieldUi, values: Record<string, unknown>) =>
    field.required ||
    (field.requiredWhen !== undefined && fits(field.requiredWhen, { ...initial, ...values }));

  /** What is wrong with the values, by field, in words a non-developer understands. */
  function problems(values: Record<string, unknown>) {
    const result = schema.safeParse(values);
    const messages: Record<string, string> = {};
    if (!result.success)
      for (const issue of result.error.issues) {
        const field = ui.fields.find((f) => f.name === issue.path[0]);
        if (field && !messages[field.name])
          messages[field.name] = friendly(field, issue, values[field.name]);
      }
    for (const field of ui.fields) {
      const value = values[field.name];
      if (
        !messages[field.name] &&
        field.requiredWhen &&
        requiredNow(field, values) &&
        (value === null || value === undefined || value === "")
      )
        messages[field.name] = w.requiredNow(field.label);
    }
    return { result, messages, ok: result.success && Object.keys(messages).length === 0 };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const { result, messages, ok } = problems(storedValues(ui, inputs, app.timeZone));
    setErrors(messages);
    if (ok && result.success) await run(() => onSubmit(result.data));
  }

  /**
   * A field is checked when it is left, with the message saving would give. One left empty is not reported before saving (tabbing past
   * a field is no mistake), unless it already was.
   */
  function check(field: FieldUi, current = inputs) {
    const values = storedValues(ui, current, app.timeZone);
    const value = values[field.name];
    const message = problems(values).messages[field.name];
    if ((value === null || value === undefined || value === "") && !errors[field.name]) return;
    setErrors(({ [field.name]: _, ...rest }) =>
      message ? { ...rest, [field.name]: message } : rest,
    );
  }

  /**
   * Typing in a field with a message takes the message away once what is typed is right; until
   * then the message stays as it was, not changing with every key, and leaving the field checks
   * it again.
   */
  function change(field: FieldUi, value: string | boolean) {
    const next = { ...inputs, [field.name]: value };
    setInputs(next);
    if (errors[field.name] && !problems(storedValues(ui, next, app.timeZone)).messages[field.name])
      setErrors(({ [field.name]: _, ...rest }) => rest);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      const facts = inUseFacts(error);
      if (facts) setInUse(facts);
      else setFailure(failureMessage(ui, error));
    } finally {
      setBusy(false);
    }
  }

  // A long text, a picture or a list takes the full width when the form has two columns.
  const wide = (field: FieldUi) =>
    ui.formColumns === 2 &&
    (field.kind === "text" ||
      field.kind === "markdown" ||
      field.kind === "picture" ||
      field.kind === "pictures" ||
      field.kind === "files" ||
      field.control === "textarea");
  const renderField = (field: FieldUi) => {
    const id = `${formId}field-${field.name}`;
    const error = errors[field.name];
    const inline = field.kind === "bool";
    const described =
      [field.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
    const input = (
      <FieldInput
        field={field}
        id={id}
        value={inputs[field.name] ?? ""}
        invalid={error !== undefined}
        describedBy={described}
        options={options}
        record={typeof initial?.id === "number" ? initial.id : undefined}
        currency={app.currency}
        onChange={(value) => change(field, value)}
      />
    );
    return (
      <div
        key={field.name}
        data-kit="field"
        data-field={field.name}
        className={`${inline ? "flex items-center gap-3" : "space-y-2"}${wide(field) ? " sm:col-span-2" : ""}`}
        {...editorMarker(ui, field, "field")}
      >
        {!inline && (
          <Label htmlFor={id} data-part="label">
            <span {...textMarker(`models.${ui.model}.fields.${field.name}.label`)}>
              {field.label}
            </span>
            {requiredNow(field, storedValues(ui, inputs, app.timeZone)) && (
              <span className="text-destructive"> *</span>
            )}
          </Label>
        )}
        {field.computed ? (
          <p
            id={id}
            className="flex min-h-control items-center gap-2 rounded-md bg-muted px-3 text-sm font-semibold tabular-nums"
          >
            <Calculator aria-hidden className="size-5 text-muted-foreground" />
            {formatValue(field, computed[field.name], app)}
            <span className="sr-only">{w.calculated}</span>
          </p>
        ) : fixed?.includes(field.name) || locked(field) ? (
          // Shown with its value, as an input that cannot be changed.
          <fieldset disabled className="contents">
            {input}
          </fieldset>
        ) : (
          input
        )}
        {inline && (
          <Label htmlFor={id} data-part="label">
            {field.label}
          </Label>
        )}
        {field.help && (
          <p id={`${id}-help`} data-part="help" className="text-sm text-muted-foreground">
            {field.help}
          </p>
        )}
        {error && (
          <p
            id={`${id}-error`}
            data-part="error"
            className="flex items-center gap-1.5 text-sm text-destructive"
          >
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  };

  // Someone who may only read sees the record, not a form they cannot use.
  if (readOnly && initial) {
    const record = { ...initial, ...computed };
    return (
      <Card data-kit="model-form" data-part="view" className="max-w-3xl">
        <div className="space-y-6 p-card">
          {groups(ui).map((group) => (
            <section key={group.name ?? ""} data-part="section" className="space-y-4">
              {group.title && (
                <h2 className="text-base font-semibold" data-part="title">
                  {group.title}
                </h2>
              )}
              <dl className={ui.formColumns === 2 ? "grid gap-6 sm:grid-cols-2" : "space-y-5"}>
                {/* The title is the page's heading already. */}
                {group.fields
                  .filter((field) => field.name !== ui.titleField)
                  .map((field) => (
                    <div
                      key={field.name}
                      data-kit="field"
                      data-field={field.name}
                      className={wide(field) ? "sm:col-span-2" : undefined}
                    >
                      <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
                      <dd
                        className={cn(
                          "mt-1",
                          field.kind === "money" && "text-xl font-semibold tabular-nums",
                        )}
                      >
                        {shown(ui, field, record, app)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
          {onCancel && (
            <div data-part="actions" className="border-t pt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                {cancelLabel ?? "Back"}
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card data-kit="model-form" className="max-w-3xl">
      <form
        onSubmit={submit}
        noValidate
        className="space-y-6 p-card"
        onBlur={(event) => {
          // Leaving a field, not moving within it (the parts of a choice list). Not for one of
          // the form's buttons: saving checks everything, and a message appearing now would move
          // the button from under the click.
          const box = (event.target as Element).closest("[data-field]");
          const to = event.relatedTarget as HTMLElement | null;
          const field = ui.fields.find((f) => f.name === box?.getAttribute("data-field"));
          if (field && !box?.contains(to) && !to?.closest("[data-part=actions]")) check(field);
        }}
      >
        {!readOnly && ui.fields.some((f) => (f.required || f.requiredWhen) && !f.computed) && (
          <p className="text-sm text-muted-foreground">
            {w.fieldsMarked} <span className="text-destructive">*</span> {w.areRequired}
          </p>
        )}
        <fieldset disabled={readOnly} className="space-y-6">
          {groups(ui).map((group) => (
            <div key={group.name ?? ""} data-part="section" className="space-y-4">
              {group.title && (
                <h2 className="text-base font-semibold" data-part="title">
                  {group.title}
                </h2>
              )}
              <div className={ui.formColumns === 2 ? "grid gap-6 sm:grid-cols-2" : "space-y-6"}>
                {group.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}
        </fieldset>
        {failure && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm text-destructive"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {failure}
          </p>
        )}
        <div data-part="actions" className="flex flex-wrap items-center gap-3 border-t pt-6">
          {!readOnly && (
            <Button type="submit" disabled={busy}>
              {busy ? w.saving : submitLabel}
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              {cancelLabel ?? (readOnly ? "Back" : "Cancel")}
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              className="ml-auto border-destructive text-destructive"
              disabled={busy}
              onClick={() => (trash ? run(() => onDelete()) : confirmDelete.current?.showModal())}
            >
              {trash ? w.moveToTrash : w.delete}
            </Button>
          )}
          {onDelete && inUse && (
            <TogetherDialog
              facts={inUse}
              what={
                typeof recordName === "string" && recordName
                  ? `“${recordName}”`
                  : w.thisOne(ui.label)
              }
              rootLabel={ui.label}
              busy={busy}
              onTogether={() => {
                setInUse(undefined);
                run(() => onDelete(true));
              }}
              onClose={() => setInUse(undefined)}
            />
          )}
          {onDelete && !trash && (
            // Opening it focuses Cancel, the first button; Escape closes it.
            <dialog
              ref={confirmDelete}
              aria-labelledby="delete-title"
              className="m-auto w-[calc(100%-2.5rem)] max-w-md rounded-lg border bg-card p-card text-card-foreground backdrop:bg-black/50"
            >
              <h2 id="delete-title" className="text-lg font-semibold">
                {w.delete}{" "}
                {typeof recordName === "string" && recordName
                  ? `“${recordName}”`
                  : w.thisOne(ui.label)}
                ?
              </h2>
              <p className="mt-2 text-muted-foreground">{w.cannotBeUndone}</p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => confirmDelete.current?.close()}
                >
                  {w.cancel}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    confirmDelete.current?.close();
                    run(() => onDelete());
                  }}
                >
                  {w.deleteIt(ui.label.toLowerCase())}
                </Button>
              </div>
            </dialog>
          )}
        </div>
      </form>
    </Card>
  );
}

/** A message a non-developer understands, instead of Zod's technical text. */
function friendly(field: FieldUi, issue: z.core.$ZodIssue, value: unknown): string {
  if (value === null || value === undefined) return "Required";
  if (issue.code !== "invalid_type") return issue.message;
  switch (field.kind) {
    case "int":
      return w.enterWholeNumber;
    case "decimal":
    case "money":
      return w.enterNumber;
    case "date":
      return w.enterValidDate;
    case "datetime":
      return w.enterValidDateTime;
    default:
      return issue.message;
  }
}

/** Explains server errors (see refusal in access.ts): a unique field taken, a record in use. */
function failureMessage(ui: ModelUi, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const column = /^taken:(\w+)$/.exec(message)?.[1];
  const field = ui.fields.find(
    (f) => f.name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) === column,
  );
  if (field) return w.alreadyHas(ui.label, field.label);
  if (message === "in-use") return w.stillUsed(ui.label);
  const noRight = /^no-right:(.+)$/.exec(message)?.[1];
  if (noRight) return w.noRightToDelete(noRight);
  if (message === "full") return w.noPlacesLeft;
  const booked = /^booked:(\d+)$/.exec(message)?.[1];
  if (booked) return w.alreadyTaken(booked);
  return message || w.tryAgain;
}

/** Form inputs for a record being edited, or for a new one: defaults, including formula defaults. */
function initialInputs(
  ui: ModelUi,
  initial: Record<string, unknown> | undefined,
  timeZone: string | undefined,
  /** A new record: what `initial` leaves out comes from the defaults. */
  fresh = false,
): Record<string, string | boolean> {
  const inputs: Record<string, string | boolean> = {};
  const values: Record<string, unknown> = {};
  for (const field of ui.fields) {
    if (field.computed) continue;
    const suggested = ui.defaults?.[field.name];
    const value =
      initial && (!fresh || initial[field.name] !== undefined)
        ? initial[field.name]
        : suggested
          ? suggested(values)
          : field.default;
    values[field.name] = value;
    inputs[field.name] = toInput(field, value, timeZone);
  }
  return inputs;
}

/** The values to validate and save: every entered field, never computed ones. */
function storedValues(
  ui: ModelUi,
  inputs: Record<string, string | boolean>,
  timeZone: string | undefined,
): Record<string, unknown> {
  return Object.fromEntries(
    ui.fields
      .filter((f) => !f.computed)
      .map((f) => [f.name, fromInput(f, inputs[f.name] ?? "", timeZone)]),
  );
}

/** The model's fields with `order` first, in that order. */
/** The model's description with the page's presentation: field order, sections, columns, controls. */
function presented(
  ui: ModelUi,
  page: {
    fieldOrder?: string[];
    sections?: ModelUi["sections"];
    formColumns?: 1 | 2;
    control?: Record<string, FieldUi["control"]>;
  },
): ModelUi {
  const order = page.fieldOrder ?? page.sections?.flatMap((s) => s.fields);
  const rank = (name: string) => {
    const i = order?.indexOf(name) ?? -1;
    return i === -1 ? (order?.length ?? 0) : i;
  };
  const fields = [...ui.fields]
    .sort((a, b) => (order ? rank(a.name) - rank(b.name) : 0))
    .map((f) => (page.control?.[f.name] ? { ...f, control: page.control[f.name] } : f));
  return {
    ...ui,
    fields,
    ...(page.sections ? { sections: page.sections } : {}),
    ...(page.formColumns ? { formColumns: page.formColumns } : {}),
  };
}

/** The form's fields in their groups: the sections given, then the rest under no heading. */
function groups(ui: ModelUi): { name?: string; title?: string; fields: FieldUi[] }[] {
  if (!ui.sections?.length) return [{ fields: ui.fields }];
  const placed = new Set(ui.sections.flatMap((s) => s.fields));
  const byName = new Map(ui.fields.map((f) => [f.name, f]));
  const sections = ui.sections.map((s) => ({
    name: s.name,
    title: s.title,
    fields: s.fields.flatMap((name) => byName.get(name) ?? []),
  }));
  const rest = ui.fields.filter((f) => !placed.has(f.name));
  return rest.length ? [...sections, { fields: rest }] : sections;
}

/** A stored value as someone who may only read sees it: pictures shown, Markdown formatted. */
function shown(ui: ModelUi, field: FieldUi, record: Record<string, unknown>, app: AppUi) {
  const value = record[field.name];
  const base = `/files/${ui.model?.replace(/[A-Z]/g, (c, i) => `${i ? "-" : ""}${c.toLowerCase()}`)}/${String(record.id)}/${field.name}`;
  if (field.kind === "picture")
    return value ? (
      <img
        src={base}
        alt={String((value as { alt?: string }).alt ?? "")}
        className="max-h-96 rounded-md object-contain"
      />
    ) : (
      "—"
    );
  if (field.kind === "pictures") {
    const pictures = Array.isArray(value) ? (value as { alt?: string }[]) : [];
    return pictures.length ? (
      <ul data-part="pictures" className="flex snap-x gap-3 overflow-x-auto pb-2">
        {pictures.map((p, i) => (
          <li key={`${base}/${i}`} className="shrink-0 snap-start">
            <img
              src={`${base}/${i}`}
              alt={p.alt ?? ""}
              loading="lazy"
              className="h-56 w-auto rounded-md object-cover"
            />
          </li>
        ))}
      </ul>
    ) : (
      "—"
    );
  }
  // A document is a link to it, with its size; several, a list of them.
  if (field.kind === "file" || field.kind === "files") {
    const list = (
      field.kind === "file" ? (value ? [value] : []) : Array.isArray(value) ? value : []
    ) as {
      name?: string;
      size?: number;
    }[];
    return list.length ? (
      <ul data-part="files" className="space-y-1">
        {list.map((f, i) => (
          <li key={`${base}/${i}`}>
            <a
              href={field.kind === "file" ? base : `${base}/${i}`}
              className="underline underline-offset-4"
            >
              {f.name}
            </a>{" "}
            <span className="text-muted-foreground">{fileSize(Number(f.size ?? 0))}</span>
          </li>
        ))}
      </ul>
    ) : (
      "—"
    );
  }
  if (field.view && typeof value === "string" && value) return field.view({ text: value });
  if (field.relation) {
    const related = record[field.relation.key] as Record<string, unknown> | null | undefined;
    // One in the trash shows as a dash (its value is then null).
    const title = related?.deletedAt ? null : related?.[field.relation.titleField];
    return formatValue(field, title ?? value, app);
  }
  if (field.kind === "text" && typeof value === "string" && value)
    return <p className="whitespace-pre-wrap">{value}</p>;
  return formatValue(field, value, app);
}

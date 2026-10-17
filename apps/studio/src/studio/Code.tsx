// The Code window (docs/design/studio-v3.md §4): the spec files in the editor, nothing else.
// A part picked in the preview in Select shows its lines: a text in the content file, anything
// else in smithable.yml.
import { EDITABLE_FILES, type EditableFile, emptyFile, validateSpec } from "@smithable/core";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { isMap, isScalar, isSeq, type Node, parseDocument } from "yaml";
import { lastChange, type Project } from "../api";
import type { Run } from "../builder/ChangeForms";
import { FILE_DOCS } from "../docs";
import { checkFile, type Spec } from "../engine";
import { isPreviewMessage, type Place } from "../preview";
import { Button, Select } from "../ui";

// The editor is its own piece of code, fetched when the window is first shown.
const SpecText = lazy(() => import("./SpecText"));

/** A place to show in the editor: a concept's lines in a file, asked at a time. */
type Jump = { concept: string; file: EditableFile; at: number };

export function Code({
  project,
  spec,
  run,
  place,
  onPlace,
  onLook,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  /** Opens No code's Look: where the ux file's choices have controls. */
  onLook: () => void;
  /** The file open, kept for the tab's session (App.tsx). */
  place: Place["code"];
  onPlace: (place: Place["code"]) => void;
}) {
  const [jump, setJump] = useState<Jump>();
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e) || e.data.type !== "select") return;
      const { concept } = e.data;
      const file = concept.startsWith("text:") ? "smithable.content.yml" : "smithable.yml";
      setJump({ concept, file, at: Date.now() });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return (
    <section aria-label="Code" data-guide="files" className="flex h-full min-h-0 flex-col bg-panel">
      <SpecEditor
        project={project}
        plugins={spec.plugins}
        run={run}
        jump={jump}
        file={place.file ?? "smithable.yml"}
        onFile={(file) => onPlace({ file })}
        onLook={onLook}
      />
    </section>
  );
}

/**
 * The spec files as text: smithable.yml and its companions, each checked as you type by the
 * same validator the CLI uses, and saved whole as one change (editSpec). A file the project does
 * not have yet starts from its first line; the auth file is only offered when there is one.
 */
function SpecEditor({
  project,
  plugins,
  run,
  jump,
  file,
  onFile: setFile,
  onLook,
}: {
  project: Project;
  plugins: Spec["plugins"];
  run: Run;
  jump?: Jump;
  /** The file open, kept in Code mode's place (App.tsx), so a mode switch comes back to it. */
  file: EditableFile;
  onFile: (file: EditableFile) => void;
  onLook: () => void;
}) {
  const offered = (Object.keys(EDITABLE_FILES) as EditableFile[]).filter(
    (f) => project.files[EDITABLE_FILES[f]] !== undefined || emptyFile(f) !== undefined,
  );
  const saved = project.files[EDITABLE_FILES[file]] ?? emptyFile(file) ?? "";
  // Unsaved edits, by file, and each file as it was when its editing began: a change on disk
  // replaces the text only when it has not been edited, and is otherwise offered, so typing is
  // never lost. Kept for the browser tab's session, so a mode switch or a reload keeps them
  // (studio-v2.md §2).
  const [drafts, setDrafts] = useState(() => keptDrafts(project.name, "text"));
  const [bases, setBases] = useState(() => keptDrafts(project.name, "base"));
  useEffect(() => {
    for (const f of Object.keys(EDITABLE_FILES) as EditableFile[]) {
      const key = draftKey(project.name, f);
      const text = drafts[f];
      const base = bases[f];
      try {
        if (text === undefined || base === undefined) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify({ text, base }));
      } catch {}
    }
  }, [drafts, bases, project.name]);
  const text = drafts[file] ?? saved;
  const base = bases[file] ?? saved;
  const edited = text !== base;
  const setText = (next: string) => {
    setDrafts((d) => ({ ...d, [file]: next }));
    if (bases[file] === undefined) setBases((b) => ({ ...b, [file]: saved }));
  };
  const dropEdits = () => {
    setDrafts(({ [file]: _, ...rest }) => rest);
    setBases(({ [file]: _, ...rest }) => rest);
  };
  const draft = drafts[file];
  const began = bases[file];
  useEffect(() => {
    // A save of this text lands here too.
    if (edited && saved !== text) return;
    if (draft !== undefined || began !== undefined) {
      setDrafts(({ [file]: _, ...rest }) => rest);
      setBases(({ [file]: _, ...rest }) => rest);
    }
  }, [saved, edited, text, file, draft, began]);
  // Unsaved edits: the browser asks before a link, Back or closing the tab loses them.
  const unsaved = Object.values(drafts).length > 0;
  useEffect(() => {
    if (!unsaved) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", ask);
    return () => removeEventListener("beforeunload", ask);
  }, [unsaved]);
  // Where a concept is declared, to select and bring into view when asked (not as the text
  // changes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: a jump is asked by its time
  useEffect(() => {
    if (jump) setFile(jump.file);
  }, [jump]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a jump is asked by its time
  const select = useMemo(() => {
    if (!jump) return undefined;
    const text =
      drafts[jump.file] ?? project.files[EDITABLE_FILES[jump.file]] ?? emptyFile(jump.file) ?? "";
    const range = jump.concept.startsWith("text:")
      ? contentRange(text, jump.concept.slice(5))
      : specRange(text, jump.concept);
    return range && jump ? { from: range[0], to: range[1], at: jump.at } : undefined;
  }, [jump]);
  const { diagnostics, roles } = useMemo(
    () => checkFile(project.files, file, text, plugins, project.ownThemes),
    [project.files, file, text, plugins, project.ownThemes],
  );
  const errors = diagnostics.filter((d) => d.severity === "error");
  // The problems shown: a new one once typing pauses, so a line half written is not called
  // wrong; one put right goes at once.
  const [shown, setShown] = useState(diagnostics);
  // biome-ignore lint/correctness/useExhaustiveDependencies: compared with what is shown, not rerun by it
  useEffect(() => {
    const before = new Set(shown.map(problemKey));
    if (diagnostics.every((d) => before.has(problemKey(d)))) {
      setShown(diagnostics);
      return;
    }
    const t = setTimeout(() => setShown(diagnostics), 800);
    return () => clearTimeout(t);
  }, [diagnostics]);
  // Problems first; then notes, advice the app is fine without (docs/design/advice.md).
  const problems = shown.filter((d) => d.severity !== "note");
  const notes = shown.filter((d) => d.severity === "note");
  // An edit saves itself after a pause (docs/design/studio-changes.md §4): when it is valid and
  // removes no field (one that does keeps the Save button, which asks first). Going on in the
  // same file grows the same change while it is still the newest; another file, another change
  // made anywhere, leaving the editor or five minutes without a keystroke start a new one.
  const fields = (t: string) =>
    (validateSpec({ path: "smithable.yml", text: t }, { plugins }).ir?.models ?? []).flatMap((m) =>
      m.fields.map((f) => `${m.name}.${f.name}`),
    );
  // biome-ignore lint/correctness/useExhaustiveDependencies: the saved file's fields, once per save
  const savedFields = useMemo(
    () => (file === "smithable.yml" ? fields(saved) : []),
    [file, saved, plugins],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: as the text changes
  const removes = useMemo(() => {
    if (file !== "smithable.yml" || text === saved) return false;
    const now = fields(text);
    return savedFields.some((f) => !now.includes(f));
  }, [file, text, saved, savedFields]);
  const head = project.trace[0]?.id;
  const growing = useRef<{ file: EditableFile; id?: string; at: number } | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const save = async (by: "pause" | "button") => {
    const kept = growing.current;
    const grow =
      by === "pause" && kept?.file === file && kept.id === head && Date.now() - kept.at < 5 * 60_000
        ? kept.id
        : undefined;
    setSaving(true);
    const ok = await run("editSpec", {
      text,
      ...(file === "smithable.yml" ? {} : { file }),
      ...(grow ? { grow } : {}),
    });
    setSaving(false);
    // The server says which change the save made or grew: the next save grows that one.
    const made = ok && by === "pause" ? lastChange() : undefined;
    growing.current = made ? { file, id: made, at: Date.now() } : undefined;
  };
  const ready = text !== saved && errors.length === 0 && !removes && !saving;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a pause after the last keystroke
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void save("pause"), 1500);
    return () => clearTimeout(t);
  }, [ready, text]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: another file is another change
  useEffect(() => {
    growing.current = undefined;
  }, [file]);
  const state =
    text === saved
      ? "Saved"
      : saving
        ? "Saving…"
        : errors.length
          ? "Not saved: fix the problems first"
          : removes
            ? "Not saved: it removes a field, so Save asks first"
            : "Edited: it saves itself when you pause";
  // "What goes here?": the editor's list of what can be written at the cursor, for a phone,
  // which has no Ctrl-Space.
  const [ask, setAsk] = useState(0);
  // "What goes here?" with nothing to offer says so for a moment, instead of doing nothing.
  const [nothing, setNothing] = useState(false);
  useEffect(() => {
    if (!nothing) return;
    const gone = setTimeout(() => setNothing(false), 4000);
    return () => clearTimeout(gone);
  }, [nothing]);
  // The first time the editor opens in this browser: how to ask it what fits.
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem("smithable:editor-hint") !== "seen";
    } catch {
      return false;
    }
  });
  const hintSeen = () => {
    setHint(false);
    try {
      localStorage.setItem("smithable:editor-hint", "seen");
    } catch {}
  };
  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* In a narrow column the toolbar wraps onto a second line, never a word per line. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-2 py-1.5 text-xs">
        <Select
          aria-label="File"
          value={file}
          onChange={(e) => setFile(e.target.value as EditableFile)}
          className="text-xs"
          options={offered.map((f) => [
            f,
            drafts[f] !== undefined &&
            drafts[f] !== (project.files[EDITABLE_FILES[f]] ?? emptyFile(f))
              ? `${f} (edited)`
              : f,
          ])}
        />
        {/* How the open file is written: its part of the spec reference, as Help opens. */}
        <a
          href={FILE_DOCS[file]}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 whitespace-nowrap text-xs text-muted hover:underline"
        >
          How this file is written
        </a>
        {project.files[EDITABLE_FILES[file]] === undefined && (
          <span className="text-quiet">Not in the project yet: saving adds it.</span>
        )}
        <Button
          variant="ghost"
          className="ml-auto h-6 whitespace-nowrap text-xs"
          // Keeps the editor's focus (and a phone's keyboard) where it is.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAsk((n) => n + 1)}
        >
          What goes here?
        </Button>
      </div>
      {nothing && (
        <p role="status" className="border-b border-line bg-subtle px-2 py-1 text-xs text-muted">
          Nothing to suggest at the cursor: put it on a new line where a key goes, or after a key
          and a space.
        </p>
      )}
      {hint && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-2 border-b border-line bg-subtle px-2 py-1 text-xs text-muted"
        >
          <span>
            Ctrl-Space (⌃Space on a Mac) lists what fits where the cursor is, and "What goes here?"
            does the same.
          </span>
          <Button variant="ghost" className="h-6 whitespace-nowrap text-xs" onClick={hintSeen}>
            Got it
          </Button>
        </p>
      )}
      {/* The look has controls in No code (themes, columns, forms, a landing page's sections);
          this file is for what they do not cover, or for changing a lot at once. */}
      {file === "smithable.ux.yml" && (
        <p className="flex flex-wrap items-center gap-x-2 border-b border-line bg-subtle px-2 py-1 text-xs text-muted">
          <span>
            Themes, colours, columns, forms and a landing page's sections have controls in No code's
            Look tab; edit here for what Look has no control for, or to change a lot at once.
            Ctrl-Space lists what fits.
          </span>
          <Button variant="ghost" className="h-6 whitespace-nowrap text-xs" onClick={onLook}>
            Open Look
          </Button>
        </p>
      )}
      <Suspense fallback={<p className="flex-1 p-3 text-xs text-quiet">Opening the editor…</p>}>
        <SpecText
          key={file}
          label={file}
          value={text}
          onChange={setText}
          problems={shown.filter((d) => d.file === file)}
          select={jump?.file === file ? select : undefined}
          kept={`smithable:editor:${project.name}:${file}`}
          assist
          ask={ask}
          onNothing={() => setNothing(true)}
          known={{
            ...(roles ? { roles } : {}),
            spec: drafts["smithable.yml"] ?? project.files.spec ?? "",
            themes: project.ownThemes.map((t) => t.name),
          }}
        />
      </Suspense>
      {edited && saved !== base && saved !== text && (
        <p
          role="status"
          className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 p-2 text-xs"
        >
          {file} changed on disk while you were editing.
          <Button variant="ghost" onClick={dropEdits}>
            Use the file on disk
          </Button>
        </p>
      )}
      {/* The problems under the editor, a few lines high and scrolling, so they never push the
          editor out of sight; the buttons on their own line, so a narrow column does not
          squeeze the list to a word a line. Problems first; then notes, advice the app is fine
          without (docs/design/advice.md). */}
      <div data-guide="problems" className="space-y-2 border-t border-line p-2">
        <ul
          aria-label="Problems"
          aria-live="polite"
          className="max-h-24 space-y-0.5 overflow-y-auto text-xs"
        >
          {problems.length === 0 ? (
            <li className="text-green-700">No problems.</li>
          ) : (
            // Keyed by the message too: the YAML parser gives two problems with one place and
            // code, and alike keys left rows behind beside "No problems." (one said twice is
            // shown once).
            [...new Map(problems.map((d) => [problemKey(d), d])).entries()]
              .slice(0, 20)
              .map(([key, d]) => (
                <li
                  key={key}
                  className={d.severity === "error" ? "text-red-700" : "text-amber-700"}
                >
                  {d.file === file ? "Line" : `${d.file} line`} {d.line}: {d.message}
                </li>
              ))
          )}
        </ul>
        {notes.length > 0 && (
          <ul
            aria-label="Worth considering"
            className="max-h-16 space-y-0.5 overflow-y-auto text-xs"
          >
            {notes.slice(0, 3).map((d) => (
              <li
                key={`${d.file}:${d.line}:${d.column}:${d.code}`}
                className="flex items-baseline gap-2 text-sky-700"
              >
                <span>
                  Worth considering, {d.file === file ? "line" : `${d.file} line`} {d.line}:{" "}
                  {d.message}
                </span>
                {/* Its fix through the operation path, as any change: checked, undoable. */}
                {d.fix && (
                  <Button
                    variant="ghost"
                    className="h-5 shrink-0 px-1 text-xs"
                    disabled={text !== saved}
                    title={text !== saved ? "Save or discard your edits first" : undefined}
                    onClick={() => d.fix && void run(d.fix.op, d.fix.args)}
                  >
                    Apply
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* A mistaken edit, or one that cannot be saved, is dropped for the file as saved. */}
          <Button
            variant="ghost"
            disabled={text === saved}
            onClick={() => {
              if (confirm(`Discard your edits to ${file}?`)) dropEdits();
            }}
          >
            Discard
          </Button>
          <span aria-live="polite" className="self-center text-xs text-quiet">
            {state}
          </span>
          <Button
            disabled={errors.length > 0 || text === saved || saving}
            onClick={() => void save("button")}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A problem's place and words: two alike are one. */
const problemKey = (d: { file: string; line: number; column: number; message: string }) =>
  `${d.file}:${d.line}:${d.column}:${d.message}`;

/** Where a file's unsaved edit is kept for the session: its text and the file as it was. */
const draftKey = (app: string, file: EditableFile) => `smithable:draft:${app}:${file}`;

/** The kept edits' texts, or the files as they were when editing began, by file. */
function keptDrafts(app: string, part: "text" | "base"): Partial<Record<EditableFile, string>> {
  const kept: Partial<Record<EditableFile, string>> = {};
  for (const f of Object.keys(EDITABLE_FILES) as EditableFile[]) {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey(app, f)) ?? "null") as {
        text: string;
        base: string;
      } | null;
      if (value) kept[f] = value[part];
    } catch {}
  }
  return kept;
}

/**
 * Where a text is kept in smithable.content.yml, by its dot-separated place
 * ("pages.home.hero.title"): its value, or the nearest key on the way to it when the text is
 * not written there (a wording derived from names), so the line to add it under is shown.
 */
export function contentRange(text: string, path: string): [number, number] | undefined {
  let node: Node | null | undefined = parseDocument(text).contents;
  let found: [number, number] | undefined;
  for (const part of path.split(".")) {
    if (isMap(node)) {
      const pair = node.items.find((p) => isScalar(p.key) && String(p.key.value) === part);
      if (!pair) break;
      const key = pair.key as Node;
      if (key.range) found = [key.range[0], key.range[1]];
      node = pair.value as Node | null;
    } else if (isSeq(node)) {
      node = node.items[Number(part)] as Node | undefined;
    } else break;
    if (node?.range && isScalar(node)) found = [node.range[0], node.range[1]];
  }
  return found;
}

export function specRange(text: string, concept: string): [number, number] | undefined {
  const [kind = "", rest = ""] = concept.split(":");
  const [name = "", field] = rest.split(".");
  const section = {
    model: "models",
    field: "models",
    page: "pages",
    action: "actions",
    outgoing: "outgoing",
    query: "queries",
  }[kind];
  if (!section) return;
  const lines = text.split("\n");
  const offset = (i: number) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
  const start = lines.indexOf(`${section}:`);
  if (start < 0) return;
  const at = lines.findIndex((l, i) => i > start && new RegExp(`^ {2}${name}:`).test(l));
  if (at < 0) return;
  let end = at + 1;
  while (end < lines.length && /^( {3,}|\s*$)/.test(lines[end] ?? "")) end++;
  if (!field) return [offset(at), offset(at) + (lines[at]?.length ?? 0)];
  const line = lines.findIndex(
    (l, i) => i > at && i < end && new RegExp(`^ {4,}${field}:`).test(l),
  );
  return line < 0 ? undefined : [offset(line), offset(line) + (lines[line]?.length ?? 0)];
}

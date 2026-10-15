// The Languages tab (docs/design/languages.md §1, step 5): the app's other languages, each
// text a person reads beside its words in the language, the empty ones marked; adding and
// taking away a language. Each text is saved with setText in the language's file.
import { type ContentIR, LANGUAGES, textPaths, textsToTranslate } from "@smithable/core";
import { useMemo, useState } from "react";
import type { Spec } from "../engine";
import { Button, cx, Input, Label, Select } from "../ui";
import type { Run } from "./ChangeForms";

/** A language's name in English (the maker's tool stays English): "Swedish". */
const nameOf = (code: string) =>
  new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;

export function Languages({ spec, run }: { spec: Spec; run: Run }) {
  const { content, ir } = spec;
  const others = content?.languages ?? [];
  const [chosen, setChosen] = useState<string>();
  const shown = chosen && others.includes(chosen as never) ? chosen : others[0];
  const [adding, setAdding] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const own = useMemo(
    () =>
      content && ir ? [...textsToTranslate(content, ir)].sort(([a], [b]) => (a < b ? -1 : 1)) : [],
    [content, ir],
  );
  const said = useMemo(
    () =>
      textPaths(
        (shown && content?.translations?.[shown as keyof typeof content.translations]) ||
          ({} as ContentIR),
      ),
    [content, shown],
  );
  if (!content || !ir)
    return <p className="p-4 text-sm text-quiet">The spec has errors; fix them in Code mode.</p>;
  const addable = LANGUAGES.filter((l) => l !== content.language && !others.includes(l));
  const empty = own.filter(([path]) => !said.get(path)?.trim()).length;
  return (
    <div className="space-y-4 p-4 text-sm">
      <p className="text-muted">
        The app is in {nameOf(content.language)}. In another language its public pages are at their
        own address (/sv/…), and each signed-in person sees the language they chose. Records stay as
        they are written.
      </p>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (adding) void run("addLanguage", { language: adding }).then(() => setChosen(adding));
        }}
      >
        <Label text="Add a language">
          <Select
            aria-label="Add a language"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            options={[["", "Choose…"], ...addable.map((l): [string, string] => [l, nameOf(l)])]}
          />
        </Label>
        <Button type="submit" disabled={!adding}>
          Add
        </Button>
      </form>
      {shown && (
        <section aria-label={`Texts in ${nameOf(shown)}`} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
            {others.map((l) => (
              <button
                key={l}
                type="button"
                aria-current={l === shown ? "true" : undefined}
                onClick={() => setChosen(l)}
                className={cx(
                  "rounded px-2 py-1 text-xs font-medium",
                  l === shown ? "bg-subtle" : "text-muted",
                )}
              >
                {nameOf(l)}
              </button>
            ))}
            <span className="flex-1" />
            <Button
              variant="ghost"
              className="h-7 border border-red-200 text-xs text-red-700"
              onClick={() => void run("removeLanguage", { language: shown })}
            >
              Remove {nameOf(shown)}
            </Button>
          </div>
          <p className="text-xs text-muted" data-part="untranslated">
            {empty === 0
              ? `Every text has its ${nameOf(shown)} words.`
              : `${empty} of ${own.length} texts have no ${nameOf(shown)} words yet: they show in ${nameOf(content.language)}.`}
            <label className="ml-3 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyEmpty}
                onChange={(e) => setOnlyEmpty(e.target.checked)}
              />
              Only those
            </label>
          </p>
          <table className="w-full text-left">
            <thead className="text-xs text-quiet">
              <tr>
                <th className="w-1/2 pb-1 font-medium">{nameOf(content.language)}</th>
                <th className="pb-1 font-medium">{nameOf(shown)}</th>
              </tr>
            </thead>
            <tbody>
              {own
                .filter(([path]) => !onlyEmpty || !said.get(path)?.trim())
                .map(([path, text]) => (
                  <Row
                    key={`${shown}:${path}:${said.get(path) ?? ""}`}
                    path={path}
                    text={text}
                    said={said.get(path) ?? ""}
                    language={shown}
                    run={run}
                  />
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/** One text: the app's words, and the language's in a box saved when it is left or Enter. */
function Row({
  path,
  text,
  said,
  language,
  run,
}: {
  path: string;
  text: string;
  said: string;
  language: string;
  run: Run;
}) {
  const [value, setValue] = useState(said);
  const save = () => {
    if (value.trim() !== said.trim())
      void run("setText", { path: path.split("."), text: value.trim(), language });
  };
  return (
    <tr className="border-t border-line align-top" data-path={path}>
      <td className="py-1.5 pr-3">
        <span className="block">{text}</span>
        <code className="text-xs text-quiet">{path}</code>
      </td>
      <td className="py-1.5">
        <Input
          aria-label={`${text} in ${nameOf(language)}`}
          value={value}
          placeholder="Not translated"
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          className={cx(!said.trim() && "border-dashed")}
        />
      </td>
    </tr>
  );
}

// Builder's Details panel when nothing is selected: the app's own details (its name and what it
// is for, its language and theme, who may sign up) with their forms, and how to see a part's.
import { LANGUAGES } from "@smithable/core";
import { useState } from "react";
import type { Spec } from "../engine";
import { Button, Input, Label, Select } from "../ui";
import type { Run } from "./ChangeForms";
import { LANGUAGE_NAMES } from "./Look";

export function AppDetails({
  spec,
  run,
  onLook,
}: {
  spec: Spec;
  run: Run;
  /** Opens the Look tab, where the theme is chosen. */
  onLook: () => void;
}) {
  const app = spec.ir?.app;
  const [name, setName] = useState(app?.name ?? "");
  const [description, setDescription] = useState(app?.description ?? "");
  if (!app)
    return (
      <p className="p-3 text-sm text-neutral-500">The spec has errors; fix them in Code mode.</p>
    );
  const signIn = spec.auth?.signIn;
  // Only what was changed, so the change list says what it was.
  const edits = {
    ...(name.trim() !== app.name ? { name: name.trim() } : {}),
    ...(description.trim() !== (app.description ?? "") ? { description: description.trim() } : {}),
  };
  const changed = Object.keys(edits).length > 0;
  const preset = spec.ux?.theme.preset;
  return (
    <section aria-label="The app" className="space-y-5 p-3 text-sm">
      <p className="text-neutral-600">
        Choose Select above the preview and click a part of the app, or click a sentence in What it
        does, to see that part's details here.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) void run("setApp", edits);
        }}
      >
        <h3 className="text-xs font-semibold text-neutral-500">The app</h3>
        <Label text="App name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Label>
        <Label text="What it is for" hint="One sentence.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Label>
        <Button type="submit" disabled={!changed || !name.trim()}>
          Save
        </Button>
      </form>
      <div className="space-y-3">
        <Label text="Language">
          <Select
            value={spec.content?.language ?? LANGUAGES[0]}
            onChange={(e) => void run("setLanguage", { language: e.target.value })}
            options={LANGUAGES.map((l) => [l, LANGUAGE_NAMES[l]])}
          />
        </Label>
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-600">Theme</p>
          <p className="flex items-center justify-between gap-2">
            <span>{preset ? preset[0]?.toUpperCase() + preset.slice(1) : "The default theme"}</span>
            <Button variant="ghost" onClick={onLook}>
              Change it in Look
            </Button>
          </p>
        </div>
        {signIn && signIn !== "none" && (
          <Label text="Who may sign up">
            <Select
              value={signIn.selfSignUp ? "anyone" : "invited"}
              onChange={(e) => void run("setSignUp", { who: e.target.value })}
              options={[
                ["anyone", "Anyone"],
                ["invited", "Only people who are invited"],
              ]}
            />
          </Label>
        )}
      </div>
    </section>
  );
}

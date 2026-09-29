# The plugin and companion interface (design)

Status: 2026-09-29. Steps 1–4 and 7 of §4 are implemented (companion registration, `follow` on sections, companions and patterns with refusals, one object per page pattern in `packages/core/src/patterns.ts` with a table of landing section kinds, the adapter split, schema-annotated Builder forms). Plugins v2 (§3.5) is implemented: `patch`, `operations` with the clash prefix, `summarize`, the factory form with `PLUGIN_API`, and `operationsFor(plugins)` used by the CLI, MCP, Studio and the AI. Hook points (§3.6) are implemented in the adapter (`hooks.ts`: `src/generated/hooks.ts`, the `src/custom/hooks.ts` stub, a plugin's hooks file, daily jobs in production) and `smithable code hooks` has the coder write one. Open: registry-driven `Editors` (§3.2, optional now that plugin operations work through the existing editors). The decision it prepares: how built-in features, companion files, page patterns and project plugins register through one interface, so that the public plugin API is "publish what we already use" (ARCHITECTURE §5.1) and a new page pattern or section kind touches one module in core and one in the adapter instead of about eight places.

## 1. Where we are

*Exists.* `SpecSection` (`packages/core/src/section.ts`): a top-level key of `smithable.yml` with its JSON Schema, a parser into the IR and its operations. Six built-ins register through it: app, models, actions, queries, pages, navigation. `OPERATIONS` is the flat list of their operations (`apply.ts`).

*Exists.* `SpecPlugin` (`packages/core/src/plugin.ts`): a project plugin is one ES module without imports, `{ key, description, schema, expand?, generate? }`. `expand` returns ordinary spec entries under models, actions, queries or pages, merged as if hand-written, so every built-in generator, migration, access rule and test applies. `generate` may write files only under `src/generated/plugins/<key>/`. The CLI loads plugins with `require`, Studio's tab with a dynamic import of `/api/plugins/<key>.mjs`; they are declared in `smithable.context.yml`. `smithable teach <key>` has a model write one.

What does not fit the model yet:

| | Today | Consequence |
|---|---|---|
| Rule, access, editSpec, ux, content and context operations | hang off the `app` section (`sections/app.ts`) | The section interface is nominal for anything cross-cutting |
| `smithable.auth.yml`, `.ux.yml`, `.content.yml`, `.context.yml` | free validator functions, wired by hand in `apply.ts` | A new companion or a new key in one means editing `apply.ts` and the model operations that cascade into it |
| Renames and removals | cascade code lives in `model-operations.ts` and knows the ux and content file layout | Growth of the ux vocabulary means editing model operations |
| Page patterns (crud, landing, dashboard, settings, onboarding) and landing section kinds | closed unions in `ir.ts`; special-cased in `pages.ts`, `ux.ts` (icons), `content.ts` (texts), `navigation.ts` (defaults), the adapter's `generateApp` dispatch and `Landing.tsx` | About eight places per new pattern or section kind |
| Plugins | can only add named entries; no operations, no summary, no behaviour hooks | A plugin section is invisible in the CLI, MCP, Builder and the AI's operation list, and cannot add a field to an existing model or a section to the home page |
| Adapter | `generateApp` hard-codes every section; one hook for plugin files | The adapter side of "each feature registers its generator" does not exist |

## 2. Goals and non-goals

Goals:

1. One registration shape for built-in sections, companions and plugins. Composition, not special cases: `OPERATIONS`, the JSON Schema, the Builder summary and the rename cascades are all folded from the registrants.
2. Page patterns and landing section kinds become registries, in core and in the adapter.
3. Plugins gain operations, a summary, patching of existing entries, and behaviour hooks, in that order of value.
4. Every step keeps generation byte-identical for the examples and leaves the spec grammar unchanged, so it can land before M16 without a spec migration.

Non-goals (for now): publishing the API, npm plugins, plugin-defined field types, a second adapter. The API stays private until a second adapter or several real plugins exist (ARCHITECTURE §5.1).

## 3. The shape

### 3.1 Spec sections (extend what exists)

```ts
export interface SpecSection<K extends SectionKey = SectionKey> {
  key: K;
  required: boolean;
  schema: JsonSchema;
  parse(ctx: ParseContext, node: ParsedNode | null | undefined, parsed: Partial<SpecIR>): SpecIR[K];
  operations?: AnyOperation[];
  /** Builder's "Your app": this section's part of the summary. */
  summarize?(ir: SpecIR, companions: Companions): SummarySection[];
  /** A concept was renamed or removed elsewhere: keep this section's references right. */
  onRename?(event: RenameEvent, editors: Editors, ir: SpecIR): void;
  onRemove?(event: RemoveEvent, editors: Editors, ir: SpecIR): Refusal | void;
}

export type RenameEvent =
  | { kind: "field"; model: string; from: string; to: string }
  | { kind: "model"; from: string; to: string }
  | { kind: "page"; from: string; to: string };
export type RemoveEvent =
  | { kind: "field"; model: string; field: string }
  | { kind: "page"; page: string }
  | { kind: "section"; page: string; section: string };
/** A registrant may refuse a removal, naming what still uses the concept. */
export interface Refusal { message: string }
```

`applyOperation` gains one step: after `op.apply`, for each `Effect` of kind rename or remove it calls every registrant's `onRename`/`onRemove`. The cascades now in `model-operations.ts` (ux columns and field order, content labels, `ownedBy`, formulas, tiles, onboarding steps) move to the registrant that owns each file or key. A refusal fails the operation with the registrant's message, which is what the C6 fix does by hand today for dashboard tiles.

### 3.2 Companions (new)

```ts
export interface Companion<T> {
  /** The file and its version key: "smithable.ux.yml", "smithableUx". */
  file: string;
  versionKey: string;
  schema: JsonSchema;
  /** Validates the whole file against the finished spec IR. */
  validate(source: Source, ir: SpecIR): { value?: T; diagnostics: Diagnostic[] };
  operations?: AnyOperation[];
  summarize?(value: T, ir: SpecIR): SummarySection[];
  onRename?(event: RenameEvent, editor: YamlEditor, value: T, ir: SpecIR): void;
  onRemove?(event: RemoveEvent, editor: YamlEditor, value: T, ir: SpecIR): Refusal | void;
}
export const COMPANIONS = [authCompanion, uxCompanion, contentCompanion, contextCompanion];
```

`Editors` becomes a map keyed by companion (`editors.spec`, `editors.for(companion)`); `apply.ts` loops over `COMPANIONS` for validation instead of naming each file. The `app` section keeps only `app`'s own operations; rule and editSpec operations register on `specSection` (a small registrant for the file as a whole), access operations on `models` and `pages` (where the `access` keys live).

### 3.3 Page patterns and landing sections (new registries)

```ts
export interface PagePattern<P extends { kind: string }> {
  kind: P["kind"];
  /** Schema of the page key that selects the pattern (`crud`, `landing`, `dashboard`, …). */
  schema: JsonSchema;
  parse(ctx: ParseContext, page: string, value: ParsedNode, parsed: Partial<SpecIR>): P;
  models(pattern: P): string[];
  inMainMenuByDefault: boolean;
  defaultIcon?(pattern: P, ir: SpecIR): string;
  /** Paths in smithable.content.yml this pattern's texts live at. */
  contentKeys?(pattern: P, page: string): string[][];
  operations?: AnyOperation[];
  onRename?/onRemove? as above, scoped to the pattern's own references
}
export interface LandingSectionKind<S> { kind: string; schema: JsonSchema; parse(...): S; models(section: S): string[]; contentKeys(section: S): string[][] }
```

`PageIR.pattern` stays a discriminated union for the built-ins (typed through the registry's generic parameter), so `pages.ts`, `ux.ts`, `content.ts` and `navigation.ts` stop enumerating kinds and ask the registry. A plugin may register a pattern later; this is the seam, not a promise.

### 3.4 Adapter registrants

```ts
export interface SectionGenerator { key: SectionKey | string; files(ir: SpecIR, ctx: GenerateContext): GeneratedFile[]; kit?: string[] }
export interface PatternGenerator { kind: string; route(page: PageIR, ir: SpecIR, ctx: GenerateContext): GeneratedFile[]; kit?: string[] }
export interface SectionKindGenerator { kind: string; component(section, page, ir, ctx): string; kit?: string[] }
```

`generateApp` becomes: scaffold, then every `SectionGenerator`, then for each page its `PatternGenerator`, then the plugin folders. `kit` lists the kit files a registrant needs, so "only what is used" (§6.3) is computed rather than hand-maintained. `Landing.tsx` splits into one file per section kind. Regex surgery on generated text (`literal(...).replace`, the `texts=` injection, dashboard grid merging) is replaced by builders that return the pieces to compose. The byte-identity test over the examples is the guard for every step.

### 3.5 Plugins v2

```ts
export interface SpecPlugin {
  key: string;
  description: string;
  schema: JsonSchema;
  expand?(value): Record<string, Record<string, unknown>>;                 // exists: new entries
  patch?(value, ir: SpecIR): Patch[];                                        // new: changes to existing entries
  generate?(value, ir): { path: string; content: string }[];                // exists
  operations?: AnyOperation[];                                               // new
  summarize?(value, ir): SummarySection[];                                   // new
  hooks?(value, ir): { model: string; event: "afterCreate" | "afterUpdate" | "afterDelete"; module: string }[]; // new, §3.6
}
export type Patch =
  | { add: "field"; model: string; field: string; type: string }
  | { add: "section"; page: string; section: string; value: unknown }
  | { add: "menu"; menu: string; page: string; position?: number }
  | { add: "public"; kind: "pages" | "read" | "create"; name: string }
  | { add: "text"; path: string[]; text: string };
```

Patches are applied to the document after `expand`, with the same rules: conflicts are errors reported at the plugin's section; a patch never removes or changes what `smithable.yml` says, only adds. That is what makes a taught plugin safe to regenerate without AI.

Plugins are still one ES module without imports, so operations they define cannot import `OperationError` or `didYouMean`. The module therefore exports either an object (today's form, kept) or a factory that receives a small API:

```ts
export default (api: PluginApi) => ({ key: "newsletter", …, operations: [ { name: "addList", schema, summary, positional, describe, destructive: () => false, apply(editors, args, ir) { if (…) throw new api.OperationError("…"); editors.spec.add([…]); return []; } } ] });
interface PluginApi { OperationError: typeof OperationError; didYouMean: typeof didYouMean; identifier: typeof identifier; kebab: typeof kebab }
```

A plugin operation joins `OPERATIONS` like any other, so it appears in `smithable op`, the MCP tool list, Studio's schema-driven Operation form and the AI's signature list with no further code. Its name is prefixed by the plugin key when it clashes with a built-in (`newsletter:addList`).

### 3.6 Behaviour hooks in generated apps

The one thing neither `expand` nor custom actions cover is "when a record changes, do something". Rather than a new spec construct per case (jobs, email, webhooks), the adapter generates one hook file:

```ts
// src/generated/hooks.ts (generated; imports custom and plugin hook modules at declared points only)
import * as custom from "../custom/hooks";        // stub created once: export const afterCreate = {}, …
import * as newsletter from "./plugins/newsletter/hooks";
export const hooks: Hooks = merge(custom, newsletter);
export interface Hooks { afterCreate: Partial<Record<ModelName, Hook>>; afterUpdate: …; afterDelete: …; daily: (() => Promise<void>)[] }
```

The generated data functions call `hooks.afterCreate.Customer?.(record, viewer)` after the write, in the same request. `daily` runs from the production server's timer. This passes ARCHITECTURE §2.4 as a mechanism (it adds no grammar) and gives plugins and custom code a place for behaviour without touching generated files. Jobs, when they arrive as a construct, generate onto it.

## 4. Migration, in order

Each step is one change with a guard that must be green before and after.

| Step | Change | Guard |
|---|---|---|
| 1 | `onRename`/`onRemove`/`summarize` on `SpecSection`; the cascades leave `model-operations.ts` for the sections and companions that own each reference | `apply.test.ts` cascade cases (C6), byte-identical `examples/` output, `summary.test.ts` |
| 2 | `Companion` registry; `apply.ts` loops over registrants; operations leave `app` | `smithable.schema.json` unchanged (the schema test), all spec and companion fixtures, `pnpm test:apps` |
| 3 | Page pattern and landing section registries in core | IR snapshot tests, the invalid-spec fixtures' line numbers |
| 4 | Adapter split: `SectionGenerator`, `PatternGenerator`, `SectionKindGenerator`; builders instead of regex | `generate.test.ts` byte identity over every example, `pnpm test:apps` |
| 5 | Plugin factory form, `patch`, `operations`, `summarize` | the newsletter teach test extended with a subscribe section on the home page and an `addList` operation visible in `smithable op`, the MCP tool list and Studio |
| 6 | Hooks file and `hooks` in plugins | a test app whose `afterCreate` hook writes a row; the smoke tests |
| 7 | Builder forms from schema annotations (`x-smithable: { ref: "model" \| "field" \| "page" \| "role" \| "choiceValue" }`) | `pnpm test:studio` on every Builder form it covers today |

Steps 1 to 3 are core only and small (each under a day). Step 4 is the largest and is pure refactoring. Steps 5 to 7 are the features. Stop after any step; each leaves the codebase better than before.

## 5. Constraints that must hold

- Engine rule (§1): registrants and plugins are pure and browser-safe. Operations edit `YamlEditor`s and throw `OperationError`; no I/O.
- Determinism: `patch` and `generate` are functions of their inputs; the byte-identity test covers plugin output too.
- Trust (§5.1): a plugin runs code. Locally it is trusted like a dependency; hosted, only vetted plugins and those written by `teach` in the user's own project. Plugin operations get the same argument check (`checkJson`) as built-ins, so MCP and the AI cannot pass extra keys.
- Companions never mix concerns: a plugin patch to `smithable.content.yml` may only add default texts for its own keys; it may never name technology outside `smithable.context.yml`.

## 6. Open questions

- Plugin versioning: a taught plugin is pinned by its file in the project; an npm plugin would need `smithable.lock` to record its version. Later.
- Should `PageIR.pattern` become `{ kind: string; [key: string]: unknown }` for plugin patterns, or stay a closed union with a registry for behaviour? Leaning: closed union until a plugin pattern exists.
- Hooks in the preview: `daily` needs a scheduler in the dev server. A "run now" button in Studio may be enough for M15.5.

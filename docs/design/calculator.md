# Calculators, and pages and sections of your own (design)

Status: proposed 2026-09-30 by Fable, from the question "what about a calculator that is bound to no model: inputs, a slider, results computed as you type?". It adds one page pattern that is also a landing section (`calculator`), one formula function (`PMT`), and the escape hatch for everything more interactive (`custom` pages and sections, created once in `src/custom/`). Merging this document is the go-ahead; §5 splits the work. What it does not add is a component vocabulary (`input`, `output`, `row`, `button`): that is a UI framework in YAML, unbounded and ambiguous for the AI, and the three constructs here cover the calculator without it.

Against ARCHITECTURE §2.4: calculators are common (mortgage and loan, price and quote estimators, ROI, BMI, savings, "how many do I need"); the formula engine already exists and already runs in forms as you type; the alternative is a hand-written React component per calculator; nothing names a technology; and a formula is checked, testable with `examples` and readable in the Builder, which custom code is not.

Built 2026-09-30 (Fable): §2 and §3 as designed (core, the kit's `Calculator.tsx`, the page route and the landing section, `PMT`, examples as tests, the field operations on a calculator, `addCalculatorPage`, the content keys), except `results: beside | below` in the ux file and the tier-0 phrase; §4 (`custom` pages and sections) is not built yet. `results: beside | below` (under a calculator page's `form` in the ux file) and the booking landing's `estimate` calculator with its browser step built 2026-10-01 by Opus.

## 1. What people get

- **A calculator page** (`/mortgage`): a form of a few inputs and, under or beside them, results that change as you type. Nothing is saved, no account is needed unless the page's access says so, and a phone shows results under the inputs, a wide screen beside them.
- **A calculator on a landing page**, a section among the others ("See what you'd pay"), the usual marketing case.
- **Inputs that fit their numbers:** a bounded number can be a slider or a stepper ([look.md](look.md) §1.1), a choice buttons, exactly as in every other form.
- **Results with meaning:** a money result shows as money, a percentage as one, a date as a date; a result can be text ("You'd save 3 years").

## 2. The spec

```yaml
pages:
  mortgage:
    calculator:
      fields:
        price:   { type: money, min: 0, default: 300000 }
        deposit: { type: money, min: 0, default: 60000 }
        years:   { type: int, min: 5, max: 40, default: 25 }
        rate:    { type: decimal, min: 0, max: 20, default: 4.5 }
        monthly: { type: money, formula: PMT(rate / 100 / 12, years * 12, price - deposit) }
        total:   { type: money, formula: monthly * years * 12 }
        interest: { type: money, formula: total - (price - deposit) }
      examples:
        - input: { price: 300000, deposit: 60000, years: 25, rate: 4.5 }
          expected: { monthly: 1334, total: 400200 }
```

- **`fields`** are written exactly as a model's: the same types, `min`/`max`, `default`, choices, `formula`. Entered fields are the inputs; formula fields are the results. No references, lists or pictures (a calculator has no records to point at; validation says so), and no `unique` or `!` (nothing is stored, so nothing is required: an empty input counts as 0 or "" as in every formula).
- **Formulas** are the spec's formulas, unchanged, over the calculator's own fields. `PMT(rate, periods, amount)` is added: the payment per period of a loan, the spreadsheet function, so loan calculators do not need custom code. It rounds as `ROUND` does, to the field's type.
- **`examples`** become tests, as a formula's do; here one example checks several results at once.
- **Nothing else:** no `model`, no data functions, no access rules beyond the page's `access`, no records. A calculator whose results should be saved is a model with computed fields and a crud page, which exists today.
- **As a landing section:** `pages.home.landing.estimate: { calculator: { fields: … } }`, any name, texts keyed under the section as for every other section. The same object, the same rendering, the landing page's frame.
- **Texts** in `smithable.content.yml` under the page (`pages.mortgage: { title: What would I pay?, fields: { rate: { label: Interest rate, help: Your bank's yearly rate } }, results: { title: Your payment } }`): a calculator's fields belong to the page, since there is no model.
- **Presentation** in `smithable.ux.yml` as a form's: `form: { fieldOrder, control: { years: slider, rate: slider }, sections, columns }` (look.md §1.1–1.2), plus `results: beside | below` (the default is beside on wide screens).

## 3. How it works

- **Core:** the `calculator` pattern registers in `PAGE_PATTERNS` like the others (no model, no menu by default when it is a section, in the menu when a page, icon `chart`), parses its fields with the field parser models use (a `FieldsIR` shared with `ModelIR`, so every field check, formula check and `follow` applies), refuses references, lists, pictures, `!` and `unique` with clear messages, and checks `examples`. Field operations accept a calculator's page name where they take a model (`addField mortgage rate decimal --min 0 --max 20`, `changeField`, `renameField`, `removeField`), so the Builder's field forms work on a calculator without new forms; `addCalculatorPage page [field=type …]` adds one, and the landing section is added as sections are. The index describes it in one sentence per result ("Monthly is the payment of price minus deposit over years at rate").
- **Adapter:** one kit component, `Calculator.tsx`, which is `ModelForm` without a submit: the same `FieldInput`s, the same generated formula module (`src/generated/<page>.formulas.ts`, evaluated in the browser as forms do today), results rendered read-only with the field's format. A page route with no server function; on a landing page a section around the same component. Formula tests from `examples` go where model formula tests go.
- **Access:** a calculator page is a page like any other for `access` and `public.pages`; it needs no sign-in by itself and reads nothing, so a public calculator exposes nothing.

## 4. Pages and sections of your own: `custom`

For what no pattern and no formula covers (a chart of the repayment over time, a map, a drag-and-drop planner, an embedded video), the spec names the thing and hands the code to `src/custom/`, the contract actions and queries already have:

```yaml
pages:
  planner:
    custom: Planner              # src/custom/pages/Planner.tsx, created once
    access: [member]
  home:
    landing:
      hero:
      repayment: { custom: RepaymentChart }   # src/custom/sections/RepaymentChart.tsx, created once
```

- This completes a path that half exists: `smithable customize page:<page>` already moves a hand-edited list component into `src/custom/pages/` and generates the route again (ARCHITECTURE §6.5), and `custom` is listed among the page patterns still to come. A custom page written from a `customize` and one written from scratch are the same thing: a route Smithable owns around a component you own.
- The value is the component's name. Smithable creates the file **once** as a stub that renders the section's or page's title from the content file, and never changes it. The page's route, access, navigation entry and icon are Smithable's as for any page; a section's place and texts are the landing page's. Removing the page or section leaves the file (it is yours).
- A custom page or section gets the kit's props for its kind (the page's texts; a section's texts and its name), typed in `src/generated/`, so a change of name fails type checking rather than silently rendering nothing.
- `smithable code page:planner "<what to do>"` has a model write it under the usual rules (only `src/custom/` changes, the type check and tests pass). The Builder shows a custom page or section as "Planner, a page of your own", and its texts are editable like any section's.
- A custom page has no data functions; code that reads records imports the generated data functions, which apply the access rules, as custom queries do.

This is the boundary: the ux file chooses looks, the spec names what exists, and custom code is a named thing in a file. Nothing in YAML ever describes an element.

## 5. Order of work

1. **Core:** `FieldsIR` shared by models and calculators, the `calculator` pattern (page and section), `PMT`, examples over several results, field operations on a calculator, `addCalculatorPage`, phrases ("add a mortgage calculator with price, deposit, years and rate" is a tier-0 phrase when every field is `name=type`), index and summary. Fable.
2. **Adapter:** `Calculator.tsx`, the page route and the section, the generated formula module for a page, formula tests from `examples`, the `data-kit="calculator"` hook (look.md §2.2). Opus.
3. **`custom` pages and sections:** the pattern and section kind in core (a name, no fields), the one-time stub and typed props in the adapter, `smithable code page:` and `section:` targets, Builder's wording. Opus, after 2.
4. **Example:** the booking starter's landing page gets an `estimate` section (classes per month and the pass that pays off) or, if that reads as clutter, the CRM gets a `/quote` calculator; `test-apps` types into it in a browser and reads a result. Whichever is chosen also serves as the Look tab's demo of a slider.
5. **Docs:** spec (a "Calculators" subsection under pages, `PMT` under formulas, "Custom pages and sections"), ARCHITECTURE §6.3 (ownership zones: `src/custom/pages`, `sections`, `styles.css`) and §10.4, ROADMAP.

Apps without a calculator or a custom page stay byte-identical.

## 6. Out of scope, for later

- **Tables of results** (an amortisation schedule: one row per year). A formula over a range is a loop, which the spec keeps out; a custom section is the way, and a `SERIES` function would be the candidate if calculators keep asking for it.
- **Saving a calculation** or sending it by mail: a model and an action, which exist.
- **Charts of results:** the dashboard's charts are over records; a chart of a formula over an input's range is the same "loop" question as the table.

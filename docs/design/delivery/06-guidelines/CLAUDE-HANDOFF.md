# Implementation handoff for Claude

Implement the generated-app design system shown in this package, not Smithable's app-builder chrome. The existing screenshots identify the data and current functionality; they are not the target styling.

## Recommended order

1. Load theme/mode tokens from `02-tokens/themes.css`. Preserve existing token names. Add semantic success and warning pairs. Map the foundation scale into the Tailwind/shadcn theme using the project's installed versions.
2. Build shared primitives: Button, Badge, Input, Textarea, Select/Combobox, Checkbox/Switch, Card, Table, Dialog, Alert, Skeleton and navigation.
3. Add the responsive shell and list pattern. The 390 px record-card pattern is a first-class representation of the same records. Do not squeeze the desktop table into a narrow viewport.
4. Implement the form renderer from field metadata. Required state, error, help text and read-only computed values must be consistent across every field type.
5. Implement detail + related records, dashboard, settings, onboarding, sign-in and reusable landing sections.
6. Build Acme CRM in corporate/compact; Stillwater Yoga in playful/comfortable; Invoicely in modern/comfortable.
7. Run the acceptance checks below and bring the built apps back for review.

## Exact acceptance targets

- All four theme presets in both modes. Preview a list and a form in all eight combinations before expanding implementation.
- 1440 px desktop, 390 px phone; also verify 320 px reflow and 200% zoom. No document-level horizontal scrolling.
- Desktop compact controls may be 36 px tall for fine pointers. At coarse pointer or narrow widths use minimum 44 × 44 px interactive targets. Variable-height rows must accommodate wrapped names.
- Text contrast >=4.5:1; large text >=3:1; meaningful input boundaries, chart marks and focus indicators >=3:1 against adjacent backgrounds. Re-run on actual computed colours, including user brand overrides.
- Keyboard focus must survive dark mode, disabled siblings, sticky headers and open drawers. All icon actions have accessible names.
- Test 0 records, filtered zero results, 200 records, missing phone/manager/notes, €0.00 and €1,000,000.00, the long Mariehamn company name, its long address, and å/ä/ö.
- Verify form submission errors, failed requests with retry, stale linked records, duplicate submit prevention and computed-value updates.
- Invoice arithmetic: 2 × €600 + 5 × €450 + 4 × €350 = €4,850.00; the example tax rate is 0%, not a universal tax rule.
- Deletion defaults to Cancel. Related records block deletion until a deliberate policy is implemented; no silent cascading.

## Keep semantics as well as appearance

Use real headings, labels, links, buttons and table headers. A row is not a replacement for a keyboard-operable record link. Display loading text to assistive technology; mark the relevant region busy. Preserve focus after create/delete/navigation. Announce save success politely and show errors inline plus an error summary for multi-field failures.

Mobile card order: name, secondary identifier/contact, status/segment, key numeric value. Secondary fields remain on the detail page. Keep amounts complete and unbroken. For actions without room, use an explicitly labelled menu with a 44 px trigger.

Use a real chart component, not the SVG mockup as the chart. Include a data table/summary, labels and distinguishable marks. The line chart in the initial visual designs is illustrative, not a source of financial data; connect the implementation to internally consistent fixture data.

The sign-in design includes Google/Facebook and email/password variants. Show only configured providers. Do not display missing environment variables, development-admin bypasses or implementation instructions to end users.

## Review status

No reference app implementation exists in this package. Mark the milestone “design proposal delivered; implementation review pending”. Do not infer approval from a generated file or this handoff.

# Design brief: Smithable's themes, components and page patterns

## 1. What Smithable is, in one page

Smithable builds web apps from a short description of what they do: which records they store (customers, orders, bookings), who may do what, and which pages they have. The same description can be changed at any time, and the app's code is regenerated. Two kinds of people use it: people who are not developers (they describe and click), and developers and agencies (they work with the code). Every app is an ordinary web app its owner can take anywhere.

Because thousands of different apps are made from the same parts, **the design is not for one app: it is a system** of themes, components and page patterns that makes *any* app built from them look professional, on desktop and mobile, without anyone designing that app. Users choose a theme and, at most, a brand colour and a font. They never write CSS.

What exists today is functional but plain: see the screenshots in `current/`. Your work replaces its look entirely.

## 2. What you do not need to know

You do not need to read code or understand how Smithable works. The generated apps are built with **shadcn/ui** components and **Tailwind CSS 4**; designing with the shadcn/ui Figma kit (or equivalent components) as a starting point is ideal, because your designs will be implemented with exactly those components. A developer turns your files into code.

## 3. Deliverables

Deliver one Figma file, organised as below, plus the token export in item 3.1.

### 3.1 Four theme presets

Names: **modern**, **minimal**, **playful**, **corporate**. The four should feel clearly different, and each should suit business apps (a CRM or an invoicing tool must look trustworthy even in "playful").

For each preset, in **light and dark**:

| Token | Used for |
|---|---|
| `background`, `foreground` | Page background and body text |
| `card`, `card-foreground` | Cards, tables, forms |
| `primary`, `primary-foreground` | Main buttons, links, selected navigation |
| `secondary`, `secondary-foreground` | Secondary buttons |
| `muted`, `muted-foreground` | Subtle backgrounds, help text, table headers |
| `accent`, `accent-foreground` | Hover and selected backgrounds |
| `destructive`, `destructive-foreground` | Delete buttons, errors |
| `success`, `warning` (+ foregrounds) | Status badges and messages |
| `border`, `input`, `ring` | Borders, input borders, focus ring |
| `sidebar`, `sidebar-foreground` | Navigation sidebar |
| `chart-1` … `chart-5` | Chart series |

Plus:
- **Typography:** one or two fonts, with a type scale (page title, section title, body, small, label, table header, numbers). Fonts must be under an open licence (SIL OFL or similar) so apps can host them themselves; Google Fonts is fine.
- **Radius**, **shadows** (at most three levels) and a **spacing scale**.
- **Two densities:** comfortable (default) and compact (for data-heavy internal tools): row heights, input heights, paddings.

**Format:** Figma variables, and the same values exported as **W3C design-tokens JSON** or CSS custom properties. Colours in **OKLCH** (Tailwind CSS 4 uses it); hex alongside is welcome.

### 3.2 Brand-input rules (written, not only shown)

Users may give a **primary colour** and optionally a **font**. For each preset, describe as rules how the theme adapts, so a developer can implement them as a formula:
- which tokens are derived from the primary colour (e.g. `primary`, `ring`, `accent`, `chart-1`) and how (lightness and chroma in OKLCH, per light and dark mode);
- what happens when the colour is too light or too dark to meet contrast (e.g. text on it switches to dark, or lightness is clamped);
- which fonts may replace the preset's font (a short list, or rules such as "any sans-serif; headings keep the preset's weight").

Show three examples per preset: a blue, a saturated orange and a very light pastel.

### 3.3 Components

Every component in every state: default, hover, focus (keyboard), active, disabled, error, loading, and where relevant empty and read-only.

| Area | Components |
|---|---|
| Frame | App shell: sidebar navigation with the app name, menu groups, signed-in user with sign-out; its mobile form (menu button or bottom navigation); page header with title and actions |
| Lists | Table with column headers, text, numbers (right-aligned), amounts, dates, status badges, links to other records; row hover and click; search box; empty state ("No customers yet" + action) and "No customers match 'x'"; **how a table works on a 390 px phone** (it must not just overflow) |
| Forms | Every field type, with label, required mark, help text and error: text, long text, whole number, number, amount (currency), date, date and time, yes/no, email, phone, web address, a choice from a list, a link to another record (e.g. choose a customer), a user; computed read-only values (e.g. "Shipping cost: €15.00", updating as you type); form actions (save, cancel, delete) |
| Records | Detail page of a record with its related records (a customer and its orders) |
| Feedback | Confirm dialog for deleting; success and error messages; "you are not allowed to do this" and "not found" pages; loading state |
| Other | Buttons (primary, secondary, outline, ghost, destructive, icon), badges, cards, sign-in card with "Continue with Google / Facebook" |

Icons: **Lucide** (the icon set shadcn/ui uses).

### 3.4 Page patterns

Each at **1440 px (desktop)** and **390 px (mobile)**, in light and dark, filled with realistic content (see section 5):

1. **List / detail**: the list page, the detail page with related records, the create form.
2. **Dashboard**: stat cards (e.g. "Open orders 24, +12% this month"), a line chart, a bar chart, a list of recent items.
3. **Settings**: grouped settings with save.
4. **Onboarding**: a first-run flow of two or three steps, or an empty app with guidance.
5. **Sign-in**.
6. **Landing-page sections**, each a reusable block: hero (with and without an image), features (3 or 6), pricing (2 to 4 plans), testimonials, FAQ, call to action, footer. A landing page is a stack of these sections, in any order.

### 3.5 Three reference apps

Put it all together in three apps, each in a different preset, desktop and mobile:
- **Acme CRM** (internal tool, compact density): customers, orders, a customer's orders, search.
- **Stillwater Yoga** (a booking site): a public class schedule, class types, instructors, a "my bookings" page, and a small landing page.
- **Invoicely** (a small SaaS): a landing page with pricing, then after sign-in a dashboard, clients and invoices with invoice lines and totals.

The milestone is complete when you approve these three as implemented in code (you will review the built apps, not only your files).

## 4. Requirements

- **Accessibility:** WCAG 2.2 AA. Text contrast at least 4.5:1 (3:1 for large text and UI outlines), in every preset, in light and dark, including placeholder and disabled text where it carries meaning. Visible keyboard focus everywhere. Nothing may depend on hover alone, and nothing on colour alone (status badges have text).
- **Mobile:** every page works at 390 px wide, with no sideways scrolling of the page. Touch targets at least 44 × 44 px.
- **Real data:** long names ("Mariehamn Marine and Offshore Services AB"), long email addresses, amounts up to €1,000,000.00, empty values, 0 and 200 rows, and text in Swedish and Finnish (å, ä, ö) must all look intentional.
- **No bespoke artwork:** the system must work without illustrations or photos made for a specific app. Where a hero image is optional, show the section with and without it.
- **Buildable:** stay within what shadcn/ui components and Tailwind CSS can express; no custom animation choreography. When in doubt, ask.
- **Rights:** Smithable is open source, and the app kit is released under the 0BSD licence, so apps built with it carry no obligations. You deliver all work so that it can be released that way (a transfer of rights or an equivalent licence to Smithable). Fonts and icons must have licences that allow this (OFL, ISC, MIT).

## 5. Content to design with

Use these, not lorem ipsum:
- **Customers:** name, email, phone, segment (small business / enterprise / government), credit limit (amount), notes, account manager. Examples: Nordic Timber Oy, Baltic Freight AB, Skerry Software, Kallio Design, Arctic Outdoor Co.
- **Orders:** number (ORD-1001), customer, status (draft / placed / shipped / cancelled), total, shipping method (standard / express), shipping cost (computed), placed at.
- **Classes:** class type (Vinyasa, Yin, beginner / all levels / advanced), instructor, starts at, capacity, spots left.
- **Invoices:** number (2026-001), client, issued on, due on, status (draft / sent / paid / overdue), lines (description, quantity, unit price, amount), total.

## 6. What to deliver, and when to check in

1. **Week 1:** direction: the four presets on one list page and one form, light and dark. We review together before you go further.
2. **Then:** components and page patterns.
3. **Finally:** the three reference apps, the brand-input rules and the token export.

Out of scope: code, a logo or brand for Smithable itself, and designs for a specific customer's app.

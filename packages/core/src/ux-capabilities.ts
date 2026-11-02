// Bounded presentation capabilities shared by operation schemas and contextual editors.
// Keep this module free of registry/parser imports: themes may consult it during initialization.
export const NAVIGATIONS = ["sidebar", "topbar", "topbar-centered"] as const;
export const CHROMES = ["light", "dark"] as const;
export const ACTIVES = ["filled", "subtle", "underline"] as const;
export const LANDING_WIDTHS = ["contained", "wide", "full"] as const;
export const HEADER_LOOKS: Record<string, readonly string[]> = {
  position: ["sticky", "scrolling"],
  over: ["none", "hero"],
};

export interface UxCapability {
  label: string;
  operation: string;
  argument: string;
  scope: "app" | "page";
  kinds?: readonly string[];
  values: readonly string[];
  reset: string;
  fallback: string;
  path: readonly string[];
  rawPath: readonly string[];
  fixed?: Readonly<Record<string, string>>;
  requires?: "picture" | "thread" | "filters" | "capacity";
  structural: boolean;
  themeDefault: boolean;
}

export const UX_CAPABILITIES = {
  navigation: {
    label: "Menu layout",
    operation: "setMenuLayout",
    argument: "navigation",
    scope: "app",
    values: NAVIGATIONS,
    reset: "default",
    fallback: "sidebar",
    path: ["navigation"],
    rawPath: ["navigation"],
    structural: true,
    themeDefault: true,
  },
  chrome: {
    label: "Menu surface",
    operation: "setChrome",
    argument: "chrome",
    scope: "app",
    values: CHROMES,
    reset: "default",
    fallback: "theme",
    path: ["chrome"],
    rawPath: ["chrome"],
    structural: false,
    themeDefault: true,
  },
  menuActive: {
    label: "Active menu item",
    operation: "setMenuActive",
    argument: "active",
    scope: "app",
    values: ACTIVES,
    reset: "default",
    fallback: "auto",
    path: ["menuActive"],
    rawPath: ["menuActive"],
    structural: true,
    themeDefault: true,
  },
  width: {
    label: "Page width",
    operation: "setLandingWidth",
    argument: "width",
    scope: "page",
    kinds: ["landing"],
    values: LANDING_WIDTHS,
    reset: "contained",
    fallback: "contained",
    path: ["width"],
    rawPath: ["width"],
    structural: true,
    themeDefault: true,
  },
  headerPosition: {
    label: "Header position",
    operation: "setSectionLook",
    argument: "value",
    fixed: { section: "header", key: "position" },
    scope: "page",
    kinds: ["landing"],
    values: HEADER_LOOKS.position ?? [],
    reset: "default",
    fallback: "sticky",
    path: ["header", "position"],
    rawPath: ["header", "position"],
    structural: true,
    themeDefault: true,
  },
  headerOver: {
    label: "Header over picture",
    operation: "setSectionLook",
    argument: "value",
    fixed: { section: "header", key: "over" },
    scope: "page",
    kinds: ["landing"],
    values: HEADER_LOOKS.over ?? [],
    reset: "default",
    fallback: "none",
    path: ["header", "over"],
    rawPath: ["header", "over"],
    structural: true,
    themeDefault: true,
  },
  mark: {
    label: "Record marks",
    operation: "setTableMark",
    argument: "mark",
    scope: "page",
    kinds: ["crud"],
    values: ["initials", "picture", "none"],
    reset: "none",
    fallback: "none",
    path: ["mark"],
    rawPath: ["table", "mark"],
    requires: "picture",
    structural: true,
    themeDefault: true,
  },
  rowActions: {
    label: "Row actions",
    operation: "setRowActions",
    argument: "actions",
    scope: "page",
    kinds: ["crud"],
    values: ["below", "menu"],
    reset: "below",
    fallback: "below",
    path: ["rowActions"],
    rawPath: ["table", "actions"],
    structural: true,
    themeDefault: true,
  },
  filtersLook: {
    label: "Filter presentation",
    operation: "setFiltersLook",
    argument: "look",
    scope: "page",
    kinds: ["crud", "calendar"],
    values: ["default", "chips"],
    reset: "default",
    fallback: "default",
    path: ["filtersLook"],
    rawPath: ["filters", "look"],
    requires: "filters",
    structural: true,
    themeDefault: true,
  },
  calendarView: {
    label: "Calendar view",
    operation: "setCalendarView",
    argument: "view",
    scope: "page",
    kinds: ["calendar"],
    values: ["week", "agenda", "days"],
    reset: "week",
    fallback: "week",
    path: ["calendar", "view"],
    rawPath: ["calendar", "view"],
    structural: true,
    themeDefault: true,
  },
  capacityLook: {
    label: "Capacity presentation",
    operation: "setCalendarCapacity",
    argument: "look",
    scope: "page",
    kinds: ["calendar"],
    values: ["number", "pips", "bar"],
    reset: "number",
    fallback: "number",
    path: ["calendar", "capacity", "look"],
    rawPath: ["calendar", "capacity", "look"],
    requires: "capacity",
    structural: true,
    themeDefault: false,
  },
  recordHeader: {
    label: "Record header",
    operation: "setRecordSummary",
    argument: "look",
    fixed: { place: "header" },
    scope: "page",
    kinds: ["crud"],
    values: ["summary", "none"],
    reset: "none",
    fallback: "none",
    path: ["recordHeader"],
    rawPath: ["record", "header"],
    structural: true,
    themeDefault: true,
  },
  formAside: {
    label: "Form aside",
    operation: "setRecordSummary",
    argument: "look",
    fixed: { place: "aside" },
    scope: "page",
    kinds: ["crud"],
    values: ["summary", "none"],
    reset: "none",
    fallback: "none",
    path: ["formAside"],
    rawPath: ["form", "aside"],
    structural: true,
    themeDefault: true,
  },
  recordPictures: {
    label: "Record pictures",
    operation: "setRecordPictures",
    argument: "look",
    scope: "page",
    kinds: ["crud"],
    values: ["aside", "top", "none"],
    reset: "none",
    fallback: "none",
    path: ["recordPictures"],
    rawPath: ["record", "pictures"],
    requires: "picture",
    structural: true,
    themeDefault: true,
  },
  recordFirst: {
    label: "Record opening",
    operation: "setRecordFirst",
    argument: "first",
    scope: "page",
    kinds: ["crud"],
    values: ["form", "thread"],
    reset: "form",
    fallback: "form",
    path: ["recordFirst"],
    rawPath: ["record", "first"],
    requires: "thread",
    structural: true,
    themeDefault: true,
  },
  recordList: {
    label: "Related list presentation",
    operation: "setRecordList",
    argument: "look",
    scope: "page",
    kinds: ["crud"],
    values: ["table", "thread", "inline"],
    reset: "table",
    fallback: "table",
    path: ["lists"],
    rawPath: ["record", "lists"],
    structural: true,
    themeDefault: false,
  },
} as const satisfies Record<string, UxCapability>;
export type UxCapabilityId = keyof typeof UX_CAPABILITIES;

export interface UxChoiceContext {
  kind?: string;
  hasPicture?: boolean;
  hasThread?: boolean;
  hasFilters?: boolean;
  hasSummary?: boolean;
  headerOverHero?: boolean;
}
/** Explanations shared by controls and inherited-default compatibility checks. Core validation
 * remains authoritative when an operation applies the requested value. */
export function uxChoiceProblem(
  id: UxCapabilityId,
  value: string,
  context: UxChoiceContext,
): string | undefined {
  const cap: UxCapability = UX_CAPABILITIES[id];
  if (cap.scope === "page" && context.kind && !cap.kinds?.includes(context.kind))
    return `This choice is for ${cap.kinds?.join(" or ")} pages.`;
  if (
    ((id === "mark" && value === "picture") || (id === "recordPictures" && value !== "none")) &&
    !context.hasPicture
  )
    return "This model has no picture field.";
  if (id === "recordFirst" && value === "thread" && !context.hasThread)
    return "Choose a related list as a conversation first.";
  if (id === "filtersLook" && value === "chips" && !context.hasFilters)
    return "This page has no filters.";
  if ((id === "recordHeader" || id === "formAside") && value === "summary" && !context.hasSummary)
    return "This model has no status, amount or date fields to summarize.";
  if (id === "headerOver" && value === "hero" && !context.headerOverHero)
    return "A header can float over a cover or photo hero.";
  return undefined;
}

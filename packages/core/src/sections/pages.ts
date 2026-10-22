import { isMap, isScalar, isSeq, type ParsedNode } from "yaml";
import {
  type At,
  checkKeys,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNameList,
  readString,
} from "../context.js";
import {
  type FieldIR,
  type ModelIR,
  type PageIR,
  type PageSection,
  type PatternKind,
  type SpecIR,
  USER_MODEL,
} from "../ir.js";
import { capitalize, kebab } from "../naming.js";
import { PAGE_PATTERNS, PATTERN_KINDS, patternInfo, readSections } from "../patterns.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { checkDefaultFilter, checkFilterFields, checkSortableFields } from "./list-keys.js";
import { NAME_PATTERN, nameRule } from "./names.js";
import { pageOperations } from "./page-operations.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

const ROUTE_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/** Routes the generated app uses itself (see the deployment contract). */
const RESERVED_ROUTES = [/^\/health$/, /^\/api(?:\/|$)/, /^\/sign-in$/, /^\/files(?:\/|$)/];

/** The page kinds proper: `sections` is every page's, and a page of sections alone. */
const KINDS = PATTERN_KINDS.filter((k) => k !== "sections");

/** The section a page's kind brings, placed first unless its `sections` name it. */
function ownSections(pattern: PageIR["pattern"], model: string | undefined): PageSection[] {
  if (pattern.kind === "landing") return pattern.sections;
  if (pattern.kind === "sections") return [];
  if (pattern.kind === "dashboard") return [{ name: "dashboard", kind: "tiles", own: true }];
  const shown = model ?? ("model" in pattern ? pattern.model : undefined);
  return [
    { name: pattern.kind, kind: pattern.kind, own: true, ...(shown ? { model: shown } : {}) },
  ];
}

/** What a page kind's own section is called in a message. */
const OWN_LABELS: Partial<Record<PatternKind, string>> = {
  crud: "list",
  dashboard: "tiles",
  calendar: "calendar",
  calculator: "calculator",
  articles: "articles",
  order: "order form",
  users: "user list",
  data: "data view",
  review: "review list",
  settings: "form",
  onboarding: "steps",
  legal: "privacy text",
  custom: "component",
};

export const pagesSection: SpecSection<"pages"> = {
  key: "pages",
  required: false,
  operations: [
    ...pageOperations,
    ...PATTERN_KINDS.flatMap((k) => PAGE_PATTERNS[k].operations ?? []),
  ],
  follow(spec, effect, ir) {
    // Each page follows through its pattern: a search, a tile, an onboarding step.
    const notes: string[] = [];
    for (const page of ir.pages) {
      const followed = patternInfo(page).follow(spec, effect, ir);
      if (followed && "refusal" in followed) return followed;
      if (followed) notes.push(followed.note);
    }
    return notes.length ? { note: notes.join("; ") } : undefined;
  },
  schema: {
    type: "object",
    description: `The application's pages. Each page has one kind (${KINDS.slice(0, -1).join(", ")} or ${KINDS.at(-1)}), sections beside it, or sections alone.`,
    propertyNames: { pattern: NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      oneOf: [
        ...KINDS.map((k) => ({ required: [k] })),
        { required: ["sections"], not: { anyOf: KINDS.map((k) => ({ required: [k] })) } },
      ],
      additionalProperties: false,
      properties: {
        route: {
          type: "string",
          pattern: ROUTE_PATTERN.source,
          description: "Defaults to / plus the page name.",
        },
        ...Object.fromEntries(PATTERN_KINDS.map((k) => [k, PAGE_PATTERNS[k].schema])),
        actions: {
          type: "array",
          items: { type: "string" },
          description: "Actions offered on the page, as buttons.",
        },
        search: {
          type: "array",
          items: { type: "string" },
          description: "Fields the list can be searched by, e.g. [name, email].",
        },
        filters: {
          type: "array",
          items: { type: "string" },
          description:
            "Fields the list can be filtered by: choices and references as chips, numbers and dates as a range, yes/no as a toggle.",
        },
        defaultFilter: {
          type: "object",
          propertyNames: { pattern: "^[a-z][A-Za-z0-9]*$" },
          additionalProperties: { type: ["string", "boolean", "array"], items: { type: "string" } },
          description:
            'Filter values applied when the address says nothing, by filter, e.g. { startsAt: upcoming }: a date takes upcoming, past, today, thisWeek, thisMonth or a range; "all" in the address clears one.',
        },
        sortable: {
          type: "array",
          items: { type: "string" },
          description: "Fields the list can be sorted by, either way, from a Sort by control.",
        },
        mine: {
          type: "boolean",
          description:
            "The page lists only the viewer's own records (my items, my orders); it needs sign-in.",
        },
        favorites: {
          oneOf: [{ type: "boolean" }, { const: "only" }],
          description:
            "true: a heart on each record and a Saved view of the list; only: a list of the viewer's saved records.",
        },
        contact: {
          oneOf: [
            { type: "string" },
            {
              type: "object",
              required: ["to"],
              additionalProperties: false,
              properties: {
                to: { type: "string", description: "owner, or a user field of the model." },
                keep: {
                  type: "string",
                  description: "A model a copy of each message is stored in.",
                },
              },
            },
          ],
          description:
            "A contact block on the record page that mails the record's owner (or the user a field names): owner, a field, or { to, keep }.",
        },
        ...textSchema,
      },
    },
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const pages: PageIR[] = [];
    const routes = new Map<string, string>();
    for (const { key: id, keyNode, value } of mapEntries(ctx, node, `"pages"`) ?? []) {
      if (!NAME_PATTERN.test(id)) {
        ctx.error(keyNode, "invalid-name", nameRule("page", id));
        continue;
      }
      ctx.define("page", id);
      ctx.mark(`page:${id}`, keyNode);
      const page = readPage(ctx, id, keyNode, value, parsed);
      if (!page) continue;
      // The page's own route and any its pattern takes besides (a data page's model lists).
      for (const route of [page.route, ...patternInfo(page).routes(page.route)]) {
        const other = routes.get(route);
        if (other !== undefined && other !== id)
          ctx.error(
            keyNode,
            "duplicate-route",
            `Pages "${other}" and "${id}" both use the route ${route}.`,
          );
        routes.set(route, id);
      }
      pages.push(page);
    }
    // Files that wait for review with no page to approve them would wait for ever.
    const listed = new Set(
      pages.flatMap((p) => (p.pattern.kind === "review" ? p.pattern.models : [])),
    );
    for (const model of parsed.models ?? [])
      if (model.review && !listed.has(model.name))
        ctx.warning(
          node,
          "review-no-page",
          `${model.name}'s ${model.review.join(", ")} wait for review, but no review page lists ${model.name}, so nothing is ever approved.`,
          `Add one: smithable op addReviewPage (a page with "review: all").`,
        );
    return pages;
  },
};

function readPage(
  ctx: ParseContext,
  id: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
  parsed: Partial<SpecIR>,
): PageIR | undefined {
  const where = `page "${id}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: [
      "route",
      ...PATTERN_KINDS,
      "actions",
      "search",
      "filters",
      "defaultFilter",
      "sortable",
      "favorites",
      "contact",
      "mine",
      ...TEXT_KEYS,
    ],
    later: ["list", "calendar"],
    content: ["title", "label", "heading"],
    moved: {
      access: `who may open ${where} is said by the roles in smithable.auth.yml (roles.<role>.pages: [${id}], or all).`,
    },
  });
  let route = `/${kebab(id)}`;
  let pattern: PageIR["pattern"] | undefined;
  let sectionsNode: { value: ParsedNode | null; keyNode: ParsedNode } | undefined;
  let actions: string[] | undefined;
  const actionNodes = new Map<string, At>();
  let search: { name: string; at: At }[] | undefined;
  let filters: { name: string; at: At }[] | undefined;
  let defaultFilter: { name: string; value: string; at: At }[] | undefined;
  let sortable: { name: string; at: At }[] | undefined;
  let favorites: PageIR["favorites"] | undefined;
  let mine = false;
  let contact: { to: string; keep?: string; toAt: At; keepAt?: At } | undefined;
  for (const { key, value } of known) {
    if (key === "route") {
      const r = readString(ctx, value, `The route of ${where}`);
      if (r === undefined) continue;
      if (!ROUTE_PATTERN.test(r)) {
        ctx.error(
          value,
          "invalid-route",
          `Route "${r}" must start with "/" and use lowercase letters, digits, dashes and slashes.`,
        );
      } else if (RESERVED_ROUTES.some((reserved) => reserved.test(r))) {
        ctx.error(value, "reserved-route", `Route "${r}" is reserved for the application itself.`);
      } else {
        route = r;
      }
    } else if (key === "actions") {
      const listed = readNameList(ctx, value, `the actions of ${where}`);
      for (const { name, at } of listed) {
        ctx.reference("action", name, at);
        actionNodes.set(name, at);
      }
      actions = listed.map(({ name }) => name);
    } else if (key === "search") {
      search = readNameList(ctx, value, `the search of ${where}`);
    } else if (key === "filters") {
      filters = readNameList(ctx, value, `the filters of ${where}`);
    } else if (key === "defaultFilter") {
      // Each value as the address carries it: a list of values becomes "a,b", a yes/no "true".
      defaultFilter = [];
      for (const entry of mapEntries(ctx, value, `the default filter of ${where}`) ?? []) {
        const v = entry.value;
        const text = isScalar(v)
          ? String(v.value ?? "")
              .split(",")
              .map((part) => part.trim())
              .join(",")
          : isSeq(v)
            ? v.items.map((i) => (isScalar(i) ? String(i.value ?? "") : "")).join(",")
            : undefined;
        if (text === undefined || text === "")
          ctx.error(
            v,
            "invalid-default-filter",
            `The default filter of ${where} gives "${entry.key}" a value: a word, a range or a list of values.`,
          );
        else defaultFilter.push({ name: entry.key, value: text, at: v });
      }
    } else if (key === "sortable") {
      sortable = readNameList(ctx, value, `the sortable fields of ${where}`);
    } else if (key === "mine") {
      const v = readBoolean(ctx, value, `"mine" in ${where}`);
      if (v) mine = true;
    } else if (key === "favorites") {
      const v = isScalar(value) ? value.value : undefined;
      if (v === true) favorites = "all";
      else if (v === "only") favorites = "only";
      else if (v !== false)
        ctx.error(
          value,
          "invalid-value",
          `"favorites" in ${where} must be true (a heart and a Saved view) or only (the viewer's saved records).`,
        );
    } else if (key === "contact") {
      if (isScalar(value) && typeof value.value === "string") {
        contact = { to: value.value, toAt: value };
      } else if (isMap(value)) {
        const cw = `"contact" in ${where}`;
        const options = checkKeys(ctx, mapEntries(ctx, value, cw) ?? [], cw, {
          allowed: ["to", "keep"],
        });
        const to = options.find((o) => o.key === "to");
        const keep = options.find((o) => o.key === "keep");
        const toValue = to ? readString(ctx, to.value, `"to" in ${where}`) : undefined;
        if (!to)
          ctx.error(value, "missing-key", `${cw} needs "to": owner, or a user field of the model.`);
        else if (toValue !== undefined) {
          const keepValue = keep ? readString(ctx, keep.value, `"keep" in ${where}`) : undefined;
          contact = {
            to: toValue,
            toAt: to.value,
            ...(keepValue !== undefined ? { keep: keepValue, keepAt: keep?.value } : {}),
          };
        }
      } else {
        ctx.error(
          value,
          "invalid-value",
          `"contact" in ${where} is owner, a user field of the model, or { to, keep }.`,
        );
      }
    } else if (key === "sections") {
      // Read once the page's kind is known: its own kind's name places its own section.
      sectionsNode = { value, keyNode: known.find((e) => e.key === key)?.keyNode ?? keyNode };
    } else if (key in PAGE_PATTERNS) {
      pattern = PAGE_PATTERNS[key as PatternKind].parse(ctx, value, where, parsed);
    }
  }
  const patterns = known.filter((e) => (KINDS as readonly string[]).includes(e.key));
  if (patterns.length > 1) {
    ctx.error(
      patterns[1]?.keyNode ?? keyNode,
      "invalid-key",
      `${capitalize(where)} can use only one pattern: ${KINDS.join(", ")}.`,
    );
    return undefined;
  }
  // A page of parts and no kind: its sections alone (docs/design/page-sections.md §2).
  if (!pattern && sectionsNode && patterns.length === 0) pattern = { kind: "sections" };
  if (!pattern) {
    if (patterns.length === 0) {
      const examples = KINDS.map((k) => `"${PAGE_PATTERNS[k].example}"`);
      ctx.error(
        keyNode,
        "missing-pattern",
        `${capitalize(where)} needs a kind: ${examples.slice(0, -1).join(", ")} or ${examples.at(-1)}; or "sections" alone.`,
      );
    }
    return undefined;
  }
  const model = patternInfo({ id, route, pattern, sections: [] }).manages();
  // The page's sections: its kind's own first, unless the sections name the kind to place it.
  let sections = ownSections(pattern, model);
  if (sectionsNode && pattern.kind === "landing") {
    ctx.error(
      sectionsNode.keyNode,
      "invalid-key",
      `A landing page's sections are under "landing"; add them there (${where}).`,
    );
  } else if (sectionsNode) {
    const own =
      pattern.kind === "sections"
        ? {}
        : { kind: pattern.kind, label: OWN_LABELS[pattern.kind] ?? pattern.kind };
    const added = readSections(ctx, sectionsNode.value, where, parsed, own);
    const placed = own ? added.findIndex((s) => s.own) : -1;
    sections =
      placed >= 0
        ? [...added.slice(0, placed), ...sections, ...added.slice(placed + 1)]
        : [...sections, ...added];
    // A tile's or a step's name is a text key under the page too, so a section cannot share it.
    const taken = Object.keys(patternInfo({ id, route, pattern, sections: [] }).parts());
    for (const section of added.filter((s) => !s.own && taken.includes(s.name)))
      ctx.error(
        sectionsNode.keyNode,
        "duplicate-name",
        `${capitalize(where)} already has a part named "${section.name}" (a ${pattern.kind === "dashboard" ? "tile" : "step"}); give the section another name.`,
      );
    if (pattern.kind === "sections" && sections.length === 0)
      ctx.error(
        sectionsNode.keyNode,
        "missing-key",
        `${capitalize(where)} has no sections; a page of sections needs at least one, like "story: { text: }" or "team: { records: Instructor }".`,
      );
  }
  if (!model)
    for (const e of known.filter((e) =>
      [
        "actions",
        "search",
        "filters",
        "defaultFilter",
        "sortable",
        "favorites",
        "contact",
        "mine",
      ].includes(e.key),
    ))
      ctx.error(e.keyNode, "invalid-key", `"${e.key}" belongs to a crud page.`);
  // A standard action changes a record of its model, so it is offered on that model's page.
  for (const action of parsed.actions ?? []) {
    const at = actionNodes.get(action.name);
    if (model && actionNodes.has(action.name) && !action.custom && action.on !== model)
      ctx.error(
        at,
        "invalid-action",
        `The action "${action.name}" changes a ${action.on}, so it belongs on a crud page of ${action.on}, not on ${where}.`,
      );
  }
  if (!known.some((e) => e.key === "route") && RESERVED_ROUTES.some((r) => r.test(route))) {
    ctx.error(
      keyNode,
      "reserved-route",
      `Page "${id}" would use the route ${route}, which is reserved for the application itself.`,
      `Give it another name, or a "route".`,
    );
  }
  const checkedFilters =
    model && filters?.length ? checkFilterFields(ctx, filters, model, parsed, where) : undefined;
  return {
    id,
    route,
    pattern,
    sections,
    ...(model && actions?.length ? { actions } : {}),
    ...(model && search?.length ? { search: checkSearch(ctx, search, model, parsed, where) } : {}),
    ...(checkedFilters ? { filters: checkedFilters } : {}),
    ...(model && defaultFilter?.length
      ? (() => {
          const checked = checkDefaultFilter(
            ctx,
            defaultFilter,
            checkedFilters ?? [],
            model,
            parsed,
            where,
          );
          return Object.keys(checked).length ? { defaultFilter: checked } : {};
        })()
      : {}),
    ...(model && sortable?.length
      ? { sortable: checkSortableFields(ctx, sortable, model, parsed, where) }
      : {}),
    ...(model && favorites ? { favorites } : {}),
    ...(model && mine ? { mine: true as const } : {}),
    ...(model && contact ? checkContact(ctx, contact, model, parsed, where) : {}),
    ...readSemanticText(ctx, known),
  };
}

/** Text you can type into a search box: strings, text, emails, phone numbers, web addresses, choices; and references, by the related record's name. */
const SEARCHABLE = ["string", "text", "markdown", "email", "phone", "url"];

/** Whether a field's own value can be searched (references are searched by their record's name). */
const searchable = (field: FieldIR) =>
  !field.formula &&
  (field.type.kind === "choice" ||
    (field.type.kind === "scalar" && SEARCHABLE.includes(field.type.name)));

/** A model's fields a list can be searched by without naming them: its own text and choices. */
export function searchableFields(model: ModelIR): string[] {
  return model.fields.filter(searchable).map((f) => f.name);
}

function checkSearch(
  ctx: ParseContext,
  fields: { name: string; at: At }[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): string[] {
  const target = parsed.models?.find((m) => m.name === model);
  if (!target) return fields.map((f) => f.name); // reported as an unknown model
  for (const { name, at } of fields) {
    const field = target.fields.find((f) => f.name === name);
    if (!field) {
      ctx.error(
        at,
        "unknown-field",
        `${model} has no field named "${name}" to search ${where} by.`,
        didYouMean(
          name,
          target.fields.map((f) => f.name),
        ),
      );
    } else if (field.type.kind === "relation") {
      // A reference is searched by the related record's name: it needs a text field.
      const related = parsed.models?.find(
        (m) => field.type.kind === "relation" && m.name === field.type.model,
      );
      const named =
        field.type.model === "User" ||
        related?.fields.some((f) => f.type.kind === "scalar" && f.type.name === "string");
      if (field.type.many || !named)
        ctx.error(
          at,
          "invalid-search",
          field.type.many
            ? `"${name}" is a list of records; search the other page instead.`
            : `"${name}" cannot be searched: ${field.type.model} has no text field to search by.`,
        );
    } else if (!searchable(field)) {
      ctx.error(
        at,
        "invalid-search",
        `"${name}" cannot be searched: only stored text, email, phone, web address and choice fields, and references to records with a name, can.`,
      );
    }
  }
  return fields.map((f) => f.name);
}

/** A page's contact block: who it mails (the owner, or a user field of the model) and where a copy may be kept. */
function checkContact(
  ctx: ParseContext,
  contact: { to: string; keep?: string; toAt: At; keepAt?: At },
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): { contact?: PageIR["contact"] } {
  const target = parsed.models?.find((m) => m.name === model);
  if (!target) return {}; // reported as an unknown model
  if (contact.to !== "owner") {
    const field = target.fields.find((f) => f.name === contact.to);
    const toUser =
      field?.type.kind === "relation" && !field.type.many && field.type.model === USER_MODEL;
    if (!toUser) {
      ctx.error(
        contact.toAt,
        "invalid-contact",
        field
          ? `"${contact.to}" is not a user field of ${model}: a contact block mails the owner, or the user a field like "seller: User" names.`
          : `${model} has no field "${contact.to}": a contact block mails the owner, or the user a field like "seller: User" names.`,
      );
      return {};
    }
  }
  if (contact.keep !== undefined) {
    const kept = parsed.models?.find((m) => m.name === contact.keep);
    if (!kept) {
      ctx.reference("model", contact.keep, contact.keepAt ?? contact.toAt);
      return {};
    }
    const links = kept.fields.filter(
      (f) => f.type.kind === "relation" && !f.type.many && !f.formula,
    );
    if (links.length) {
      ctx.error(
        contact.keepAt ?? contact.toAt,
        "invalid-value",
        `A kept message's model cannot link to other records (${contact.keep} has ${links.map((f) => f.name).join(", ")}): the sender fills it in alone.`,
        "Use a model of its own for messages, e.g. Message with name, email and message.",
      );
      return {};
    }
  }
  return { contact: { to: contact.to, ...(contact.keep ? { keep: contact.keep } : {}) } };
}

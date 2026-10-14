// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  type PageIR,
  pageIcon,
  pascal,
  plural,
  type SpecIR,
  storesPictures,
  titleField,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { actionNames, askedFields } from "../actions.js";
import { hasSignIn } from "../auth.js";
import { savedToggle, trashNames } from "../data.js";
import {
  attr,
  code,
  DATA_LIMIT,
  dataKey,
  guard,
  HEADER,
  hasFavorites,
  importList,
  indexPath,
  join,
  keyOf,
  literal,
  modelNamed,
  names,
  ownerKey,
  paramsUsed,
  relatedTitle,
  standardActions,
  type Texts,
  tableRef,
  type Within,
} from "../shared.js";
import { actionButton } from "./record.js";
import { LUCIDE } from "./root.js";

type Favorites = PageIR["favorites"];

/** Fields every model has, which a list may be filtered or sorted by too. */
const AUTOMATIC: Record<string, { key: string; label: string }> = {
  createdAt: { key: "createdAt", label: "Added" },
  updatedAt: { key: "updatedAt", label: "Changed" },
};

/**
 * A list's filters (marketplace.md §2.2): each field's condition in the server function, its
 * control for the kit's Filters, and the choices a reference filter offers. References to
 * people who sign in (owner) are not filters yet: listing them would show every user's name.
 */
function filterCode(
  page: PageIR,
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  favorites?: Favorites,
  ownOnly?: boolean,
) {
  const n = names(model, t);
  const conditions: string[] = [];
  const controls: Record<string, unknown>[] = [];
  const options: string[] = [];
  const modules: { module: string; data: string }[] = [];
  let ranges = false;
  let lists = false;
  let toggles = false;
  let mine = false;
  // The viewer's saved records (marketplace.md §2.3): always (only), or in the Saved view.
  if (favorites) {
    lists = true;
    const savedOnly = `inArray(${n.table}.id, saved)`;
    conditions.push(
      favorites === "only" ? savedOnly : `data.view === "saved" ? ${savedOnly} : undefined`,
    );
  }
  // A page of only the viewer's own records (mine: true): always, so no Mine toggle there.
  if (ownOnly) {
    toggles = true;
    conditions.push(`eq(${n.table}.${ownerKey(model)}, viewer?.id ?? "")`);
  }
  for (const name of page.filters ?? []) {
    if (name === "owner" && ownOnly) continue;
    // The owner: a "Mine" toggle for those signed in, never a list of people.
    if (name === "owner") {
      mine = true;
      conditions.push(
        `data.f?.owner === "mine" && viewer ? eq(${n.table}.${ownerKey(model)}, viewer.id) : undefined`,
      );
      controls.push({ name, label: "Mine", kind: "mine" });
      continue;
    }
    const auto = AUTOMATIC[name];
    const field = model.fields.find((f) => f.name === name);
    const value = `data.f?.${name}`;
    if (auto) {
      ranges = true;
      conditions.push(
        `${value} ? inRange(${n.table}.${auto.key}, ${value}, "instant") : undefined`,
      );
      controls.push({ name, label: auto.label, kind: "range", input: "date" });
      continue;
    }
    if (!field) continue;
    const label = t.field(model, field).label ?? humanize(field.name);
    if (field.type.kind === "choice") {
      lists = true;
      const values = field.type.values;
      conditions.push(
        `${value} ? inArray(${n.table}.${dataKey(field)}, ${value}.split(",").filter((v) => ${literal(values)}.includes(v)) as (${values.map((v) => JSON.stringify(v)).join(" | ")})[]) : undefined`,
      );
      const labels = t.field(model, field).values ?? {};
      controls.push({
        name,
        label,
        kind: "chips",
        options: values.map((v) => ({ value: v, label: labels[v] ?? humanize(v) })),
      });
    } else if (
      field.type.kind === "relation" &&
      !field.type.many &&
      field.type.model !== USER_MODEL
    ) {
      lists = true;
      const target = modelNamed(ir, field.type.model);
      const tn = names(target, t);
      const title = relatedTitle(ir, target.name);
      modules.push({ module: `#/generated/${kebab(target.name)}.server`, data: tn.data });
      conditions.push(
        `${value} ? inArray(${n.table}.${dataKey(field)}, ${value}.split(",").map(Number).filter(Number.isInteger)) : undefined`,
      );
      // The related records the viewer may read, by their names.
      options.push(
        `${name}: (await ${tn.data}.list(viewer)).map((r) => ({ value: String(r.id), label: String(r.${title}) }))`,
      );
      controls.push({ name, label, kind: "chips", options: code(`options.${name}`) });
    } else if (field.type.kind === "scalar") {
      const kind = field.type.name;
      if (["int", "decimal", "money", "date", "datetime"].includes(kind)) {
        ranges = true;
        const how = kind === "date" ? '"date"' : kind === "datetime" ? '"instant"' : '"number"';
        conditions.push(
          `${value} ? inRange(${n.table}.${dataKey(field)}, ${value}, ${how}${kind === "money" ? ", 100" : ""}) : undefined`,
        );
        controls.push({
          name,
          label,
          kind: "range",
          input: kind === "date" || kind === "datetime" ? "date" : "number",
        });
      } else if (kind === "bool") {
        toggles = true;
        conditions.push(
          `${value} === "true" || ${value} === "false" ? eq(${n.table}.${dataKey(field)}, ${value} === "true") : undefined`,
        );
        controls.push({ name, label, kind: "toggle" });
      }
    }
  }
  // "Sort by": each field both ways, in words that fit its kind.
  const sorts = (page.sortable ?? []).flatMap((name) => {
    const auto = AUTOMATIC[name];
    const field = model.fields.find((f) => f.name === name);
    const label =
      auto?.label ?? (field ? (t.field(model, field).label ?? humanize(field.name)) : name);
    const key = auto?.key ?? (field ? dataKey(field) : name);
    const kind = auto ? "date" : field?.type.kind === "scalar" ? field.type.name : "string";
    const [up, down] = ["int", "decimal", "money"].includes(kind)
      ? ["low to high", "high to low"]
      : ["date", "datetime"].includes(kind)
        ? ["oldest first", "newest first"]
        : ["A to Z", "Z to A"];
    return [
      { value: key, label: `${label}, ${up}` },
      { value: `-${key}`, label: `${label}, ${down}` },
    ];
  });
  return {
    conditions,
    controls,
    options,
    modules,
    sorts,
    // A table's sortable columns, by the field's name: their key in the address.
    headers: Object.fromEntries(
      (page.sortable ?? []).flatMap((name) => {
        const field = model.fields.find((f) => f.name === name);
        return field ? [[name, dataKey(field)]] : [];
      }),
    ) as Record<string, string>,
    names: (page.filters ?? []).filter((name) => !(ownOnly && name === "owner")),
    columns: (page.sortable ?? []).map((name) => {
      const field = model.fields.find((f) => f.name === name);
      const key = AUTOMATIC[name]?.key ?? (field ? dataKey(field) : name);
      return `${key}: ${n.table}.${key}`;
    }),
    mine,
    favorites,
    imports: { ranges, lists, toggles: toggles || mine },
  };
}

/** A list's page in the address (?page=3): a positive whole number, else the first. */
const PAGE = "count(s.page)";

/** A searchable list's server function and route options: the search text is in the URL. */
export function searchCode(
  page: PageIR,
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  within?: Within,
  favorites?: Favorites,
  ownOnly?: boolean,
  /** The list's order until someone sorts it, as an SQL expression (the ux file's sort). */
  order?: string,
) {
  const n = names(model, t);
  // Filters and sorting live beside the search, in the address too (not inside a data page).
  const filtering =
    !within && (page.filters?.length || page.sortable?.length || favorites || ownOnly)
      ? filterCode(page, model, t, ir, favorites, ownOnly)
      : undefined;
  const fields = (page.search ?? []).map(
    (name) => model.fields.find((f) => f.name === name) as FieldIR,
  );
  const fn = `search${pascal(plural(model.name))}`;
  const labels = fields.map((f) => (t.field(model, f).label ?? humanize(f.name)).toLowerCase());
  // A reference is searched by the related record's name, e.g. an order by its customer.
  const own = fields.filter((f) => f.type.kind !== "relation");
  const terms = [
    ...(own.length
      ? [`contains([${own.map((f) => `${n.table}.${f.name}`).join(", ")}], data.q)`]
      : []),
    ...fields.flatMap((f) => {
      if (f.type.kind !== "relation") return [];
      const title = relatedTitle(ir, f.type.model);
      // Among the related records the viewer may read (a user's name is shown anyway).
      if (f.type.model !== USER_MODEL && title !== "id")
        return [
          `inArray(${n.table}.${dataKey(f)}, ${names(modelNamed(ir, f.type.model), t).data}.titled(viewer, data.q))`,
        ];
      const target = f.type.model === USER_MODEL ? "user" : tableRef(modelNamed(ir, f.type.model));
      return [`relatedContains(${n.table}.${dataKey(f)}, ${target}, [${target}.${title}], data.q)`];
    }),
  ];
  const byTitle = (f: FieldIR) =>
    f.type.kind === "relation" &&
    f.type.model !== USER_MODEL &&
    relatedTitle(ir, f.type.model) !== "id";
  // Related records found through their data module (titled), and the rest by their table.
  const titled = fields.filter(byTitle).map((f) => {
    const target = modelNamed(ir, (f.type as { model: string }).model);
    return { module: `#/generated/${kebab(target.name)}.server`, data: names(target, t).data };
  });
  const related = fields
    .filter((f) => f.type.kind === "relation" && !byTitle(f))
    .map((f) =>
      f.type.kind === "relation" && f.type.model === USER_MODEL ? "user" : "* as schema",
    );
  const placeholder = `Search by ${labels.length > 1 ? `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}` : labels[0]}`;
  if (filtering) {
    const searched = terms.length
      ? `data.q ? ${terms.length > 1 ? `or(${terms.join(", ")})` : terms[0]} : undefined`
      : "undefined";
    const view = favorites === "all";
    const keys = ["q", "sort", ...filtering.names];
    return {
      fn: `
/** The ${n.pluralLabel.toLowerCase()} matching the search and the filters, among those the viewer may read. */
const ${fn} = createServerFn()
  .validator(listQuery)
  .handler(async ({ data }) => {
    const viewer = await currentViewer();${
      favorites
        ? `
    const saved = ${n.data}.saved(viewer);`
        : ""
    }
    const where = and(
      ${[searched, ...filtering.conditions].join(",\n      ")},
    );${
      filtering.columns.length
        ? `
    // The order the viewer chose, among the fields the page offers; else the newest first.
    const order = orderOf({ ${filtering.columns.join(", ")} }, data.sort);`
        : ""
    }
    return {
      ...(await ${n.data}.page(viewer, where, ${filtering.columns.length ? (order ? `order ?? ${order}` : "order") : (order ?? "undefined")}, ${PAGED_ARGS})),
      canCreate: allows(${n.access}.create, viewer),
      options: { ${filtering.options.join(", ")} },${favorites ? "\n      saved," : ""}
    };
  });
`,
      options: `  validateSearch: (s: Search) => optional({ ${keys.map((k) => `${k}: text(s.${k})`).join(", ")}${view ? ', view: oneOf(s.view, ["saved"] as const)' : ""}, page: ${PAGE} }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: { q, sort, ${view ? "view, " : ""}page, ...f } }) => ${fn}({ data: { q, sort, ${view ? "view, " : ""}f, page } }),
  // While a search or filter loads, the page stays (and its controls keep their focus).
  pendingMs: Number.POSITIVE_INFINITY,
  gcTime: 0,
`,
      placeholder,
      filtering,
      imports: {
        related: [...new Set(related)],
        titled: [...titled, ...filtering.modules],
        own: own.length > 0,
        relation: related.length > 0,
        or: terms.length > 1,
      },
    };
  }
  return {
    fn: `
/** The ${n.pluralLabel.toLowerCase()} matching the search, among those the viewer may read. */
const ${fn} = createServerFn()
  .validator(listQuery)
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    const where = data.q ? ${terms.length > 1 ? `or(${terms.join(", ")})` : terms[0]} : undefined;
    ${listed(n, "where", within, order)}
  });
`,
    options: within
      ? `  validateSearch: (s: Search) => optional({ q: text(s.q) }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => ${fn}({ data: { q: deps.q } }),`
      : `  validateSearch: (s: Search) => optional({ q: text(s.q), page: ${PAGE} }),
  loaderDeps: ({ search }) => ({ q: search.q, page: search.page }),
  loader: ({ deps }) => ${fn}({ data: { q: deps.q, page: deps.page } }),
  // While a search loads, the page stays (and the box keeps its focus and text), never the
  // placeholder; coming back loads afresh instead of showing rows from before a change.
  pendingMs: Number.POSITIVE_INFINITY,
  gcTime: 0,
`,
    placeholder,
    imports: {
      related: [...new Set(related)],
      titled,
      own: own.length > 0,
      relation: related.length > 0,
      or: terms.length > 1,
    },
  };
}

/**
 * A list page in two parts: the route (loading, search, access) and the component. Generated,
 * both go in one route file; customized (ARCHITECTURE §6.4), the component moves to
 * src/custom/pages/ and reads the route's data with getRouteApi.
 */
export function listParts(
  page: PageIR,
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  ux: UxIR,
  within?: Within,
  auth?: AuthIR,
  /** A page of the owner's own (src/custom/pages), which reads the route through getRouteApi. */
  owned = false,
) {
  const n = names(model, t);
  // Hearts and the viewer's saved records (marketplace.md §2.3), for apps with sign-in.
  const favorites = !within && auth && hasFavorites(model, ir, auth) ? page.favorites : undefined;
  // Inside a data page, one of many lists: named after its model too.
  const component = `${pascal(page.id)}${within ? pascal(plural(model.name)) : ""}Page`;
  const path = indexPath(page.route);
  const actions = (page.actions ?? []).flatMap((name) =>
    ir.actions.filter((a) => a.name === name && a.custom),
  );
  // Only the viewer's own records (mine: true), for apps with sign-in.
  const ownOnly = Boolean(!within && auth && hasSignIn(auth) && page.mine);
  const filtered =
    !within && (page.filters?.length || page.sortable?.length || favorites || ownOnly);
  // The ux file's order, in the query: a page of a longer list is the right fifty, not fifty
  // sorted (a computed field is not a column, so it stays sorted in the page only).
  const sorted = within ? undefined : ux.pages[page.id]?.sort;
  const sortField = model.fields.find((f) => f.name === sorted?.replace(/^-/, ""));
  const order =
    sorted &&
    sortField &&
    !sortField.formula &&
    !(sortField.type.kind === "relation" && sortField.type.many)
      ? `${sorted.startsWith("-") ? "desc" : "asc"}(${n.table}.${dataKey(sortField)})`
      : undefined;
  const search =
    page.search?.length || filtered
      ? searchCode(page, model, t, ir, within, favorites, ownOnly, order)
      : undefined;
  const filtering = search && "filtering" in search ? search.filtering : undefined;
  const searchable = Boolean(page.search?.length);
  // A data page shows each model as it is: the presentation belongs to the model's own page.
  const presentation = within ? undefined : ux.pages[page.id];
  const columns = presentation?.columns?.map((name) => keyOf(model, name));
  const key = (name: string) => keyOf(model, name);
  const below = Object.entries(presentation?.below ?? {}).map(([c, f]) => [key(c), key(f)]);
  // The list's order until someone sorts it, and cards instead of a table on wide screens.
  const sort = presentation?.sort
    ? {
        field: key(presentation.sort.replace(/^-/, "")),
        descending: presentation.sort.startsWith("-"),
      }
    : undefined;
  const cards = presentation?.view === "cards";
  // A model with pictures shows the page's icon where a record has none (cards, its column).
  const icon = model.fields.some(storesPictures) ? LUCIDE[pageIcon(ux, page)] : undefined;
  // Inside a data page without a search, the list still loads the newest records only.
  const capped = within && !search;

  const route = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage");
  if (search) {
    route
      .add("@tanstack/react-start", "createServerFn")
      .add("#/db/schema", "* as schema", ...search.imports.related)
      .add(`#/generated/${kebab(model.name)}.server`, n.access, n.data)
      .add("#/kit/access", "allows");
    if (search.imports.or) route.add("drizzle-orm", "or");
    if (search.imports.own) route.add("#/kit/search", "contains");
    if (search.imports.relation) route.add("#/kit/search", "relatedContains");
    if (search.imports.titled.length || filtering?.imports.lists)
      route.add("drizzle-orm", "inArray");
    if (filtering) route.add("drizzle-orm", "and");
    if (filtering?.imports.toggles) route.add("drizzle-orm", "eq");
    if (filtering?.imports.ranges) route.add("#/kit/filter", "inRange");
    if (filtering?.columns.length) route.add("#/kit/filter", "orderOf");
    for (const t of search.imports.titled) route.add(t.module, t.data);
    route.add("#/lib/viewer.server", "currentViewer");
  } else {
    route
      .add("@tanstack/react-start", "createServerFn")
      .add(`#/generated/${kebab(model.name)}.server`, n.access, n.data)
      .add("#/kit/access", "allows")
      .add("#/lib/viewer.server", "currentViewer");
  }
  if (order)
    route
      .add("drizzle-orm", sorted?.startsWith("-") ? "desc" : "asc")
      .add("#/db/schema", "* as schema");
  const view = importList()
    .add("@tanstack/react-router", "Link", "useNavigate")
    .add("#/components/ui/button", "buttonVariants");
  for (const a of actions) view.add(actionNames(a).module, actionNames(a).access);
  // Standard actions: a button in each row they fit, for viewers who may run them.
  const offered = within ? [] : standardActions(page, ir);
  for (const a of offered)
    view.add(
      actionNames(a).module,
      a.name,
      actionNames(a).access,
      actionNames(a).fits,
      ...(askedFields(a).length ? [actionNames(a).askUi, actionNames(a).asks] : []),
    );
  if (offered.length) view.add("#/kit/ActionButton", "ActionButton").add("#/kit/access", "allows");
  if (offered.length > 2) view.add("#/kit/Overflow", "Overflow");
  // Chosen rows (actions.md §9): the page's actions that change records, and Delete, on several.
  const many = offered.filter((a) => !a.copy);
  // The trash (docs/design/trash.md): Undo after Move to trash, and the way to the Trash page.
  const trash = Boolean(model.trash && !within);
  if (trash)
    view
      .add("@tanstack/react-router", "useRouter")
      .add("#/kit/Trash", "TrashNotice")
      .add(n.module, trashNames(model).restore);
  const selecting = !within && (many.length > 0 || Boolean(auth && hasSignIn(auth)));
  if (selecting) {
    view
      .add("react", "useState")
      .add("@tanstack/react-router", "useRouter")
      .add("#/kit/SelectionBar", "SelectionBar")
      .add("#/kit/csv", "csvName", "csvOf", "download")
      .add("#/kit/access", "allows")
      .add(n.module, n.removeMany, n.deleteRule);
    for (const a of many) view.add(actionNames(a).module, actionNames(a).many);
  }
  const owner = `row.${ownerKey(model)}`;
  const fits = (a: (typeof many)[number]) =>
    `allows(${actionNames(a).access}, viewer, ${owner}) && ${actionNames(a).fits}(row)`;
  view.add("#/generated/app", "app").add(n.module, n.ui).add("#/kit/words", "w");
  if (actions.length) view.add("#/kit/access", "allows");
  view.add("#/kit/AppShell", "PageHeader").add("#/kit/ModelTable", "ModelTable");
  if (sort) view.add("#/kit/model", "sortRows");
  if (searchable) view.add("#/kit/SearchBox", "SearchBox");
  if (filtering?.controls.length || filtering?.sorts.length) view.add("#/kit/Filters", "Filters");
  if (favorites) view.add("@tanstack/react-router", "useRouter").add(n.module, savedToggle(model));
  if (favorites === "all") view.add("#/kit/Filters", "SavedTabs");
  if (icon) view.add("lucide-react", icon);

  const newest = `list${pascal(plural(model.name))}`;
  // The server function the route loads with: a gallery calls it again for more cards.
  const loading = search ? `search${pascal(plural(model.name))}` : newest;
  const loadArgs = filtering
    ? `{ q, sort, ${favorites === "all" ? "view, " : ""}f: values, page: next }`
    : searchable
      ? "{ q, page: next }"
      : "{ page: next }";
  // The whole list as it is filtered, for "Export CSV" (at most EXPORT_ROWS records).
  const exportArgs = filtering
    ? `{ q, sort, ${favorites === "all" ? "view, " : ""}f: values, all: true }`
    : searchable
      ? "{ q, all: true }"
      : "{ all: true }";
  const options = `${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}${
    search
      ? search.options
      : capped
        ? `  loader: () => ${newest}(),\n`
        : `  validateSearch: (s: Search) => optional({ page: ${PAGE} }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps }) => ${newest}({ data: { page: deps.page } }),
`
  }`;
  /** The component, reading the route's data through \`api\` (Route, or getRouteApi's result). */
  const body = (api: string) => {
    // Cards load more as the reader scrolls; a page of the owner's own, which cannot call the
    // route's server function, and a table, are paged instead (docs/design/paging.md).
    const scrolling = cards && !within && !owned;
    return `function ${component}() {
  const { ${scrolling ? "rows: first" : "rows"}, canCreate${within ? ", more" : scrolling ? ", total, size" : ", total, page: at, size"}${filtering?.options.length ? ", options" : ""}${favorites ? ", saved" : ""} } = ${api}.useLoaderData();${filtering ? `\n  const { q, sort, ${favorites === "all" ? "view, " : ""}page: _page, ...values } = ${api}.useSearch();` : searchable ? `\n  const { q } = ${api}.useSearch();` : ""}
${actions.length || offered.length || selecting || filtering?.mine || favorites || trash ? `  const { viewer } = ${api}.useRouteContext();\n` : ""}  const navigate = useNavigate(${within ? "" : `{ from: ${JSON.stringify(path)} }`});${favorites || selecting || trash ? "\n  const router = useRouter();" : ""}${
      scrolling
        ? `
  // The cards loaded after the first page, as the reader scrolls; a new search starts again.
  const [extra, setExtra] = useState<typeof first>([]);
  useEffect(() => setExtra([]), [first]);
  const rows = [...first, ...extra];
  const loadMore = async () => {
    const next = Math.floor(rows.length / size) + 1;
    const found = await ${loading}({ data: ${loadArgs} });
    setExtra((shown) => [...shown, ...found.rows]);
  };`
        : ""
    }${
      selecting
        ? `
  // The chosen rows, offered when the viewer may do something to at least one row.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const chosen = rows.filter((row) => selected.has(row.id));
  const selectable = rows.some((row) => ${[...many.map(fits), `allows(${n.deleteRule}, viewer, ${owner})`].join(" || ")});`
        : ""
    }${
      favorites
        ? `
  // A heart saves the record for the viewer; a visitor signs in first and comes back.
  const toggleSaved = async (id: number) => {
    if (!viewer) {
      await navigate({ to: "/sign-in", search: { redirect: location.pathname + location.search } });
      return;
    }
    await ${savedToggle(model)}({ data: id });
    await router.invalidate();
  };`
        : ""
    }
  const newButton = canCreate && (
    <Link to=${attr(join(page.route, "new"))} className={buttonVariants()}>
      {w.newOne(${JSON.stringify(n.label.toLowerCase())})}
    </Link>
  );${actions
    .map(
      (a) => `
  const ${a.name}Button = allows(${actionNames(a).access}, viewer) && (
    <Link to=${attr(join(page.route, `actions/${kebab(a.name)}`))}${t.actionHelp(a) ? ` title=${attr(t.actionHelp(a) as string)}` : ""} className={buttonVariants({ variant: "outline" })}>
      ${t.action(a)}
    </Link>
  );`,
    )
    .join("")}
  return (
    <>
      <PageHeader${within ? "" : `\n        page=${attr(page.id)}`}
        title=${attr(within ? n.pluralLabel : t.pageTitle(page.id))}${within ? "" : t.pageSubtitle(page.id)}
        actions={${actions.length ? `<>${actions.map((a) => `{${a.name}Button}`).join("")}{newButton}</>` : "newButton"}}
      />
${
  searchable && search
    ? `      <SearchBox
        value={q ?? ""}
        placeholder=${attr(search.placeholder)}
        onSearch={(text) => navigate({ to: ${JSON.stringify(page.route)}, search: ${filtering ? "(prev) => ({ ...prev, q: text || undefined, page: undefined })" : "{ q: text || undefined }"}, replace: true, resetScroll: false })}
      />
`
    : ""
}${
  favorites === "all"
    ? `      {viewer && (
        <SavedTabs
          saved={view === "saved"}
          onChange={(saved) => navigate({ to: ${JSON.stringify(page.route)}, search: (prev) => ({ ...prev, view: saved ? "saved" : undefined, page: undefined }), replace: true, resetScroll: false })}
        />
      )}
`
    : ""
}${
  filtering && (filtering.controls.length || filtering.sorts.length)
    ? `      <Filters
        filters={${literal(filtering.controls)}}
        values={values}${filtering.mine ? "\n        signedIn={Boolean(viewer)}" : ""}${filtering.sorts.length ? `\n        sorts={${literal(filtering.sorts)}}\n        sort={sort}` : ""}
        onChange={(next) => navigate({ to: ${JSON.stringify(page.route)}, search: { q, ${favorites === "all" ? "view, " : ""}...next }, replace: true, resetScroll: false })}
      />
`
    : ""
}${
  selecting
    ? `      {selectable && (
        <SelectionBar
          count={chosen.length}
          noun={${literal([n.label.toLowerCase(), n.pluralLabel.toLowerCase()])}}
          app={app}
          titleOf={(id) => String(rows.find((row) => row.id === id)?.${titleField(model) === "id" ? "id" : keyOf(model, titleField(model))} ?? id)}
          actions={[${many
            .map(
              (a) => `
            {
              label: ${JSON.stringify(t.action(a))},${t.actionHelp(a) ? `\n              help: ${JSON.stringify(t.actionHelp(a))},` : ""}
              concept: "action:${a.name}",
              applies: chosen.filter((row) => ${fits(a)}).length,${askedFields(a).length ? `\n              ask: { ui: ${actionNames(a).askUi}, schema: ${actionNames(a).asks} },` : ""}
              run: (${askedFields(a).length ? "values" : ""}) => ${actionNames(a).many}({ data: { ids: chosen.map((row) => row.id)${askedFields(a).length ? ", values: values as never" : ""} } }),
            },`,
            )
            .join("")}${many.length ? "\n          " : ""}]}
          deletable={chosen.filter((row) => allows(${n.deleteRule}, viewer, ${owner})).length}
          onDelete={(together) => ${n.removeMany}({ data: { ids: chosen.map((row) => row.id), together } })}${trash ? "\n          trash" : ""}
          onDone={async () => {
            setSelected(new Set());
            await router.invalidate();
          }}
          onExport={() => download(csvName(${n.ui}), csvOf(${n.ui}, chosen))}
        />
      )}
`
    : ""
}${within ? `      {more && (\n        <p className="text-sm text-muted-foreground">The newest ${DATA_LIMIT} are shown${search ? "; search to find the others" : ""}.</p>\n      )}\n` : ""}${
  trash
    ? `      <TrashNotice
        model=${attr(model.name)}
        onUndo={async (id) => {
          await ${trashNames(model).restore}({ data: [id] });
          await router.invalidate();
        }}
      />
`
    : ""
}      <ModelTable
        ui={${n.ui}}${within ? "" : `\n        page=${attr(page.id)}\n        ${scrolling ? "more={{ total, load: loadMore }}" : `paging={{ page: at, size, total, to: (next) => navigate({ to: ${JSON.stringify(page.route)}, search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) }) }}`}`}${columns ? `\n        columns={${literal(columns)}}` : ""}${below.length ? `\n        below={${literal(Object.fromEntries(below))}}` : ""}
        app={app}${
          within || capped || owned
            ? ""
            : `
        exportRows={async () => (await ${loading}({ data: ${exportArgs} })).rows}`
        }
        rows={${(() => {
          const ordered = sort
            ? `sortRows(rows, ${JSON.stringify(sort.field)}${sort.descending ? ", true" : ""})`
            : "rows";
          // A visitor's own sort (from the address) before the page's.
          // The viewer's own sort is already the query's order; the page's applies otherwise.
          return filtering?.sorts.length && ordered !== "rows"
            ? `sort ? rows : ${ordered}`
            : ordered;
        })()}}${
          filtering && Object.keys(filtering.headers).length
            ? `\n        sorting={{ keys: ${literal(filtering.headers)}, value: sort, onChange: (next) => navigate({ to: ${JSON.stringify(page.route)}, search: (prev) => ({ ...prev, sort: next, page: undefined }), replace: true, resetScroll: false }) }}`
            : ""
        }${cards ? '\n        view="cards"' : ""}${icon ? `\n        icon={${icon}}` : ""}${favorites ? "\n        saved={{ ids: saved, onToggle: toggleSaved }}" : ""}${selecting ? "\n        selection={selectable ? { ids: selected, onChange: setSelected } : undefined}" : ""}${
          offered.length
            ? `
        rowActions={(row) => (
          ${offered.length > 2 ? "<Overflow inRow>" : "<>"}
            ${offered
              .map(
                (
                  a,
                ) => `{allows(${actionNames(a).access}, viewer, row.${ownerKey(model)}) && ${actionNames(a).fits}(row) && (
              ${actionButton(a, "row", page.route, t)}
            )}`,
              )
              .join("\n            ")}
          ${offered.length > 2 ? "</Overflow>" : "</>"}
        )}`
            : ""
        }${
          filtering
            ? `\n        emptyMessage={q || Object.values(values).some(Boolean) ? "No ${n.pluralLabel.toLowerCase()} match the search and filters." : ${
                favorites === "only"
                  ? `"No saved ${n.pluralLabel.toLowerCase()} yet."`
                  : favorites
                    ? `view === "saved" ? "No saved ${n.pluralLabel.toLowerCase()} yet: the heart on one saves it." : undefined`
                    : "undefined"
              }}`
            : searchable
              ? `\n        emptyMessage={q ? \`No ${n.pluralLabel.toLowerCase()} match “\${q}”.\` : undefined}`
              : ""
        }
        emptyAction={newButton || undefined}
        onOpen={(row) => navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(row.id) } })}
      />${
        trash
          ? `
      {viewer && (
        <p className="pt-2 text-right text-sm">
          <Link to=${attr(join(page.route, "trash"))} className="text-muted-foreground hover:underline">
            {w.trashView}
          </Link>
        </p>
      )}`
          : ""
      }
    </>
  );
}
`;
  };
  if (cards && !within && !owned) view.add("react", "useEffect", "useState");
  const serverFn =
    search?.fn ??
    (capped
      ? `
/** The newest ${n.pluralLabel.toLowerCase()} the viewer may read. */
const ${newest} = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  ${listed(n, "undefined", within)}
});
`
      : `
/** A page of the ${n.pluralLabel.toLowerCase()} the viewer may read. */
const ${newest} = createServerFn()
  .validator(listQuery)
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    ${listed(n, "undefined", undefined, order)}
  });
`);
  return { component, path, route, view, serverFn, options, body };
}

/** The route file of a list page; with a custom page, it renders that instead. */
export function listRoute(
  page: PageIR,
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  custom: boolean,
  ux: UxIR,
  within?: Within,
  auth?: AuthIR,
): string {
  const p = listParts(page, model, t, ir, ux, within, auth);
  const checks = paramsUsed(`${p.serverFn}${p.options}`);
  if (checks.length) p.route.add("#/kit/params", ...checks);
  const head = `export const Route = createFileRoute(${JSON.stringify(p.path)})({
${p.options}  component: ${p.component},
});
`;
  if (custom) {
    p.route.add(`#/custom/pages/${page.id}`, p.component);
    return `${HEADER}// The page itself is src/custom/pages/${page.id}.tsx, which is yours.
${p.route.render()}${p.serverFn}
${head}`;
  }
  return `${HEADER}${p.route.merge(p.view).render()}${p.serverFn}
${head}
${p.body("Route")}`;
}

/**
 * The statement that returns a list's rows: all of them, or inside a data page the newest
 * DATA_LIMIT, one more fetched to know whether there are others.
 */
/** The most records "Export CSV" takes from a list; a visitor of a public list, fewer. */
const EXPORT_ROWS = 10_000;
const VISITOR_EXPORT_ROWS = 500;

/** A list's page, or with \`all\` (an export) its first records. */
const PAGED_ARGS = `data.all ? 1 : data.page, data.all ? (viewer ? ${EXPORT_ROWS} : ${VISITOR_EXPORT_ROWS}) : undefined`;

function listed(
  n: ReturnType<typeof names>,
  where: string,
  within?: Within,
  order?: string,
): string {
  if (!within)
    return `return { ...(await ${n.data}.page(viewer, ${where}, ${order ?? "undefined"}, ${PAGED_ARGS})), canCreate: allows(${n.access}.create, viewer) };`;
  return `const rows = await ${n.data}.list(viewer, ${where}, ${DATA_LIMIT + 1});
    return {
      rows: rows.slice(0, ${DATA_LIMIT}),
      more: rows.length > ${DATA_LIMIT},
      canCreate: allows(${n.access}.create, viewer),
    };`;
}

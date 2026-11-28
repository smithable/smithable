import { expect, test, vi } from "vitest";

// Two clicks before the page redraws (T1740, T1744): the kit's components are called as plain
// functions, so both clicks use the handlers of one drawing, and the address moves between them.
const element = (type: unknown, props: Record<string, unknown>) => ({ type, props });
vi.mock("react", () => ({
  useState: (value: unknown) => [value, () => {}],
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
  useId: () => "id",
}));
vi.mock("react/jsx-runtime", () => ({ jsx: element, jsxs: element, Fragment: "fragment" }));
vi.mock("react/jsx-dev-runtime", () => ({ jsxDEV: element, Fragment: "fragment" }));
vi.mock("lucide-react", () => ({
  ChevronLeft: "i",
  ChevronRight: "i",
  SlidersHorizontal: "i",
  X: "i",
}));
vi.mock("#/components/ui/button", () => ({ Button: "button" }));
vi.mock("#/components/ui/input", () => ({ Input: "input", Label: "label" }));
vi.mock("#/lib/utils", () => ({ cn: () => "" }));
vi.mock("../templates/src/kit/AiMark", () => ({ AiMarked: "span" }));
vi.mock("../templates/src/kit/Combobox", () => ({ Combobox: "input" }));

type Props = Record<string, unknown>;
type Element = { type: unknown; props: Props };
type Component = (props: Props) => Element;

const found = (node: unknown, wanted: (e: Element) => boolean): Element[] => {
  if (Array.isArray(node)) return node.flatMap((n) => found(n, wanted));
  if (!node || typeof node !== "object") return [];
  const e = node as Element;
  return [...(wanted(e) ? [e] : []), ...found(e.props?.children, wanted)];
};

/** The first such element's handler; calling it throws where the element is not drawn. */
const handler = (node: unknown, wanted: (e: Element) => boolean, name: string) =>
  found(node, wanted)[0]?.props[name] as (value?: unknown) => void;

// Kit files, as the generated apps get them (paths the build does not follow).
const calendarPath: string = "../templates/src/kit/Calendar.tsx";
const filtersPath: string = "../templates/src/kit/Filters.tsx";

test("two quick Next clicks move two weeks, and Previous goes back one", async () => {
  const { Calendar } = (await import(calendarPath)) as { Calendar: Component };
  let address: Props = { week: "2026-W41", time: "morning" };
  const drawn = Calendar({
    search: address,
    items: [],
    timeZone: "UTC",
    newLabel: "New",
    onNavigate: (next: (now: Props) => Props) => {
      address = next(address);
    },
  });
  const click = (label: string) =>
    handler(drawn, (e) => e.props?.["aria-label"] === label, "onClick")();
  click("Next");
  click("Next");
  expect(address).toEqual({ week: "2026-W43", time: "morning" });
  click("Previous");
  expect(address).toEqual({ week: "2026-W42", time: "morning" });
});

test("two quick changes to two filters both stay in the address", async () => {
  const { Filters } = (await import(filtersPath)) as { Filters: Component };
  let address: Props = { q: "yoga", page: 2 };
  const drawn = Filters({
    filters: [
      { name: "level", label: "Level", kind: "toggle" },
      { name: "room", label: "Room", kind: "toggle" },
    ],
    values: {},
    sorts: [{ value: "name", label: "Name" }],
    // As a generated list page does it.
    onChange: (_: unknown, changed: Props) => {
      address = { ...address, ...changed, page: undefined };
    },
  });
  const chips = (name: string) =>
    handler(drawn, (e) => (e.props?.filter as Props | undefined)?.name === name, "onChange");
  chips("level")("true");
  chips("room")("false");
  handler(drawn, (e) => e.type === "select", "onChange")({ target: { value: "name" } });
  expect(address).toEqual({ q: "yoga", level: "true", room: "false", sort: "name" });
});

import { expect, test } from "vitest";
import { indexPage, staticFrames } from "./static.js";

const page = (id: string, route: string, kind: string) => ({ id, route, pattern: { kind } });

test("every page is saved; a list's form and first record too; the states when asked", () => {
  const pages = [page("home", "/", "landing"), page("customers", "/customers", "crud")];
  expect(staticFrames(pages).map((f) => [f.file, f.path])).toEqual([
    ["home", "/"],
    ["customers", "/customers"],
    ["customers-form", "/customers/new"],
    ["customers-record", "/customers/1"],
  ]);
  const states = staticFrames(pages, true);
  expect(states.map((f) => f.state).filter(Boolean)).toEqual(["empty", "errors", "dialog"]);
  expect(states.find((f) => f.state === "empty")?.path).toMatch(/^\/customers\?q=/);
  expect(states.find((f) => f.state === "dialog")?.path).toBe("/customers/1");
});

test("the index page lists the frames and shows the first; texts are escaped", () => {
  const html = indexPage("Nordic <Timber>", [
    { label: "Home", path: "/frames/home.html" },
    { label: "Customers: form with errors", path: "/frames/customers-errors.html" },
  ]);
  expect(html).toContain("<title>Nordic &lt;Timber&gt;: the pages</title>");
  expect(html).toContain('<a href="frames/home.html">Home</a>');
  expect(html).toContain('<a href="frames/customers-errors.html">Customers: form with errors</a>');
  expect(html).toContain('data-mode="dark"');
  expect(html).toContain('data-width="390"');
});

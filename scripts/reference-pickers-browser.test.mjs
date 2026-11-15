import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// An isolated interaction check for the actual component; full Studio/operation integration
// is checked separately once the shared form draft guard and its integration have landed.
test("closed reference pickers search, preserve unknown values and keep ordered async changes", {
  timeout: 60000,
}, async () => {
  const root = resolve(import.meta.dirname, "../apps/studio");
  const require = createRequire(resolve(root, "package.json"));
  const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
  const { default: react } = await import(
    pathToFileURL(require.resolve("@vitejs/plugin-react")).href
  );
  const entry = "\0reference-picker-fixture";
  const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReferencePicker} from '/src/builder/ReferencePicker.tsx';
import {PendingEdits, usePendingEdits} from '/src/builder/pending-edit.tsx';
function Fixture() {
  const pending = usePendingEdits();
  const [single, setSingle] = useState('removed');
  const [many, setMany] = useState(['page2', 'page1']);
  const [writes, setWrites] = useState(0);
  const [created, setCreated] = useState(0);
  const [failure, setFailure] = useState(false);
  const [count, setCount] = useState(16);
  const [shown, setShown] = useState(true);
  const options = Array.from({length:count}, (_,i) => ({value:'page'+i, label:'Page '+i}));
  const save = (set) => async (value) => {
    setWrites((n) => n + 1);
    if (window.hold) await new Promise((resolve) => window.release = resolve);
    if (failure) throw Error('Fixture refusal');
    if (window.refuseFalse) return false;
    set(value);
    return true;
  };
  return <PendingEdits.Provider value={pending.report}>
    {shown && <ReferencePicker label="Destination" options={options} value={single} unset="No destination" onChange={save(setSingle)} create={{label:'New page', open:() => setCreated((n) => n+1)}} />}
    <ReferencePicker label="Menu pages" options={options} value={many} multiple onChange={save(setMany)} />
    <button onClick={() => setFailure((before) => !before)}>Toggle refusal</button>
    <button onClick={() => setCount((before) => before === 16 ? 6 : 16)}>Toggle choices</button>
    <button onClick={() => setShown((before) => !before)}>Toggle destination</button>
    <output aria-label="Saved">{JSON.stringify({single,many,writes,created})}</output>
    <output aria-label="Pending">{String(pending.pending())}</output>
  </PendingEdits.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
  const server = await createServer({
    root,
    configFile: false,
    plugins: [
      react(),
      {
        name: "reference-picker-fixture",
        resolveId(id) {
          if (id === "virtual:reference-picker-fixture") return entry;
        },
        load(id) {
          if (id === entry) return { code: fixture, map: null };
        },
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (req.url !== "/") return next();
            try {
              const html = await vite.transformIndexHtml(
                "/",
                '<div id="root"></div><script type="module">import "virtual:reference-picker-fixture";</script>',
              );
              res.setHeader("content-type", "text/html");
              res.end(html);
            } catch (error) {
              next(error);
            }
          });
        },
        // The fixture is a virtual TSX module; transform it with the same JSX setup as Studio.
        async transform(code, id) {
          if (id !== entry) return;
          const { transformWithOxc } = await import(pathToFileURL(require.resolve("vite")).href);
          return transformWithOxc(code, "reference-picker-fixture.tsx", {
            jsx: { runtime: "automatic" },
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "warn",
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.equal(typeof address, "object");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    const saved = page.getByLabel("Saved", { exact: true });
    await saved.waitFor();
    const state = async () => JSON.parse(await saved.innerText());
    const pending = page.getByLabel("Pending", { exact: true });
    const pendingIs = async (wanted) => {
      await page.waitForFunction(
        (value) =>
          document.querySelector('output[aria-label="Pending"]').textContent === String(value),
        wanted,
      );
    };
    await pendingIs(false);
    const destination = page.getByRole("combobox", { name: "Destination", exact: true });
    assert.equal(await destination.inputValue(), "removed");
    await page
      .getByRole("status")
      .filter({ hasText: "saved reference is not available" })
      .waitFor();
    await page
      .getByRole("searchbox", { name: "Find Destination", exact: true })
      .fill("not a real page");
    await pendingIs(true);
    assert.equal((await state()).writes, 0);
    assert.equal(await destination.inputValue(), "removed");
    assert.equal(await destination.locator('option[value="not a real page"]').count(), 0);
    await page.getByRole("button", { name: "Toggle choices", exact: true }).click();
    assert.equal(
      await page.getByRole("searchbox", { name: "Find Destination", exact: true }).count(),
      0,
    );
    assert.equal(await destination.locator('option[value="page0"]').count(), 1);
    await pendingIs(false);
    assert.equal((await state()).writes, 0);
    await page.getByRole("button", { name: "Toggle choices", exact: true }).click();
    await page.getByRole("searchbox", { name: "Find Destination", exact: true }).fill("Page 15");
    await destination.selectOption("page15");
    await page.waitForFunction(
      () => JSON.parse(document.querySelector("output").textContent).single === "page15",
    );
    assert.equal((await state()).writes, 1);
    await pendingIs(false);
    await destination.selectOption("");
    await page.waitForFunction(
      () => !("single" in JSON.parse(document.querySelector("output").textContent)),
    );
    await page.getByRole("button", { name: "New page", exact: true }).click();
    assert.equal((await state()).created, 1);

    await page.getByRole("button", { name: "Move page1 earlier", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(document.querySelector("output").textContent).many.join(",") === "page1,page2",
    );
    const menu = page.getByRole("group", { name: "Menu pages", exact: true }).getByRole("combobox");
    assert.equal(await menu.locator('option[value="page1"]').count(), 0);
    await menu.selectOption("page3");
    await page.waitForFunction(
      () => JSON.parse(document.querySelector("output").textContent).many.length === 3,
    );
    await page.getByRole("button", { name: "Remove page2", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(document.querySelector("output").textContent).many.join(",") === "page1,page3",
    );

    await page.getByRole("button", { name: "Toggle refusal", exact: true }).click();
    await destination.selectOption("page4");
    await page.getByRole("alert").filter({ hasText: "Fixture refusal" }).waitFor();
    assert.equal((await state()).single, undefined);
    assert.equal(await destination.inputValue(), "");
    await page.getByRole("button", { name: "Toggle refusal", exact: true }).click();
    await page.evaluate(() => {
      window.refuseFalse = true;
    });
    await destination.selectOption("page4");
    await page.getByRole("alert").filter({ hasText: "The change was not applied" }).waitFor();
    assert.equal((await state()).single, undefined);
    await page.evaluate(() => {
      window.refuseFalse = false;
      window.hold = true;
    });
    await destination.focus();
    await page.keyboard.press("End");
    const pendingGroup = page.getByRole("group", { name: "Destination", exact: true });
    await page.waitForFunction(
      () =>
        document.querySelector('fieldset[aria-label="Destination"]').getAttribute("aria-busy") ===
        "true",
    );
    assert.equal(await pendingGroup.getAttribute("aria-busy"), "true");
    await pendingIs(true);
    assert.equal(await destination.evaluate((node) => node === document.activeElement), true);
    const beforeSecond = (await state()).writes;
    await destination.selectOption("page6");
    assert.equal((await state()).writes, beforeSecond);
    await page.evaluate(() => {
      window.hold = false;
      window.release();
    });

    await page.waitForFunction(
      () => JSON.parse(document.querySelector("output").textContent).single === "page15",
    );
    await pendingIs(false);
    await page.getByRole("searchbox", { name: "Find Destination", exact: true }).fill("Page");
    await page.getByRole("searchbox", { name: "Find Menu pages", exact: true }).fill("Page");
    await pendingIs(true);
    await page.getByRole("button", { name: "Toggle destination", exact: true }).click();
    // Unmounting one picker releases only its own entry; the second still has a draft.
    assert.equal(await pending.innerText(), "true");
    await page.getByRole("searchbox", { name: "Find Menu pages", exact: true }).fill("");
    await pendingIs(false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS isolated actual component: unknown/search never writes, ordered changes, refusal and pending protection; not full Studio integration",
    );
  } finally {
    await browser?.close();
    await server.close();
  }
});

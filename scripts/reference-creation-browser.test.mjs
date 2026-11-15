import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repo = resolve(import.meta.dirname, "..");
const require = createRequire(join(repo, "package.json"));
const studioRequire = createRequire(join(repo, "apps/studio/package.json"));
const { chromium } = require("playwright");
const { build } = await import(pathToFileURL(studioRequire.resolve("vite")).href);

test("complete creation returns a current reference and preserves its requesting draft", {
  timeout: 240000,
}, async () => {
  const root = mkdtempSync(join(tmpdir(), "smithable-reference-creation-"));
  const dir = join(root, "crm"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const port = Number(process.env.REFERENCE_CREATION_PORT ?? 5820),
    base = `http://localhost:${port}`;
  const env = { ...process.env, XDG_CONFIG_HOME: join(root, "config") };
  for (const key of Object.keys(env))
    if (
      /^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key)
    )
      delete env[key];
  const operationsFor = (request) => {
    if (request.includes("two kinds"))
      return ["VendorOne", "VendorTwo"].map((model) => ({
        op: "addModel",
        args: { model, fields: { name: "string!", email: "email" } },
      }));
    if (request.includes("default data page")) return [{ op: "addDataPage", args: {} }];
    if (request.includes("new landing"))
      return [{ op: "addLandingPage", args: { page: "reference-home" } }];
    if (request.includes("new action"))
      return [
        {
          op: "addAction",
          args: { action: "referenceDraft", on: "Order", set: { status: "draft" } },
        },
      ];
    if (request.includes("not a creation"))
      return [{ op: "setApp", args: { description: "A changed description" } }];
    const model = request.includes("keep selection")
      ? "UnselectedSupplier"
      : request.includes("legacy model")
        ? "LegacySupplier"
        : request.includes("refused model")
          ? "RetrySupplier"
          : request.includes("edited model")
            ? "ProposedSupplier"
            : "Supplier";
    return [{ op: "addModel", args: { model, fields: { name: "string!" } } }];
  };
  const fake = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text || "{}");
    const user = body.messages?.find((item) => item.role === "user")?.content ?? "";
    const request = /^Request: (.*)$/m.exec(user)?.[1] ?? "";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        model: "fake-model",
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({ kind: "operations", operations: operationsFor(request) }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }),
    );
  });
  await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
  env.SMITHABLE_LOCAL_MODEL = "fake-model";
  env.SMITHABLE_LOCAL_URL = `http://127.0.0.1:${fake.address().port}/v1`;
  let server,
    browser,
    page,
    log = "";
  const source = join(root, "probe.tsx");
  writeFileSync(
    source,
    `
import React, {StrictMode, useContext, useEffect, useMemo, useState} from ${JSON.stringify(studioRequire.resolve("react"))};
import {createRoot} from ${JSON.stringify(studioRequire.resolve("react-dom/client"))};
import {api} from ${JSON.stringify(join(repo, "apps/studio/src/api.ts"))};
import {readSpec} from ${JSON.stringify(join(repo, "apps/studio/src/engine.ts"))};
import {PendingEdits,usePendingEdits,usePendingEdit} from ${JSON.stringify(join(repo, "apps/studio/src/builder/pending-edit.tsx"))};
import {ReferenceCreation} from ${JSON.stringify(join(repo, "apps/studio/src/builder/reference-creation.ts"))};
import {ReferenceCreationProvider} from ${JSON.stringify(join(repo, "apps/studio/src/builder/ReferenceCreationProvider.tsx"))};
import {Wizard} from ${JSON.stringify(join(repo, "apps/studio/src/builder/Wizard.tsx"))};
function Form(){
 const create=useContext(ReferenceCreation), [draft,setDraft]=useState("original"),[result,setResult]=useState("none"),[selected,setSelected]=useState("Customer");
 usePendingEdit(draft!=="original");
 return <section aria-label="Requesting form"><label>Reference draft<input aria-label="Reference draft" value={draft} onChange={e=>setDraft(e.target.value)}/></label>
 <output aria-label="Returned reference">{result}</output><output aria-label="Selected reference">{selected}</output>
 {['model','page','action'].map(kind=><button key={kind} disabled={!create} onClick={async()=>{const name=await create(kind);setResult(name??'cancelled');if(name)setSelected(name)}}>New {kind}</button>)}</section>
}
function App(){
 const [project,setProject]=useState(), [started,setStarted]=useState(0), [legacy,setLegacy]=useState(false), [legacyClosed,setLegacyClosed]=useState(0), edits=usePendingEdits();
 const refresh=async()=>setProject(await api.project());
 useEffect(()=>{void refresh();const events=new EventSource('/api/events');events.addEventListener('changed',refresh);return()=>events.close()},[]);
 const spec=useMemo(()=>project?readSpec(project.files):{},[project]);
 const run=async(name,args)=>{const result=await api.operation(name,args);if(result.ok)await refresh();return result.ok};
 return <PendingEdits.Provider value={edits.report}><output aria-label="Pending edits">{String(edits.pending())}</output><output aria-label="Creation starts">{started}</output>
 <ReferenceCreationProvider project={project?.lookProject} ir={spec.ir} run={run} onStart={()=>setStarted(n=>n+1)}><Form/></ReferenceCreationProvider>
 <button onClick={()=>setLegacy(true)}>Open ordinary wizard</button><output aria-label="Ordinary wizard closed">{legacyClosed}</output>
 {legacy&&<Wizard kind="model" models={spec.ir?.models??[]} run={run} onClose={()=>{setLegacy(false);setLegacyClosed(n=>n+1)}}/>}</PendingEdits.Provider>
}
createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`,
  );
  try {
    const compiled = await build({
      configFile: false,
      root: repo,
      logLevel: "error",
      base: "/creation-probe/",
      define: { "process.env.NODE_ENV": JSON.stringify("development") },
      resolve: {
        alias: [
          { find: /^react$/, replacement: studioRequire.resolve("react") },
          { find: /^react\/jsx-runtime$/, replacement: studioRequire.resolve("react/jsx-runtime") },
          {
            find: /^react\/jsx-dev-runtime$/,
            replacement: studioRequire.resolve("react/jsx-dev-runtime"),
          },
          { find: /^react-dom\/client$/, replacement: studioRequire.resolve("react-dom/client") },
        ],
      },
      build: {
        write: false,
        minify: false,
        lib: { entry: source, formats: ["es"], fileName: "probe" },
      },
    });
    const files = new Map(
      (Array.isArray(compiled) ? compiled : [compiled])
        .flatMap((item) => item.output)
        .map((item) => [item.fileName, item.type === "chunk" ? item.code : item.source]),
    );
    const entry = [...files.keys()].find((name) => name.endsWith(".js"));
    execFileSync(
      process.execPath,
      [cli, "new", dir, "--starter", "crm", "--admin", "creation-test@example.invalid"],
      { cwd: repo, env, stdio: "pipe", timeout: 120000 },
    );
    server = spawn(process.execPath, [cli, "studio", dir, "--port", String(port)], {
      cwd: repo,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr])
      stream.on("data", (data) => {
        log = (log + data).slice(-15000);
      });
    const until = Date.now() + 120000;
    let ready = false;
    while (Date.now() < until) {
      try {
        if ((await (await fetch(`${base}/api/preview/answers`)).json()).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, log);
    const html = await (await fetch(base)).text();
    const css = /<link[^>]+href="([^"]+\.css)"/.exec(html)?.[1];
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => console.error("Browser error:", error.message));
    await page.route("**/creation-probe", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head>${css ? `<link rel="stylesheet" href="${css}">` : ""}</head><body><div id="root"></div><script type="module" src="/creation-probe/${entry}"></script></body></html>`,
      }),
    );
    await page.route("**/creation-probe/*", (route) => {
      const name = new URL(route.request().url()).pathname.split("/").pop();
      const body = files.get(name);
      return body === undefined
        ? route.abort()
        : route.fulfill({ contentType: "text/javascript", body });
    });
    await page.goto(`${base}/creation-probe`);
    const form = page.getByRole("region", { name: "Requesting form", exact: true });
    const dialog = page.getByRole("dialog", { name: "Create and select", exact: true });
    const result = form.getByLabel("Returned reference", { exact: true });
    const draft = form.getByLabel("Reference draft", { exact: true });
    await page.getByRole("button", { name: "New model", exact: true }).waitFor();
    const pending = page.getByLabel("Pending edits", { exact: true });
    assert.equal(await pending.textContent(), "false");
    await form.getByRole("button", { name: "New model", exact: true }).click();
    await dialog.waitFor();
    assert.equal(await pending.textContent(), "true", "open creator did not protect the form");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await pending.textContent(), "false", "cancel left a stuck pending guard");
    await draft.fill("preserved unsaved reference");
    await form.getByRole("button", { name: "New model", exact: true }).click();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await result.textContent(), "cancelled");
    assert.equal(await draft.inputValue(), "preserved unsaved reference");
    assert.equal(await form.getByLabel("Selected reference").textContent(), "Customer");
    console.log("PASS cancellation keeps the requesting draft and existing selection");
    const propose = async (kind, text) => {
      await form.getByRole("button", { name: `New ${kind}`, exact: true }).click();
      await dialog.getByRole("textbox").first().fill(text);
      await dialog.getByRole("button", { name: "Next", exact: true }).click();
      await dialog.getByRole("button", { name: "Create", exact: true }).waitFor();
    };
    let releaseAsk, askArrived;
    const askGate = new Promise((resolve) => {
      releaseAsk = resolve;
    });
    const asking = new Promise((resolve) => {
      askArrived = resolve;
    });
    const holdAsk = async (route) => {
      askArrived();
      await askGate;
      await route.continue();
    };
    await page.route("**/api/ask", holdAsk);
    await form.getByRole("button", { name: "New model", exact: true }).click();
    await dialog.getByRole("textbox").first().fill("cancelled late model");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await asking;
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    const lateResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/ask",
    );
    releaseAsk();
    await lateResponse;
    await page.unroute("**/api/ask", holdAsk);
    assert.equal(await dialog.count(), 0, "late proposal reopened a cancelled creator");
    assert.equal(await draft.inputValue(), "preserved unsaved reference");
    assert.equal(
      (await (await fetch(`${base}/api/project`)).json()).trace.length,
      0,
      "cancelled proposal wrote source",
    );
    console.log("PASS cancellation during preparation ignores its late proposal without a write");
    await propose("model", "supplier creation");
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let arrived;
    const waiting = new Promise((resolve) => {
      arrived = resolve;
    });
    const holdProject = async (route) => {
      arrived();
      await gate;
      await route.continue();
    };
    await page.route("**/api/project", holdProject);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await waiting;
    await dialog.getByRole("status").filter({ hasText: "Updating the choices" }).waitFor();
    assert.equal(
      await result.textContent(),
      "cancelled",
      "reference resolved before the fresh choices arrived",
    );
    assert.equal(await draft.inputValue(), "preserved unsaved reference");
    release();
    await page.unroute("**/api/project", holdProject);
    await dialog.waitFor({ state: "detached" });
    assert.equal(await result.textContent(), "Supplier");
    console.log("PASS successful creation waits for current IR and returns its exact name");
    await propose("model", "keep selection");
    let releaseChoices, choicesArrived;
    const choicesGate = new Promise((resolve) => {
      releaseChoices = resolve;
    });
    const waitingChoices = new Promise((resolve) => {
      choicesArrived = resolve;
    });
    const holdChoices = async (route) => {
      choicesArrived();
      await choicesGate;
      await route.continue();
    };
    await page.route("**/api/project", holdChoices);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await waitingChoices;
    await dialog.getByRole("button", { name: "Keep current selection", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await form.getByLabel("Selected reference").textContent(), "Supplier");
    assert.equal(await result.textContent(), "cancelled");
    const refreshedChoices = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/project",
    );
    releaseChoices();
    await refreshedChoices;
    await page.unroute("**/api/project", holdChoices);
    assert.equal(await form.getByLabel("Selected reference").textContent(), "Supplier");
    console.log(
      "PASS keeping the current selection after creation never returns an unrefreshed choice",
    );
    await propose("model", "edited model");
    await dialog.getByLabel("Kind of record", { exact: true }).fill("EditedSupplier");
    const refuseBatch = (route) =>
      route.request().postDataJSON()?.name === "batch"
        ? route.fulfill({ json: { ok: false, output: "Controlled batch refusal" } })
        : route.continue();
    await page.route("**/api/op", refuseBatch);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog
      .getByRole("status")
      .filter({ hasText: "The creation could not be applied" })
      .waitFor();
    assert.equal(
      await dialog.getByLabel("Kind of record", { exact: true }).inputValue(),
      "EditedSupplier",
    );
    await page.unroute("**/api/op", refuseBatch);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await result.textContent(), "EditedSupplier");
    console.log("PASS an edited complete creation uses the batch and returns the edited name");
    await propose("model", "two kinds");
    assert.ok(await dialog.getByRole("button", { name: "Create", exact: true }).isDisabled());
    await dialog.getByLabel("After creating, use", { exact: true }).selectOption("VendorTwo");
    await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
    await dialog.getByRole("textbox").first().fill("two kinds");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByLabel("After creating, use", { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel("After creating, use", { exact: true }).inputValue(), "");
    assert.ok(await dialog.getByRole("button", { name: "Create", exact: true }).isDisabled());
    await dialog.getByLabel("After creating, use", { exact: true }).selectOption("VendorTwo");
    const firstModel = dialog.getByRole("group", { name: "Kind of record VendorOne", exact: true });
    const secondModel = dialog.getByRole("group", {
      name: "Kind of record VendorTwo",
      exact: true,
    });
    await firstModel.getByLabel("Field 1", { exact: true }).fill("email");
    assert.ok(await dialog.getByRole("button", { name: "Create", exact: true }).isDisabled());
    await secondModel.getByLabel("Field 1", { exact: true }).fill("title");
    assert.ok(await dialog.getByRole("button", { name: "Create", exact: true }).isDisabled());
    assert.ok(
      await dialog
        .getByText("Two fields are called email: give one of them another name.", { exact: true })
        .isVisible(),
    );
    await firstModel.getByLabel("Field 1", { exact: true }).fill("name");
    assert.ok(await dialog.getByRole("button", { name: "Create", exact: true }).isEnabled());
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await result.textContent(), "VendorTwo");
    const { parse } = studioRequire("yaml");
    const createdSpec = parse((await (await fetch(`${base}/api/project`)).json()).files.spec);
    assert.deepEqual(createdSpec.models.VendorOne.fields, { name: "string!", email: "email" });
    assert.deepEqual(createdSpec.models.VendorTwo.fields, { title: "string!", email: "email" });
    console.log(
      "PASS multiple new items require an explicit choice and retain each model validation error",
    );
    await propose("model", "not a creation");
    assert.ok(await dialog.getByRole("button", { name: "Create", exact: true }).isDisabled());
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    for (const [kind, text, name] of [
      ["page", "new landing", "reference-home"],
      ["page", "default data page", "admin"],
      ["action", "new action", "referenceDraft"],
    ]) {
      await propose(kind, text);
      await dialog.getByRole("button", { name: "Create", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      assert.equal(await result.textContent(), name);
    }
    console.log(
      "PASS page/action creators, including a real operation default, return current choices",
    );
    await propose("model", "refused model");
    await page.route("**/api/ask/apply", (route) =>
      route.fulfill({ json: { ok: false, output: "Controlled creation refusal" } }),
    );
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await dialog.getByRole("status").filter({ hasText: "Controlled creation refusal" }).waitFor();
    assert.equal(await draft.inputValue(), "preserved unsaved reference");
    await page.unroute("**/api/ask/apply");
    let releaseApply, applyArrived;
    const applyGate = new Promise((resolve) => {
      releaseApply = resolve;
    });
    const applying = new Promise((resolve) => {
      applyArrived = resolve;
    });
    const holdApply = async (route) => {
      applyArrived();
      await applyGate;
      await route.continue();
    };
    await page.route("**/api/ask/apply", holdApply);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await applying;
    await page.keyboard.press("Escape");
    assert.ok(await dialog.isVisible(), "Escape cancelled a committing creation");
    assert.ok(await dialog.getByRole("button", { name: "Dismiss", exact: true }).isDisabled());
    assert.ok(await dialog.getByLabel("Kind of record", { exact: true }).isDisabled());
    releaseApply();
    await page.unroute("**/api/ask/apply", holdApply);
    await dialog.waitFor({ state: "detached" });
    assert.equal(await result.textContent(), "RetrySupplier");
    console.log("PASS refused creation retains the draft and can be retried explicitly");
    await draft.fill("original");
    assert.equal(await pending.textContent(), "false");
    await page.getByRole("button", { name: "Open ordinary wizard", exact: true }).click();
    const ordinary = page.getByRole("region", { name: "Add a kind of record", exact: true });
    await ordinary.getByRole("textbox").first().fill("legacy model");
    await ordinary.getByRole("button", { name: "Next", exact: true }).click();
    await ordinary.getByRole("button", { name: "Create", exact: true }).click();
    await ordinary.waitFor({ state: "detached" });
    assert.equal(await page.getByLabel("Ordinary wizard closed").textContent(), "1");
    assert.equal(await form.getByLabel("Selected reference").textContent(), "RetrySupplier");
    console.log("PASS the existing ordinary wizard still closes on successful creation");
    const project = await (await fetch(`${base}/api/project`)).json();
    assert.match(project.files.spec, /EditedSupplier:/);
    assert.doesNotMatch(project.files.spec, /ProposedSupplier:/);
    assert.equal(await draft.inputValue(), "original");
  } catch (error) {
    if (page)
      await page.screenshot({ path: join(root, "failure.png"), fullPage: true }).catch(() => {});
    console.error(root, log);
    throw error;
  } finally {
    await browser?.close();
    if (server?.pid) {
      const gone = new Promise((resolve) => server.once("exit", resolve));
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      if (server.exitCode === null)
        await Promise.race([gone, new Promise((resolve) => setTimeout(resolve, 5000))]);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
    await new Promise((resolve) => fake.close(resolve));
  }
});

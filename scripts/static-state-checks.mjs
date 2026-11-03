// Exercise the real exporter against controlled valid/invalid forms and a destructive dialog.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { savePages } from "../packages/cli/dist/static.js";
export async function checkStaticStates(browser) {
  let writes = 0;
  const server = createServer((req, res) => {
    if (req.method === "POST") {
      writes++;
      res.end("mutated");
      return;
    }
    const invalid = req.url === "/invalid";
    const dialog = req.url === "/dialog";
    res.setHeader("content-type", "text/html");
    res.end(`<!doctype html><html><head><title>Capture boundary</title><style>body{color:black}</style></head><body data-hydrated="true"><form data-kit="model-form"><input id="field"><button type="submit">Save</button></form><button id="remove">Delete</button><dialog>Are you sure?</dialog><script>
      document.querySelector('form').onsubmit=async event=>{event.preventDefault();
        ${invalid ? "document.querySelector('input').setAttribute('aria-invalid','true');" : "try{await fetch('/write',{method:'POST'});}catch{}document.querySelector('input').setAttribute('aria-invalid','true');"}
      };
      document.querySelector('#remove').onclick=async()=>{${dialog ? "try{await fetch('/write',{method:'POST'});}catch{}" : ""}document.querySelector('dialog').showModal();};
    </script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = mkdtempSync(join(tmpdir(), "smithable-static-states-"));
  const page = await browser.newPage();
  try {
    const saved = await savePages(
      page,
      `http://127.0.0.1:${server.address().port}`,
      root,
      [
        { file: "invalid", label: "Local validation", path: "/invalid", state: "errors" },
        { file: "valid", label: "Optional form", path: "/valid", state: "errors" },
        { file: "dialog", label: "Destructive dialog", path: "/dialog", state: "dialog" },
      ],
      { imports: false },
    );
    assert.equal(writes, 0, "controlled-state export sent a mutation");
    assert.deepEqual(
      saved.frames.map((f) => f.path),
      ["/frames/invalid.html"],
    );
    assert.deepEqual(
      saved.skipped.map((f) => [f.label, f.reason]),
      [
        ["Optional form", "state capture refused a network mutation"],
        ["Destructive dialog", "state capture refused a network mutation"],
      ],
    );
    console.log(
      "  ✓ static validation/dialog capture blocks mutations and refuses a valid optional-form submission",
    );
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
}

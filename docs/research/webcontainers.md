# M8: can the preview run in the browser? (2026-09-27)

The spike (removed from the repository on 2026-10-01, after the decision; this note keeps its findings) ran the Smithable engine in a web page and a generated app's dev server inside a StackBlitz WebContainer (`@webcontainer/api` 1.6.4) in the same tab, driven by headless Chromium.

## What works

| | Result |
|---|---|
| Boot a WebContainer (Node 22 inside) | 1–4 s |
| Install the generated app's dependencies (`npm install`, cold) | 44–86 s |
| Start its Vite 8 dev server (Rolldown falls back to its WebAssembly build automatically) | 10–12 s more |
| SQLite in WebAssembly (`sql.js` through Drizzle's `sql-js` driver): migrations and queries | Works; the list and form pages render from it |
| The engine in the browser: apply an operation and regenerate the app | 15 ms |
| Write the changed files into the container | 25 ms |
| `drizzle-kit generate` inside the container | 2.7 s |
| Preview shows a new field after the operation (hot reload) | **2.9–3.5 s** |

So the engine itself is fully browser-ready, as designed (ARCHITECTURE rule: engine packages have no Node built-ins). The preview update is close to, but above, the 2-second target.

## What does not

**`AsyncLocalStorage` loses its value after the first `await`** inside a WebContainer ([stackblitz/webcontainer-core#1169](https://github.com/stackblitz/webcontainer-core/issues/1169), open, no fix or workaround announced). Tested directly: the store is there synchronously and `undefined` after `await null`, a timer, or a nested async call. The generated stack depends on it:

- **TanStack Start** keeps each request's context in it, so server functions cannot read the request (`No Start context found in AsyncLocalStorage`). A preview-only patch that falls back to the last stored value made pages render, but it is only correct while requests do not overlap.
- **Better Auth** keeps its per-request state and database transactions in it, across `await`. The patch cannot give it correct semantics; the development sign-in failed inside the preview. SvelteKit hit the same limitation ([sveltejs/kit#16822](https://github.com/sveltejs/kit/pull/16822)).
- Separately, the preview runs on another site (`*.webcontainer-api.io`) than the page embedding it, so sign-in cookies would need `SameSite=None` or partitioned cookies in the preview.

An app without sign-in works, which is how the timings above were measured.

## Decision

Following the roadmap's rule ("if it isn't viable, the Remote VM runtime is chosen instead"):

1. **The hosted preview runs in a Remote VM** (a small EU VM or container per active project), not a WebContainer. Everything generated apps use works there unchanged, including sign-in and native SQLite, so there is no preview-only database driver.
2. **The engine stays in the browser.** Operations, validation and generation run in the Builder tab (15 ms); the tab sends changed files to the VM, which runs the dev server. The Builder stays responsive and the VM does no Smithable work.
3. **Hosted projects are Git repositories on EU servers.** The browser engine commits each operation (as the CLI does); the preview VM works on a checkout. This keeps undo, history and hand-over to developers identical to the local product.
4. **WebContainers stay an option.** The spike remains as a harness; once #1169 is fixed, rerunning it shows whether the preview can move into the browser and save the VM cost.

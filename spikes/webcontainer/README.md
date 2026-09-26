# M8 spike: WebContainers

Runs the Smithable engine in a web page, and a generated app's dev server inside a StackBlitz WebContainer in the same tab. Findings and the decision: [docs/research/webcontainers.md](../../docs/research/webcontainers.md).

```sh
pnpm build
node spikes/webcontainer/prepare.mjs --no-sign-in   # or without the flag: the full CRM
node spikes/webcontainer/drive.mjs 400               # headless Chromium; prints the timings
```

Not part of `pnpm check`: it needs the network (StackBlitz and npm) and takes a few minutes.

// `smithable preview [dir] [--live] [--fast] [--everything] [--for <minutes>] [--port <n>]`: the app's development
// server with its door open to this process alone (a new secret each start), and with --live the
// project's sample users acting in it (docs/design/sample-users.md §4), their moves printed as
// they happen. With a model configured they act from their personas; --fast, or no model, is each
// person's draw from what they did; --everything tries every move's variants and reports what the
// app took that its rules forbid, or refused that they allow (§3a). A run ends after --for
// minutes (an hour unless said), or on Ctrl+C.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { providersFor } from "./ask.js";
import { generate } from "./generate.js";
import { type Io, tool } from "./io.js";
import { doorAt, projectPeople } from "./sample-people.js";
import { type FeedLine, sampleRunner } from "./sample-run.js";

/** A feed line as the terminal shows it. */
export function feedText(line: FeedLine): string {
  const time = new Date(line.at).toLocaleTimeString("en-GB", { hour12: false });
  const why = line.why ? ` (${line.why})` : "";
  const said =
    line.outcome === "refused"
      ? ` Refused: ${line.message}`
      : line.outcome === "finding"
        ? ` ${line.variant ? "Finding" : "The app failed"}: ${line.message}${line.seed !== undefined ? ` (seed ${line.seed})` : ""}`
        : line.message
          ? ` ${line.message}`
          : "";
  return `${time} ${line.who}: ${line.text}${why}.${said}\n`;
}

export async function preview(
  dir: string,
  io: Io,
  options: { live: boolean; fast: boolean; everything?: boolean; minutes: number; port: number },
): Promise<number> {
  const code = await generate(dir, io, {
    tools: !existsSync(join(dir, "node_modules")),
    force: false,
  });
  if (code !== 0) return code;
  const base = `http://localhost:${options.port}`;
  const secret = randomBytes(24).toString("hex");
  const server = spawn(
    ...tool(dir, "vite", ["dev", "--port", String(options.port), "--strictPort"]),
    {
      cwd: dir,
      env: { ...process.env, DEV_DOOR_SECRET: secret, BETTER_AUTH_URL: base },
      // With sample users acting, the server's own lines (a line per request) would bury theirs.
      stdio: ["ignore", options.live ? "ignore" : "inherit", "inherit"],
      detached: true,
    },
  );
  const exited = new Promise<number>((resolve) =>
    server.on("exit", (status) => resolve(status ?? 0)),
  );
  const stopServer = () => {
    try {
      if (server.pid) process.kill(-server.pid);
    } catch {}
  };
  // The server is in a process group of its own: Ctrl+C stops it from here, whenever it comes.
  let interrupted = () => {};
  process.once("SIGINT", () => {
    stopServer();
    interrupted();
  });
  let gone = false;
  void exited.then(() => {
    gone = true;
  });
  let up = false;
  for (let i = 0; i < 240 && !gone && !up; i++) {
    up = await fetch(`${base}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) {
    io.err(
      gone
        ? `The app did not start (is port ${options.port} taken?).\n`
        : "The app did not answer.\n",
    );
    stopServer();
    return 1;
  }
  io.out(`\nThe app is at ${base}.\n`);
  if (!options.live) return exited;
  let printed = 0;
  let ended = false;
  let finish = () => {};
  const runner = sampleRunner({
    door: doorAt(base, secret),
    load: projectPeople(dir),
    providers: () => (options.fast || options.everything ? [] : providersFor()),
    changed: (state) => {
      // Only the lines not printed yet (the feed keeps its last two hundred).
      for (const line of state.feed) if (line.n >= printed) io.out(feedText(line));
      printed = (state.feed.at(-1)?.n ?? printed - 1) + 1;
      // A run that stopped by itself (a cap) ends the command.
      if (!state.running && state.stopped && !ended) {
        ended = true;
        io.err(`${state.stopped}\n`);
        finish();
      }
    },
  });
  const started = runner.state();
  if (!started.people.length) {
    io.err(
      'No sample users: add some with `smithable op addSampleUser "Maja Lindqvist" <role>`.\n',
    );
    stopServer();
    return 1;
  }
  io.out(
    `${started.people.map((p) => p.name).join(", ")} ${options.everything ? "try everything in the app (every move with the values its rules allow and forbid)" : `use the app${options.fast ? " (fast, no model)" : ""}`}, for ${options.minutes} minutes. Ctrl+C stops.\n`,
  );
  runner.start(options.fast, options.everything ? "everything" : "sensible");
  // Nobody uses Studio here: the run lasts as long as it was asked to.
  const keep = setInterval(() => runner.touch(), 60_000);
  await new Promise<void>((resolve) => {
    const end = setTimeout(resolve, options.minutes * 60_000);
    finish = interrupted = () => {
      clearTimeout(end);
      resolve();
    };
  });
  clearInterval(keep);
  runner.pause();
  const { moves, cost, currency, coverage } = runner.state();
  io.out(`${moves} moves${cost > 0 ? `, ${cost.toFixed(3)} ${currency}` : ""}.\n`);
  // Trying everything: the report (§3a), each finding with its seed.
  if (coverage) {
    io.out(
      `Tried ${coverage.tried} of ${coverage.of} variants: ${coverage.passes} as the rules say, ${coverage.findings} ${coverage.findings === 1 ? "finding" : "findings"}.\n`,
    );
    // From the log, which keeps the whole run (the feed only its last lines).
    for (const e of runner.log().filter((e) => e.outcome === "finding"))
      io.out(`  turn ${e.turn}, ${e.id}: ${e.move ?? "no move"}: ${e.message ?? ""}\n`);
  }
  stopServer();
  await exited;
  return 0;
}

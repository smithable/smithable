/// <reference types="node" />
import { afterEach, expect, test, vi } from "vitest";

// access.ts (the refusal's Conflict) imports the router for its redirect, which tests do not need.
vi.mock("@tanstack/react-router", () => ({ redirect: () => undefined }));

// The kit's trace and log modules, as the generated apps get them (paths the build does not follow).
const tracePath: string = "../templates/src/kit/trace.server.ts";
const logPath: string = "../templates/src/kit/log.server.ts";
const trace = (await import(tracePath)) as {
  traced(
    request: Request,
    address: string | undefined,
    run: () => Promise<Response>,
  ): Promise<Response>;
  traceWho(who: string, role?: string): void;
  loggedPath(url: URL): string;
};
const { log, refusal } = (await import(logPath)) as {
  log: { info(message: string, values?: Record<string, unknown>): void };
  refusal(error: unknown): Error;
};

/** Every JSON line written to standard output and error while `run` runs. */
async function lines(run: () => Promise<unknown>): Promise<Record<string, unknown>[]> {
  const written: string[] = [];
  const keep = (chunk: unknown) => {
    written.push(String(chunk));
    return true;
  };
  vi.spyOn(process.stdout, "write").mockImplementation(keep);
  vi.spyOn(process.stderr, "write").mockImplementation(keep);
  await run();
  vi.restoreAllMocks();
  return written.flatMap((w) => w.split("\n").filter(Boolean)).map((l) => JSON.parse(l));
}
afterEach(() => vi.restoreAllMocks());

const id = "4bf92f3577b34da6a3ce929d0e0e4736";
const request = new Request("http://app.test/customers?q=Anna&page=2", {
  headers: { traceparent: `00-${id}-00f067aa0ba902b7-01`, "user-agent": "test" },
});

test("one id for the request: continued, answered, and on every line it writes", async () => {
  let answer: Response | undefined;
  const written = await lines(async () => {
    answer = await trace.traced(request, "10.0.0.1", async () => {
      trace.traceWho("user-1", "admin");
      log.info("Looked up the customers", { found: 3 });
      return new Response("ok");
    });
  });
  expect(answer?.headers.get("traceparent")).toMatch(new RegExp(`^00-${id}-[0-9a-f]{16}-01$`));
  const [app, access] = written;
  expect(app).toMatchObject({ log: "app", level: "info", trace: id, who: "user-1", found: 3 });
  expect(access).toMatchObject({
    log: "access",
    trace: id,
    method: "GET",
    path: "/customers?q&page",
    status: 200,
    who: "user-1",
    role: "admin",
    address: "10.0.0.1",
    browser: "test",
  });
  expect(JSON.stringify(written)).not.toContain("Anna");
});

test("a request without an id gets one; an unexpected database error is logged and quoted by its id", async () => {
  let message = "";
  const written = await lines(() =>
    trace.traced(new Request("http://app.test/"), undefined, async () => {
      message = refusal(new Error("disk I/O error")).message;
      return new Response("", { status: 500 });
    }),
  );
  const [error, access] = written;
  expect(access?.trace).toMatch(/^[0-9a-f]{32}$/);
  expect(error).toMatchObject({ level: "error", trace: access?.trace });
  expect(error).not.toHaveProperty("who");
  expect(error).toMatchObject({ error: { message: "disk I/O error" } });
  expect(message).toBe(`Something went wrong. Please try again. Reference: ${access?.trace}`);
  // What a person can act on stays a code for the form, not a log line.
  expect(refusal(new Error("UNIQUE constraint failed: customers.email")).message).toBe(
    "taken:email",
  );
});

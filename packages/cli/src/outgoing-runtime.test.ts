import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, expect, test, vi } from "vitest";

const state = globalThis as typeof globalThis & { smithableOutbox?: unknown };
afterEach(() => {
  delete state.smithableOutbox;
  vi.useRealTimers();
});

function fixture() {
  vi.useFakeTimers();
  type Row = {
    id: number;
    nextAt: Date;
    sentAt?: Date;
    failedAt?: Date;
    error?: string;
    tries: number;
    createdAt: Date;
    body: string;
    target: string;
  };
  const rows = { mail: [] as Row[], call: [] as Row[] };
  const table = (kind: "mail" | "call") => ({ kind, id: "id", nextAt: "nextAt" });
  const mail = table("mail");
  const call = table("call");
  const storage = { failures: 0 };
  const db = {
    select: () => ({
      from: (t: typeof mail) => ({
        where: () => ({
          orderBy: () => ({
            limit: (n: number) => ({
              all: () =>
                rows[t.kind]
                  .filter((r) => !r.sentAt && !r.failedAt && r.nextAt.getTime() <= Date.now())
                  .slice(0, n),
            }),
          }),
        }),
      }),
    }),
    update: (t: typeof mail) => ({
      set: (values: object) => ({
        where: (id: number) => ({
          run: () => {
            Object.assign(rows[t.kind].find((r) => r.id === id) ?? {}, values);
          },
        }),
      }),
    }),
    transaction: (fn: (tx: unknown) => void) => {
      if (storage.failures > 0) {
        storage.failures--;
        throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
      }
      return fn(db);
    },
  };
  const post = vi.fn();
  const sendMail = vi.fn().mockResolvedValue(undefined);
  const source = stripTypeScriptTypes(
    readFileSync(
      new URL("../../adapter-tanstack/templates/src/kit/outgoing.server.ts", import.meta.url),
      "utf8",
    )
      .replace(/^import[\s\S]*?;\n/gm, "")
      .replace(/\bexport /g, "")
      .replace(/import\.meta\.env\.(DEV|SSR)/g, "false"),
  );
  const load = () =>
    new Function(
      "db",
      "outgoingMail",
      "outgoingCall",
      "eq",
      "and",
      "isNull",
      "lte",
      "sendMail",
      "mailConfigured",
      "audit",
      "log",
      "post",
      "proxied",
      "proxyRefusal",
      "targetSettings",
      "pauseAfter",
      "createHmac",
      "outsideTrace",
      `${source}; return {sendDue};`,
    )(
      db,
      mail,
      call,
      (_: unknown, id: number) => id,
      () => {},
      () => {},
      () => {},
      sendMail,
      () => true,
      () => {},
      { warn: vi.fn(), error: vi.fn() },
      post,
      () => true,
      () => undefined,
      () => ({ url: "TEST_WEBHOOK_URL", secret: "TEST_WEBHOOK_SECRET" }),
      () => 60000,
      () => ({ update: () => ({ digest: () => "signature" }) }),
      (fn: () => void) => fn(),
    ) as { sendDue(): Promise<number> };
  vi.stubEnv("TEST_WEBHOOK_URL", "https://example.test/hook");
  vi.stubEnv("TEST_WEBHOOK_SECRET", "test");
  const row = (id: number) => ({
    id,
    tries: 0,
    createdAt: new Date(),
    nextAt: new Date(),
    body: "{}",
    target: "test",
  });
  return { rows, row, post, sendMail, load, storage };
}

afterEach(() => vi.unstubAllEnvs());

test("mail queued during a stalled webhook sends before the webhook finishes, including after module reload", async () => {
  const f = fixture();
  let release = () => {};
  f.post.mockImplementation(
    () =>
      new Promise<number>((resolve) => {
        release = () => resolve(200);
      }),
  );
  f.rows.call.push(f.row(1));
  const first = f.load().sendDue();
  // The transport itself is the barrier, with no real-time sleeps.
  await vi.waitUntil(() => f.post.mock.calls.length === 1);
  f.rows.mail.push(f.row(2));
  const next = f.load().sendDue();
  await vi.waitUntil(() => f.sendMail.mock.calls.length === 1);
  expect(f.rows.call[0]?.sentAt).toBeUndefined();
  release();
  expect(await first).toBe(1);
  expect(await next).toBe(1);
  expect(f.post).toHaveBeenCalledTimes(1);
  expect(f.sendMail).toHaveBeenCalledTimes(1);
});

test("simultaneous drains deduplicate both transports and a failed mail releases its guard", async () => {
  const f = fixture();
  f.rows.mail.push(f.row(1));
  f.rows.call.push(f.row(2));
  f.sendMail.mockRejectedValueOnce(new Error("mail offline"));
  f.post.mockResolvedValue(200);
  const kit = f.load();
  expect(await Promise.all([kit.sendDue(), kit.sendDue()])).toEqual([1, 0]);
  expect(f.post).toHaveBeenCalledTimes(1);
  expect(f.sendMail).toHaveBeenCalledTimes(1);
  f.rows.mail.push(f.row(3));
  expect(await kit.sendDue()).toBe(1);
  expect(f.sendMail).toHaveBeenCalledTimes(2);
});

test("a full mail batch schedules the remaining mail", async () => {
  const f = fixture();
  for (let i = 0; i < 51; i++) f.rows.mail.push(f.row(i));
  expect(await f.load().sendDue()).toBe(50);
  expect(f.sendMail).toHaveBeenCalledTimes(50);
  await vi.runOnlyPendingTimersAsync();
  expect(f.sendMail).toHaveBeenCalledTimes(51);
});

test("a failed webhook releases its guard for later calls and keeps retry timing", async () => {
  const f = fixture();
  f.rows.call.push(f.row(1));
  f.post.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(200);
  const kit = f.load();
  expect(await kit.sendDue()).toBe(0);
  expect(f.rows.call[0]?.nextAt.getTime()).toBe(Date.now() + 60000);
  f.rows.call.push(f.row(2));
  expect(await kit.sendDue()).toBe(1);
  expect(f.post).toHaveBeenCalledTimes(2);
});

for (const kind of ["mail", "call"] as const) {
  test(`a successful ${kind} retries its busy database acknowledgement without resending`, async () => {
    const f = fixture();
    f.rows[kind].push(f.row(1));
    f.post.mockResolvedValue(200);
    f.storage.failures = 1;
    const sending = f.load().sendDue();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.rows[kind][0]?.error).toBeUndefined();
    expect(await f.load().sendDue()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await sending).toBe(1);
    expect(f.rows[kind][0]?.sentAt).toBeInstanceOf(Date);
    expect(kind === "mail" ? f.sendMail : f.post).toHaveBeenCalledTimes(1);
  });
}

import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The kit's mail.ts as the generated apps get it, with the transport and the disk stood in.
const path: string = "../templates/src/kit/mail.ts";

const m = vi.hoisted(() => ({ smtp: [] as unknown[], held: [] as string[] }));
vi.mock("nodemailer", () => ({
  createTransport: (settings: unknown) => ({
    async sendMail(mail: unknown) {
      if (typeof settings === "object" && settings !== null && "streamTransport" in settings)
        return { messageId: "<one@test>", message: "Subject: x\n\nx" };
      m.smtp.push(mail);
      return {};
    },
  }),
}));
vi.mock("node:fs", () => ({
  mkdirSync() {},
  writeFileSync() {},
  renameSync(_from: string, to: string) {
    m.held.push(to);
  },
  readdirSync: () => [],
  readFileSync: () => "",
}));
vi.mock("../templates/src/kit/log.server", () => ({ log: { warn() {}, info() {} } }));
vi.mock("../templates/src/kit/visitor", () => ({ ownDataDir: () => "/data" }));

type Kit = {
  sendMail(mail: { to: string; subject: string; text: string }): Promise<void>;
  mailMode(): string | undefined;
};
const kit = async () => {
  vi.resetModules();
  return (await import(path)) as Kit;
};
const mail = { to: "someone@example.com", subject: "Hello", text: "Hi" };

beforeEach(() => {
  m.smtp = [];
  m.held = [];
  vi.stubEnv("SMTP_URL", "smtp://user:secret@smtp.example.com:587");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("MAIL_MODE unset sends through SMTP as before, and Import names no mode", async () => {
  vi.stubEnv("MAIL_MODE", undefined);
  const k = await kit();
  await k.sendMail(mail);
  expect(m.smtp).toHaveLength(1);
  expect(m.held).toHaveLength(0);
  expect(k.mailMode()).toBeUndefined();
});

test("MAIL_MODE blank, mistyped or outbox holds the mail in the outbox though SMTP is set", async () => {
  const modes = ["", "  ", "outbox", " all", "Testers"];
  for (const mode of modes) {
    vi.stubEnv("MAIL_MODE", mode);
    const k = await kit();
    await k.sendMail(mail);
    expect(m.smtp, mode).toHaveLength(0);
    expect(k.mailMode(), mode).toBe("held");
  }
  expect(m.held).toHaveLength(modes.length);
  expect(m.held.every((f) => f.startsWith("/data/mail/outbox/") && f.endsWith(".eml"))).toBe(true);
});

test("MAIL_MODE testers or all sends; an SMTP_URL that is no address reads held, not an error", async () => {
  vi.stubEnv("MAIL_MODE", "testers");
  let k = await kit();
  await k.sendMail(mail);
  expect(m.smtp).toHaveLength(1);
  expect(k.mailMode()).toBe("testers");
  vi.stubEnv("SMTP_URL", "not an address");
  k = await kit();
  expect(k.mailMode()).toBe("held");
});

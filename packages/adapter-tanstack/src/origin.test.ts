import { afterEach, expect, test } from "vitest";

// The kit's origin.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/origin.ts";
const kit = (await import(path)) as {
  originOf(request: Request): string;
  requestOrigin(request: Request): string;
};

afterEach(() => {
  delete process.env.TRUST_PROXY;
  delete process.env.BETTER_AUTH_URL;
});

const asked = (headers: Record<string, string>) =>
  new Request("http://10.0.0.5:3000/sitemap.xml", { headers });

test("the app's own address wins over a host a visitor sent through a proxy (T803)", () => {
  process.env.TRUST_PROXY = "1";
  process.env.BETTER_AUTH_URL = "https://shop.example.com";
  // A common proxy passes a visitor's X-Forwarded-Host on; links keep the app's own address.
  expect(kit.originOf(asked({ "x-forwarded-host": "evil.example" }))).toBe(
    "https://shop.example.com",
  );
});

test("without an address set, a forwarded host is used only when it is one", () => {
  process.env.TRUST_PROXY = "1";
  expect(
    kit.originOf(asked({ "x-forwarded-host": "shop.example.com", "x-forwarded-proto": "https" })),
  ).toBe("https://shop.example.com");
  // No port past 65535, no empty labels: the request's own origin instead.
  for (const host of ["shop.example.com:99999", "a..b", "shop.example.com:0"])
    expect(kit.originOf(asked({ "x-forwarded-host": host })), host).toBe("http://10.0.0.5:3000");
  // Written as a browser writes an origin, so an Origin header compares equal.
  expect(
    kit.originOf(
      asked({ "x-forwarded-host": "Shop.Example.com:443", "x-forwarded-proto": "https" }),
    ),
  ).toBe("https://shop.example.com");
  delete process.env.TRUST_PROXY;
  expect(kit.originOf(asked({ "x-forwarded-host": "shop.example.com" }))).toBe(
    "http://10.0.0.5:3000",
  );
});

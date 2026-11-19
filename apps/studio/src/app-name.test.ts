import { expect, test } from "vitest";
import { checkName, NAME_PATH, readOffer, saveName, splitAddress } from "./app-name";

type Seen = { url: string; init?: RequestInit };
const service = (body: unknown, type = "application/json", status = 200) => {
  const seen: Seen[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": type },
    });
  };
  return { fetcher, seen };
};

test("the offer is shown only when the service answers with a domain", async () => {
  const { fetcher, seen } = service({
    offer: ["webapp.ax", "apps.example"],
    default: "apps.example",
    current: "https://shop.webapp.ax",
  });
  expect(await readOffer(fetcher)).toEqual({
    offer: ["webapp.ax", "apps.example"],
    default: "apps.example",
    current: "https://shop.webapp.ax",
  });
  expect(seen[0].url).toBe(NAME_PATH);
  // No domain served: the feature is off, nothing shows.
  expect(await readOffer(service({ offer: [], default: null, current: null }).fetcher)).toBe(
    undefined,
  );
  // Local Studio or a sign-in page: HTML, not the service's JSON.
  expect(await readOffer(service("<!doctype html>", "text/html").fetcher)).toBe(undefined);
  expect(
    await readOffer(service({ why: "A demo gets no name." }, "application/json", 403).fetcher),
  ).toBe(undefined);
  expect(
    await readOffer(async () => {
      throw new TypeError("offline");
    }),
  ).toBe(undefined);
  // A default the offer does not hold falls back to the first domain.
  expect(
    (await readOffer(service({ offer: ["webapp.ax"], default: "other.ax", current: null }).fetcher))
      ?.default,
  ).toBe("webapp.ax");
});

test("the check gives the address or the service's own sentence", async () => {
  const free = service({ free: true, address: "https://shop.webapp.ax" });
  expect(await checkName("shop", "webapp.ax", free.fetcher)).toEqual({
    free: true,
    address: "https://shop.webapp.ax",
  });
  expect(free.seen[0].url).toBe(`${NAME_PATH}?name=shop&domain=webapp.ax`);
  expect(
    await checkName("admin", "webapp.ax", service({ why: "That name is taken." }).fetcher),
  ).toEqual({ why: "That name is taken." });
  expect((await checkName("x", "webapp.ax", service("", "text/html", 502).fetcher)).free).toBe(
    undefined,
  );
});

test("set and remove post the service's form", async () => {
  const set = service({ address: "https://shop.webapp.ax" });
  expect(await saveName({ name: "shop", domain: "webapp.ax" }, set.fetcher)).toEqual({
    address: "https://shop.webapp.ax",
  });
  expect(set.seen[0].init?.method).toBe("POST");
  expect(set.seen[0].init?.body).toBe("name=shop&domain=webapp.ax");
  const removed = service({ removed: true });
  expect(await saveName({ remove: true }, removed.fetcher)).toEqual({ removed: true });
  expect(removed.seen[0].init?.body).toBe("remove=1");
  expect(
    await saveName(
      { name: "shop", domain: "webapp.ax" },
      service({ why: "That name is taken." }, "application/json", 409).fetcher,
    ),
  ).toEqual({ why: "That name is taken." });
  // A removal answered with an address is not a removal.
  expect("why" in (await saveName({ remove: true }, set.fetcher))).toBe(true);
});

test("the address in use splits into a name and an offered domain", () => {
  const offer = ["webapp.ax", "apps.webapp.ax"];
  expect(splitAddress("https://shop.webapp.ax", offer)).toEqual({
    name: "shop",
    domain: "webapp.ax",
  });
  expect(splitAddress("https://shop.apps.webapp.ax/", offer)).toEqual({
    name: "shop",
    domain: "apps.webapp.ax",
  });
  expect(splitAddress("https://shop.elsewhere.com", offer)).toBe(undefined);
  expect(splitAddress(null, offer)).toBe(undefined);
  expect(splitAddress("not a url", offer)).toBe(undefined);
});

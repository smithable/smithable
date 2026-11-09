import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from "node:crypto";
import { expect, test } from "vitest";

// The kit's push-crypto.server.ts, as the generated apps get it (a path the build does not follow).
type Keys = { publicKey: string; privateKey: string };
const path: string = "../templates/src/kit/push-crypto.server.ts";
const { encryptPush, newPushKeys, vapidHeader } = (await import(path)) as {
  encryptPush(
    s: { p256dh: string; auth: string },
    text: Uint8Array,
    sender?: Keys,
    salt?: Uint8Array,
  ): Buffer;
  newPushKeys(): Keys;
  vapidHeader(endpoint: string, keys: Keys, subject: string, now?: number): string;
};

const bytes = (text: string) => Buffer.from(text, "base64url");

// RFC 8291 Appendix A: the example's keys, secret and salt give exactly its message.
test("a push message is encrypted as RFC 8291's example", () => {
  const body = encryptPush(
    {
      p256dh:
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg",
    },
    Buffer.from("When I grow up, I want to be a watermelon"),
    {
      publicKey:
        "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
      privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
    },
    bytes("DGv6ra1nlYgDCS1FRnbzlw"),
  );
  expect(body.toString("base64url")).toBe(
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
  );
});

test("a message to a new browser key, with a new sender key and salt, decrypts as the browser would", () => {
  const browser = createECDH("prime256v1");
  browser.generateKeys();
  const auth = Buffer.from("0123456789abcdef");
  const body = encryptPush(
    { p256dh: browser.getPublicKey().toString("base64url"), auth: auth.toString("base64url") },
    Buffer.from("New order: #12"),
  );
  // The browser's side: the header, then the same keys from its private key.
  const salt = body.subarray(0, 16);
  const sender = body.subarray(21, 86);
  const shared = browser.computeSecret(sender);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), browser.getPublicKey(), sender]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, info, 32));
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12),
  );
  const sealed = body.subarray(86);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(sealed.subarray(-16));
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]);
  expect(plain.subarray(0, -1).toString()).toBe("New order: #12");
  expect(plain.at(-1)).toBe(2);
});

test("the VAPID header is a JWT for the push service's origin, signed with the app's key", () => {
  const keys = newPushKeys();
  const now = Date.UTC(2026, 10, 9, 8);
  const header = vapidHeader(
    "https://fcm.googleapis.com/fcm/send/abc",
    keys,
    "mailto:shop@example.com",
    now,
  );
  const [, jwt = "", k = ""] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? [];
  expect(k).toBe(keys.publicKey);
  const [head = "", claims = "", signature = ""] = jwt.split(".");
  expect(JSON.parse(bytes(claims).toString())).toEqual({
    aud: "https://fcm.googleapis.com",
    exp: now / 1000 + 12 * 60 * 60,
    sub: "mailto:shop@example.com",
  });
  const key = createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: bytes(keys.publicKey).subarray(1, 33).toString("base64url"),
      y: bytes(keys.publicKey).subarray(33).toString("base64url"),
    },
    format: "jwk",
  });
  expect(
    verify(
      "sha256",
      Buffer.from(`${head}.${claims}`),
      { key, dsaEncoding: "ieee-p1363" },
      bytes(signature),
    ),
  ).toBe(true);
});

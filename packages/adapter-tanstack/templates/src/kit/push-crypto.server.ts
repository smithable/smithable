// Smithable app kit: Web Push's two pieces of cryptography (docs/design/notifications.md §4), on
// Node's own crypto rather than a package: the message encrypted for one browser (RFC 8291, the
// aes128gcm encoding of RFC 8188), and the app's signature the push service asks for (VAPID,
// RFC 8292). The browser's push service carries the message and can read none of it.
import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const bytesOf = (text: string) => Buffer.from(text, "base64url");

/** A key pair for VAPID or a message's sender: the public key uncompressed (65 bytes), base64url. */
export interface PushKeys {
  publicKey: string;
  privateKey: string;
}

/** A new P-256 key pair. */
export function newPushKeys(): PushKeys {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64(ecdh.getPublicKey()), privateKey: b64(ecdh.getPrivateKey()) };
}

/** A browser's subscription, as PushManager.subscribe gives it. */
export interface Subscription {
  endpoint: string;
  /** The browser's public key (p256dh) and its auth secret, base64url. */
  p256dh: string;
  auth: string;
}

/**
 * The message's body, encrypted for one browser (RFC 8291 §3, RFC 8188 with one record).
 * `sender` and `salt` are new for each message; given here only so a test can repeat the RFC's.
 */
export function encryptPush(
  subscription: Pick<Subscription, "p256dh" | "auth">,
  plaintext: Uint8Array,
  sender: PushKeys = newPushKeys(),
  salt: Uint8Array = randomBytes(16),
): Buffer {
  const browser = bytesOf(subscription.p256dh);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(bytesOf(sender.privateKey));
  const senderPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(browser);
  // The input keying material from the shared secret and the browser's auth secret (§3.3, §3.4).
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), browser, senderPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, bytesOf(subscription.auth), keyInfo, 32));
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12),
  );
  // One record: the text and the delimiter 2 that marks the last record (RFC 8188 §2).
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const sealed = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  Buffer.from(salt).copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(senderPublic.length, 20);
  return Buffer.concat([header, senderPublic, sealed]);
}

/**
 * The Authorization header for a push to `endpoint` (RFC 8292): a JWT for the push service's
 * origin, signed with the app's VAPID key, valid for 12 hours, naming the app's contact.
 */
export function vapidHeader(endpoint: string, keys: PushKeys, subject: string, now = Date.now()) {
  const publicKey = bytesOf(keys.publicKey);
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: keys.privateKey,
      x: b64(publicKey.subarray(1, 33)),
      y: b64(publicKey.subarray(33, 65)),
    },
    format: "jwk",
  });
  const part = (value: object) => b64(Buffer.from(JSON.stringify(value)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: subject,
  })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64(signature)}, k=${keys.publicKey}`;
}

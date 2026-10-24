import { createHash, createHmac } from "node:crypto";

/**
 * A minimal client for S3-compatible storage (AWS S3, MinIO, Scaleway, OVH, Hetzner…):
 * put, get and list objects, signed with AWS Signature Version 4. Credentials come from the
 * environment and are never stored: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * (default us-east-1) and AWS_ENDPOINT_URL for providers other than AWS (path-style URLs).
 */
export class S3 {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly key: string;
  private readonly secret: string;
  /** Temporary credentials (an assumed role, SSO) come with a session token. */
  private readonly token: string | undefined;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const key = env.AWS_ACCESS_KEY_ID;
    const secret = env.AWS_SECRET_ACCESS_KEY;
    if (!key || !secret)
      throw new Error(
        "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (and AWS_ENDPOINT_URL for providers other than AWS).",
      );
    this.key = key;
    this.secret = secret;
    this.token = env.AWS_SESSION_TOKEN || undefined;
    this.region = env.AWS_REGION ?? "us-east-1";
    this.endpoint = (env.AWS_ENDPOINT_URL ?? `https://s3.${this.region}.amazonaws.com`).replace(
      /\/$/,
      "",
    );
  }

  async put(bucket: string, key: string, body: Buffer): Promise<void> {
    const response = await this.request("PUT", bucket, key, {}, body);
    if (!response.ok)
      throw new Error(`Uploading ${key} failed: ${response.status} ${await response.text()}`);
  }

  async get(bucket: string, key: string): Promise<Buffer> {
    const response = await this.request("GET", bucket, key);
    if (!response.ok)
      throw new Error(`Downloading ${key} failed: ${response.status} ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }

  /** Every key under a prefix (up to 1000 per request, followed through all pages). */
  async list(bucket: string, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const query: Record<string, string> = {
        "list-type": "2",
        prefix,
        ...(token ? { "continuation-token": token } : {}),
      };
      const response = await this.request("GET", bucket, "", query);
      const xml = await response.text();
      if (!response.ok) throw new Error(`Listing ${prefix} failed: ${response.status} ${xml}`);
      keys.push(...[...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => unescapeXml(m[1] ?? "")));
      const rawToken = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1];
      token = rawToken ? unescapeXml(rawToken) : undefined;
    } while (token);
    return keys;
  }

  private request(
    method: string,
    bucket: string,
    key: string,
    query: Record<string, string> = {},
    body: Buffer = Buffer.alloc(0),
  ): Promise<Response> {
    const url = new URL(
      `${this.endpoint}/${encodePath(bucket)}${key ? `/${encodePath(key)}` : ""}`,
    );
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${encode(k)}=${encode(query[k] ?? "")}`)
      .join("&");
    const now = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const date = now.slice(0, 8);
    const payload = sha256(body);
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payload,
      "x-amz-date": now,
      ...(this.token ? { "x-amz-security-token": this.token } : {}),
    };
    const signed = Object.keys(headers).sort();
    const canonical = [
      method,
      url.pathname,
      canonicalQuery,
      ...signed.map((h) => `${h}:${headers[h]}`),
      "",
      signed.join(";"),
      payload,
    ].join("\n");
    const scope = `${date}/${this.region}/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", now, scope, sha256(canonical)].join("\n");
    const key4 = ["aws4_request", "s3", this.region, date]
      .reverse()
      .reduce<Buffer | string>((k, part) => hmac(k, part), `AWS4${this.secret}`);
    const signature = createHmac("sha256", key4).update(toSign).digest("hex");
    return fetch(`${url.origin}${url.pathname}${canonicalQuery ? `?${canonicalQuery}` : ""}`, {
      method,
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.key}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`,
      },
      ...(method === "PUT" ? { body } : {}),
    });
  }
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();
/** RFC 3986 encoding, as Signature Version 4 wants it. */
const encode = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
const encodePath = (s: string) => s.split("/").map(encode).join("/");
const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

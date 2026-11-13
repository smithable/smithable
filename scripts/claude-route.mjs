// A loopback route to Claude for the benches (T754): the engine's providers speak OpenAI-style chat
// completions; this turns each call into a call to Anthropic's Messages API, as the hosted service's
// gateway does (system text apart, structured output with every object closed, no temperature), and
// the answer back. Its cost is counted at the model's list price (packages/ai listPrice), in dollars;
// cached input is counted as plain input, so a little high. The key is read from ~/.config/smithable/claude.env and never printed or logged.
//   const route = await claudeRoute(); … openAICompatible({ baseUrl: route.url, model: "claude-haiku-5-5", … }); route.close();
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";

const claudeKey = () => {
  const text = readFileSync(join(homedir(), ".config/smithable/claude.env"), "utf8");
  const key = /^claude_smithable_api_key=["']?([^"'\n]+)/m.exec(text)?.[1];
  if (!key) throw new Error("No Anthropic key in ~/.config/smithable/claude.env");
  return key;
};

/** Objects that list their properties are closed: Anthropic's structured output refuses open ones. */
const KEPT = new Set([
  "const",
  "enum",
  "default",
  "examples",
  "dependentRequired",
  "allOf",
  "not",
  "if",
  "then",
  "else",
]);
const NAMED = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
  "dependencies",
]);
export function closed(schema) {
  if (Array.isArray(schema)) return schema.map(closed);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (KEPT.has(key)) out[key] = value;
    else if (NAMED.has(key) && value && typeof value === "object" && !Array.isArray(value))
      out[key] = Object.fromEntries(Object.entries(value).map(([name, s]) => [name, closed(s)]));
    else out[key] = closed(value);
  }
  const type = out.type;
  const isObject =
    type === "object" || (Array.isArray(type) && type.includes("object")) || type === undefined;
  if (
    isObject &&
    out.properties &&
    typeof out.properties === "object" &&
    out.additionalProperties === undefined &&
    out.unevaluatedProperties === undefined
  )
    out.additionalProperties = false;
  return out;
}

/** The chat completions request as a Messages API request. */
export function messagesBody(body, maxTokens = 16000) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const text = (c) =>
    typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.text ?? "").join("") : "";
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => text(m.content))
    .join("\n\n");
  const turns = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const last = turns.at(-1);
    if (last?.role === m.role) last.content.push({ type: "text", text: text(m.content) || " " });
    else turns.push({ role: m.role, content: [{ type: "text", text: text(m.content) || " " }] });
  }
  const format = body.response_format;
  const schema = format?.type === "json_schema" ? closed(format.json_schema?.schema) : undefined;
  return {
    model: body.model,
    max_tokens: maxTokens,
    ...(system
      ? { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] }
      : {}),
    messages: turns.length ? turns : [{ role: "user", content: [{ type: "text", text: " " }] }],
    ...(schema ? { output_config: { format: { type: "json_schema", schema } } } : {}),
  };
}

const textOf = (answer) =>
  (answer.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
/** An answer's text without a Markdown code fence around it. */
export const unfenced = (text) =>
  /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/.exec(text)?.[1] ?? text;
const isJson = (text) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** Starts the route on a free loopback port. */
export async function claudeRoute() {
  const key = claudeKey();
  const server = createServer(async (req, res) => {
    const send = (status, value, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(typeof value === "string" ? value : JSON.stringify(value));
    };
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions"))
      return send(404, { error: "not here" });
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      const ask = async (body) => {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: AbortSignal.timeout(170_000),
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });
        return { response, text: await response.text() };
      };
      const body = messagesBody(JSON.parse(raw));
      let { response, text } = await ask(body);
      let content;
      // A schema the API cannot take (the engine's arguments keyed by an app's own names are maps,
      // which cannot be closed): asked once more without it, as the service's gateway does; the
      // system text asks for JSON only, and an answer that is not JSON is the first refusal.
      if (response.status === 400 && body.output_config && /output_config/i.test(text)) {
        const { output_config: _, ...plain } = body;
        const again = await ask(plain);
        const said = again.response.ok ? textOf(JSON.parse(again.text)) : "";
        const json = unfenced(said);
        if (again.response.ok && isJson(json))
          ({ response, text, content } = { ...again, content: json });
      }
      // A refusal goes back as it came (429 with its retry-after, so the caller waits and asks again).
      if (!response.ok)
        return send(
          response.status,
          text,
          response.headers.get("retry-after")
            ? { "retry-after": response.headers.get("retry-after") }
            : {},
        );
      const answer = JSON.parse(text);
      const u = answer.usage ?? {};
      send(200, {
        model: answer.model,
        choices: [
          {
            message: { role: "assistant", content: content ?? textOf(answer) },
            finish_reason: answer.stop_reason,
          },
        ],
        usage: {
          prompt_tokens:
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0),
          completion_tokens: u.output_tokens ?? 0,
        },
      });
    } catch (error) {
      send(502, { error: String(error?.message ?? error).replaceAll(key, "[key]") });
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${server.address().port}/v1`,
    close: () => new Promise((done) => server.close(done)),
  };
}

// A stand-in for an OpenAI-compatible model server (Ollama, Mistral, …), for tests: it answers
// known requests with scripted operations or questions, and reports token usage like a real one.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

/** A first draft from a sentence: the booking starter, renamed. */
function draft() {
  const example = new URL("../examples/booking/", import.meta.url);
  const files = [
    "smithable.yml",
    "smithable.auth.yml",
    "smithable.content.yml",
    "smithable.ux.yml",
  ];
  return Object.fromEntries(
    files.map((f) => [
      f,
      readFileSync(new URL(f, example), "utf8").replaceAll("Stillwater Yoga", "Lotus Pilates"),
    ]),
  );
}

const ANSWERS = [
  [
    /mobile number/i,
    {
      kind: "operations",
      operations: [{ op: "addField", args: { model: "Customer", field: "mobile", type: "phone" } }],
    },
  ],
  [
    /add a date/i,
    { kind: "question", question: "A date on what?", options: ["Orders", "Customers"] },
  ],
  [/email .* ships/i, { kind: "none", reason: "Sending email needs custom code." }],
];

/** Starts the server on a free port; `requests` collects what it was asked. */
export async function startFakeModel() {
  const requests = [];
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text || "{}");
    requests.push(body);
    const user = body.messages?.find((m) => m.role === "user")?.content ?? "";
    const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
    const request = /^Request: (.*)$/m.exec(user)?.[1] ?? "";
    const answer = system.includes("first version of a web app")
      ? draft()
      : (ANSWERS.find(([pattern]) => pattern.test(request))?.[1] ?? {
          kind: "none",
          reason: "The stand-in model only knows a few requests.",
        });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        model: "fake-model",
        choices: [{ message: { role: "assistant", content: JSON.stringify(answer) } }],
        usage: { prompt_tokens: Math.ceil(user.length / 4), completion_tokens: 40 },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

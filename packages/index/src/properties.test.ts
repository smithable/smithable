// Property-based checks (backlog A 63): the words box's rules on random requests built from the
// examples' own names and the words requests use. A request is read or not, never a crash; its
// operations apply, or are refused with a reason (as Studio shows it), never a crash.
import { type AuthIR, applyOperation, validateAuth, validateSpec } from "@smithable/core";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { matchRequest, refusalOf } from "./phrases.js";

const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const examples = Object.keys(raw)
  .filter((p) => p.endsWith("/smithable.yml"))
  .map((p) => p.split("/").at(-2) as string);

const WORDS = `add remove rename delete hide show make let only can cannot should must have has
  needs require required optional unique list lists page pages field fields column columns
  sort sorted by to as a an the of for on in with without and or not every each all no
  who what when called named new old email phone price status date number text yes
  sales admin staff visitors anyone signed public read write create edit see change
  descending ascending first last filter search menu title label help , . : " ' ! ?`.split(/\s+/);

describe.each(examples)("%s", (example) => {
  const spec = raw[`../../../examples/${example}/smithable.yml`] as string;
  const authText = raw[`../../../examples/${example}/smithable.auth.yml`];
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error(`${example} is invalid`);
  const auth = authText
    ? (validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth as AuthIR)
    : undefined;
  const roles = auth?.roles.map((r) => r.name) ?? [];
  // Names as people write them: Customer, customers, the label of a field.
  const own = [
    ...ir.models.flatMap((m) => [m.name, m.name.toLowerCase(), `${m.name.toLowerCase()}s`]),
    ...ir.models.flatMap((m) => m.fields.map((f) => f.name)),
    ...ir.pages.map((p) => p.id),
    ...roles,
  ];
  const request = fc.oneof(
    fc
      .array(fc.oneof(fc.constantFrom(...WORDS), fc.constantFrom(...own)), {
        minLength: 1,
        maxLength: 12,
      })
      .map((w) => w.join(" ")),
    fc.string({ maxLength: 80 }),
  );

  test("a request is read or not, never a crash; its operations apply or say why", () => {
    fc.assert(
      fc.property(request, (text) => {
        const refused = refusalOf(ir, text, roles, auth);
        if (refused) expect(refused.refusal.length).toBeGreaterThan(0);
        const matched = matchRequest(ir, text, roles, auth);
        if (!matched) return;
        let files: { spec: string; auth?: string } = {
          spec,
          ...(authText ? { auth: authText } : {}),
        };
        for (const { op, args } of matched.operations) {
          const result = applyOperation(files, op, args);
          if (!result.ok) {
            expect(result.message.length, `"${text}" (${matched.rule}): ${op}`).toBeGreaterThan(0);
            return;
          }
          files = { ...files, ...result.files };
        }
      }),
      {
        numRuns: Number(import.meta.env.FC_RUNS ?? 300),
        seed: Number(import.meta.env.FC_SEED ?? 1),
      },
    );
  }, 60_000);
});

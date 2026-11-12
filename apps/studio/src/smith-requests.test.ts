// Studio's own rules on what people say to Smith (docs/benchmarks/smith-requests.json, T731):
// undo and redo by words, and feedback, read before any model. What they catch must be right;
// what the set says needs no model must be caught. The lists only shrink (packages/ai has the
// rest of the rule tiers).
import { expect, test } from "vitest";
import { feedbackRequest } from "./builder/Ask";
import { readHistory } from "./history";

interface Request {
  id: string;
  text: string;
  kind: string;
  noModel: boolean;
}

const set = Object.values(
  import.meta.glob("../../../docs/benchmarks/smith-requests.json", {
    eager: true,
    import: "default",
  }),
)[0] as { requests: Request[] };

test("undo by words and feedback: what Studio's rules catch is right, and what needs no model is caught", () => {
  const wrong: string[] = [];
  const missed: string[] = [];
  for (const r of set.requests) {
    const history = readHistory(r.text) !== undefined;
    const feedback = feedbackRequest(r.text) !== undefined;
    if (history && r.kind !== "undo") wrong.push(`${r.id}: ${r.kind} read as undo`);
    if (feedback && r.kind !== "feedback") wrong.push(`${r.id}: ${r.kind} read as feedback`);
    if (r.noModel && r.kind === "undo" && !history) missed.push(`${r.id}: undo`);
    if (r.noModel && r.kind === "feedback" && !feedback) missed.push(`${r.id}: feedback`);
  }
  expect(wrong).toMatchSnapshot("read wrongly by Studio's rules");
  expect(missed).toMatchSnapshot("needs no model, not caught by Studio's rules yet");
});

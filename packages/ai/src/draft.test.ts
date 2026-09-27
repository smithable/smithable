import { describe, expect, test } from "vitest";
import { checkSpecFiles, closestStarter, draftProject, type SpecFiles } from "./draft.js";
import type { Provider } from "./provider.js";

const load = (example: string): SpecFiles => {
  const all = import.meta.glob("../../../examples/*/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  return Object.fromEntries(
    Object.entries(all)
      .filter(([path]) => path.includes(`/examples/${example}/`))
      .map(([path, text]) => [path.split("/").at(-1) as string, text]),
  );
};
const starters = { crm: load("crm"), booking: load("booking"), invoicing: load("invoicing") };

function scripted(answers: SpecFiles[], name = "frontier"): Provider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name,
    tier: name === "frontier" ? "frontier" : "smithable",
    location: "eu",
    price: { input: 1, output: 3 },
    prompts,
    async complete({ user }) {
      prompts.push(user);
      return {
        text: JSON.stringify(answers.shift()),
        model: name,
        inputTokens: 9000,
        outputTokens: 2500,
      };
    },
  };
}

describe("starting from a sentence", () => {
  test("the closest starter is chosen without a model", () => {
    expect(
      closestStarter("A booking site for a yoga studio with classes and instructors", starters),
    ).toBe("booking");
    expect(closestStarter("Invoices for freelancers and their clients", starters)).toBe(
      "invoicing",
    );
    expect(closestStarter("Our sales team tracks customers and orders", starters)).toBe("crm");
  });

  test("the strongest allowed model adapts the starter; errors go back once, exactly", async () => {
    const booking = starters.booking;
    const broken = {
      ...booking,
      "smithable.yml": booking["smithable.yml"]?.replace("crud: Session", "crud: Sesion") ?? "",
    };
    const fixed = {
      ...booking,
      "smithable.yml": booking["smithable.yml"]?.replace("Stillwater Yoga", "Lotus Pilates") ?? "",
    };
    const weak = scripted([], "smithable");
    const strong = scripted([broken, fixed]);
    const draft = await draftProject({
      description: "A booking site for a pilates studio",
      starter: booking,
      providers: [weak, strong],
    });
    expect(draft.kind).toBe("draft");
    expect(draft.kind === "draft" && draft.files["smithable.yml"]).toContain("name: Lotus Pilates");
    expect(weak.prompts).toHaveLength(0);
    expect(strong.prompts[0]).toContain("Description: A booking site for a pilates studio");
    expect(strong.prompts[1]).toMatch(/smithable\.yml:\d+:\d+ {2}error {2}.*Sesion/);
    expect(draft.usage.map((u) => u.cost)).toEqual([0.0165, 0.0165]);
  });

  test("the starters themselves are valid drafts", () => {
    for (const files of Object.values(starters)) expect(checkSpecFiles(files)).toEqual([]);
  });
});

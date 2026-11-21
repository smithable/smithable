// The project worker's own process (project-worker.ts): started in the project with childOptions() and
// no secret, it runs the app's own tools for each question on fd 3, one at a time, and answers
// each with a line of JSON. It ends when the pipe closes.
import { Socket } from "node:net";
import type { MigrationPlan } from "./generate.js";
import * as steps from "./tool-steps.js";

const dir = process.cwd();
const pipe = new Socket({ fd: 3, readable: true, writable: true });
let buffer = "";
let queue: Promise<void> = Promise.resolve();

pipe.setEncoding("utf8");
pipe.on("data", (chunk: string) => {
  buffer += chunk;
  for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
    const line = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    // A question that fails to parse ends the worker; the parent starts it again or falls back.
    queue = queue.then(() => answer(line)).catch(() => process.exit(1));
  }
});
pipe.on("end", () => process.exit(0));
pipe.on("error", () => process.exit(1));

async function answer(line: string): Promise<void> {
  const { id, step, migration } = JSON.parse(line) as {
    id: number;
    step: string;
    migration?: MigrationPlan;
  };
  let err = "";
  const say = {
    err: (text: string) => {
      err += text;
    },
  };
  let value: boolean | undefined;
  try {
    if (step === "warm") {
      await steps.warmTools(dir);
      value = true;
    } else if (step === "createMigration") value = await steps.createMigration(dir, migration);
    else if (step === "routeTree") value = await steps.routeTree(dir, say);
    else if (step === "applyMigrations") value = steps.applyMigrations(dir, say);
    else err = `No step "${step}".`;
  } catch (error) {
    err += error instanceof Error ? error.message : String(error);
  }
  pipe.write(`${JSON.stringify({ id, value: value ?? null, err: err.slice(0, 3000) })}\n`);
}

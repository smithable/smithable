import type { ChildProcess } from "node:child_process";

export function fixturePids(directory: string): number[];
export function stopStudioFixture(
  studio: ChildProcess | undefined,
  directory: string,
): Promise<void>;

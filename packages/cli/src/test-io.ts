import type { Io } from "./io.js";

/** An Io that records output, for tests. */
export function captureIo(): Io & { stdout: string; stderr: string } {
  const io = {
    stdout: "",
    stderr: "",
    out: (text: string) => {
      io.stdout += text;
    },
    err: (text: string) => {
      io.stderr += text;
    },
  };
  return io;
}

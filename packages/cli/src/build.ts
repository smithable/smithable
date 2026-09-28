import { readFileSync } from "node:fs";
import { join } from "node:path";
import { exec, type Io } from "./io.js";

/** The app's name in its package.json: its image, container and volume are named after it. */
export function appName(dir: string): string {
  return (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string }).name;
}

/** `smithable build [dir]`: builds the app's OCI image with Docker. */
export function build(dir: string, io: Io): number {
  const name = appName(dir);
  if (exec("docker", ["--version"], dir) !== 0) {
    io.err("Docker is needed to build the image. Install Docker, then run this again.\n");
    return 1;
  }
  const code = exec("docker", ["build", "-t", name, "."], dir);
  if (code === 0)
    io.out(
      `\nBuilt image "${name}". Run it with:\n\n  docker run -p 3000:3000 -v ${name}-data:/data ${name}\n`,
    );
  return code;
}

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appName } from "./build.js";
import type { Io } from "./io.js";
import { security } from "./security.js";

/** Sign-in provider keys passed to the app from the environment when set; never stored. */
const PROVIDER_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
];

/**
 * The app's session secret: made once and kept in data/ (never committed), so sessions
 * survive redeploys.
 */
function authSecret(dir: string): string {
  const path = join(dir, "data", ".smithable", "auth-secret");
  if (!existsSync(path)) {
    mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
    writeFileSync(path, randomBytes(32).toString("base64url"), { mode: 0o600 });
  }
  return readFileSync(path, "utf8").trim();
}

/**
 * `smithable deploy [dir] --target docker|ssh://user@host|compose` (ARCHITECTURE §12): the
 * Release checks first, then the image replaces the running container, keeping its data
 * volume; `compose` writes a compose.yaml to run anywhere instead.
 */
export async function deploy(
  dir: string,
  io: Io,
  options: { target: string; port: number; url?: string },
): Promise<number> {
  const name = appName(dir);
  if (options.target === "compose") return compose(dir, io, name, options.port);
  const remote = options.target.startsWith("ssh://");
  if (options.target !== "docker" && !remote) {
    io.err(`Unknown deploy target "${options.target}": docker, ssh://user@host or compose.\n`);
    return 2;
  }
  const host = remote ? new URL(options.target).hostname : "localhost";
  const url = options.url ?? `http://${host}:${options.port}`;
  io.out("Release checks first:\n");
  if ((await security(dir, io, "release")) !== 0) {
    io.err("Not deployed: the Release checks failed.\n");
    return 1;
  }
  // A remote Docker host is used over SSH by Docker itself.
  // The secret goes to `docker run -e NAME` through the environment, not on its command line.
  const env = {
    ...process.env,
    BETTER_AUTH_SECRET: authSecret(dir),
    BETTER_AUTH_URL: url,
    ...(remote ? { DOCKER_HOST: options.target } : {}),
  };
  const docker = (args: string[]) =>
    spawnSync("docker", args, { cwd: dir, env, encoding: "utf8", maxBuffer: 1 << 26 });
  io.out(`Deploying ${name} to ${remote ? options.target : "Docker on this machine"}…\n`);
  const built = docker(["build", "-q", "-t", name, "."]);
  if (built.status !== 0) {
    io.err(`${built.stderr}\nThe image did not build.\n`);
    return 1;
  }
  // The running version steps aside (renamed and stopped, which frees its port) and comes
  // back if the new one does not start or answer.
  const previous = `${name}-previous`;
  docker(["rm", "-f", previous]);
  const hadOne = docker(["rename", name, previous]).status === 0;
  if (hadOne) docker(["stop", previous]);
  const putBack = (why: string) => {
    docker(["rm", "-f", name]);
    if (hadOne) {
      docker(["rename", previous, name]);
      docker(["start", name]);
    }
    io.err(`${why}${hadOne ? " The previous version runs again." : ""}\n`);
    return 1;
  };
  const started = docker([
    "run",
    "-d",
    "--name",
    name,
    "--restart",
    "unless-stopped",
    "-p",
    `${options.port}:3000`,
    "-v",
    `${name}-data:/data`,
    "-e",
    "BETTER_AUTH_SECRET",
    "-e",
    "BETTER_AUTH_URL",
    ...PROVIDER_KEYS.filter((k) => process.env[k]).flatMap((k) => ["-e", k]),
    name,
  ]);
  if (started.status !== 0) return putBack(`${started.stderr}\nThe container did not start.`);
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) {
        docker(["rm", "-f", previous]);
        io.out(`Deployed: ${url} (data in the Docker volume ${name}-data).\n`);
        return 0;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const logs = docker(["logs", "--tail", "20", name]);
  return putBack(
    `${logs.stdout}${logs.stderr}\nThe container started but ${url}/health did not answer.`,
  );
}

/** compose.yaml for `docker compose up -d`, with its secrets in .env (never committed). */
function compose(dir: string, io: Io, name: string, port: number): number {
  writeFileSync(
    join(dir, "compose.yaml"),
    `# Runs ${name} with Docker Compose: docker compose up -d
# Its data lives in the "data" volume; back it up with smithable backup.
services:
  app:
    build: .
    image: ${name}
    restart: unless-stopped
    ports:
      - "${port}:3000"
    volumes:
      - data:/data
    env_file: .env
volumes:
  data:
`,
  );
  const envPath = join(dir, ".env");
  if (!existsSync(envPath))
    writeFileSync(
      envPath,
      `# Secrets for compose.yaml; not committed (.gitignore).\nBETTER_AUTH_SECRET=${authSecret(dir)}\nBETTER_AUTH_URL=http://localhost:${port}\n`,
      { mode: 0o600 },
    );
  io.out(
    `Wrote compose.yaml, with its secrets in .env. Set BETTER_AUTH_URL there to the app's public address, then:\n\n  docker compose up -d\n`,
  );
  return 0;
}

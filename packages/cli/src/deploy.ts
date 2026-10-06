import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateAuth, validateSpec } from "@smithable/core";
import { appName } from "./build.js";
import type { Io } from "./io.js";
import { security } from "./security.js";

/** Sign-in provider keys and mail settings passed to the app from the environment when set; never stored. */
const PROVIDER_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "SMTP_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "MAIL_FROM",
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
  const mail = mailWarning(dir, process.env);
  if (mail) io.err(`${mail}\n`);
  for (const warning of targetWarnings(dir, process.env)) io.err(`${warning}\n`);
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
  const since = Date.now();
  const putBack = (why: string) => {
    docker(["rm", "-f", name]);
    let restored = false;
    if (hadOne) {
      // The new version copied the database before migrating it (src/db/index.ts); the copy goes
      // back, so the previous version never runs on a schema it does not know.
      restored = restoreBeforeMigration(docker, name, `${name}-data`, since);
      docker(["rename", previous, name]);
      docker(["start", name]);
    }
    io.err(
      `${why}${hadOne ? ` The previous version runs again${restored ? ", on its database as it was before the migration" : ""}.` : ""}\n`,
    );
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
    ...[...PROVIDER_KEYS, ...targetKeys(dir)]
      .filter((k) => process.env[k])
      .flatMap((k) => ["-e", k]),
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

/**
 * Puts back db/before-migration.db over the database when the new version wrote it during this
 * deploy (its time is after `since`): a one-off container of the new image, as root, so the file
 * goes to the image's own user. Returns whether anything was put back.
 */
function restoreBeforeMigration(
  docker: (args: string[]) => { status: number | null; stdout: string },
  image: string,
  volume: string,
  since: number,
): boolean {
  const result = docker([
    "run",
    "--rm",
    "--user",
    "0",
    "-v",
    `${volume}:/data`,
    "--entrypoint",
    "/nodejs/bin/node",
    image,
    "-e",
    `const fs=require("fs");const c="/data/db/before-migration.db";if(!fs.existsSync(c)||fs.statSync(c).mtimeMs<${since}){console.log("kept");process.exit(0)}for(const f of ["app.db-wal","app.db-shm"])fs.rmSync("/data/db/"+f,{force:true});fs.renameSync(c,"/data/db/app.db");fs.chownSync("/data/db/app.db",65532,65532);console.log("restored")`,
  ]);
  return result.status === 0 && result.stdout.trim() === "restored";
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
      `# Secrets for compose.yaml; not committed (.gitignore).\nBETTER_AUTH_SECRET=${authSecret(dir)}\nBETTER_AUTH_URL=http://localhost:${port}\n# Mail (see README): SMTP_URL=smtp://user:password@host:587 and MAIL_FROM=\n`,
      { mode: 0o600 },
    );
  io.out(
    `Wrote compose.yaml, with its secrets in .env. Set BETTER_AUTH_URL there to the app's public address, then:\n\n  docker compose up -d\n`,
  );
  return 0;
}

/** Email sign-in mails its codes: without mail settings in the environment nobody can sign in. */
export function mailWarning(dir: string, env: NodeJS.ProcessEnv): string | undefined {
  const path = join(dir, "smithable.auth.yml");
  if (!existsSync(path)) return undefined;
  const { auth } = validateAuth({ path, text: readFileSync(path, "utf8") });
  const email = auth && auth.signIn !== "none" && auth.signIn.providers.includes("email");
  if (!email || env.SMTP_URL || env.SMTP_HOST) return undefined;
  return "Warning: email sign-in needs mail settings (SMTP_URL, or SMTP_HOST and the others): without them no sign-in code reaches anyone.";
}

/** The outgoing targets smithable.yml names (integrations.md §4.1), e.g. statusFeed. */
function targets(dir: string): string[] {
  const path = join(dir, "smithable.yml");
  if (!existsSync(path)) return [];
  const { ir } = validateSpec({ path, text: readFileSync(path, "utf8") });
  return [...new Set((ir?.outgoing ?? []).map((o) => o.to).filter((to) => to !== "mail"))];
}

/** Each target's settings: OUTGOING_<TARGET>_URL and OUTGOING_<TARGET>_SECRET. */
function targetKeys(dir: string): string[] {
  return targets(dir).flatMap((t) => [
    `OUTGOING_${t.toUpperCase()}_URL`,
    `OUTGOING_${t.toUpperCase()}_SECRET`,
  ]);
}

/** A target without its address or secret keeps its calls in the outbox: said before a release. */
export function targetWarnings(dir: string, env: NodeJS.ProcessEnv): string[] {
  return targets(dir).flatMap((t) => {
    const missing = [
      `OUTGOING_${t.toUpperCase()}_URL`,
      `OUTGOING_${t.toUpperCase()}_SECRET`,
    ].filter((k) => !env[k]);
    return missing.length
      ? [
          `Warning: the outgoing target ${t} is not set (${missing.join(", ")}): its calls wait in the outbox until it is.`,
        ]
      : [];
  });
}

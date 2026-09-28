// Deploy and backup test (needs Docker; M14): the CRM passes the Release checks and is
// deployed; a customer written in the running app survives a backup to an S3-compatible
// bucket (SeaweedFS, which checks request signatures), destroying the container and its
// volume, a fresh deploy and a restore. Also: the Compose export, and a folder backup of the
// development database, and the SSH target: a deploy to Docker in a container reached over SSH.
// Run after `pnpm build`: `pnpm test:deploy`.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-deploy-"));
const dir = join(root, "app");
const s3 = `smithable-test-s3-${process.pid}`;
const remote = `smithable-test-ssh-${process.pid}`;
const port = 4950;
const remotePort = 4951;
const env = {
  ...process.env,
  AWS_ACCESS_KEY_ID: "smithabletest",
  AWS_SECRET_ACCESS_KEY: "smithable-secret-key-0123456789",
  AWS_ENDPOINT_URL: "http://localhost:8334",
};
let failed = false;

function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    cwd: repo,
    encoding: "utf8",
    env,
    maxBuffer: 1 << 26,
    ...options,
  });
  if (r.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
function step(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    console.log(`✗ ${name}\n  ${String(error.message).split("\n").slice(-12).join("\n  ")}`);
    throw error;
  }
}
const smithable = (...args) => run("node", [cli, ...args]);
const sql = (container, query) =>
  run("docker", [
    "exec",
    container,
    "/nodejs/bin/node",
    "-e",
    `const D=require("better-sqlite3");const s=new D("/data/db/app.db").prepare(${JSON.stringify(query)});console.log(JSON.stringify(s.reader?s.all():s.run()))`,
  ]);

let name;
try {
  step("smithable new", () => {
    run("node", [cli, "new", dir, "--starter", "crm"]);
    run("git", ["init", "-q"], { cwd: dir });
    run("git", ["add", "-A"], { cwd: dir });
    run(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=t@example.com", "commit", "-qm", "start"],
      { cwd: dir },
    );
    name = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name;
  });
  step("an S3-compatible bucket runs (SeaweedFS, checking signatures)", () => {
    writeFileSync(
      join(root, "s3.json"),
      JSON.stringify({
        identities: [
          {
            name: "t",
            credentials: [
              { accessKey: env.AWS_ACCESS_KEY_ID, secretKey: env.AWS_SECRET_ACCESS_KEY },
            ],
            actions: ["Admin", "Read", "Write", "List"],
          },
        ],
      }),
    );
    run("docker", [
      "run",
      "-d",
      "--name",
      s3,
      "-p",
      "8334:8333",
      "-v",
      `${root}:/etc/seaweed:ro`,
      "chrislusf/seaweedfs:4.47",
      "server",
      "-s3",
      "-s3.config=/etc/seaweed/s3.json",
      "-dir=/data",
    ]);
    for (let i = 0; i < 60; i++) {
      if (spawnSync("curl", ["-s", "-m", "2", "http://localhost:8334"]).status === 0) return;
      spawnSync("sleep", ["1"]);
    }
    throw new Error("SeaweedFS did not start");
  });
  step("deploy: the Release checks pass, and the app runs in Docker", () => {
    const out = smithable("deploy", dir, "--port", String(port));
    if (!out.includes("All checks passed.") || !out.includes(`Deployed: http://localhost:${port}`))
      throw new Error(out);
    // Scan reports can quote secrets: none is left in the project, committed or not.
    for (const report of [
      ".smithable/gitleaks.json",
      ".smithable/zap.json",
      "data/.smithable/reports/gitleaks.json",
      "data/.smithable/reports/zap",
    ])
      if (existsSync(join(dir, report))) throw new Error(`${report} was left behind`);
  });
  step("a customer written in the running app is backed up to the bucket", () => {
    sql(
      name,
      "insert into customers (name, segment, created_at, updated_at) values ('Backup Test Oy', 'smb', 0, 0)",
    );
    const out = smithable("backup", dir, "--container", name, "--to", "s3://backups/acme");
    if (!out.includes("Backed up to s3://backups/acme/")) throw new Error(out);
  });
  step(
    "after destroying the container and its volume, a fresh deploy plus restore brings it back",
    () => {
      run("docker", ["rm", "-f", name]);
      run("docker", ["volume", "rm", `${name}-data`]);
      smithable("deploy", dir, "--port", String(port));
      if (
        sql(name, "select count(*) as n from customers where name = 'Backup Test Oy'").includes(
          '"n":1',
        )
      )
        throw new Error("the fresh deploy already had the customer");
      const out = smithable("restore", dir, "--container", name, "--from", "s3://backups/acme");
      if (!out.includes("Restored")) throw new Error(out);
      for (
        let i = 0;
        i < 60 && spawnSync("curl", ["-sf", `http://localhost:${port}/health`]).status !== 0;
        i++
      )
        spawnSync("sleep", ["1"]);
      if (
        !sql(name, "select count(*) as n from customers where name = 'Backup Test Oy'").includes(
          '"n":1',
        )
      )
        throw new Error("the customer is not back");
      if (spawnSync("curl", ["-sf", `http://localhost:${port}/health`]).status !== 0)
        throw new Error("the app is not healthy");
    },
  );
  step("compose: compose.yaml with its secrets in .env, which Git ignores", () => {
    smithable("deploy", dir, "--target", "compose");
    if (!readFileSync(join(dir, "compose.yaml"), "utf8").includes("data:/data"))
      throw new Error("no data volume");
    if (!readFileSync(join(dir, ".env"), "utf8").includes("BETTER_AUTH_SECRET="))
      throw new Error("no secret");
    if (spawnSync("git", ["check-ignore", "-q", ".env"], { cwd: dir }).status !== 0)
      throw new Error(".env is not ignored");
  });
  step("ssh: the app is deployed to a Docker host reached over SSH", () => {
    // The remote host: Docker in a container with sshd, reached with a key made for the test.
    // An `ssh` first on PATH adds the test's own settings; ~/.ssh is not touched.
    const ssh = join(root, "ssh");
    mkdirSync(join(ssh, "bin"), { recursive: true });
    run("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", join(ssh, "key")]);
    writeFileSync(
      join(ssh, "Dockerfile"),
      `FROM docker:29-dind
RUN apk add --no-cache openssh-server && ssh-keygen -A && mkdir -p /root/.ssh
COPY key.pub /root/.ssh/authorized_keys
ENTRYPOINT ["sh", "-c", "/usr/sbin/sshd && exec dockerd-entrypoint.sh"]
`,
    );
    run("docker", ["build", "-q", "-t", "smithable-test-ssh", ssh]);
    run("docker", [
      "run",
      "-d",
      "--privileged",
      "--name",
      remote,
      "-p",
      "2222:22",
      "-p",
      `${remotePort}:${remotePort}`,
      "smithable-test-ssh",
    ]);
    writeFileSync(
      join(ssh, "config"),
      `Host *\n  IdentityFile ${join(ssh, "key")}\n  StrictHostKeyChecking no\n  UserKnownHostsFile /dev/null\n  LogLevel ERROR\n`,
    );
    writeFileSync(
      join(ssh, "bin", "ssh"),
      `#!/bin/sh\nexec /usr/bin/ssh -F ${join(ssh, "config")} "$@"\n`,
    );
    chmodSync(join(ssh, "bin", "ssh"), 0o755);
    const sshEnv = { ...env, PATH: `${join(ssh, "bin")}:${env.PATH}` };
    const target = "ssh://root@localhost:2222";
    for (let i = 0; i < 60; i++) {
      const info = spawnSync("docker", ["info", "-f", "{{.ServerVersion}}"], {
        env: { ...sshEnv, DOCKER_HOST: target },
      });
      if (info.status === 0) break;
      spawnSync("sleep", ["1"]);
    }
    const out = run(
      "node",
      [cli, "deploy", dir, "--target", target, "--port", String(remotePort)],
      { env: sshEnv },
    );
    if (!out.includes(`Deployed: http://localhost:${remotePort}`)) throw new Error(out);
    // The app runs on the remote host's Docker.
    const ps = run("docker", ["exec", remote, "docker", "ps", "--format", "{{.Names}}"]);
    if (!ps.split("\n").includes(name)) throw new Error(ps);
  });
  step("the development database is backed up to a folder and restored", () => {
    const folder = join(root, "backups");
    smithable("backup", dir, "--to", folder);
    const db = join(dir, "data", "db", "app.db");
    rmSync(db);
    smithable("restore", dir, "--from", folder);
    if (!existsSync(db)) throw new Error("the database is not back");
  });
} catch {
  // Reported above.
} finally {
  if (name) spawnSync("docker", ["rm", "-f", name]);
  if (name) spawnSync("docker", ["volume", "rm", `${name}-data`]);
  spawnSync("docker", ["rm", "-f", s3]);
  spawnSync("docker", ["rm", "-f", "-v", remote]);
}
if (failed) {
  console.log(`\nFailed. The app is kept in ${dir}`);
  process.exit(1);
}
rmSync(root, { recursive: true, force: true });
console.log("\nDeploy, backup and restore work.");

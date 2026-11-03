// Native SQLite/FIFO failure injection in a disposable app image; no daemon socket mounts.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureProgram, stopCaptureProgram } from "../packages/cli/dist/backup-capture.js";

const image = process.argv[2];
if (!image?.startsWith("recovery-fixture-"))
  throw new Error("Pass the disposable test-deploy fixture image tag.");
const root = mkdtempSync(join(tmpdir(), "smithable-native-capture-"));
const name = `smithable-capture-${process.pid}`;
function run(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 15000, ...options });
  if (result.status !== 0) throw new Error(`${args[0]} failed: ${result.stderr || result.error}`);
  return result.stdout.trim();
}
const exec = (code) => run(["exec", "-w", "/fixture", name, "/nodejs/bin/node", "-e", code]);
async function waitFor(fn, description) {
  const deadline = Date.now() + 10000;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function start(code) {
  const child = spawn("docker", ["exec", "-w", "/fixture", name, "/nodejs/bin/node", "-e", code], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const done = new Promise((resolve) =>
    child.on("exit", (status, signal) => resolve({ status, signal, stderr })),
  );
  return { child, done };
}
function config(id, timeoutMs) {
  mkdirSync(join(root, id));
  const fifo = spawnSync("mkfifo", [join(root, id, "blocked.pipe")]);
  assert.equal(fifo.status, 0);
  const prefix = `/fixture/${id}`;
  exec(
    `const D=require('/app/node_modules/better-sqlite3');const db=new D('${prefix}/app.db');db.exec("PRAGMA journal_mode=WAL;CREATE TABLE records(value TEXT);INSERT INTO records VALUES('before')");db.close()`,
  );
  return {
    from: `${prefix}/app.db`,
    to: `${prefix}/snapshot.db`,
    uploads: `${prefix}/uploads`,
    toUploads: `${prefix}/copied`,
    control: `${prefix}/control`,
    token: `capture-${process.pid}-${id}`,
    timeoutMs,
  };
}
const writer = (cfg) =>
  exec(
    `const D=require('/app/node_modules/better-sqlite3');const db=new D(${JSON.stringify(cfg.from)},{timeout:0});db.exec("UPDATE records SET value='after'");db.close();console.log('writer released')`,
  );
try {
  mkdirSync(join(root, "node_modules", "better-sqlite3"), { recursive: true });
  writeFileSync(
    join(root, "node_modules", "better-sqlite3", "package.json"),
    JSON.stringify({ main: "index.cjs" }),
  );
  writeFileSync(
    join(root, "node_modules", "better-sqlite3", "index.cjs"),
    `const D=require('/app/node_modules/better-sqlite3'),fs=require('node:fs'),path=require('node:path');module.exports=class extends D {constructor(file,options){super(file,options);this.source=file;}exec(sql){const result=super.exec(sql);if(sql==='BEGIN IMMEDIATE'&&!fs.existsSync(path.join(path.dirname(this.source),'allow'))){const dir=path.dirname(this.source);fs.writeFileSync(path.join(dir,'held'),'yes');fs.openSync(path.join(dir,'blocked.pipe'),'r');}return result;}};`,
  );
  run([
    "run",
    "-d",
    "--name",
    name,
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    "/data",
    "-v",
    `${root}:/fixture`,
    image,
    "-e",
    "setInterval(()=>{},1000)",
  ]);
  for (const mode of ["WAL", "DELETE"]) {
    const normal = config(`normal-${mode}`, 10000);
    writeFileSync(join(root, `normal-${mode}`, "allow"), "yes");
    exec(
      `const D=require('/app/node_modules/better-sqlite3');const db=new D(${JSON.stringify(normal.from)});db.pragma('journal_mode=${mode}');db.close();const fs=require('node:fs');fs.mkdirSync(${JSON.stringify(normal.uploads)});fs.writeFileSync(${JSON.stringify(normal.uploads + "/plain.txt")},'upload bytes')`,
    );
    const result = await start(captureProgram(normal)).done;
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      exec(
        `const D=require('/app/node_modules/better-sqlite3');const db=new D(${JSON.stringify(normal.to)},{readonly:true});console.log(db.prepare('SELECT value FROM records').get().value);db.close()`,
      ),
      "before",
    );
    assert.equal(
      exec(
        `console.log(require('node:fs').readFileSync(${JSON.stringify(normal.toUploads + "/plain.txt")},'utf8'))`,
      ),
      "upload bytes",
    );
    assert.equal(exec(stopCaptureProgram(normal.control, normal.token)), "finished");
    console.log(`PASS native ${mode} capture preserves snapshot and upload bytes`);
  }
  const disconnected = config("disconnected", 20000);
  const first = start(captureProgram(disconnected));
  await waitFor(() => existsSync(join(root, "disconnected", "held")), "native writer hold");
  first.child.kill("SIGTERM");
  await first.done;
  assert.equal(exec(stopCaptureProgram(disconnected.control, disconnected.token)), "finished");
  assert.equal(writer(disconnected), "writer released");
  assert.equal(run(["inspect", name, "--format", "{{.State.Running}}"]), "true");
  console.log(
    "PASS disconnected Docker client: matching helper stopped; writer released; container alive",
  );

  const timed = config("deadline", 1000);
  const second = start(captureProgram(timed));
  await waitFor(() => existsSync(join(root, "deadline", "held")), "native blocked FIFO");
  const deadline = setTimeout(() => second.child.kill("SIGKILL"), 6000);
  const result = await second.done;
  clearTimeout(deadline);
  assert.equal(result.status, 137, result.stderr);
  assert.match(result.stderr, /write-pause deadline/);
  assert.equal(writer(timed), "writer released");
  console.log(
    "PASS native synchronous FIFO block: parent deadline kills the helper and releases SQLite hold",
  );

  const delayed = config("delayed", 1000);
  assert.equal(exec(stopCaptureProgram(delayed.control, delayed.token)), "pending");
  const third = await start(captureProgram(delayed)).done;
  assert.equal(third.status, 125, third.stderr);
  assert.equal(existsSync(join(root, "delayed", "snapshot.db")), false);
  assert.equal(writer(delayed), "writer released");
  console.log("PASS cancellation fence refuses a delayed helper before capture");

  const publishing = config("publishing", 1000);
  const marker = join(root, "publishing", "publishing");
  const fourth = start(
    `const fs=require('node:fs');const link=fs.linkSync;fs.linkSync=(...args)=>{fs.writeFileSync('/fixture/publishing/publishing','yes');fs.openSync('/fixture/publishing/blocked.pipe','r');return link(...args);};` +
      captureProgram(publishing),
  );
  await waitFor(() => existsSync(marker), "control publication barrier");
  assert.equal(exec(stopCaptureProgram(publishing.control, publishing.token)), "pending");
  exec("require('node:fs').writeFileSync('/fixture/publishing/blocked.pipe','release')");
  const published = await fourth.done;
  assert.equal(published.status, 125, published.stderr);
  assert.equal(existsSync(join(root, "publishing", "snapshot.db")), false);
  assert.equal(writer(publishing), "writer released");
  console.log("PASS atomic control publication: stop sees pending, late helper sees fence");
} finally {
  run(["rm", "-f", name]);
  rmSync(root, { recursive: true, force: true });
}

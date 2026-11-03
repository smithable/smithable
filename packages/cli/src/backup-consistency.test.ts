import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { backup, restore } from "./backup.js";
import { tempDir } from "./test-dir.js";

// The generated app supplies better-sqlite3. This isolated fixture adapts its used API to
// Node's real SQLite so the runner needs no native app dependency or borrowed checkout.
// A second SQLite connection attempts a lifecycle mutation exactly after VACUUM completes.
const driver = `const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const path=require('node:path');
const config=JSON.parse(fs.readFileSync(path.join(process.cwd(),'capture-fixture.json'),'utf8'));
let attempted=false,pending=false;
function mutate(){
  const writer=new DatabaseSync(config.database);writer.exec('PRAGMA busy_timeout=0');
  try{
    if(config.mode!=='delete')fs.writeFileSync(config.newPath,config.newContent);
    if(config.mode==='delete')writer.prepare('DELETE FROM documents WHERE id=1').run();
    else if(config.mode==='replace')writer.prepare('UPDATE documents SET file=? WHERE id=1').run(JSON.stringify({file:config.newFile}));
    else writer.prepare('INSERT INTO documents VALUES(2,?)').run(JSON.stringify({file:config.newFile}));
    if(config.mode!=='create')fs.unlinkSync(config.oldPath);
    return true;
  }catch(error){if(/locked|busy/i.test(String(error)))return false;throw error;}
  finally{writer.close();}
}
module.exports=class extends DatabaseSync {
  constructor(file,options={}){super(file,{readOnly:Boolean(options.readonly)});}
  exec(sql){
    const result=super.exec(sql);
    if(sql.startsWith('VACUUM INTO')&&!attempted){attempted=true;pending=!mutate();fs.writeFileSync(config.status,JSON.stringify({blocked:pending,resumed:false}));}
    if(sql==='ROLLBACK'&&pending){if(!mutate())throw new Error('Writer did not resume after capture');fs.writeFileSync(config.status,JSON.stringify({blocked:true,resumed:true}));}
    return result;
  }
};`;

for (const mode of ["delete", "replace", "create"] as const) {
  test(`backup/restore retains referenced blobs while ${mode} attempts run during capture`, async () => {
    const root = tempDir("capture-consistency-");
    const project = join(root, "project");
    mkdirSync(join(project, "data", "db"), { recursive: true });
    mkdirSync(join(project, "data", "uploads", "Document"), { recursive: true });
    mkdirSync(join(project, "node_modules", "better-sqlite3"), { recursive: true });
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "capture-fixture" }));
    writeFileSync(
      join(project, "node_modules", "better-sqlite3", "package.json"),
      JSON.stringify({ type: "commonjs", main: "index.cjs" }),
    );
    writeFileSync(join(project, "node_modules", "better-sqlite3", "index.cjs"), driver);
    const oldContent = "original referenced upload\n".repeat(3);
    const newContent = "replacement upload\n".repeat(3);
    const fileOf = (text: string) =>
      `Document/${createHash("sha256").update(text).digest("hex").slice(0, 24)}.txt`;
    const oldFile = fileOf(oldContent);
    const newFile = fileOf(newContent);
    const oldPath = join(project, "data", "uploads", oldFile);
    writeFileSync(oldPath, oldContent);
    const database = join(project, "data", "db", "app.db");
    const source = new DatabaseSync(database);
    source.exec("PRAGMA journal_mode=WAL;CREATE TABLE documents(id INTEGER PRIMARY KEY,file TEXT)");
    source.prepare("INSERT INTO documents VALUES(1,?)").run(JSON.stringify({ file: oldFile }));
    source.close();
    const status = join(project, "capture-status.json");
    writeFileSync(
      join(project, "capture-fixture.json"),
      JSON.stringify({
        mode,
        database,
        oldPath,
        newFile,
        newPath: join(project, "data", "uploads", newFile),
        newContent,
        status,
      }),
    );
    const messages: string[] = [];
    const io = {
      out: (message: string) => messages.push(message),
      err: (message: string) => messages.push(message),
    };
    const store = join(root, "store");
    expect(await backup(project, io, { to: store }), messages.join("")).toBe(0);
    expect(await restore(project, io, { from: store }), messages.join("")).toBe(0);
    const restored = new DatabaseSync(database, { readOnly: true });
    try {
      const rows = restored.prepare("SELECT file FROM documents ORDER BY id").all() as {
        file: string;
      }[];
      expect(rows).toHaveLength(1);
      for (const row of rows) {
        const reference = JSON.parse(row.file) as { file: string };
        expect(
          readFileSync(join(project, "data", "uploads", reference.file), "utf8"),
          `snapshot references ${reference.file}`,
        ).toBe(oldContent);
      }
    } finally {
      restored.close();
    }
    expect(JSON.parse(readFileSync(status, "utf8"))).toEqual({ blocked: true, resumed: true });
  });
}

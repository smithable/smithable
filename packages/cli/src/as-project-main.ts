// One call of as-project.ts in a child running as the project's user: the call on standard input,
// the answer on standard output, both JSON. Only the module that holds the function is loaded,
// which registers it: a call is one process start, and the CLI's whole graph would triple it.
import { readFileSync } from "node:fs";
import { answerCall } from "./as-project.js";

const HOME: Record<string, () => Promise<unknown>> = {
  snapshotDatabase: () => import("./database.js"),
  restoreDatabase: () => import("./database.js"),
  pruneSnapshots: () => import("./database.js"),
  countValue: () => import("./database.js"),
  countValues: () => import("./database.js"),
  countOutside: () => import("./database.js"),
  roleHolders: () => import("./restore.js"),
  prepareImport: () => import("./import.js"),
  insertImport: () => import("./import.js"),
  importOwner: () => import("./import.js"),
  keepImport: () => import("./import.js"),
  dropImport: () => import("./import.js"),
  reseedPictures: () => import("./picture-style.js"),
  sync: () => import("./replace.js"),
  removeTree: () => import("./tree-files.js"),
  writeTreeFile: () => import("./tree-files.js"),
};

const text = readFileSync(0, "utf8");
const name = (JSON.parse(text) as { name?: string }).name ?? "";
// A closed list: any other name loads nothing and is answered as unknown.
if (Object.hasOwn(HOME, name)) await HOME[name]?.();
const { code, out } = answerCall(text);
process.stdout.write(out, () => process.exit(code));

// Plain file work in the project's tree that must be done with the project's rights where a
// project user is configured (as-project.ts): removing what that user's tools made, and writing
// where the folder would not give the file the project's group.
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { asProject } from "./as-project.js";
import { projectUser } from "./secrets.js";

/** Removes a file or folder and all in it; nothing when it is not there. */
export const removeTree = asProject("removeTree", (path: string): void => {
  rmSync(path, { recursive: true, force: true });
});

const writeAsProject = asProject(
  "writeTreeFile",
  (path: string, data: string | Uint8Array, mode?: number): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, mode === undefined ? undefined : { mode });
  },
);

/** Whether a new file at `path` would take the project's group: its nearest folder is setgid, that group. */
function takesGroup(path: string, gid: number): boolean {
  for (let folder = dirname(path); ; folder = dirname(folder)) {
    const stat = statSync(folder, { throwIfNoEntry: false });
    // A folder made under a setgid one is setgid too, with its group.
    if (stat) return stat.isDirectory() && stat.gid === gid && (stat.mode & 0o2000) !== 0;
    if (dirname(folder) === folder) return false;
  }
}

/**
 * Writes a file of the project's tree, making its folders. Here, as this process, where the
 * nearest folder gives a new file the project's group (setgid, that group), so the project can
 * change it; otherwise as the project's user (checked for each write). Without one, here.
 */
export function writeTreeFile(path: string, data: string | Uint8Array, mode?: number): void {
  const user = projectUser();
  if (user && !takesGroup(path, user.gid)) {
    writeAsProject(path, data, mode);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data, mode === undefined ? undefined : { mode });
}

// Plain file work in the project's tree, done as the project's user where one is configured
// (as-project.ts). Not here as this process: a file it wrote would be its own, 0644 under the usual
// umask, which the project could not change, a file of the project's it could not overwrite, and
// a link the project put in the tree would lead its write elsewhere.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { asProject } from "./as-project.js";

/** A file to write (making its folders) or append to, or, with `data: null`, one file to remove. */
export type TreeChange = {
  path: string;
  data: string | Uint8Array | null;
  mode?: number;
  append?: boolean;
};

/** Applies the changes in order, all in one child where there is a project user. */
export const changeTree = asProject("changeTree", (changes: TreeChange[]): void => {
  for (const { path, data, mode, append } of changes) {
    if (data === null) {
      rmSync(path, { force: true });
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, {
      ...(mode === undefined ? {} : { mode }),
      ...(append ? { flag: "a" } : {}),
    });
  }
});

/** Writes one file of the project's tree, making its folders. */
export function writeTreeFile(path: string, data: string | Uint8Array, mode?: number): void {
  changeTree([{ path, data, mode }]);
}

/** Removes a file or folder and all in it; nothing when it is not there. */
export const removeTree = asProject("removeTree", (path: string): void => {
  rmSync(path, { recursive: true, force: true });
});

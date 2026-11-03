import type { YamlEditor, YamlValue } from "./edit.js";

/** Sets `value` at `path` in smithable.ux.yml, creating what is missing, or removes it. */
export function put(ux: YamlEditor, path: string[], value: YamlValue | undefined): void {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    if (ux.has(path)) ux.removeAndPrune(path, 0);
  } else if (ux.has(path)) {
    ux.set(path, value);
  } else {
    ux.add(path.slice(0, -1), path[path.length - 1] as string, value);
  }
}

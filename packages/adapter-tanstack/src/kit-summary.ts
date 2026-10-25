import { TEMPLATES } from "./templates.gen.js";

/**
 * What the app kit does by itself, in its own words (A 163): the first sentence of each kit
 * file's opening comment, for Smith's context, so he can say that an app already does a thing
 * (and what it does not) without a second description to keep in step.
 */
export function kitSummary(): string[] {
  return Object.entries(TEMPLATES)
    .filter(([path]) => /^src\/kit\/[^/]+\.tsx$/.test(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, source]) => {
      const comment = /^(?:\/\/.*\n)+/.exec(source)?.[0] ?? "";
      // Without the design notes it names, which Smith has no use for.
      const text = comment
        .replace(/^\/\/ ?/gm, "")
        .replace(/\s+/g, " ")
        .replace(/ \((?:docs\/design\/)?[\w-]+\.md[^)]*\)/g, "");
      const said = /^Smithable app kit: (.+?\.)(?: |$)/.exec(text)?.[1];
      const name = path.slice("src/kit/".length, -".tsx".length);
      return said ? [`${name}: ${said}`] : [];
    });
}

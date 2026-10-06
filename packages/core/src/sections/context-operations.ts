import { ANALYTICS, type AnalyticsProvider } from "../context-file.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";

/** An npm package name, e.g. chart.js or @turf/turf. */
const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Adds a library for custom code to smithable.context.yml (the one file that names
 * technologies), at an exact version; Smithable puts it in package.json. "none" removes it.
 */
const setPackage: Operation<{ name: string; version: string }> = {
  name: "setPackage",
  summary:
    'Add a library for custom code at an exact version, e.g. chart.js 4.4.1 ("none" removes it).',
  schema: {
    type: "object",
    required: ["name", "version"],
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "The npm package, e.g. chart.js." },
      version: { type: "string", description: 'An exact version, e.g. 4.4.1, or "none".' },
    },
  },
  positional: ["name", "version"],
  describe: ({ name, version }) =>
    version === "none" ? `Remove the package ${name}` : `Add the package ${name} ${version}`,
  destructive: () => false,
  apply(editors, { name, version }) {
    const context = editors.context;
    if (!PACKAGE_NAME.test(name)) throw new OperationError(`"${name}" is not an npm package name.`);
    if (version === "none") {
      if (!context.has(["packages", name]))
        throw new OperationError(`smithable.context.yml has no package "${name}".`);
      context.removeAndPrune(["packages", name], 0);
      return [];
    }
    // Exact, so a build is the same every time (the lockfile then pins its dependencies).
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version))
      throw new OperationError(`Use an exact version like 4.4.1, not "${version}".`);
    if (context.has(["packages", name])) context.set(["packages", name], version);
    else context.add(["packages"], name, version);
    return [];
  },
};

/**
 * Counts the app's visits with one provider (docs/design/analytics.md): the provider and the
 * app's id with it; "none" stops counting. Google asks for consent first.
 */
const setAnalytics: Operation<{ provider: string; id?: string }> = {
  name: "setAnalytics",
  summary: `Count visits with ${Object.keys(ANALYTICS).join(", ")} and the app's id there ("none" stops it); google asks visitors for consent first.`,
  schema: {
    type: "object",
    required: ["provider"],
    additionalProperties: false,
    properties: {
      provider: { enum: [...Object.keys(ANALYTICS), "none"] },
      id: {
        type: "string",
        description: "The app's id with the provider, e.g. shop.example.com for Plausible.",
      },
    },
  },
  positional: ["provider", "id"],
  describe: ({ provider, id }) =>
    provider === "none" ? "Stop counting visits" : `Count visits with ${provider} (${id})`,
  destructive: () => false,
  apply(editors, { provider, id }) {
    const context = editors.context;
    if (provider === "none") {
      if (!context.has(["analytics"]))
        throw new OperationError("smithable.context.yml counts no visits.");
      context.remove(["analytics"]);
      return [];
    }
    const known = ANALYTICS[provider as AnalyticsProvider];
    if (!known) throw new OperationError(`There is no analytics provider "${provider}".`);
    if (!id || !new RegExp(known.id).test(id))
      throw new OperationError(`Give ${provider}'s id for the app, like ${known.example}.`);
    if (context.has(["analytics"])) context.remove(["analytics"]);
    context.add([], "analytics", { [provider]: id });
    return [];
  },
};

export const contextOperations: AnyOperation[] = [setPackage, setAnalytics];

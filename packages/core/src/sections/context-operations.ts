import {
  ANALYTICS,
  type AnalyticsProvider,
  EXACT_VERSION,
  PAYMENT_PROVIDERS,
} from "../context-file.js";
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
    if (!EXACT_VERSION.test(version))
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

/**
 * The payment provider (docs/design/payments.md §3.5): one per app; "none" leaves the app on
 * `fake` in development and preview. Choosing a real one the first time says whose part is what (§7b).
 */
const setPaymentProvider: Operation<{ provider: string }> = {
  name: "setPaymentProvider",
  summary: `Take the app's payments through ${PAYMENT_PROVIDERS.join(", ")} ("none" takes the choice away; development and preview then use fake).`,
  schema: {
    type: "object",
    required: ["provider"],
    additionalProperties: false,
    properties: { provider: { enum: [...PAYMENT_PROVIDERS, "none"] } },
  },
  positional: ["provider"],
  describe: ({ provider }) =>
    provider === "none" ? "Name no payment provider" : `Take payments through ${provider}`,
  destructive: () => false,
  apply(editors, { provider }) {
    const context = editors.context;
    const before = context.has(["payments", "provider"])
      ? context.get(["payments", "provider"])
      : undefined;
    if (provider === "none") {
      if (!context.has(["payments"]))
        throw new OperationError("smithable.context.yml names no payment provider.");
      context.remove(["payments"]);
      return [];
    }
    if (!(PAYMENT_PROVIDERS as readonly string[]).includes(provider))
      throw new OperationError(
        `There is no payment provider "${provider}"; there are ${PAYMENT_PROVIDERS.join(", ")}.`,
      );
    if (context.has(["payments"])) context.remove(["payments"]);
    context.add([], "payments", { provider });
    const real = (p: unknown) => p === "stripe" || p === "mollie";
    return real(provider) && !real(before)
      ? [
          {
            note: `you are the merchant and ${provider}'s customer: the account, the payment methods, prices, VAT, terms of sale, refunds and disputes are yours, and card data is the provider's, never to be taken into the app (in a field, a form, a message or a file)`,
          },
        ]
      : [];
  },
};

export const contextOperations: AnyOperation[] = [setPackage, setAnalytics, setPaymentProvider];

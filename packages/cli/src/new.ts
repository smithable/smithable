import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  type Assumption,
  clarifyProject,
  closeShared,
  closestStarter,
  type DraftedSamples,
  describedWith,
  draftProject,
  draftProjectByOperations,
  draftSamples,
  type Edit,
  type Question,
  readDescription,
  readEdit,
  STARTER_TEXTS,
  starterScore,
  type Usage,
} from "@smithable/ai";
import {
  applyOperations,
  fitSamples,
  pageModel,
  partSections,
  patternInfo,
  reservedDomain,
  type SpecIR,
  sampleFileText,
  stagePage,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
  YamlEditor,
} from "@smithable/core";
import { noSignIn, summarize } from "@smithable/index";
import { confirm, providersFor, usageLine } from "./ask.js";
import { askIn, languageAsked, PageError, siteNameOf } from "./from-page.js";
import { generate } from "./generate.js";
import { ensureRepository } from "./git.js";
import { hostedLevel } from "./hosted-level.js";
import { exec, type Io, tool } from "./io.js";
import { addLibraryPictures, dropMissingPictures, placePictures } from "./pictures.js";
import { readSite } from "./site-fetch.js";
import { projectSitePersonal, replaceSitePersonalText } from "./site-personal.js";
import { STARTER_ASSETS, STARTER_CODE, STARTER_SAMPLES, STARTERS } from "./starters.gen.js";
import { assetReview, type WebsiteAsset, writeAssetManifest } from "./website-assets.js";
import { repairWebsiteCopy } from "./website-copy.js";
import {
  prepareWebsiteContext,
  replaceWebsitePersonalArtifacts,
  replaceWebsitePersonalFiles,
  type WebsiteContext,
  websitePictures,
  websitePrivateProviders,
} from "./website-generation.js";
import { digest, parseWebsiteInput, type WebsiteGenerationInput } from "./website-input.js";

/**
 * The starter a description is, or is a small edit of, where that can be read without a model
 * (the start page shows a starter's own description; packages/ai starter-descriptions.ts).
 */
function knownStart(
  description: string,
): { name: string; edit: Exclude<Edit, { kind: "rewrite" }> } | undefined {
  for (const name of Object.keys(STARTER_TEXTS)) {
    const files = STARTERS[name];
    if (!files) continue;
    const edit = readEdit(name, description, {
      spec: files["smithable.yml"] ?? "",
      auth: files["smithable.auth.yml"],
      content: files["smithable.content.yml"],
      ux: files["smithable.ux.yml"],
    });
    if (edit.kind !== "rewrite") return { name, edit };
  }
  return undefined;
}

/**
 * `smithable new <dir>`: a new project from a starter spec, with sample data. With
 * `--describe "<sentence>"`, a model first adapts the closest starter to the description
 * (ARCHITECTURE §9.8), and the result is shown in plain language before it is used.
 */
export async function create(
  dir: string,
  io: Io,
  starter: string | undefined,
  options: {
    describe?: string;
    answers?: string;
    yes?: boolean;
    sampleData?: boolean;
    pictureData?: boolean;
    from?: string;
    withPictures?: boolean;
    websiteInput?: WebsiteGenerationInput;
    contentMode?: "sample" | "full";
    instructions?: string;
    interpretSiteImages?: boolean;
    websiteOwnerDescription?: boolean;
    onWebsite?: (summary: {
      inputDigest?: string;
      contentMode?: "sample" | "full";
      personal?: { version: 1; counts: Record<string, number> };
      assetManifestDigest?: string;
      images?: {
        id: string;
        role: string;
        subject: string[];
        basis: string;
        needsVisualCheck: boolean;
      }[];
    }) => void;
    /** The app's name as someone typed it (the hosted form): it wins over a draft's own. */
    name?: string;
    /** The administrator's address; without it, the Git user's (email-sign-in.md §3). */
    admin?: string;
    /** The app's time zone (the hosted service's, from the account); without it, the machine's. */
    timezone?: string;
    /** The packages are in place (a link to another project's): nothing is installed. */
    installed?: boolean;
    /**
     * Build the starter as it is for the description, with no draft, why given (T778): when a
     * model could not make it (the allowance used up, no working draft), the starter still comes
     * in as private as the description asks.
     */
    starterOnly?: string;
    unattended?: boolean;
    onStage?: (stage: "preparing" | "drafting" | "building") => void;
    onAssumptions?: (assumptions: Assumption[]) => void;
    onUsage?: (usage: Usage) => void;
    onDiagnostic?: (message: string) => void;
    /** Stops further calls at this measured budget; a provider response may exceed it. */
    maxTokens?: number;
    /** Told the draft before the compiler/build tools run. */
    onDraft?: (files: Record<string, string>, assumptions?: Assumption[]) => void;
  } = {},
): Promise<number> {
  if ((options.from || options.websiteInput) && options.describe) {
    io.err("Choose a website input or a description, not both.\n");
    return 1;
  }
  if (options.instructions !== undefined && options.instructions.length > 2000) {
    io.err("Owner instructions must be at most 2000 characters.\n");
    return 1;
  }
  if (options.timezone && !knownZone(options.timezone)) {
    io.err(`Unknown time zone "${options.timezone}". Use a name like Europe/Mariehamn.\n`);
    return 1;
  }
  if (
    (options.contentMode === "full" || options.websiteInput?.options?.contentMode === "full") &&
    hostedLevel()
  ) {
    io.err("Full website content requires the hosted owner's recorded instruction.\n");
    return 1;
  }
  // A page as the starting point: what it says is the description (first-build.md §2.8).
  let pictures: { file: string; alt: string; bytes: Uint8Array; model?: string }[] = [];
  let fromPage = false;
  let draftedSamples: DraftedSamples = {};
  if (options.from) {
    if (options.withPictures) {
      const consent = await confirm(
        io,
        "These pictures belong to whoever made that site. Use them only for a site you own or have the right to make from it. Continue?",
        options.yes === true,
      );
      if (consent !== true) return consent;
    }
    try {
      const site = await readSite(options.from, { allowAssets: options.withPictures === true });
      if (site.reading.tooLittle && options.contentMode !== "full")
        throw new PageError(
          "The site gave too little factual information. Describe what the app should do.",
        );
      const authorizationId = "local-owner-instruction";
      const input = parseWebsiteInput({
        version: 1,
        options: { contentMode: options.contentMode ?? "sample" },
        facts: site.reading.facts,
        personalMap: site.reading.personalMap,
        sourceCorpus: site.reading.sourceCorpus,
        images: site.reading.images,
        authorization: {
          id: authorizationId,
          site: options.from,
          images: options.withPictures === true,
        },
        originals: site.originals.map((original) => ({
          id: original.id,
          mediaType: original.mediaType,
          sha256: digest(original.bytes),
          base64: Buffer.from(original.bytes).toString("base64"),
          authorizationId,
        })),
      });
      options = { ...options, websiteInput: input };
      io.out(`Read ${site.bundle.pages.length} pages from the site.\n`);
    } catch (error) {
      if (!(error instanceof PageError)) throw error;
      io.err(`${error.message}\n`);
      return 1;
    }
  }
  let website: WebsiteContext | undefined;
  let websiteAssets: WebsiteAsset[] = [];
  let websiteAssumptions: Assumption[] | undefined;
  if (options.contentMode === "full" && !options.from) {
    io.err("Full website content requires the explicit local --from workflow.\n");
    return 1;
  }
  let privacy: ReturnType<typeof projectSitePersonal> | undefined;
  if (options.websiteInput) {
    const input = parseWebsiteInput(options.websiteInput);
    privacy = projectSitePersonal(input, {
      contentMode: input.options?.contentMode ?? "sample",
      personalMap: input.personalMap,
    });
    options = {
      ...options,
      websiteInput: { ...input, personalMap: privacy.personalMap, model: privacy.model },
      describe: options.websiteOwnerDescription
        ? privacy.model.contentMode === "full"
          ? options.instructions
          : replaceSitePersonalText(options.instructions ?? "", privacy.personalMap)
        : privacy.model.description,
      sampleData: false,
    };
  }
  // A starter's own description, or a small edit of it, needs no model: it is the starter, with
  // the edit's operations applied. From here on it is treated as that starter.
  // Also when that starter is named with it (the hosted form passes the one `clarify` picked,
  // which is this one). Another starter named, or answers to questions, are for the model.
  let prepared: Record<string, string> | undefined;
  const read =
    options.describe && !options.from && !options.answers
      ? knownStart(options.describe)
      : undefined;
  const known = read && (starter === undefined || starter === read.name) ? read : undefined;
  if (known) {
    starter = known.name;
    options = { ...options, describe: undefined };
    if (known.edit.kind === "same")
      io.out(`This is the ${known.name} starter's own description: no model is needed.\n`);
    else {
      const base = STARTERS[known.name] as Record<string, string>;
      prepared = {
        ...base,
        "smithable.yml": known.edit.files.spec,
        "smithable.auth.yml": known.edit.files.auth ?? "",
        "smithable.content.yml": known.edit.files.content ?? "",
        "smithable.ux.yml": known.edit.files.ux ?? "",
      };
      io.out(
        `The ${known.name} starter with what your description changes, read without a model:\n${known.edit.steps
          .map(
            (s) =>
              `  ${s.op} ${Object.values(s.args)
                .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
                .join(" ")}\n`,
          )
          .join("")}${known.edit.notes.map((n) => `${n}\n`).join("")}`,
      );
    }
  }
  // The kind of app the no-model reader settled, as the questions step and Studio take it; else
  // the starter that shares the most words. A model, when there is one, still picks below.
  const settled = options.describe ? readDescription(options.describe) : undefined;
  let name =
    starter ??
    (settled?.read && settled.kind && STARTERS[settled.kind]
      ? settled.kind
      : options.describe
        ? closestStarter(options.describe, STARTERS)
        : "crm");
  if (starter === undefined && options.describe) name = starterFor(options.describe, name).name;
  if (starter !== undefined && STARTERS[starter] === undefined) {
    io.err(`Unknown starter "${starter}". Available: ${Object.keys(STARTERS).join(", ")}.\n`);
    return 2;
  }
  let description = options.describe;
  let tokens = 0;
  const rawAvailable = description ? providersFor() : [];
  const available = privacy
    ? websitePrivateProviders(
        rawAvailable,
        privacy.personalMap,
        privacy.model.contentMode === "full",
      )
    : rawAvailable;
  const providers =
    !options.onUsage && !options.maxTokens
      ? available
      : available.map((provider) => ({
          ...provider,
          async complete(request: Parameters<typeof provider.complete>[0]) {
            const estimate = Math.ceil(
              (request.system.length +
                request.user.length +
                JSON.stringify(request.schema).length) /
                3,
            );
            if (options.maxTokens && tokens + estimate > options.maxTokens)
              throw new Error("The model token limit for this app was reached.");
            const completion = await provider.complete(request);
            tokens += completion.inputTokens + completion.outputTokens;
            options.onUsage?.({
              provider: provider.name,
              model: completion.model,
              tier: provider.tier,
              inputTokens: completion.inputTokens,
              outputTokens: completion.outputTokens,
              cost:
                completion.cost?.amount ??
                (completion.inputTokens * provider.price.input +
                  completion.outputTokens * provider.price.output) /
                  1_000_000,
              currency: completion.cost?.currency ?? provider.currency ?? "EUR",
              ...(completion.cached ? { cached: true } : {}),
            });
            return completion;
          },
        }));
  options.onStage?.("preparing");
  if (options.websiteInput) {
    website = await prepareWebsiteContext(
      options.websiteInput,
      options.interpretSiteImages === true,
      providers,
      (message) => options.onDiagnostic?.(message),
      options.instructions,
      options.websiteOwnerDescription === true,
    );
    description = website.description;
    options.onWebsite?.({
      contentMode: website.contentMode,
      personal: website.personal,
      images: website.images.map((image) => ({
        id: image.id,
        role: image.role,
        subject: image.subject,
        basis: image.basis,
        needsVisualCheck:
          website?.interpretations.find((item) => item.imageId === image.id)?.needsVisualCheck ??
          image.role === "unknown",
      })),
    });
  }
  // Before the draft: the model may ask up to three questions and picks the starter to adapt
  // (docs/design/first-build.md). --yes asks nothing; --answers answers in order, unasked. Either
  // way the model still picks the starter when none was named: skipping the questions is not
  // skipping the choice (the word match knows only English).
  const asking = !options.unattended && !options.yes && !options.answers;
  if (
    description &&
    !options.starterOnly &&
    (asking || starter === undefined || options.unattended)
  ) {
    const asked = await clarifyProject({
      description,
      starters: starterSummaries(),
      providers,
      askIn: askIn(description),
    });
    if (asked.starter && starter === undefined) name = asked.starter;
    // Who it is for weighed against a public starter, whoever picked it (T767).
    if (starter === undefined && description) name = starterFor(description, name).name;
    const questions = withLanguage(asked.questions, description);
    if (options.unattended && questions.length) {
      const assumptions = defaultAssumptions(name, questions);
      options.onAssumptions?.(assumptions);
      description = describedWith(
        description,
        assumptions.map((a) => ({ question: a.question, answer: a.chosen })),
      );
    }
    if (asking && questions.length) {
      const answers = await askQuestions(io, questions);
      if (answers === undefined) return 1;
      description = describedWith(description, answers);
    }
  }
  if (description && options.answers) {
    const given = options.answers.split(";").map((a) => a.trim());
    description = describedWith(
      description,
      given.map((answer, i) => ({ question: `(${i + 1})`, answer })),
    );
  }
  if (website?.contentMode === "sample" && description)
    description = replaceSitePersonalText(description, website.personalMap, { context: "text" });
  let files = prepared ?? (STARTERS[name] as Record<string, string>);
  // Prepared dependencies (node_modules, possibly a link, and the lockfile they were installed
  // from, as hosted workspaces provide) do not count: the install then has little to do.
  const PREPARED = ["node_modules", "pnpm-lock.yaml"];
  if (existsSync(dir) && readdirSync(dir).some((f) => !PREPARED.includes(f))) {
    io.err(`${dir} already exists and is not empty.\n`);
    return 1;
  }
  if (description) {
    // No model set up (T778): the starter as it is, built here and kept as private as the
    // description below (keptPrivate), rather than a refusal that sends the person to build the
    // starter alone, public as it is.
    const starterOnly = (providers.length === 0 || Boolean(options.starterOnly)) && !website;
    // Said as what the person got and what not (Fable M647): the starter unchanged, not an app made
    // from the description; in Studio too, as the first of the draft's assumptions.
    const unchanged = options.starterOnly
      ? `${options.starterOnly}, so this is the ${name} starter unchanged, not an app made from your description.`
      : `No model is set up, so this is the ${name} starter unchanged, not an app made from your description. To have it drafted, set up a model (docs.smithable.ai/ai.html).`;
    io.out(starterOnly ? `${unchanged}\n` : `Starting from the ${name} starter.\n`);
    // What a public starter means, said before the draft; without one, what was done is said with
    // the assumptions below.
    if (starter === undefined && !starterOnly) {
      const note = publicNote(name, description);
      if (note) io.out(`${note}\n`);
    }
    // Drafting as operations (an empty app, one checked operation at a time; the default, see
    // docs/benchmarks/draft-modes-*.md) or as whole files adapted from the starter.
    options.onStage?.("drafting");
    const draft: Awaited<ReturnType<typeof draftProject>> = starterOnly
      ? {
          kind: "draft",
          files,
          usage: [],
          assumptions: [
            {
              part: "app",
              question: "What was made?",
              chosen: unchanged,
              options: ["Set up a model and describe the app again"],
            },
          ],
        }
      : process.env.SMITHABLE_DRAFT === "files"
        ? await draftProject({ description, starter: files, providers })
        : await draftProjectByOperations({
            description,
            providers,
            starter: { name, files },
            // The bench's harness switches (backlog Experiments 7); unset, the draft is made as always.
            ...(/^\d+$/.test(process.env.SMITHABLE_REPAIRS ?? "")
              ? { repairs: Number(process.env.SMITHABLE_REPAIRS) }
              : {}),
            ...(process.env.SMITHABLE_HARNESS === "critique" ||
            process.env.SMITHABLE_HARNESS === "vote3"
              ? { harness: process.env.SMITHABLE_HARNESS }
              : {}),
          });
    io.out(`${usageLine(draft.usage)}\n`);
    if (draft.kind === "failed") {
      io.err(
        `${draft.message}\nWithout a model, start from a starter: smithable new ${dir} --starter ${name}\n`,
      );
      return 1;
    }
    if (
      website &&
      Object.keys(draft.files).some(
        (file) =>
          ![
            "smithable.yml",
            "smithable.auth.yml",
            "smithable.content.yml",
            "smithable.ux.yml",
          ].includes(file) && !/^smithable\.content\.[a-zA-Z0-9-]+\.ya?ml$/.test(file),
      )
    )
      throw new Error("Website drafting returned an unexpected source file.");
    files = website ? replaceWebsitePersonalFiles(draft.files, website) : draft.files;
    // Kept private where the description names no visitors, whatever the draft kept (T767).
    if (!website && description) {
      const kept = keptPrivate(files, description, STARTERS[name] as Record<string, string>);
      files = kept.files;
      if (kept.assumption) draft.assumptions = [...(draft.assumptions ?? []), kept.assumption];
      const closed = noSignInAssumption(files, description);
      if (closed) draft.assumptions = [...(draft.assumptions ?? []), closed];
    }
    // From a page: the site's own name, not the draft's reading of the page's title (which is
    // often a sentence); a name someone typed still wins below.
    const site =
      (!options.websiteOwnerDescription ? website?.businessName : undefined) ??
      siteNameOf(description);
    if (site && !options.name?.trim()) files = named(files, site);
    if (!website) options.onDraft?.(files, draft.assumptions);
    websiteAssumptions = draft.assumptions;
    if (draft.assumptions?.length) options.onAssumptions?.(draft.assumptions);
    // An action the model could not get right is left out and said, rather than failing the draft.
    for (const dropped of draft.dropped ?? [])
      options.onDiagnostic?.(`Left out because it could not be made valid: ${dropped}`);
    if (draft.dropped?.length)
      io.out(
        `Left out, since it could not be made valid:\n${draft.dropped.map((d) => `  ${d}\n`).join("")}`,
      );
    const auth = validateAuth({
      path: "smithable.auth.yml",
      text: files["smithable.auth.yml"] ?? "",
    }).auth;
    const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
    const content = files["smithable.content.yml"];
    if (ir) {
      const texts = content
        ? validateContent({ path: "smithable.content.yml", text: content }, ir).content
        : undefined;
      for (const section of summarize(ir, auth, texts))
        io.out(`\n${section.title}\n${section.sentences.map((s) => `  ${s}\n`).join("")}`);
    }
    // Where the description left the shape open, what the draft went with (smith-first.md §4).
    if (draft.assumptions?.length)
      io.out(
        `\nAssumed:\n${draft.assumptions.map((a) => `  ${a.question} ${a.chosen}${a.options.length ? ` (or: ${a.options.join(", ")})` : ""}\n`).join("")}`,
      );
    const confirmed = await confirm(io, "\nCreate this app?", options.yes === true);
    if (confirmed !== true) return confirmed;
    const texts =
      ir && content
        ? validateContent({ path: "smithable.content.yml", text: content }, ir).content
        : undefined;
    // Sample records drafted with the app, a few per model in one small request; a model left
    // out keeps the starter's records or generated rows.
    if (ir && options.sampleData !== false && process.env.SMITHABLE_NO_SAMPLES !== "1") {
      const drafted = await draftSamples({
        description,
        ir,
        ...(texts ? { content: texts } : {}),
        providers,
      });
      if (drafted.usage.length) io.out(`${usageLine(drafted.usage)}\n`);
      draftedSamples = drafted.samples;
    }
    // Pictures from the Smithable image library, unless the page's own came with --with-pictures.
    if (
      ir &&
      !website &&
      options.pictureData !== false &&
      !fromPage &&
      process.env.SMITHABLE_NO_PICTURES !== "1"
    )
      pictures = await addLibraryPictures({
        description,
        ir,
        ...(texts ? { content: texts } : {}),
        drafted: new Set(Object.keys(draftedSamples)),
        files,
        io,
      });
  }
  if (options.name?.trim()) files = named(files, options.name.trim());
  // The app's first administrator is whoever makes it: a starter's sample address never
  // survives into a new project, where it would be someone else's way in.
  const admin = options.admin?.trim() || gitEmail();
  if (admin) {
    files = administered(files, admin);
    const actualAdmins = new YamlEditor(files["smithable.auth.yml"] ?? "").get(["admins"]);
    if (
      website &&
      Array.isArray(actualAdmins) &&
      actualAdmins.some(
        (value) => typeof value === "string" && value.toLowerCase() === admin.toLowerCase(),
      )
    )
      website.authoritativeAdmin = admin.toLowerCase();
    files = withoutSampleDomains(files, io);
    // What follows for the administrator and their colleagues, in the validator's words.
    const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
    for (const d of validateAuth(
      { path: "smithable.auth.yml", text: files["smithable.auth.yml"] ?? "" },
      ir,
    ).diagnostics)
      if (d.code === "admin-outside-domains" || d.code === "example-domain")
        io.out(`${d.message}\n`);
  } else if (/^admins:/m.test(files["smithable.auth.yml"] ?? ""))
    io.out(
      "No administrator was set (no --admin and no Git user.email): the starter's sample address is still in smithable.auth.yml. Set yours with: smithable op setAdmins you@your-domain\n",
    );
  files = withTimeZone(files, options.timezone);
  if (website) {
    const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
    if (!ir) {
      io.err("The website app specification could not be checked.\n");
      return 1;
    }
    const placed = await websitePictures({
      context: website,
      files,
      ir,
      io,
      allowLibrary: options.pictureData !== false,
    });
    pictures = placed.pictures;
    websiteAssets = placed.assets;
    files = replaceWebsitePersonalFiles(files, website);
    fromPage = false;
  }
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  // The plain starter comes with its own custom code (e.g. the CRM's customer merge); an app
  // drafted from a description may have changed what that code relies on, so it gets stubs.
  if (!options.describe)
    for (const [file, text] of Object.entries(STARTER_CODE[name] ?? {})) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
  // Its sample records; none at all with --no-sample-data, which also leaves the database empty.
  const sampleData = options.sampleData !== false;
  // A drafted app keeps the starter's records for the models and fields it kept (fitSamples);
  // the rest get generated rows.
  const starterSamples = Object.entries(STARTER_SAMPLES[name] ?? {}).map(([path, text]) => ({
    path,
    text,
  }));
  const drafted = options.describe
    ? validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir
    : undefined;
  const samples = !options.describe
    ? starterSamples
    : drafted
      ? fitSamples(
          [
            ...starterSamples.filter((s) => !(sampleModel(s.path) in draftedSamples)),
            ...sampleFiles(draftedSamples, drafted, pictures, fromPage),
          ],
          drafted,
        )
      : [];
  if (sampleData)
    for (const { path, text } of samples) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  // The starter's own pictures (a drafted app's texts may still use them), then the page's as
  // sample pictures (never linked to the site) or the library's where its list says
  // (samples/<n>.webp, and hero.webp): the hero picked for this app replaces the starter's.
  placePictures(
    dir,
    website || options.pictureData === false ? {} : (STARTER_ASSETS[name] ?? {}),
    pictures.map((p) => (fromPage ? { ...p, file: `samples/${p.file}` } : p)),
  );
  if (website) {
    const copyFiles = {
      ...files,
      ...(sampleData
        ? Object.fromEntries(samples.map((sample) => [sample.path, sample.text]))
        : {}),
    };
    const privacyFiles = replaceWebsitePersonalFiles(copyFiles, website);
    const rewritten =
      website.contentMode === "full"
        ? privacyFiles
        : await repairWebsiteCopy(
            privacyFiles,
            website.input.sourceCorpus,
            website.description,
            providers,
            (message) =>
              options.onDiagnostic?.(replaceSitePersonalText(message, website.personalMap)),
          );
    const repaired = replaceWebsitePersonalFiles(rewritten, website);
    for (const [file, text] of Object.entries(repaired)) {
      if (file.startsWith("samples/") && !sampleData) continue;
      writeFileSync(join(dir, file), text);
    }
    writeAssetManifest(dir, websiteAssets);
    const review = assetReview(dir);
    if (review.diagnostics.length) {
      io.err(`${review.diagnostics.join("\n")}\n`);
      return 1;
    }
    options.onDraft?.(
      Object.fromEntries(Object.entries(repaired).filter(([file]) => !file.startsWith("samples/"))),
      websiteAssumptions,
    );
  }
  if (options.describe && !website) dropMissingPictures(dir, io);
  options.onStage?.("building");
  const code = await generate(dir, io, {
    tools: true,
    force: false,
    ...(options.installed ? { installed: true } : {}),
  });
  if (code !== 0) return code;
  if (website) {
    replaceWebsitePersonalArtifacts(dir, website, true);
    const review = assetReview(dir);
    if (review.diagnostics.length) {
      io.err(`${review.diagnostics.join("\n")}\n`);
      return 1;
    }
    options.onWebsite?.({ assetManifestDigest: review.manifestDigest });
  }
  if (sampleData && exec(...tool(dir, "tsx", ["src/db/seed.ts"]), dir) !== 0)
    io.err("Could not add sample data; the app works without it.\n");
  // History from the moment the project is made (B 79, cloud #348): a project published before
  // any change has a commit to check out and to name its engine by. Changes, undo and the change
  // numbers read this commit as the start, not a change.
  ensureRepository(dir);
  io.out(
    `\nCreated ${dir}. Open it in Studio, to see it and change it:\n\n  cd ${dir}\n  smithable studio\n\nor only run the app with smithable run.\n`,
  );
  return 0;
}

/**
 * `smithable clarify "<description>"`: the questions before a draft and the starter chosen, for
 * a program (--json) or a person. A model that fails or is missing means no questions, so a
 * caller never has to tell a failure from a description that says enough.
 */
export async function clarify(io: Io, description: string, json: boolean): Promise<number> {
  // A starter's own description, or a small edit of it: nothing to ask, and no model to ask it.
  const known = knownStart(description);
  const asked = known
    ? { starter: known.name, questions: [], usage: [] }
    : await clarifyProject({
        description,
        starters: starterSummaries(),
        providers: providersFor(),
        askIn: askIn(description),
      }).catch(() => ({ questions: [], usage: [] }) as Awaited<ReturnType<typeof clarifyProject>>);
  const questions = withLanguage(asked.questions, description);
  const result = {
    ...(asked.starter ? { starter: asked.starter } : {}),
    questions,
  };
  if (json) io.out(`${JSON.stringify(result)}\n`);
  else {
    io.out(`Starter: ${asked.starter ?? "(the closest by words)"}\n`);
    io.out(
      questions.length
        ? questions
            .map(
              (q, i) =>
                `${i + 1}. ${q.question}${q.options.length ? ` (${q.options.join(" / ")})` : ""}\n`,
            )
            .join("")
        : "No questions: the description says enough.\n",
    );
  }
  return 0;
}

/** What a starter lets anyone use without signing in: the kinds of record and the pages. */
function publicOf(name: string): {
  read: string[];
  pages: { id: string; model?: string }[];
  signIn?: false;
  /** For a starter with no sign-in: what anyone can use, and that nothing else works (T769). */
  closed?: string;
} {
  const files = STARTERS[name] as Record<string, string> | undefined;
  if (!files?.["smithable.yml"] || !files["smithable.auth.yml"]) return { read: [], pages: [] };
  const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] }).ir;
  if (!ir) return { read: [], pages: [] };
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: files["smithable.auth.yml"] },
    ir,
  ).auth;
  if (!auth) return { read: [], pages: [] };
  // Without sign-in too, only what public names is open (core's access; T769).
  const pages = ir.pages.filter((p) => auth.public.pages.includes(p.id));
  const closed = noSignIn(ir, auth);
  return {
    ...(closed ? { signIn: false as const, closed } : {}),
    read: auth.public.read,
    pages: pages.map((p) => ({
      id: p.id,
      ...("model" in p.pattern ? { model: String(p.pattern.model) } : {}),
    })),
  };
}

/** The kinds of record a starter lets anyone read without signing in (its `public: read`). */
export function publicRecords(name: string): string[] {
  return publicOf(name).read;
}

/**
 * What a starter that lets anyone read records says with its suggestion: which, and the operation
 * that keeps them private (nothing read without signing in; the pages that list them closed too).
 */
export function publicNote(name: string, description?: string): string | undefined {
  const { read, pages, signIn, closed } = publicOf(name);
  // No sign-in: said whether or not anything is public, since nothing else works for anyone.
  if (signIn === false && closed) return closed.replace(/^This app/, `The ${name} starter`);
  if (!read.length) return undefined;
  const kept = pages.filter((p) => !p.model || !read.includes(p.model)).map((p) => p.id);
  // Led with the case when the description names no visitors (the reader read none).
  const lead =
    description !== undefined && readDescription(description).visitors !== "read"
      ? `Your description names no visitors, and the ${name} starter is a public site`
      : `The ${name} starter is a public site`;
  return `${lead}: anyone can read its ${read.join(", ")} records without signing in. To keep them private: smithable op setPublic --pages ${kept.length ? kept.join(",") : '""'} --read ""`;
}

/**
 * A first build as private as its description (T767), after the draft, whatever made it, when the
 * result lets anyone read a kind of record:
 * - the no-model reader settled that the description names no visitors: closed by setPublic in the
 *   same build (the pages that list those records too), said as an assumption;
 * - the reader could not tell, and the result reads exactly what the starter did (inherited, not
 *   decided): closed the same way;
 * - the reader could not tell, and the draft changed what is public (the model or the answers
 *   decided it): kept, and said as an assumption the other way round, so it is seen.
 */
export function keptPrivate(
  files: Record<string, string>,
  description: string,
  starter?: Record<string, string>,
): { files: Record<string, string>; assumption?: Assumption } {
  const visitors = readDescription(description).visitors;
  if (visitors === "read") return { files };
  const spec = files["smithable.yml"];
  const authText = files["smithable.auth.yml"];
  if (!spec || !authText) return { files };
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  const auth = ir && validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth;
  if (!ir || !auth || auth.signIn === "none" || !auth.public.read.length) return { files };
  const read = auth.public.read;
  const kinds = read.join(", ");
  if (visitors === undefined) {
    const inherited = publicReadOf(starter);
    const same = [...inherited].sort().join() === [...read].sort().join();
    if (!same)
      return {
        files,
        assumption: {
          part: "visitors",
          question: `Who may read the ${kinds} records without signing in?`,
          chosen: `Anyone can read the ${kinds} records without signing in.`,
          options: ["Keep them private"],
        },
      };
  }
  const { pages, steps } = closedParts(ir, auth.public.pages, read, files["smithable.ux.yml"]);
  const result = applyOperations(
    {
      spec,
      auth: authText,
      ...(files["smithable.content.yml"] ? { content: files["smithable.content.yml"] } : {}),
      ...(files["smithable.ux.yml"] ? { ux: files["smithable.ux.yml"] } : {}),
    },
    [...steps, { op: "setPublic", args: { pages, read: [] } }],
  );
  if (!result.ok) return { files };
  return {
    files: {
      ...files,
      "smithable.yml": result.files.spec,
      ...(result.files.auth !== undefined ? { "smithable.auth.yml": result.files.auth } : {}),
      ...(result.files.content !== undefined
        ? { "smithable.content.yml": result.files.content }
        : {}),
      ...(result.files.ux !== undefined ? { "smithable.ux.yml": result.files.ux } : {}),
    },
    assumption: {
      part: "visitors",
      question: `Who may read the ${kinds} records without signing in?`,
      chosen:
        visitors === "nothing"
          ? "Nobody: kept private, since your description names no visitors."
          : "Nobody: kept private, since your description does not say anyone may.",
      options: [`Visitors may read the ${kinds} records`],
    },
  };
}

/**
 * What closing kinds of record takes from the public pages (T791), by the spec's shape: a page
 * whose own list is of a closed kind closes; on the others, the sections that show a closed kind
 * go, a hero's facts lose it, and a stage hero that would show it takes its own layout. A page
 * with nothing left but those sections closes too.
 */
function closedParts(
  ir: SpecIR,
  open: readonly string[],
  closed: readonly string[],
  uxText?: string,
): { pages: string[]; steps: { op: string; args: Record<string, string> }[] } {
  const looks = uxText ? validateUx({ path: "smithable.ux.yml", text: uxText }, ir).ux : undefined;
  const pages: string[] = [];
  const steps: { op: string; args: Record<string, string> }[] = [];
  for (const id of open) {
    const page = ir.pages.find((p) => p.id === id);
    if (!page) continue;
    const parts = partSections(page);
    // The page's own records (its kind's, not a part's): a list, a menu, an order form's.
    const fromParts = new Set(parts.flatMap((s) => (s.model ? [s.model] : [])));
    if (
      ("model" in page.pattern && closed.includes(String(page.pattern.model))) ||
      patternInfo(page)
        .reads()
        .some((m) => closed.includes(m) && !fromParts.has(m))
    )
      continue;
    const shows = parts.filter((s) => s.model && closed.includes(s.model));
    if (parts.length && shows.length === parts.length) continue;
    pages.push(id);
    for (const s of shows) steps.push({ op: "removeSection", args: { page: id, section: s.name } });
    for (const [section, look] of Object.entries(looks?.pages[id]?.looks ?? {})) {
      if (shows.some((s) => s.name === section)) continue;
      const facts = look.facts?.filter((m) => !closed.includes(m));
      if (facts && facts.length !== look.facts?.length)
        steps.push({
          op: "setSectionLook",
          args: {
            page: id,
            section,
            key: "facts",
            value: facts.length ? facts.join(" ") : "default",
          },
        });
      const stage = look.layout === "stage" ? stagePage(ir, look.stage) : undefined;
      if (stage && closed.includes(pageModel(stage) ?? "")) {
        if (look.stage !== undefined)
          steps.push({
            op: "setSectionLook",
            args: { page: id, section, key: "stage", value: "default" },
          });
        steps.push({
          op: "setSectionLook",
          args: { page: id, section, key: "layout", value: "default" },
        });
      }
    }
  }
  return { pages, steps };
}

/**
 * A first build that comes out with no sign-in (T769): what anyone can use and that nothing else
 * works, for its owner too, until it has sign-in, said as an assumption the person sees, whatever
 * the description says of visitors (an open site without sign-in locks its owner out too).
 */
export function noSignInAssumption(
  files: Record<string, string>,
  description: string,
): Assumption | undefined {
  const spec = files["smithable.yml"];
  const authText = files["smithable.auth.yml"];
  if (!spec || !authText) return undefined;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  const auth = ir && validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth;
  const closed = ir && auth ? noSignIn(ir, auth) : undefined;
  return closed
    ? {
        part: "signedIn",
        question: "Who signs in?",
        chosen: closed,
        options: ["People sign in with a code sent to their email"],
      }
    : undefined;
}

/** The kinds of record a starter's files let anyone read, or none. */
function publicReadOf(files: Record<string, string> | undefined): string[] {
  const spec = files?.["smithable.yml"];
  const authText = files?.["smithable.auth.yml"];
  if (!spec || !authText) return [];
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  return (
    (ir && validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth?.public.read) ?? []
  );
}

/**
 * The starter for a description, weighing who it is for (T767). A starter that lets anyone read its
 * records is never suggested unsaid: its note says so, and how to keep them private. When the
 * no-model reader does not read visitors who look at the app, it is also ranked below every starter
 * that keeps them private and shares at least as many of the description's words, unless the
 * reader settled the kind of app as that starter's (then it is the fit, said with its note).
 */
export function starterFor(description: string, picked: string): { name: string; note?: string } {
  if (!publicRecords(picked).length) return { name: picked };
  const reading = readDescription(description);
  if (reading.visitors === "read" || (reading.read && reading.kind === picked))
    return { name: picked, ...noteOf(picked, description) };
  const closed = Object.fromEntries(
    Object.entries(STARTERS).filter(([name]) => !publicRecords(name).length),
  ) as Record<string, Record<string, string>>;
  const other = closestStarter(description, closed);
  const score = (name: string) =>
    starterScore(description, (STARTERS[name] ?? {}) as Record<string, string>);
  return score(other) > 0 && score(other) >= score(picked)
    ? { name: other }
    : { name: picked, ...noteOf(picked, description) };
}
const noteOf = (name: string, description: string) => {
  const note = publicNote(name, description);
  return note ? { note } : {};
};

/**
 * What a description leaves open before a draft, and the starter that is its example
 * (docs/design/while-it-is-made.md). Read without a model where that can be done: a starter's
 * own description asks nothing; when the reader is sure of the kind of app it asks only who
 * signs in and what visitors see, where the description does not say. Otherwise the model
 * picks the starter and asks, as `clarify` does.
 */
export async function openQuestions(description: string): Promise<{
  starter?: string;
  /** Said with the starter when anyone can read its records without signing in (T767). */
  note?: string;
  questions: { about?: string; question: string; options: string[] }[];
  /** Whether a model was asked: its call takes a few seconds. */
  asked: boolean;
}> {
  const known = knownStart(description);
  if (known) {
    const note = publicNote(known.name, description);
    return { starter: known.name, ...(note ? { note } : {}), questions: [], asked: false };
  }
  const reading = readDescription(description);
  if (reading.read && reading.kind && STARTERS[reading.kind]) {
    const chosen = starterFor(description, reading.kind);
    return {
      starter: chosen.name,
      ...(chosen.note ? { note: chosen.note } : {}),
      questions: reading.questions,
      asked: false,
    };
  }
  const answer = await clarifyProject({
    description,
    starters: starterSummaries(),
    providers: providersFor(),
    askIn: askIn(description),
  }).catch(() => ({ questions: [], usage: [] }) as Awaited<ReturnType<typeof clarifyProject>>);
  const chosen = answer.starter ? starterFor(description, answer.starter) : undefined;
  return {
    ...(chosen ? { starter: chosen.name, ...(chosen.note ? { note: chosen.note } : {}) } : {}),
    questions: withLanguage(answer.questions, description),
    asked: true,
  };
}

/** The model's questions, and for a page in another language than the person's, which one the app is in. */
function withLanguage<Q>(questions: Q[], description: string): (Q | Question)[] {
  const language = languageAsked(description);
  return language ? [...questions, language] : questions;
}

/** Each starter as the questions step sees it: what it is, and its records. */
function starterSummaries(): Record<string, { description: string; models: string[] }> {
  return Object.fromEntries(
    Object.entries(STARTERS).map(([name, files]) => {
      const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
      return [
        name,
        { description: ir?.app.description ?? "", models: ir?.models.map((m) => m.name) ?? [] },
      ];
    }),
  );
}

/** Asks the questions on the terminal: a number picks a suggested answer, text is free, Enter skips. */
async function askQuestions(
  io: Io,
  questions: Question[],
): Promise<{ question: string; answer: string }[] | undefined> {
  if (!process.stdin.isTTY) {
    io.err(
      `A few questions first:\n${questions.map((q, i) => `  ${i + 1}. ${q.question}${q.options.length ? ` (${q.options.join(" / ")})` : ""}`).join("\n")}\nAnswer them with --answers "a; b; c" (in order), or run again with --yes to skip them.\n`,
    );
    return undefined;
  }
  io.out("A few questions first (a number picks an answer, text is fine too, Enter skips):\n");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answers: { question: string; answer: string }[] = [];
  try {
    for (const q of questions) {
      io.out(
        `\n${q.question}\n${q.options.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}${q.options.length ? "\n" : ""}`,
      );
      const text = (await prompt.question("> ")).trim();
      const picked = /^\d+$/.test(text) ? q.options[Number(text) - 1] : undefined;
      answers.push({ question: q.question, answer: picked ?? text });
    }
  } finally {
    prompt.close();
  }
  return answers;
}

/** The project's files with the app named `name` (a name someone typed wins over a draft's). */
/** The project's files with `address` as the only administrator, when the app has sign-in. */
export function administered(
  files: Record<string, string>,
  address: string,
): Record<string, string> {
  const auth = new YamlEditor(files["smithable.auth.yml"] ?? "");
  if (!auth.has(["signIn"]) || auth.get(["signIn"]) === "none") return files;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return files;
  if (auth.has(["admins"])) auth.set(["admins"], [address.toLowerCase()]);
  else auth.add([], "admins", [address.toLowerCase()]);
  return { ...files, "smithable.auth.yml": auth.text };
}

/** The Git user's email address, when Git is there and knows one. */
function gitEmail(): string | undefined {
  const result = spawnSync("git", ["config", "user.email"], { encoding: "utf8" });
  const address = result.status === 0 ? result.stdout.trim() : "";
  return address || undefined;
}

const sampleModel = (path: string) => path.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "");

/**
 * Drafted sample records as samples/<Model>.yml files, each record's picture fields given the
 * model's own pictures in turn (the library's, marked as an AI's; or the page's with
 * --with-pictures), so a dish shows a dish. A model without fitting pictures leaves them out.
 */
export function sampleFiles(
  samples: DraftedSamples,
  ir: SpecIR,
  pictures: { file: string; alt: string; model?: string }[],
  fromPage = false,
): { path: string; text: string }[] {
  return Object.entries(samples).flatMap(([name, rows]) => {
    const model = ir.models.find((m) => m.name === name);
    if (!model) return [];
    const pool = fromPage
      ? pictures.map((p) => ({ file: p.file, alt: p.alt }))
      : pictures
          .filter((p) => p.model === name)
          .map((p) => ({ file: p.file.replace(/^samples\//, ""), alt: p.alt, generated: true }));
    const records = rows.map((row, i) => {
      const record: Record<string, unknown> = { ...row };
      const picture = pool[i % (pool.length || 1)];
      if (picture)
        for (const field of model.fields) {
          if (field.type.kind !== "scalar") continue;
          // A copy each: one object written twice would be a YAML alias.
          if (field.type.name === "picture") record[field.name] = { ...picture };
          if (field.type.name === "pictures") record[field.name] = [{ ...picture }];
        }
      return record;
    });
    return [
      {
        path: `samples/${name}.yml`,
        text: sampleFileText(
          records,
          "Sample records drafted with the app; change or remove them freely.",
        ),
      },
    ];
  });
}

/** Whether the runtime knows a time zone's name. */
export function knownZone(name: unknown): boolean {
  if (typeof name !== "string" || !name) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * A new app's time zone where its spec names none, so it does not run on UTC unawares (A 220): the
 * one given, over a starter's too; else the machine's unless that is UTC, where a starter's own
 * zone stays. An app with no pages is only an API, and no one's clock is guessed for it.
 */
export function withTimeZone(
  files: Record<string, string>,
  given?: string,
  machine = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Record<string, string> {
  const spec = new YamlEditor(files["smithable.yml"] ?? "");
  if (!spec.has(["app", "name"])) return files;
  const said = spec.has(["app", "timezone"]);
  if (given) {
    if (said) spec.set(["app", "timezone"], given);
    else spec.add(["app"], "timezone", given);
    return { ...files, "smithable.yml": spec.text };
  }
  if (said || /^(Etc\/)?(UTC|UCT|GMT|Universal|Zulu)$/.test(machine)) return files;
  const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
  if (!ir?.pages.length) return files;
  spec.add(["app"], "timezone", machine);
  return { ...files, "smithable.yml": spec.text };
}

export function named(files: Record<string, string>, name: string): Record<string, string> {
  const spec = new YamlEditor(files["smithable.yml"] ?? "");
  if (!spec.has(["app", "name"])) return files;
  spec.set(["app", "name"], name);
  return { ...files, "smithable.yml": spec.text };
}

/**
 * A starter's allowedDomains are sample content, like its admin: on a domain nobody has
 * (acme.example) they are taken out. A shared app that anyone could then sign up to and read is
 * made invite-only, as a draft is (closeShared): a team page and setSignUp invited.
 */
export function withoutSampleDomains(
  files: Record<string, string>,
  io: Io,
): Record<string, string> {
  const text = files["smithable.auth.yml"];
  if (!text) return files;
  const auth = new YamlEditor(text);
  const path = ["signIn", "allowedDomains"];
  const domains = auth.has(path) ? (auth.get(path) as unknown) : undefined;
  if (
    !Array.isArray(domains) ||
    !domains.length ||
    !domains.every((d) => reservedDomain(String(d)))
  )
    return files;
  auth.removeAndPrune(path, 1);
  const project = {
    spec: files["smithable.yml"] ?? "",
    auth: auth.text,
    content: files["smithable.content.yml"],
    ux: files["smithable.ux.yml"],
  };
  const closed = closeShared(project, []);
  io.out(
    `The starter let only ${domains.join(" and ")} addresses sign in (${domains.length > 1 ? "sample domains" : "a sample domain"} no one has); that limit is gone.${
      closed !== project
        ? " So that not anyone may sign up and read everything, only invited people and the administrator may sign in (the team page invites them; smithable op setSignUp anyone opens it)."
        : ""
    }\n`,
  );
  return {
    ...files,
    "smithable.yml": closed.spec,
    "smithable.auth.yml": closed.auth ?? auth.text,
    ...(closed.content !== undefined ? { "smithable.content.yml": closed.content } : {}),
    ...(closed.ux !== undefined ? { "smithable.ux.yml": closed.ux } : {}),
  };
}

/** Unknown choices keep the starter's behavior until the owner changes them. */
export function defaultAssumptions(
  starter: string,
  questions: { question: string; options: string[] }[],
): Assumption[] {
  return questions.map((question) => ({
    part: "app",
    question: question.question,
    chosen: `Keep the ${starter} starter's default where the supplied facts do not answer this. This choice is unconfirmed.`,
    options: question.options,
  }));
}

// Part of the TanStack adapter's generator (generate.ts): files reviewed before others see them
// (docs/design/file-review.md). The hold itself is in each model's data module (unheld,
// queueReviews); here are the review page's server module, its route and the file a reviewer opens.
import {
  type AuthIR,
  camel,
  type FieldIR,
  humanize,
  isFiles,
  isPictures,
  isUpload,
  kebab,
  type ModelIR,
  type PageIR,
  reviewRoles,
  type SpecIR,
  storesFiles,
  titleField,
} from "@smithable/core";
import { hasSignIn } from "./auth.js";
import {
  dataKey,
  guard,
  HEADER,
  indexPath,
  join,
  names,
  SCHEMA_IMPORT,
  type Texts,
} from "./shared.js";

/** A field that holds several pictures or documents. */
const isMany = (f: FieldIR) => isPictures(f) || isFiles(f);

/** The models with review, in spec order. */
export const reviewed = (ir: SpecIR): ModelIR[] => ir.models.filter((m) => m.review);

/** The first crud page of a model, for the link from a waiting file to its record. */
function recordRoute(ir: SpecIR, model: ModelIR): string | undefined {
  return ir.pages.find((p) => p.pattern.kind === "crud" && p.pattern.model === model.name)?.route;
}

/**
 * src/generated/review.ts: who reviews each model's files, and where the review page is; read by
 * the kit's mail to reviewers (src/kit/review-mail.server.ts) without loading the data modules.
 */
export function reviewRolesModule(ir: SpecIR, auth: AuthIR): string {
  const page = ir.pages.find((p) => p.pattern.kind === "review");
  return `${HEADER}// Who reviews each model's waiting files, and the review page (docs/design/file-review.md).
export const REVIEWER_ROLES: Record<string, string[]> = ${JSON.stringify(Object.fromEntries(reviewed(ir).map((m) => [m.name, reviewRoles(m.name, auth)])))};

export const REVIEW_PAGE: string | undefined = ${page ? JSON.stringify(page.route) : "undefined"};
`;
}

/**
 * src/generated/review.server.ts: what waits for review and what was decided, the decisions (in
 * the audit log; a rejected file is removed), the menu's count, the reasons a record's owner
 * reads, and the waiting file itself for a reviewer.
 */
export function reviewServerModule(ir: SpecIR, t: Texts, auth: AuthIR): string {
  const models = reviewed(ir);
  const signedIn = hasSignIn(auth);
  const fieldsOf = (m: ModelIR) =>
    (m.review ?? []).flatMap((f) => m.fields.find((x) => x.name === f) ?? []).filter(isUpload);
  const entry = (m: ModelIR) => {
    const n = names(m, t);
    const title = titleField(m);
    const route = recordRoute(ir, m);
    const fields = fieldsOf(m);
    const keys = fields.map((f) => dataKey(f));
    const like = keys
      .map((k) => `\${${n.table}.${k}} like \${\`%"file":"\${file}"%\`}`)
      .join(" or ");
    return `  ${JSON.stringify(m.name)}: {
    label: ${JSON.stringify(n.label)},
    reviewers: ${camel(m.name)}Reviewers,
    titles: (ids) =>
      new Map(
        db
          .select({ id: ${n.table}.id, title: ${n.table}.${title} })
          .from(${n.table})
          .where(inArray(${n.table}.id, ids))
          .all()
          .map((r) => [r.id, String(r.title ?? r.id)]),
      ),
    ${route ? `href: (id) => \`${route === "/" ? "" : route}/\${id}\`,` : "href: () => undefined,"}
    fields: {
${fields.map((f: FieldIR) => `      ${JSON.stringify(f.name)}: { label: ${JSON.stringify(t.field(m, f).label ?? humanize(f.name))}, kind: "${storesFiles(f) ? "file" : "picture"}" },`).join("\n")}
    },
    // A rejected file leaves the record: out of a list, or the field emptied; a required single
    // file stays (it cannot be empty), held from others until a new one is sent.
    takeOut: ${fields.some((f) => isMany(f) || !f.required) ? "(id, field, file) =>" : "() =>"} {
${fields
  .filter((f) => isMany(f) || !f.required)
  .map((f) => {
    const k = dataKey(f);
    return `      if (field === ${JSON.stringify(f.name)}) {
        const row = db.select({ value: ${n.table}.${k} }).from(${n.table}).where(eq(${n.table}.id, id)).get();
        ${isMany(f) ? `db.update(${n.table}).set({ ${k}: (row?.value ?? []).filter((v) => v.file !== file) }).where(eq(${n.table}.id, id)).run();` : `if (row?.value?.file === file) db.update(${n.table}).set({ ${k}: null }).where(eq(${n.table}.id, id)).run();`}
      }`;
  })
  .join("\n")}
    },
    // Another record still shows the same file (files are named by their content).
    usedElsewhere: (file, id) =>
      !!db
        .select({ id: ${n.table}.id })
        .from(${n.table})
        .where(and(ne(${n.table}.id, id), sql\`${like}\`))
        .get(),
  },`;
  };
  return `${HEADER}// Files reviewed before others see them (docs/design/file-review.md): the review page's list
// and decisions, the menu's count, and the waiting file itself for a reviewer.
import { and, desc, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
import type { ReviewItem } from "#/kit/Review";
import { deleteFile, deletePicture, uploadResponse } from "#/kit/uploads";
${models.map((m) => `import { REVIEWERS as ${camel(m.name)}Reviewers } from "./${kebab(m.name)}.server";`).join("\n")}

interface Reviewed {
  label: string;
  reviewers: string[];
  titles(ids: number[]): Map<number, string>;
  href(id: number): string | undefined;
  fields: Record<string, { label: string; kind: "picture" | "file" }>;
  usedElsewhere(file: string, id: number): boolean;
  takeOut(id: number, field: string, file: string): void;
}

const MODELS: Record<string, Reviewed> = {
${models.map(entry).join("\n")}
};

const DAY = 24 * 60 * 60 * 1000;

/** The models among \`models\` whose files the viewer reviews. */
function reviewing(viewer: Viewer | null, models: string[]): string[] {
  return viewer ? models.filter((m) => MODELS[m]?.reviewers.includes(viewer.role)) : [];
}

/** What waits for review (newest first), and what was decided in the last thirty days. */
export function reviewList(
  viewer: Viewer | null,
  models: string[],
): { waiting: (ReviewItem & { model: string })[]; decided: (ReviewItem & { model: string })[] } {
  const mine = reviewing(viewer, models);
  if (!mine.length) throw new AccessDenied(viewer !== null);
  const rows = db
    .select()
    .from(schema.fileReviews)
    .where(
      and(
        inArray(schema.fileReviews.model, mine),
        or(
          eq(schema.fileReviews.state, "pending"),
          gte(schema.fileReviews.decidedAt, new Date(Date.now() - 30 * DAY)),
        ),
      ),
    )
    .orderBy(desc(schema.fileReviews.uploadedAt))
    .limit(500)
    .all();
  const titles = new Map(
    mine.map((m) => [m, MODELS[m]?.titles(rows.filter((r) => r.model === m).map((r) => r.recordId)) ?? new Map()]),
  );
  ${
    signedIn
      ? `const senders = new Map(
    rows.some((r) => r.uploadedBy)
      ? db
          .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
          .from(schema.user)
          .where(inArray(schema.user.id, rows.flatMap((r) => (r.uploadedBy ? [r.uploadedBy] : []))))
          .all()
          .map((u) => [u.id, u.name || u.email])
      : [],
  );`
      : "const senders = new Map<string, string>();"
  }
  const items = rows.flatMap((r) => {
    const model = MODELS[r.model];
    const field = model?.fields[r.field];
    const title = titles.get(r.model)?.get(r.recordId);
    // A record that is gone takes its waiting files with it.
    if (!model || !field || title === undefined) return [];
    return [
      {
        id: r.id,
        model: r.model,
        label: model.label,
        title,
        href: model.href(r.recordId),
        fieldLabel: field.label,
        kind: field.kind,
        sender: (r.uploadedBy && senders.get(r.uploadedBy)) || "—",
        sentAt: r.uploadedAt,
        state: r.state,
        reason: r.reason,
      },
    ];
  });
  return {
    waiting: items.filter((i) => i.state === "pending"),
    decided: items.filter((i) => i.state !== "pending"),
  };
}

/** How many files wait for the viewer's review: the number on the menu entry. */
export function waitingCount(viewer: Viewer | null, models: string[]): number {
  const mine = reviewing(viewer, models);
  if (!mine.length) return 0;
  return db
    .select({ id: schema.fileReviews.id })
    .from(schema.fileReviews)
    .where(and(inArray(schema.fileReviews.model, mine), eq(schema.fileReviews.state, "pending")))
    .all().length;
}

/**
 * Approves a waiting file (others see it from now on) or rejects it with a reason its sender reads
 * on the record; a rejected file is removed unless another record shows the same one.
 */
export function decide(viewer: Viewer | null, id: number, approve: boolean, reason?: string): void {
  const row = db.select().from(schema.fileReviews).where(eq(schema.fileReviews.id, id)).get();
  if (!row || !reviewing(viewer, [row.model]).length) throw new AccessDenied(viewer !== null);
  if (row.state !== "pending") return;
  db.transaction((tx) => {
    tx.update(schema.fileReviews)
      .set({
        state: approve ? "approved" : "rejected",
        reason: approve ? null : (reason ?? null),
        decidedBy: viewer?.id ?? null,
        decidedAt: new Date(),
      })
      .where(eq(schema.fileReviews.id, id))
      .run();
    audit(tx, viewer, {
      action: approve ? "file approved" : "file rejected",
      model: row.model,
      record: row.recordId,
      fields: [row.field],
      ...(reason && !approve ? { details: { reason } } : {}),
    });
  });
  const model = MODELS[row.model];
  if (approve || !model) return;
  model.takeOut(row.recordId, row.field, row.file);
  const stored = { file: row.file, alt: "", width: 0, height: 0, name: "", type: "", size: 0 };
  const used = model.usedElsewhere(row.file, row.recordId);
  if (model.fields[row.field]?.kind === "picture") deletePicture(stored, used);
  else deleteFile(stored, used);
}

/** The rejected files of a record, with the reviewer's reasons: what its owner reads on it. */
export function rejections(model: string, recordId: number): { field: string; reason: string | null }[] {
  return db
    .select({ field: schema.fileReviews.field, reason: schema.fileReviews.reason })
    .from(schema.fileReviews)
    .where(
      and(
        eq(schema.fileReviews.model, model),
        eq(schema.fileReviews.recordId, recordId),
        eq(schema.fileReviews.state, "rejected"),
      ),
    )
    .all();
}

/** The waiting file itself, for a reviewer only (who may not read the record otherwise). */
export function reviewFile(request: Request, viewer: Viewer | null, id: number): Response {
  const row = db.select().from(schema.fileReviews).where(eq(schema.fileReviews.id, id)).get();
  if (!row || !reviewing(viewer, [row.model]).length) return new Response("Not found", { status: 404 });
  const kind = MODELS[row.model]?.fields[row.field]?.kind ?? "file";
  const name = row.file.split("/").at(-1) ?? "file";
  return uploadResponse(request, kind, { file: row.file, name, type: "", size: 0 }, false);
}
`;
}

/** The review page's route: the list with Approve and Reject, for its models' reviewers. */
export function reviewRoute(
  page: PageIR & { pattern: { kind: "review"; models: string[] } },
  t: Texts,
): string {
  const models = JSON.stringify(page.pattern.models);
  return `${HEADER}import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
import { decide, reviewList } from "#/generated/review.server";
import { guardPage } from "#/kit/page-guard";
import { PageHeader } from "#/kit/AppShell";
import { Review } from "#/kit/Review";
import { w } from "#/kit/words";
import { currentViewer } from "#/lib/viewer.server";

const MODELS = ${models};

const getReviews = createServerFn().handler(async () => reviewList(await currentViewer(), MODELS));

const decideReview = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), approve: z.boolean(), reason: z.string().trim().max(500).optional() }))
  .handler(async ({ data }) => decide(await currentViewer(), data.id, data.approve, data.reason));

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: () => getReviews(),
  component: ReviewPage,
});

function ReviewPage() {
  const { waiting, decided } = Route.useLoaderData();
  const router = useRouter();
  return (
    <>
      <PageHeader title={${t.pageTitleOf(page.id)}} subtitle={w.reviewLead} />
      <Review
        app={app}
        waiting={waiting}
        decided={decided}
        fileUrl={(id) => \`${join(page.route, "file")}/\${id}\`}
        onDecide={async (id, approve, reason) => {
          await decideReview({ data: { id, approve, reason } });
          await router.invalidate();
        }}
      />
    </>
  );
}
`;
}

/** The waiting file a reviewer opens from the review page. */
export function reviewFileRoute(page: PageIR): string {
  return `${HEADER}import { createFileRoute } from "@tanstack/react-router";
import { reviewFile } from "#/generated/review.server";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute(${JSON.stringify(join(page.route, "file/$id"))})({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        reviewFile(request, await currentViewer(), Number(params.id)),
    },
  },
});
`;
}

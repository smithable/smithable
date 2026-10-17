// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  apiOffers,
  kebab,
  type PageIR,
  pascal,
  plural,
  type SpecIR,
} from "@smithable/core";
import { hasKeys } from "../keys.js";
import { attr, code, guard, HEADER, indexPath, literal, type Texts } from "../shared.js";

/**
 * A users page: who has access, invited or active, with their role. Administrators (or the
 * page's roles) invite by email address, change roles, resend or withdraw invitations and remove
 * users. The rules live in src/generated/users.server.ts; the route's server functions pass the
 * viewer and where the invitation links point.
 */
export function usersRoute(page: PageIR, ir: SpecIR, t: Texts, auth: AuthIR): string {
  const component = `${pascal(page.id)}Page`;
  // Keys for the API, for administrators (docs/design/integrations.md §2).
  const keys = hasKeys(ir, auth);
  // "Using a key": the first model the API offers, and whether assistants get tools.
  const first = apiOffers(auth, ir).models[0];
  const use = {
    app: code("app.name"),
    ...(first ? { path: kebab(plural(first)) } : {}),
    tools: Boolean(auth.api?.assistants),
  };
  return `${HEADER}import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
${keys ? 'import { app } from "#/generated/app";\n' : ""}import { pageAccess } from "#/generated/pages";
import { ROLE_LABELS } from "#/generated/roles";
import {
  invite,
  listUsers,
  origin,
  removeUser,
  resendInvitation,
  type Role,
  ROLES,
  setRole,
  usesOf,
  withdrawInvitation,
} from "#/generated/users.server";
${keys ? 'import { listKeys, makeKey, revokeKey } from "#/generated/keys.server";\n' : ""}import { guardPage } from "#/kit/access";
import { PageHeader } from "#/kit/AppShell";${keys ? '\nimport { Keys } from "#/kit/Keys";' : ""}
import { inviteAllowed } from "#/kit/limit";
import { mailConfigured } from "#/kit/mail";
import { Users } from "#/kit/Users";
import { currentViewer } from "#/lib/viewer.server";

const ROLE_OPTIONS = ${literal(
    auth.roles.map((r) => ({
      value: r.name,
      label: code(`ROLE_LABELS[${JSON.stringify(r.name)}]`),
      ...(r.description ? { description: r.description } : {}),
    })),
  )};

${
  keys
    ? `const getUsers = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  // Only administrators see and make keys.
  return { ...(await listUsers(viewer, origin())), keys: viewer?.role === "admin" ? listKeys(viewer) : [] };
});

const makeApiKey = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().trim().min(1).max(100), role: z.enum(ROLES), until: z.iso.date().optional() }))
  .handler(async ({ data }) =>
    makeKey(await currentViewer(), data.name, data.role, data.until ? new Date(\`\${data.until}T23:59:59Z\`) : undefined),
  );

const revokeApiKey = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => revokeKey(await currentViewer(), data.id));`
    : "const getUsers = createServerFn().handler(async () => listUsers(await currentViewer(), origin()));"
}

const inviteUser = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.email().max(200), role: z.enum(ROLES) }))
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    inviteAllowed(viewer);
    await invite(viewer, data.email, data.role, origin());
    return { kept: !mailConfigured() };
  });

const changeRole = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().max(100), role: z.enum(ROLES) }))
  .handler(async ({ data }) => {
    await setRole(await currentViewer(), data.userId, data.role);
  });

const remove = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().max(100), heirId: z.string().max(100).optional() }))
  .handler(async ({ data }) => {
    await removeUser(await currentViewer(), data.userId, data.heirId);
  });

const uses = createServerFn()
  .validator(z.object({ userId: z.string().max(100) }))
  .handler(async ({ data }) => usesOf(await currentViewer(), data.userId));

const resend = createServerFn({ method: "POST" })
  .validator(z.object({ invitationId: z.string().max(100) }))
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    inviteAllowed(viewer);
    await resendInvitation(viewer, data.invitationId, origin());
    return { kept: !mailConfigured() };
  });

const withdraw = createServerFn({ method: "POST" })
  .validator(z.object({ invitationId: z.string().max(100) }))
  .handler(async ({ data }) => {
    await withdrawInvitation(await currentViewer(), data.invitationId);
  });

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: () => getUsers(),
  component: ${component},
});

function ${component}() {
  const { users, invitations${keys ? ", keys" : ""} } = Route.useLoaderData();
  const { viewer } = Route.useRouteContext();
  const router = useRouter();
  const then = async <T,>(change: Promise<T>) => {
    const done = await change;
    await router.invalidate();
    return done;
  };
  return (
    <>
      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id)} />
      <Users
        viewerId={viewer?.id}
        roles={ROLE_OPTIONS}
        users={users}
        invitations={invitations}
        onInvite={(email, role) => then(inviteUser({ data: { email, role: role as Role } }))}
        onSetRole={(userId, role) => then(changeRole({ data: { userId, role: role as Role } }))}
        onRemove={(userId, heirId) => then(remove({ data: { userId, heirId } }))}
        usesOf={(userId) => uses({ data: { userId } })}
        onResend={(invitationId) => then(resend({ data: { invitationId } }))}
        onWithdraw={(invitationId) => then(withdraw({ data: { invitationId } }))}
      />${
        keys
          ? `
      {viewer?.role === "admin" && (
        <Keys
          keys={keys}
          roles={ROLE_OPTIONS}
          use={${literal(use)}}
          onMake={async (name, role, until) => {
            const key = await makeApiKey({ data: { name, role: role as Role, until } });
            await router.invalidate();
            return key;
          }}
          onRevoke={(id) => then(revokeApiKey({ data: { id } }))}
        />
      )}`
          : ""
      }
    </>
  );
}
`;
}

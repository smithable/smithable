// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import { type AuthIR, humanize, type PageIR, pascal, type SpecIR } from "@smithable/core";
import { roleLabels } from "../auth.js";
import { attr, guard, HEADER, indexPath, literal, type Texts } from "../shared.js";

/**
 * A users page: who has access, invited or active, with their role. Administrators (or the
 * page's roles) invite by email address, change roles, resend or withdraw invitations and remove
 * users. The rules live in src/generated/users.server.ts; the route's server functions pass the
 * viewer and where the invitation links point.
 */
export function usersRoute(page: PageIR, _ir: SpecIR, t: Texts, auth: AuthIR): string {
  const component = `${pascal(page.id)}Page`;
  const labels = roleLabels(auth);
  return `${HEADER}import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pageAccess } from "#/generated/pages";
import {
  invite,
  listUsers,
  origin,
  removeUser,
  resendInvitation,
  type Role,
  ROLES,
  setRole,
  withdrawInvitation,
} from "#/generated/users.server";
import { guardPage } from "#/kit/access";
import { PageHeader } from "#/kit/AppShell";
import { Users } from "#/kit/Users";
import { currentViewer } from "#/lib/viewer.server";

const ROLE_OPTIONS = ${literal(
    auth.roles.map((r) => ({
      value: r.name,
      label: labels[r.name] ?? humanize(r.name),
      ...(r.description ? { description: r.description } : {}),
    })),
  )};

const getUsers = createServerFn().handler(async () => listUsers(await currentViewer(), origin()));

const inviteUser = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.email().max(200), role: z.enum(ROLES) }))
  .handler(async ({ data }) => {
    await invite(await currentViewer(), data.email, data.role, origin());
  });

const changeRole = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().max(100), role: z.enum(ROLES) }))
  .handler(async ({ data }) => {
    await setRole(await currentViewer(), data.userId, data.role);
  });

const remove = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().max(100) }))
  .handler(async ({ data }) => {
    await removeUser(await currentViewer(), data.userId);
  });

const resend = createServerFn({ method: "POST" })
  .validator(z.object({ invitationId: z.string().max(100) }))
  .handler(async ({ data }) => {
    await resendInvitation(await currentViewer(), data.invitationId, origin());
  });

const withdraw = createServerFn({ method: "POST" })
  .validator(z.object({ invitationId: z.string().max(100) }))
  .handler(async ({ data }) => {
    await withdrawInvitation(await currentViewer(), data.invitationId);
  });

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: () => getUsers(),
  component: ${component},
});

function ${component}() {
  const { users, invitations } = Route.useLoaderData();
  const { viewer } = Route.useRouteContext();
  const router = useRouter();
  const then = async (change: Promise<unknown>) => {
    await change;
    await router.invalidate();
  };
  return (
    <>
      <PageHeader page=${attr(page.id)} title=${attr(t.pageTitle(page.id))}${t.pageSubtitle(page.id)} />
      <Users
        viewerId={viewer?.id}
        roles={ROLE_OPTIONS}
        users={users}
        invitations={invitations}
        onInvite={(email, role) => then(inviteUser({ data: { email, role: role as Role } }))}
        onSetRole={(userId, role) => then(changeRole({ data: { userId, role: role as Role } }))}
        onRemove={(userId) => then(remove({ data: { userId } }))}
        onResend={(invitationId) => then(resend({ data: { invitationId } }))}
        onWithdraw={(invitationId) => then(withdraw({ data: { invitationId } }))}
      />
    </>
  );
}
`;
}

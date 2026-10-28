// Smithable app kit: who has access. Users with their role, open invitations, and what an
// administrator does with them: invite by email address, change a role, resend or withdraw an
// invitation, remove a user. The rules (not yourself, the last administrator stays) are checked
// on the server; this only shows their answers. A table from tablet width, cards on a phone.
// To customize it, copy this file into src/custom/components/ and edit the copy.
import { useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input, Label, NativeSelect } from "#/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { w } from "./words";

export interface RoleOption {
  value: string;
  label: string;
  description?: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  /** One of the sample users the development door acts as (development and demo builds). */
  sample?: boolean;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: Date | string;
  /** The link the invitation mail carries; shown so it can be sent by hand too. */
  link: string;
}

interface UsersProps {
  /** The signed-in user: their own role and account are not theirs to change here. */
  viewerId?: string;
  roles: RoleOption[];
  users: UserRow[];
  invitations: InvitationRow[];
  /** Resolves to whether the invitation stayed in the outbox (the preview sends no mail). */
  onInvite: (email: string, role: string) => Promise<{ kept?: boolean } | undefined>;
  onSetRole: (userId: string, role: string) => Promise<unknown>;
  /** Removes a person; what names them goes to the heir, else what may be empty is cleared. */
  onRemove: (userId: string, heirId?: string) => Promise<unknown>;
  /** The records that name a person (an assignee, the records that are theirs). */
  usesOf?: (userId: string) => Promise<UserUse[]>;
  onResend: (invitationId: string) => Promise<{ kept?: boolean } | undefined>;
  onWithdraw: (invitationId: string) => Promise<unknown>;
}

const date = (value: Date | string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));

/** What names a person: records of one kind by one column (users.server.ts). */
interface UserUse {
  field: string | null;
  noun: [string, string];
  required: boolean;
  count: number;
}

export function Users({
  viewerId,
  roles,
  users,
  invitations,
  onInvite,
  onSetRole,
  onRemove,
  usesOf,
  onResend,
  onWithdraw,
}: UsersProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles.find((r) => r.value !== "admin")?.value ?? "admin");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [removing, setRemoving] = useState<UserRow>();
  // What names the person being removed, and whom it goes to ("" is nobody).
  const [uses, setUses] = useState<UserUse[]>();
  const [heir, setHeir] = useState("");
  const needsHeir = uses?.some((u) => u.required) ?? false;
  const confirmRemove = useRef<HTMLDialogElement>(null);
  const label = (value: string) => roles.find((r) => r.value === value)?.label ?? value;
  const chosen = roles.find((r) => r.value === role);

  async function run(action: () => Promise<unknown>, done?: string | (() => string)) {
    setBusy(true);
    setFailure(undefined);
    setNotice(undefined);
    try {
      await action();
      if (done) setNotice(typeof done === "function" ? done() : done);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    let kept = false;
    await run(
      async () => {
        kept = Boolean((await onInvite(address, role))?.kept);
        setEmail("");
      },
      () => (kept ? w.invitationKept(address) : w.invitationSentTo(address)),
    );
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setNotice(w.invitationLinkCopied);
    } catch {
      setNotice(link);
    }
  }

  // The same controls in the table and in the phone cards.
  const roleControl = (u: UserRow) =>
    u.id === viewerId ? (
      <span>{label(u.role)}</span>
    ) : (
      <NativeSelect
        aria-label={w.roleOf(u.name)}
        className="h-9 w-auto"
        value={u.role}
        disabled={busy}
        onChange={(e) => run(() => onSetRole(u.id, e.target.value))}
      >
        {roles.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </NativeSelect>
    );
  const removeButton = (u: UserRow) =>
    u.id !== viewerId && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-destructive text-destructive"
        disabled={busy}
        onClick={() => {
          setRemoving(u);
          setHeir("");
          setUses(usesOf ? undefined : []);
          usesOf?.(u.id).then(setUses, () => setUses([]));
          confirmRemove.current?.showModal();
        }}
      >
        {w.remove}
      </Button>
    );
  const expired = (i: InvitationRow) => new Date(i.expiresAt).getTime() < Date.now();
  const invitationStatus = (i: InvitationRow) =>
    expired(i) ? (
      <Badge variant="danger">{w.invitationExpired}</Badge>
    ) : (
      <Badge variant="warning">{w.invitedUntil(date(i.expiresAt))}</Badge>
    );
  const invitationActions = (i: InvitationRow) => (
    <div className="flex flex-wrap gap-2 md:justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || expired(i)}
        onClick={() => copy(i.link)}
      >
        {w.copyLink}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          let kept = false;
          return run(
            async () => {
              kept = Boolean((await onResend(i.id))?.kept);
            },
            () => (kept ? w.invitationKept(i.email) : w.invitationSentAgain(i.email)),
          );
        }}
      >
        {w.resend}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => run(() => onWithdraw(i.id))}
      >
        {w.withdraw}
      </Button>
    </div>
  );
  // A sample user is a person of the sample data the development door acts as, not someone who signs in.
  const status = (u: UserRow) =>
    u.sample ? <Badge>{w.sampleUser}</Badge> : <Badge variant="success">{w.active}</Badge>;
  const you = (u: UserRow) =>
    u.id === viewerId && <span className="text-muted-foreground"> {w.you}</span>;

  return (
    <div data-kit="users" className="space-y-6">
      <Card className="p-card">
        <form onSubmit={invite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">{w.emailAddress}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              placeholder="name@example.com"
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5 sm:w-56">
            <Label htmlFor="invite-role">{w.role}</Label>
            <NativeSelect
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={busy}>
            {w.sendInvitation}
          </Button>
        </form>
        {chosen?.description && (
          <p className="mt-2 text-sm text-muted-foreground">{chosen.description}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{w.invitedNameLater}</p>
      </Card>
      {failure && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {failure}
        </p>
      )}
      {notice && (
        <p role="status" className="break-all rounded-md bg-accent p-3 text-sm">
          {notice}
        </p>
      )}
      {users.length + invitations.length === 0 && (
        <Card className="px-6 py-16 text-center text-muted-foreground">{w.nobodyYet}</Card>
      )}
      <ul className="space-y-3 md:hidden">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.name}
                    {you(u)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                </div>
                {status(u)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {roleControl(u)}
                {removeButton(u)}
              </div>
            </Card>
          </li>
        ))}
        {invitations.map((i) => (
          <li key={i.id}>
            <Card className="space-y-3 p-5">
              <div className="min-w-0">
                <p className="truncate font-semibold">{i.email}</p>
                <p className="text-sm text-muted-foreground">{label(i.role)}</p>
              </div>
              {invitationStatus(i)}
              {invitationActions(i)}
            </Card>
          </li>
        ))}
      </ul>
      {users.length + invitations.length > 0 && (
        <Card className="hidden overflow-hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{w.name}</TableHead>
                <TableHead>{w.email}</TableHead>
                <TableHead>{w.role}</TableHead>
                <TableHead>{w.status}</TableHead>
                <TableHead className="text-right">{w.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {you(u)}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{roleControl(u)}</TableCell>
                  <TableCell>
                    {status(u)}
                  </TableCell>
                  <TableCell className="text-right">{removeButton(u)}</TableCell>
                </TableRow>
              ))}
              {invitations.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>{i.email}</TableCell>
                  <TableCell>{label(i.role)}</TableCell>
                  <TableCell>{invitationStatus(i)}</TableCell>
                  <TableCell className="text-right">{invitationActions(i)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {/* Opening it focuses Cancel, the first button; Escape closes it. */}
      <dialog
        ref={confirmRemove}
        aria-labelledby="remove-title"
        className="m-auto w-[calc(100%-2.5rem)] max-w-md rounded-xl border bg-card p-card text-card-foreground backdrop:bg-black/50"
      >
        <h2 id="remove-title" className="text-lg font-semibold">
          {w.removeWho(removing?.name ?? w.thisUser)}
        </h2>
        <p className="mt-2 text-muted-foreground">{w.removedUserNote}</p>
        {removing && uses && uses.length > 0 && (
          <div data-part="uses" className="mt-4 space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {uses.map((u) => {
                const noun = u.count === 1 ? u.noun[0] : u.noun[1];
                const name = removing.name || removing.email;
                return (
                  <li key={`${u.noun[0]}-${u.field}`}>
                    {u.field
                      ? w.namedAs(u.count, noun, name, u.field)
                      : w.belongTo(u.count, noun, name)}
                  </li>
                );
              })}
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="remove-heir">{w.giveThemTo}</Label>
              <NativeSelect id="remove-heir" value={heir} onChange={(e) => setHeir(e.target.value)}>
                <option value="">{needsHeir ? w.chooseSomeone : w.nobodyLeaveEmpty}</option>
                {users
                  .filter((other) => other.id !== removing.id)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name || other.email}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => confirmRemove.current?.close()}>
            {w.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={uses === undefined || (needsHeir && !heir)}
            onClick={() => {
              confirmRemove.current?.close();
              if (removing) run(() => onRemove(removing.id, heir || undefined));
            }}
          >
            {w.removeUser}
          </Button>
        </div>
      </dialog>
    </div>
  );
}

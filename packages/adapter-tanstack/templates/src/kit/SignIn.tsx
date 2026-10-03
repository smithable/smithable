// Smithable app kit: the sign-in card: an address and then a code by mail, a button per other
// sign-in provider, and in development signing in as any role without contacting a provider.
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input, Label } from "#/components/ui/input";

const PROVIDER_LABELS: Record<string, string> = { google: "Google", facebook: "Facebook" };

export function SignIn({
  appName,
  providers,
  missing,
  invitation,
  devRoles,
  demo,
  onProvider,
  onDevRole,
  codes,
  onSendCode,
  onCode,
}: {
  appName: string;
  /** Providers that are set up, in button order. */
  providers: string[];
  /** Providers in the spec whose keys are not configured yet. */
  missing: string[];
  /** Whom the invitation link that opened the page is for; the address must sign in itself. */
  invitation?: { email: string; role: string } | null;
  /** Roles to sign in as; given in development, and in a demo. */
  devRoles?: string[];
  /** A demo: the role buttons are the way in, not a development aid. */
  demo?: boolean;
  onProvider: (provider: string) => Promise<unknown>;
  onDevRole?: (role: string) => Promise<unknown>;
  /** Signing in by a code by mail: whether codes can reach people (mail settings, or development). */
  codes?: boolean;
  onSendCode?: (address: string) => Promise<unknown>;
  onCode?: (address: string, code: string) => Promise<unknown>;
}) {
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The address a code went to; then the page asks for the code.
  const [sentTo, setSentTo] = useState<string>();
  const [address, setAddress] = useState(invitation?.email ?? "");
  const [code, setCode] = useState("");
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }
  return (
    <Card data-kit="sign-in" className="mx-auto mt-10 max-w-sm space-y-5 p-card">
      <h1 className="text-2xl font-bold">Sign in to {appName}</h1>
      {invitation && (
        <p className="rounded-md bg-accent p-3 text-sm">
          You were invited to {appName} as {invitation.role}. Sign in with{" "}
          <strong>{invitation.email}</strong>.
        </p>
      )}
      {providers.includes("email") &&
        onSendCode &&
        onCode &&
        (codes === false ? (
          <p className="text-muted-foreground">
            Signing in by email is not available yet: {appName} cannot send mail. Please contact
            whoever runs it.
          </p>
        ) : sentTo ? (
          <form
            data-part="code"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => onCode(sentTo, code));
            }}
          >
            <p className="text-sm" role="status">
              If <strong>{sentTo}</strong> may sign in, a code is on its way. It works for ten
              minutes.
            </p>
            <div className="space-y-1">
              <Label htmlFor="sign-in-code">Code</Label>
              <Input
                id="sign-in-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setSentTo(undefined);
                setCode("");
                setFailure(undefined);
              }}
            >
              Use another address
            </Button>
          </form>
        ) : (
          <form
            data-part="email"
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setFailure(undefined);
              try {
                await onSendCode(address.trim());
                setSentTo(address.trim());
              } catch (error) {
                setFailure(error instanceof Error ? error.message : "Could not send a code.");
              }
              setBusy(false);
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="sign-in-email">Email address</Label>
              <Input
                id="sign-in-email"
                type="email"
                autoComplete="email"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Send me a code
            </Button>
          </form>
        ))}
      {providers
        .filter((provider) => provider !== "email")
        .map((provider) => (
          <Button
            key={provider}
            className="w-full"
            disabled={busy}
            onClick={() => run(() => onProvider(provider))}
          >
            Continue with {PROVIDER_LABELS[provider] ?? provider}
          </Button>
        ))}
      {/* Setup notes are for the developer; visitors only learn that sign-in is unavailable. */}
      {devRoles && missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sign-in with {missing.map((p) => PROVIDER_LABELS[p] ?? p).join(" and ")} is not set up
          yet: its keys are missing from the environment. See the README.
        </p>
      )}
      {!devRoles && providers.length === 0 && (
        <p className="text-muted-foreground">
          Signing in is not available right now. Please contact whoever runs {appName}.
        </p>
      )}
      {failure && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>
      )}
      {devRoles && onDevRole && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {demo ? "Try it as" : "Development only"}
          </p>
          {devRoles.map((role) => (
            <Button
              key={role}
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => run(() => onDevRole(role))}
            >
              Sign in as {role}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

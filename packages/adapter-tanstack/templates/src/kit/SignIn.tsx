// Smithable app kit: the sign-in card, with a button per sign-in provider.
// In development it also offers signing in as any role, without contacting a provider.
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";

const PROVIDER_LABELS: Record<string, string> = { google: "Google", facebook: "Facebook" };

export function SignIn({
  appName,
  providers,
  missing,
  devRoles,
  onProvider,
  onDevRole,
}: {
  appName: string;
  /** Providers that are set up, in button order. */
  providers: string[];
  /** Providers in the spec whose keys are not configured yet. */
  missing: string[];
  /** Roles to sign in as; only given in development. */
  devRoles?: string[];
  onProvider: (provider: string) => Promise<unknown>;
  onDevRole?: (role: string) => Promise<unknown>;
}) {
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
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
    <Card className="mx-auto mt-10 max-w-sm space-y-5 p-card">
      <h1 className="text-2xl font-bold tracking-tight">Sign in to {appName}</h1>
      {providers.map((provider) => (
        <Button
          key={provider}
          className="w-full"
          disabled={busy}
          onClick={() => run(() => onProvider(provider))}
        >
          Continue with {PROVIDER_LABELS[provider] ?? provider}
        </Button>
      ))}
      {missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sign-in with {missing.map((p) => PROVIDER_LABELS[p] ?? p).join(" and ")} is not set up
          yet: its keys are missing from the environment. See the README.
        </p>
      )}
      {failure && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{failure}</p>
      )}
      {devRoles && onDevRole && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Development only
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

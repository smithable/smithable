// Smithable app kit: keys for the API (docs/design/integrations.md §2), on the users page. A key
// has a name saying what it is for, a role and an optional end date; it is shown once, then only
// its first characters. Revoking it stops it at once.
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import type { RoleOption } from "./Users";
import { w } from "./words";

export interface KeyRow {
  id: number;
  name: string;
  role: string;
  prefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "—");

/** What a program needs to call the API: from the spec, like the API's description. */
export interface KeyUse {
  /** The app's name, for the assistant's settings. */
  app: string;
  /** The path under /api/v1 of the first model offered, for the call to copy. */
  path?: string;
  /** Whether the app offers tools for AI assistants at /mcp. */
  tools: boolean;
}

/**
 * Copies the text and says so. Where the browser refuses (a frame that may not write to the
 * clipboard, a page not on https), it selects the text instead, for Ctrl+C.
 */
function CopyButton({ text, shown }: { text: string; shown: RefObject<HTMLElement | null> }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          const selection = window.getSelection();
          if (shown.current && selection) selection.selectAllChildren(shown.current);
        }
      }}
    >
      {copied ? w.copied : w.copy}
    </Button>
  );
}

/** One block of text to copy, with its button. */
function Copyable({ label, text }: { label: string; text: string }) {
  const shown = useRef<HTMLPreElement>(null);
  return (
    <div className="space-y-1">
      <p className="text-sm">{label}</p>
      <div className="flex items-start gap-2">
        <pre
          ref={shown}
          className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-sm bg-muted px-3 py-2 text-xs"
        >
          {text}
        </pre>
        <CopyButton text={text} shown={shown} />
      </div>
    </div>
  );
}

/**
 * "Using a key": the addresses, a call to copy and an assistant's connection lines, with the
 * key filled in while it is shown (docs/design/api-only.md §3.2).
 */
function UsingAKey({ use, secret }: { use: KeyUse; secret?: string }) {
  // The app's address as the browser sees it, once on the page (not known on the server).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const key = secret ?? "<key>";
  const slug =
    use.app
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "app";
  return (
    <div data-part="using-a-key" className="space-y-3">
      <h3 className="text-base font-semibold">{w.usingAKey}</h3>
      <p className="text-sm text-muted-foreground">
        {w.apiIsAt} <code>{origin}/api/v1</code>, {w.describedAt}{" "}
        <code>{origin}/api/v1/openapi.json</code>.{" "}
        <a
          href="/api/v1/openapi.json"
          download="openapi.json"
          className="underline underline-offset-4"
        >
          {w.downloadDescription}
        </a>
      </p>
      {use.path && (
        <Copyable
          label={w.aFirstCall}
          text={`curl -H "Authorization: Bearer ${key}" ${origin}/api/v1/${use.path}`}
        />
      )}
      {use.tools && (
        <Copyable
          label={w.toolsAt(origin)}
          text={JSON.stringify(
            {
              mcpServers: {
                [slug]: {
                  type: "http",
                  url: `${origin}/mcp`,
                  headers: { Authorization: `Bearer ${key}` },
                },
              },
            },
            null,
            2,
          )}
        />
      )}
    </div>
  );
}

export function Keys({
  keys,
  roles,
  use,
  onMake,
  onRevoke,
}: {
  keys: KeyRow[];
  roles: RoleOption[];
  use: KeyUse;
  onMake: (name: string, role: string, until?: string) => Promise<string>;
  onRevoke: (id: number) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  // The least a key can be: an assistant's role when the app has one, else the first role that
  // is not an administrator's (admin is a choice).
  const [role, setRole] = useState(
    roles.find((r) => r.value === "assistant")?.value ??
      roles.find((r) => r.value !== "admin")?.value ??
      roles[0]?.value ??
      "",
  );
  const [until, setUntil] = useState("");
  const [made, setMade] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const label = (value: string) => roles.find((r) => r.value === value)?.label ?? value;
  const id = useId();
  const shownKey = useRef<HTMLElement>(null);
  return (
    <section data-kit="keys" className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{w.keys}</h2>
        <p className="text-sm text-muted-foreground">{w.keysLead}</p>
        {/* The preview runs on this computer: nothing outside it can call the app yet. */}
        {import.meta.env.DEV && (
          <p data-part="preview-note" className="mt-2 text-sm text-muted-foreground">
            {w.keysInPreview}
          </p>
        )}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setFailure(undefined);
          try {
            setMade(await onMake(name, role, until || undefined));
            setName("");
            setUntil("");
          } catch (error) {
            setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
          }
        }}
      >
        <label htmlFor={`${id}-name`} className="grid gap-1 text-sm">
          {w.whatItIsFor}
          <Input
            id={`${id}-name`}
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          {w.role}
          <select
            className="h-control rounded-md border border-input bg-background px-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-until`} className="grid gap-1 text-sm">
          {w.endsOptional}
          <Input
            id={`${id}-until`}
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <Button type="submit">{w.makeAKey}</Button>
      </form>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {made && (
        <Card role="status" className="space-y-2 p-card">
          <p className="text-sm font-medium">{w.copyKeyNow}</p>
          <div className="flex items-center gap-2">
            <code
              ref={shownKey}
              data-part="key"
              className="break-all rounded-sm bg-muted px-2 py-1 text-sm"
            >
              {made}
            </code>
            <CopyButton text={made} shown={shownKey} />
          </div>
          <UsingAKey use={use} secret={made} />
        </Card>
      )}
      {keys.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {keys.map((k) => (
            <li
              key={k.id}
              data-part="key-row"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="font-medium">{k.name}</span>
              <span>{label(k.role)}</span>
              <code className="text-muted-foreground">{k.prefix}…</code>
              <span className="text-muted-foreground">{w.endsOn(day(k.expiresAt))}</span>
              <span className="text-muted-foreground">{w.lastUsed(day(k.lastUsedAt))}</span>
              {k.revokedAt ? (
                <span className="ml-auto text-muted-foreground">
                  {w.revokedOn(day(k.revokedAt))}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto h-7"
                  onClick={() => {
                    if (confirm(w.revokeKey(k.name))) onRevoke(k.id);
                  }}
                >
                  {w.revoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!made && <UsingAKey use={use} />}
    </section>
  );
}

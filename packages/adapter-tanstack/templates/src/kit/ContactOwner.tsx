// Smithable app kit: "Contact the seller" on a record's page (marketplace.md §2.4). The message
// is mailed to the record's owner by the page's server function, with the sender's address as
// the reply-to; the owner's address is never shown, and nothing is kept unless the app keeps it.
// A kept model with fields of its own asks them in its own form (`form`), the landing contact
// form's; its reference to the record is filled by the server, never by the sender.
import { CircleAlert, Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input, Label } from "#/components/ui/input";
import { refusalText } from "./refusal";
import { w } from "./words";

export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

export function ContactOwner({
  recipient,
  viewer,
  onSend,
  form,
  title,
  text,
  button,
  thanks,
}: {
  /** Who receives it, as the block names them, e.g. "seller" or "owner". */
  recipient: string;
  /** The app's own words (smithable.content.yml), else the kit's. */
  title?: string;
  text?: string;
  button?: string;
  thanks?: string;
  /** The kept model's form instead of name, email and message; it calls `sent` once sent. */
  form?: (sent: (kept?: boolean) => void, button: string) => React.ReactNode;
  /** The signed-in viewer: their name and email are filled in and locked. */
  viewer?: { name: string; email: string } | null;
  /** Without `form`: resolves to whether the message stayed in the outbox (the preview sends no mail). */
  onSend?: (values: ContactValues) => Promise<{ kept?: boolean } | undefined>;
}) {
  const id = useId();
  const [values, setValues] = useState<ContactValues>({
    name: viewer?.name ?? "",
    email: viewer?.email ?? "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "kept">("idle");
  const [failure, setFailure] = useState<string>();
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setFailure(undefined);
    try {
      setState((await onSend?.(values))?.kept ? "kept" : "sent");
    } catch (error) {
      setFailure(refusalText(error, w.messageNotSent));
      setState("idle");
    }
  }
  return (
    <Card data-kit="contact-owner" className="mt-10 max-w-3xl p-card">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title ?? w.contactThe(recipient)}
      </h2>
      {text && <p className="mt-2 whitespace-pre-line text-muted-foreground">{text}</p>}
      {state === "sent" || state === "kept" ? (
        <p role="status" className="mt-4">
          {state === "kept" ? w.messageKept : (thanks ?? w.messageSent)}
        </p>
      ) : form ? (
        <div className="mt-4">
          {form((kept) => setState(kept ? "kept" : "sent"), button ?? w.send)}
        </div>
      ) : (
        <form onSubmit={send} aria-labelledby={`${id}-title`} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>{w.yourName}</Label>
              <Input
                id={`${id}-name`}
                required
                maxLength={200}
                readOnly={Boolean(viewer)}
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>{w.yourEmail}</Label>
              <Input
                id={`${id}-email`}
                type="email"
                required
                maxLength={200}
                readOnly={Boolean(viewer)}
                value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-message`}>{w.message}</Label>
            <textarea
              id={`${id}-message`}
              required
              maxLength={2000}
              rows={4}
              value={values.message}
              onChange={(e) => setValues({ ...values, message: e.target.value })}
              className="w-full rounded-md border border-input bg-card px-3 py-2"
            />
          </div>
          {failure && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert aria-hidden className="size-4" /> {failure}
            </p>
          )}
          <Button type="submit" disabled={state === "sending"}>
            <Send aria-hidden className="size-4" />{" "}
            {state === "sending" ? w.sending : (button ?? w.send)}
          </Button>
        </form>
      )}
    </Card>
  );
}

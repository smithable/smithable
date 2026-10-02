// Smithable app kit: "Contact the seller" on a record's page (marketplace.md §2.4). The message
// is mailed to the record's owner by the page's server function, with the sender's address as
// the reply-to; the owner's address is never shown, and nothing is kept unless the app keeps it.
import { CircleAlert, Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input, Label } from "#/components/ui/input";

export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

export function ContactOwner({
  recipient,
  viewer,
  onSend,
}: {
  /** Who receives it, as the block names them, e.g. "seller" or "owner". */
  recipient: string;
  /** The signed-in viewer: their name and email are filled in and locked. */
  viewer?: { name: string; email: string } | null;
  onSend: (values: ContactValues) => Promise<unknown>;
}) {
  const id = useId();
  const [values, setValues] = useState<ContactValues>({
    name: viewer?.name ?? "",
    email: viewer?.email ?? "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<string>();
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setFailure(undefined);
    try {
      await onSend(values);
      setState("sent");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The message could not be sent.");
      setState("idle");
    }
  }
  return (
    <Card data-kit="contact-owner" className="mt-10 max-w-3xl p-card">
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        Contact the {recipient}
      </h2>
      {state === "sent" ? (
        <p role="status" className="mt-4">
          Your message is sent.
        </p>
      ) : (
        <form onSubmit={send} aria-labelledby={`${id}-title`} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>Your name</Label>
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
              <Label htmlFor={`${id}-email`}>Your email</Label>
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
            <Label htmlFor={`${id}-message`}>Message</Label>
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
            <Send aria-hidden className="size-4" /> {state === "sending" ? "Sending…" : "Send"}
          </Button>
        </form>
      )}
    </Card>
  );
}

// The app card in Studio (A 233, docs/design/app-card.md): the page `smithable card` writes, for a
// client, an auditor or a buyer, shown as it is and written again whenever the spec changes.
// Copy as Markdown and Download as HTML give the same card the command line gives.
import type { SpecIR } from "@smithable/core";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Button } from "../ui";

export function Card({ ir }: { ir: SpecIR }) {
  const [card, setCard] = useState<{ md: string; html: string } | { error: string }>();
  const [copied, setCopied] = useState(false);
  // A new spec is a new IR: the card is written again from the files.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ir is the signal, not an input
  useEffect(() => {
    let current = true;
    api.card().then(
      (c) => current && setCard(c),
      (e: unknown) => current && setCard({ error: e instanceof Error ? e.message : String(e) }),
    );
    setCopied(false);
    return () => {
      current = false;
    };
  }, [ir]);
  if (!card) return null;
  if ("error" in card) return <p className="p-3 text-sm text-quiet">{card.error}</p>;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([card.html], { type: "text/html" }));
    a.download = "app-card.html";
    a.click();
    // Some browsers start the download after click returns: the file is let go a moment later.
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() =>
            void navigator.clipboard.writeText(card.md).then(
              () => setCopied(true),
              () => {},
            )
          }
        >
          {copied ? "Copied" : "Copy as Markdown"}
        </Button>
        <Button variant="ghost" onClick={download}>
          Download as HTML
        </Button>
      </div>
      {/* Its own page, with no scripts and its own light colours, as the downloaded file looks. */}
      <iframe
        title="App card"
        sandbox=""
        srcDoc={card.html}
        className="min-h-0 flex-1 rounded border border-line bg-white"
      />
    </div>
  );
}

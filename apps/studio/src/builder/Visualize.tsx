// Studio's Visualize (A 150, Johan 2026-10-24): the app map's three views in a place of their own,
// the whole window below the header: the kinds of record and how they refer to each other, the
// menus and pages, and what happens by itself or at a button. A name opens it in No code.
import type { AuthIR, SpecIR } from "@smithable/core";
import { useState } from "react";
import { Tabs } from "../ui";
import { BehaviourMap } from "./BehaviourMap";
import { DataMap } from "./DataMap";
import { NavMap } from "./NavMap";

type View = "data" | "nav" | "acts";

export function Visualize({
  ir,
  auth,
  onOpen,
}: {
  ir?: SpecIR;
  auth?: AuthIR;
  /** Opens a part ("model:Customer") in No code's Behavior, leaving Visualize. */
  onOpen: (concept: string) => void;
}) {
  const [view, setView] = useState<View>("data");
  return (
    <section aria-label="Visualize" className="flex h-full min-h-0 flex-col bg-panel">
      <div className="border-b border-line px-3 pt-1">
        <Tabs
          tabs={[
            ["data", "Data map"],
            ["nav", "Navigation"],
            ["acts", "What happens"],
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <div className="min-h-0 flex-1">
        {!ir ? (
          <p className="p-3 text-sm text-quiet">The spec has errors; fix them in Code mode.</p>
        ) : view === "data" ? (
          <DataMap ir={ir} auth={auth} onOpen={onOpen} />
        ) : view === "nav" ? (
          <NavMap ir={ir} auth={auth} onOpen={onOpen} />
        ) : (
          <BehaviourMap ir={ir} onOpen={onOpen} />
        )}
      </div>
    </section>
  );
}

// The app map as Mermaid (A 127, docs/design/app-map.md): the same content the views draw, as a
// flowchart to paste into a document or an issue. No layout of its own: Mermaid lays it out.
import type { BehaviourEdge, BehaviourNode } from "./behaviour-map";
import type { MapEdge, MapNode } from "./data-map";
import type { NavPage, Verdict } from "./nav-map";

/** A label in quotes, Mermaid's way: a quote as its entity, line breaks as <br/>. */
const text = (s: string) => `"${s.replaceAll('"', "#quot;")}"`;
/** An id Mermaid takes: letters, digits and _ only. */
const id = (prefix: string, name: string) => `${prefix}_${name.replace(/\W/g, "_")}`;

export function dataMermaid(map: { nodes: MapNode[]; edges: MapEdge[] }): string {
  const lines = ["flowchart TB"];
  for (const n of map.nodes)
    lines.push(
      `  ${id("m", n.id)}[${text(`${n.id}<br/>${n.fields.length} field${n.fields.length === 1 ? "" : "s"}${n.madeBy ? "<br/>each is its maker's own" : ""}`)}]`,
    );
  for (const e of map.edges) {
    const label = text(e.kind === "owner" ? `${e.label} (owns it)` : e.label);
    lines.push(
      `  ${id("m", e.source)} ${e.kind === "owner" ? "-.->" : "-->"}|${label}| ${id("m", e.target)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

const WORD: Record<Verdict, string> = { allowed: "yes", denied: "no", conditional: "depends" };

export function navMermaid(nav: { menus: string[]; pages: NavPage[] }, who: string): string {
  const lines = ["flowchart TB", `  app((${text(`The app, as ${who}`)}))`];
  nav.menus.forEach((menu, i) => {
    lines.push(`  menu_${i}[${text(`Menu: ${menu}`)}]`, `  app --> menu_${i}`);
  });
  for (const p of nav.pages) {
    lines.push(
      `  ${id("p", p.id)}[${text(`${p.id}<br/>opens: ${WORD[p.open]}${p.read ? `<br/>reads ${p.model}: ${WORD[p.read]}` : ""}`)}]`,
    );
    const menu = p.menu === undefined ? -1 : nav.menus.indexOf(p.menu);
    lines.push(menu >= 0 ? `  menu_${menu} --> ${id("p", p.id)}` : `  app -.-> ${id("p", p.id)}`);
  }
  return `${lines.join("\n")}\n`;
}

const SHAPE: Record<BehaviourNode["kind"], [string, string]> = {
  model: ["[", "]"],
  action: ["(", ")"],
  custom: ["[[", "]]"],
  timer: ["([", "])"],
  outgoing: [">", "]"],
};

export function behaviourMermaid(map: { nodes: BehaviourNode[]; edges: BehaviourEdge[] }): string {
  const lines = ["flowchart TB"];
  for (const n of map.nodes) {
    const [open, close] = SHAPE[n.kind];
    lines.push(`  ${id("b", n.id)}${open}${text([n.title, ...n.lines].join("<br/>"))}${close}`);
  }
  for (const e of map.edges)
    lines.push(
      `  ${id("b", e.source)} -->${e.label ? `|${text(e.label)}|` : ""} ${id("b", e.target)}`,
    );
  return `${lines.join("\n")}\n`;
}

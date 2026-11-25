// Studio's words for the AI badge (docs/design/picture-kinds.md §1, §3 and §4), the overlay's in
// their reviewed wording.
import type { PictureKind } from "@smithable/core";

export const KIND_WORDS: Record<PictureKind, string> = {
  "ai-realistic": "AI pictures that look real",
  "ai-drawn": "AI pictures that are drawn",
  photograph: "Real photographs",
};

export const BADGE_WORDS = {
  mayBeNeeded: "An AI badge may be needed",
  explain: "What the AI badge is",
  notYet: "not yet",
  overlayTitle: "The AI badge",
  overlay: [
    "The badge is one of the EU's icons for labelling content made or altered by AI: on a large picture the icon with its words, on a small one the icon alone.",
    "It comes from the EU's Code of Practice on Transparency of AI-generated Content. This icon is optional, even where the EU's AI Act requires that people are told.",
    "Studio's preview hides it. The published app shows it by default on AI pictures that look real, not on drawn ones. That default is Smithable's choice, not a reading of the law.",
    "You can switch it off. Where the EU's AI Act applies, it requires that people are told when a picture made or altered by AI resembles an existing person, place, object, entity or event and would falsely appear authentic. Studio cannot judge whether a picture meets that test.",
    "Each picture's file says in its own metadata that an AI made it, whatever the switch says.",
  ],
  rule: "https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content",
  close: "Close",
  switchLabel: "AI badge",
  byKind: "By each picture's kind",
  on: "On every AI picture",
  off: "Off",
  confirmOff: "Switching the badge off does not change what the EU's AI Act requires.",
  confirmOffYes: "Switch it off",
  confirmOffNo: "Keep it",
  showHere: "Show AI badges here",
  kindLabel: "Kind of pictures",
  marked: "Pictures made by an image model carry the AI badge in this app.",
  markedByKind:
    "These pictures carry the AI badge in the published app, as pictures that look real.",
  drawnUnmarked: "Drawn pictures carry no AI badge unless you switch it on for every AI picture.",
  markOff: "The AI badge is off in this app.",
} as const;

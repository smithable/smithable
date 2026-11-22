// Studio's words for the AI badge (docs/design/picture-kinds.md §1, §3 and §4). PLACEHOLDER: the
// overlay's wording is reviewed (Fable's wording task) before it ships; only this file changes then.
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
    "The badge is the EU's common label for content an AI made: on a large picture the label with its words, on a small one the icon alone.",
    "It comes from the EU's code of practice on marking and labelling AI-generated content.",
    "Studio's preview hides it. The published app shows it by default on AI pictures that look real, not on drawn ones.",
    "You can switch it off. Whether your audience must be told an AI made a picture is your responsibility.",
    "Each picture's file says in its own metadata that an AI made it, whatever the switch says.",
  ],
  // The rule's own page, set with the reviewed wording; no link is drawn while it is empty.
  rule: "",
  close: "Close",
  switchLabel: "AI badge",
  byKind: "By each picture's kind",
  on: "On every AI picture",
  off: "Off",
  confirmOff:
    "The app has AI pictures that look real. Whether its audience must be told an AI made them is your responsibility.",
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

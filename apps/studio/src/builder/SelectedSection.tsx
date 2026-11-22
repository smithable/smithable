import { humanize, SECTION_LOOKS, sectionTakesPicture, stagePage } from "@smithable/core";
import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Spec } from "../engine";
import { LookSession } from "../first-look";
import type { Selection } from "../preview";
import { Button, useMedia } from "../ui";
import { SectionPicture } from "./SectionPicture";
import { SectionSketch } from "./SectionSketch";

/** A hero's layouts by what they look like (docs/spec/v0.1.md, sections); the two across the width say so. */
const HERO_LAYOUTS: Record<string, string> = {
  split: "Picture beside text",
  centered: "Text over picture",
  plain: "Text only",
  cover: "Full width, brand color",
  photo: "Full width photo",
  inset: "Picture as a card",
  stage: "Beside a list",
  tiles: "Picture with tiles",
};
/** The looks a section's form offers, in this order: the ones that change its arrangement. */
const KEYS: Record<string, string> = {
  layout: "Layout",
  columns: "Columns",
  image: "Picture side",
  height: "Height",
  band: "Background",
  mark: "Heading",
};
const HEIGHTS: Record<string, string> = {
  default: "Layout's own",
  auto: "Content's",
  full: "Full window",
};

/** A landing section picked in the preview ("section:<page>.<section>"), with the looks it takes. */
export function selectedSection(selection: Selection | undefined, spec: Spec) {
  const picked = /^section:([^.]+)\.(.+)$/.exec(selection?.concept ?? "");
  if (!picked || !spec.ir) return;
  const [, page = "", name = ""] = picked;
  const sections = spec.ir.pages.find((item) => item.id === page)?.sections;
  const section =
    sections?.find((item) => item.name === name) ??
    (name === "@footer" ? sections?.find((item) => item.kind === "footer") : undefined);
  if (!section) return;
  const sectionName = section.name;
  const looks = SECTION_LOOKS[section.kind] ?? {};
  const look = (spec.ux?.pages[page]?.looks?.[sectionName] ?? {}) as Record<string, unknown>;
  const layout = String(look.layout ?? (Array.isArray(looks.layout) ? looks.layout[0] : ""));
  // A hero's tiles are its two or three shortcuts, and its stage a list everyone sees: a layout
  // the section cannot take is not offered (T1196), unless it is the one it has.
  const ir = spec.ir;
  const shortcuts = (section as { shortcuts?: string[] }).shortcuts?.length ?? 0;
  const applies = (key: string, value: string) =>
    section.kind !== "hero" ||
    key !== "layout" ||
    value === layout ||
    (value === "tiles"
      ? shortcuts >= 2 && shortcuts <= 3
      : value !== "stage" || Boolean(stagePage(ir)));
  const choices = Object.keys(KEYS).flatMap((key) => {
    const all = looks[key];
    if (!Array.isArray(all)) return [];
    if (key === "mark" && !spec.content?.logo)
      return look.mark === "logo" ? [{ key, values: ["title"], current: "logo" }] : [];
    const values = all.filter((value) => applies(key, String(value)));
    // A hero's picture has a side only beside its text.
    if (section.kind === "hero" && key === "image" && !["split", "inset"].includes(layout))
      return [];
    // Unsaid, a height is the layout's own: a choice of its own ("default" removes the look).
    if (key === "height")
      return [
        {
          key,
          values: ["default", ...values.map(String)],
          current: String(look[key] ?? "default"),
        },
      ];
    const current = look[key] ?? (key === "band" ? "none" : values[0]);
    return [{ key, values: values.map(String), current: String(current) }];
  });
  const content = spec.content?.pages[page]?.sections?.[sectionName];
  const itemPictures =
    section.kind === "features"
      ? (content?.items ?? []).map((item, index) => ({
          index,
          label: typeof item.title === "string" ? item.title : `Feature ${index + 1}`,
          image:
            typeof item.image === "object" && !Array.isArray(item.image) ? item.image : undefined,
        }))
      : [];
  return {
    page,
    section: sectionName,
    kind: section.kind,
    label: selection?.label?.trim() || humanize(sectionName),
    choices,
    // A section with a picture of its own, and the one it has (none: the section shows its text).
    itemPictures,
    picture: sectionTakesPicture(section.kind) ? { image: content?.image } : undefined,

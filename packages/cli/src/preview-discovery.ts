import { previewRecordPath } from "@smithable/core";
/** Reads only candidates the authorized page has already rendered. No click, lookup, or write. */
export const RECORD_PROBE = `(base) => (${previewRecordPath.toString()})(base,
  [...document.querySelectorAll('[data-part="record-open"][data-record-id]')].slice(0,200).map(e => e.dataset.recordId),
  [...document.querySelectorAll('[data-part="record-link"][href]')].slice(0,200).flatMap(e => { try { const url = new URL(e.getAttribute('href'),location.origin); return url.origin === location.origin && !url.search && !url.hash ? [url.pathname] : []; } catch { return []; } }))`;

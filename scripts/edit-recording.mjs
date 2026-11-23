// Edits a take from record-undo.mjs or record-assistant.mjs for the site: trims it to its first
// moment, writes the moments' captions as a WebVTT file (shown by the site's player, not burned
// in), and exports MP4 (H.264) and WebM (VP9), both without sound. A caption shorter than
// --min-cue seconds is joined with the next, so each can be read. Needs ffmpeg on the PATH.
// Run: `node scripts/edit-recording.mjs <take dir> <name> [--out <dir>] [--min-cue 1.5]`, where
// <take dir> holds <name>.webm and <name>.json. Writes <name>.mp4, <name>.webm, <name>.en.vtt and
// <name>-poster.png. Not part of `check`.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, "min-cue": { type: "string", default: "1.5" } },
});
const [dir, name] = positionals;
if (!dir || !name)
  throw new Error("Usage: node scripts/edit-recording.mjs <take dir> <name> [--out <dir>]");
const out = opts.out ?? join(dir, "edited");
const minCue = Number(opts["min-cue"]);
mkdirSync(out, { recursive: true });

const { moments } = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));
const start = Math.max(0, moments[0].at - 0.5);
const end = moments.at(-1).at;

// Each caption shows from its moment to the next; a short one is joined with the one after it.
const cues = [];
for (const [i, m] of moments.entries()) {
  if (!m.caption) continue;
  const next = moments[i + 1]?.at ?? end;
  const last = cues.at(-1);
  if (last && last.to - last.from < minCue)
    Object.assign(last, { to: next, text: `${last.text}. ${m.caption}` });
  else cues.push({ from: m.at, to: next, text: m.caption });
}
const stamp = (s) => {
  const t = Math.max(0, s - start);
  const h = String(Math.floor(t / 3600)).padStart(2, "0");
  const min = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  return `${h}:${min}:${(t % 60).toFixed(3).padStart(6, "0")}`;
};
const vtt = cues.map((c) => `${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`).join("\n");
writeFileSync(join(out, `${name}.en.vtt`), `WEBVTT\n\n${vtt}`);

const ffmpeg = (...args) => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: "inherit",
  });
  if (run.status !== 0) throw new Error(`ffmpeg failed (${run.status ?? run.signal})`);
};
const input = [
  "-i",
  join(dir, `${name}.webm`),
  "-ss",
  start.toFixed(3),
  "-to",
  end.toFixed(3),
  "-an",
];
ffmpeg(
  ...input,
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "22",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  join(out, `${name}.mp4`),
);
ffmpeg(
  ...input,
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "33",
  "-b:v",
  "0",
  "-row-mt",
  "1",
  join(out, `${name}.webm`),
);
// The poster is the last captioned moment: the result the take shows.
const poster = moments.findLast((m) => m.caption).at + 1;
ffmpeg(
  "-ss",
  Math.min(poster, end - 0.1).toFixed(3),
  "-i",
  join(dir, `${name}.webm`),
  "-frames:v",
  "1",
  join(out, `${name}-poster.png`),
);
console.log(`Edited ${name}: ${(end - start).toFixed(1)} s, ${cues.length} captions, in ${out}`);

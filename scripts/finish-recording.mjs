// Finishes a take of record-undo.mjs or record-assistant.mjs for the site (T722): cut to its
// moments, captions as WebVTT files the site's player shows (English, then Swedish), and the video as
// MP4 (H.264) and WebM (VP9), with no sound. --social adds an MP4 with the English captions burned
// in, for social media only; the site never burns them in. Needs ffmpeg (FFMPEG names another one);
// without it, only the caption files are written and it exits 1.
// Run: `node scripts/finish-recording.mjs <take dir> [--out <dir>] [--social]`, where the take dir
// holds undo.webm and undo.json, or assistant.webm and assistant.json. Not part of `check`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" }, social: { type: "boolean", default: false } },
});
const take = positionals[0];
if (!take) throw new Error("Usage: finish-recording.mjs <take dir> [--out <dir>] [--social]");
const name = ["undo", "assistant"].find((n) => existsSync(join(take, `${n}.json`)));
if (!name) throw new Error(`${take} holds neither undo.json nor assistant.json`);
const out = opts.out ?? take;
mkdirSync(out, { recursive: true });

// The Swedish captions, by take and moment; the English ones come with the take.
const SWEDISH = {
  undo: {
    "the app as it is": "Tre instruktörer, var och en med ett telefonnummer",
    "a change removes the field": "En ändring tar bort telefonfältet",
    "the warning": "Studio säger att tre nummer följer med",
    "the numbers are gone": "Fältet och dess nummer är borta",
    "one Undo": "Ett klick på Undo",
    "back as before": "Samma nummer är tillbaka",
  },
  assistant: {
    "the app as it is": "Studions schema, live",
    "the ask": "Receptionen frågar Claude, som bara har appens verktyg",
    "the class is added": "Appen lägger till passet: det syns i schemat",
    "the refusal": "Receptionen får inte ändra en lärare: appen säger nej",
    "the answer": "Claude säger vad som gjordes och vad som nekades",
  },
};

const { moments } = JSON.parse(readFileSync(join(take, `${name}.json`), "utf8"));
const end = moments.find((m) => m.name === "end");
if (!end) throw new Error(`${name}.json has no "end" moment`);
const start = Math.max(0, moments[0].at - 0.5);
const stop = end.at + 1;
const time = (s) => {
  const ms = Math.round(Math.max(0, s - start) * 1000);
  const hh = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const mm = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
  const ss = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${String(ms % 1000).padStart(3, "0")}`;
};
const cues = moments
  .map((m, i) => ({ ...m, until: moments[i + 1]?.at ?? stop }))
  .filter((m) => m.caption);
const vtt = (text) =>
  `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${time(c.at)} --> ${time(c.until)}\n${text(c)}\n`).join("\n")}`;
const missing = cues.filter((c) => !SWEDISH[name]?.[c.name]).map((c) => c.name);
if (missing.length) throw new Error(`No Swedish caption for: ${missing.join(", ")}`);
writeFileSync(
  join(out, `${name}.en.vtt`),
  vtt((c) => c.caption),
);
writeFileSync(
  join(out, `${name}.sv.vtt`),
  vtt((c) => SWEDISH[name][c.name]),
);
console.log(
  `${name}: ${cues.length} captions, ${time(stop)} long; ${name}.en.vtt and ${name}.sv.vtt`,
);

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
if (spawnSync(ffmpeg, ["-version"]).status !== 0) {
  console.error(`No ffmpeg (${ffmpeg}): only the captions were written.`);
  process.exit(1);
}
const run = (args) => {
  const r = spawnSync(ffmpeg, ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status}) on ${args.at(-1)}`);
};
const cut = ["-ss", String(start), "-to", String(stop), "-i", join(take, `${name}.webm`), "-an"];
const mp4 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart"];
run([...cut, ...mp4, join(out, `${name}.mp4`)]);
run([...cut, "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", join(out, `${name}.site.webm`)]);
if (opts.social) {
  // The filter reads the path itself: a folder name with a colon or quote would need escaping.
  const subs = join(out, `${name}.en.vtt`).replace(/[:'\\]/g, "\\$&");
  run([...cut, "-vf", `subtitles='${subs}'`, ...mp4, join(out, `${name}-social.mp4`)]);
}
console.log(
  `${name}: ${name}.mp4 and ${name}.site.webm${opts.social ? `, ${name}-social.mp4` : ""} in ${out}`,
);

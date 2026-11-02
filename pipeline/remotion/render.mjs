#!/usr/bin/env node
// Usage: node pipeline/remotion/render.mjs <props.json> <out> [compositionId=Short] [--alpha]
// props.json's directory is used as publicDir. --alpha renders ProRes 4444 with transparency (.mov).
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const alpha = argv.includes("--alpha");
const [propsPath, out] = argv.filter((a) => !a.startsWith("--")).slice(0, 2).map((p) => path.resolve(p));
const id = argv.filter((a) => !a.startsWith("--"))[2] || "Short";
// Remotion's bundler resolves packages relative to cwd; run from this folder or the root component never loads.
process.chdir(here);
// Batch mode: props.json = {"batch": [{"id", "props", "out", "alpha", "still"}]} renders many from one bundle (still = frame -> PNG).
const data = JSON.parse(fs.readFileSync(propsPath, "utf8"));
const jobs = data.batch
  ? data.batch.map((j) => ({ id: j.id, inputProps: j.props, out: path.resolve(path.dirname(propsPath), j.out), alpha: !!j.alpha, still: j.still }))
  : [{ id, inputProps: data, out, alpha }];
const serveUrl = await bundle({ entryPoint: path.join(here, "src/index.ts"), publicDir: path.dirname(propsPath) });
const onBrowserLog = (l) => { if (l.type === "error" || process.env.DEBUG) console.error("[browser]", l.type, l.text); };
for (const job of jobs) {
  const composition = await selectComposition({ serveUrl, id: job.id, inputProps: job.inputProps, onBrowserLog, timeoutInMilliseconds: 60000 });
  if (job.still !== undefined) {
    // Still image (PNG): {"still": frameNumber} — render the settled final frame of an animated layout
    await renderStill({ composition, serveUrl, onBrowserLog, output: job.out, inputProps: job.inputProps, frame: job.still, imageFormat: "png", timeoutInMilliseconds: 60000 });
    console.log("wrote", job.out);
    continue;
  }
  const fmt = job.alpha
    ? { codec: "prores", proResProfile: "4444", pixelFormat: "yuva444p10le", imageFormat: "png" }
    : { codec: "h264", crf: 18, audioBitrate: "192k" };
  let last = -1;
  await renderMedia({
    composition, serveUrl, onBrowserLog, outputLocation: job.out, inputProps: job.inputProps, ...fmt, timeoutInMilliseconds: 60000,
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; console.log(`render ${p * 10}%`); } },
  });
  console.log("wrote", job.out);
}

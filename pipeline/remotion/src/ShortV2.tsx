import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from "remotion";
import type { Word, Shot } from "./types";
import { ACCENT } from "./brand";
import { useFonts2, SERIF, SANS } from "./useFonts2";
import { GraphicView, Graphic, INK2, PAPER, Rich } from "./Graphics";

// "Editorial" short: the speaker lives in a card that morphs between full-bleed, a framed card and a small
// picture-in-picture while explainer graphics take over. Captions are word-by-word serif with accent keywords.

export type Scene = { startMs: number; mode: "full" | "card" | "graphic"; graphic?: Graphic };
export type ShortV2Props = {
  src: string;
  durationInFrames: number;
  words: Word[];
  shots: Shot[];
  scenes: Scene[];
  emphasis: string[];
  hook?: { text: string; endMs: number };
  outro?: { text: string; startMs: number };
  faces?: Face[];
};

// Face track from pipeline/face_track.py (normalised to the source frame).
export type Face = { ms: number; cx: number; cy: number; s: number; cut?: boolean };
export function faceAt(faces: Face[] | undefined, ms: number): Face {
  if (!faces || !faces.length) return { ms, cx: 0.5, cy: 0.36, s: 0.3 };
  let i = faces.findIndex((f) => f.ms > ms);
  if (i === -1) return faces[faces.length - 1];
  if (i === 0) return faces[0];
  const a = faces[i - 1], b = faces[i];
  if (b.cut) return a; // snap on camera cuts
  const t = (ms - a.ms) / (b.ms - a.ms);
  return { ms, cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, s: a.s + (b.s - a.s) * t };
}

// Place a 1080x1920 source inside a rect so it covers it; with weight `fit` (0..1) zoom so the face fills
// `faceFrac` of the rect height and centre it. Always clamped so the rect never shows an edge.
export function frameVideo(rect: { w: number; h: number }, face: Face, zoom: number, fit: number, faceFrac = 0.5, srcW = 1080, srcH = 1920) {
  const cover = Math.max(rect.w / srcW, rect.h / srcH) * zoom;
  const faceS = (faceFrac * rect.h) / (face.s * srcH);
  const S = Math.max(cover, cover + (faceS - cover) * fit);
  const tgtY = rect.h * (0.38 + 0.12 * fit); // card/full: eyes high in frame; PiP: face centred
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(rect.w / 2 - S * face.cx * srcW, rect.w - S * srcW, 0);
  const ty = clamp(tgtY - S * face.cy * srcH, rect.h - S * srcH, 0);
  return { S, tx, ty };
}

type Rect = { x: number; y: number; w: number; h: number; r: number };
const RECTS: Record<Scene["mode"], Rect> = {
  full: { x: 0, y: 0, w: 1080, h: 1920, r: 0 },
  card: { x: 70, y: 230, w: 940, h: 1080, r: 44 },
  graphic: { x: 790, y: 100, w: 240, h: 240, r: 120 },
};
const MORPH = 10; // frames

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$,.]/g, "").replace(/[.,]$/, "");

function paginate(words: Word[]): Word[][] {
  const pages: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const len = cur.map((c) => c.text).join(" ").length + w.text.length;
    if (prev && (cur.length >= 5 || len > 24 || w.speaker !== prev.speaker || w.startMs - prev.endMs > 400 || /[.?!,]$/.test(prev.text))) {
      pages.push(cur); cur = [];
    }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export const ShortV2: React.FC<ShortV2Props> = ({ src, words, shots, scenes, emphasis, hook, outro, faces }) => {
  useFonts2();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const toF = (m: number) => Math.round((m / 1000) * fps);

  // current + previous scene for the morph
  let si = 0;
  scenes.forEach((s, i) => { if (ms >= s.startMs) si = i; });
  const scene = scenes[si];
  const prev = scenes[si - 1];
  const sf = frame - toF(scene.startMs);
  const k = prev ? interpolate(sf, [0, MORPH], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) : 1;
  const A = prev ? RECTS[prev.mode] : RECTS[scene.mode], B = RECTS[scene.mode];
  const rect: Rect = { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k, w: A.w + (B.w - A.w) * k, h: A.h + (B.h - A.h) * k, r: A.r + (B.r - A.r) * k };
  const fullness = scene.mode === "full" ? k : prev?.mode === "full" ? 1 - k : 0; // 1 = full-bleed look

  const shot = shots.find((s) => ms >= s.startMs && ms < s.endMs);
  const pipW = scene.mode === "graphic" ? k : prev?.mode === "graphic" ? 1 - k : 0;
  const zoom = (shot ? shot.scale : 1) * (scene.mode === "full" ? interpolate(sf, [0, 90], [1.0, 1.05], { extrapolateRight: "clamp" }) : 1);

  const vf = frameVideo(rect, faceAt(faces, ms), zoom, pipW, 0.55);

  // graphic (keep the outgoing one around briefly so it can exit)
  const gScene = scene.mode === "graphic" ? scene : prev?.mode === "graphic" && sf < MORPH ? prev : undefined;
  const gIn = gScene === scene;
  const gf = gIn ? sf : frame - toF(gScene?.startMs ?? 0);
  const gOut = gIn ? 0 : interpolate(sf, [0, MORPH], [0, 1], { extrapolateRight: "clamp" });

  // captions
  const emph = React.useMemo(() => new Set(emphasis.map(norm)), [emphasis]);
  const pages = React.useMemo(() => paginate(words), [words]);
  const pi = pages.findIndex((p, i) => {
    const end = Math.min(pages[i + 1]?.[0].startMs ?? Infinity, p[p.length - 1].endMs + 500);
    return ms >= p[0].startMs - 60 && ms < end;
  });
  const page = pages[pi];
  const onDark = fullness > 0.5;
  const capTop = onDark ? 1310 : scene.mode === "card" ? 1370 : 1340;

  const hookOn = hook && ms < hook.endMs + 300;
  const outroOn = outro && ms >= outro.startMs;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${PAPER} 0%, #E4DFD6 70%, #D2CCC1 100%)` }}>
      {/* speaker */}
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.r, overflow: "hidden",
                    boxShadow: fullness > 0.99 ? "none" : "0 40px 90px rgba(30,25,20,.25), 0 10px 24px rgba(30,25,20,.12)",
                    border: scene.mode === "graphic" && k > 0.5 ? `6px solid ${ACCENT}` : "none" }}>
        <OffthreadVideo src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0",
          transform: `translate(${vf.tx}px, ${vf.ty}px) scale(${vf.S})` }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)", opacity: fullness }} />
      </div>

      {/* explainer graphic */}
      {gScene?.graphic && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: -230, opacity: 1 - gOut, transform: `translateY(${-gOut * 80}px) scale(${1 - gOut * 0.05})` }}>
          <GraphicView g={gScene.graphic} f={gf} />
        </AbsoluteFill>
      )}

      {/* hook */}
      {hookOn && (() => {
        const s = spring({ frame, fps, config: { damping: 13, stiffness: 120 } });
        const out = interpolate(ms, [hook!.endMs, hook!.endMs + 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{ position: "absolute", top: 150, left: 60, right: 60, textAlign: "center", fontFamily: SERIF, fontSize: 104, lineHeight: 1.0, letterSpacing: -1.5,
                        color: "white", textShadow: "0 6px 30px rgba(0,0,0,.55)", opacity: s * (1 - out), transform: `translateY(${(1 - s) * -40}px) scale(${0.95 + 0.05 * s})` }}>
            <Rich text={hook!.text} />
          </div>
        );
      })()}

      {/* captions */}
      {page && (
        <div style={{ position: "absolute", top: capTop, left: 60, right: 60, textAlign: "center", fontFamily: SERIF, fontSize: 104, lineHeight: 1.02, letterSpacing: -1.5,
                      color: onDark ? "white" : INK2, textShadow: onDark ? "0 4px 24px rgba(0,0,0,.6)" : "none" }}>
          {page.map((w, i) => {
            const wf = frame - toF(w.startMs);
            if (wf < -1) return null; // reveal word-by-word; the line re-centres as it grows
            const s = spring({ frame: wf, fps, config: { damping: 15, stiffness: 220, mass: 0.5 } });
            const e = emph.has(norm(w.text));
            return (
              <span key={i} style={{ display: "inline-block", marginRight: 24, opacity: Math.min(1, s * 1.6),
                                     transform: `translateY(${(1 - s) * 26}px)`, fontSize: e ? "1.12em" : undefined,
                                     fontStyle: e ? "italic" : "normal", color: e ? ACCENT : undefined, transformOrigin: "50% 80%" }}>
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* end card */}
      {outroOn && (() => {
        const f = frame - toF(outro!.startMs);
        const s = spring({ frame: f, fps, config: { damping: 14 } });
        return (
          <AbsoluteFill style={{ background: INK2, opacity: Math.min(1, s * 1.4), justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
            <div style={{ fontFamily: SERIF, fontSize: 120, color: "white", textAlign: "center", lineHeight: 1, padding: "0 70px", transform: `translateY(${(1 - s) * 40}px)` }}>
              <Rich text={outro!.text} />
            </div>
            <div style={{ marginTop: 60, fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: 10, color: ACCENT, opacity: spring({ frame: f - 8, fps }) }}>FRINGE LINES</div>
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
};

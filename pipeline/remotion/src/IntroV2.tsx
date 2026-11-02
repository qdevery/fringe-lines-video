import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { ACCENT } from "./brand";
import { useFonts2, SERIF, SANS } from "./useFonts2";
import { GraphicView, Graphic, INK2, PAPER, Rich } from "./Graphics";
import type { Word } from "./types";

// Editorial cold open (16:9): fast clips, keyword captions, cutaways where the speaker shrinks into a card on
// the left while an explainer graphic lands on the right, whip transitions with whoosh/pop SFX, then a title card.

export type IntroV2Clip = { src: string; durationInFrames: number; words: Word[]; tag: string; graphic?: Graphic; graphicAtMs?: number; graphicUntilMs?: number };
export type IntroV2Props = { clips: IntroV2Clip[]; title: string; subtitle: string; topics: string[]; titleFrames: number; durationInFrames: number; emphasis: string[]; sfx?: boolean };

const WHIP = 7;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$,.]/g, "").replace(/[.,]$/, "");

type Rect = { x: number; y: number; w: number; h: number; r: number };
const FULL: Rect = { x: 0, y: 0, w: 1920, h: 1080, r: 0 };
const SIDE: Rect = { x: 90, y: 170, w: 600, h: 740, r: 40 };
const lerp = (a: Rect, b: Rect, k: number): Rect => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, r: a.r + (b.r - a.r) * k });

const Captions: React.FC<{ words: Word[]; emph: Set<string>; dark: boolean; left: number }> = ({ words, emph, dark, left }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const pages: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const len = cur.map((c) => c.text).join(" ").length + w.text.length;
    if (cur.length && (cur.length >= 3 || len > 22 || w.startMs - cur[cur.length - 1].endMs > 400)) { pages.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  const page = pages.find((p, i) => ms >= p[0].startMs - 60 && ms < Math.min(pages[i + 1]?.[0].startMs ?? Infinity, p[p.length - 1].endMs + 600));
  if (!page) return null;
  return (
    <div style={{ position: "absolute", bottom: 70, left, right: 0, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 64, letterSpacing: -1,
                  color: dark ? INK2 : "white", textShadow: dark ? "none" : "0 3px 20px rgba(0,0,0,.65)" }}>
      {page.map((w, i) => {
        const wf = f - Math.round((w.startMs / 1000) * fps);
        if (wf < -1) return null;
        const s = spring({ frame: wf, fps, config: { damping: 16, stiffness: 240, mass: 0.5 } });
        const e = emph.has(norm(w.text));
        return (
          <span key={i} style={{ display: "inline-block", marginRight: 18, opacity: Math.min(1, s * 1.6), transform: `translateY(${(1 - s) * 18}px)`,
                                 color: e ? ACCENT : undefined }}>{w.text}</span>
        );
      })}
    </div>
  );
};

const ClipV2: React.FC<{ clip: IntroV2Clip; index: number; emph: Set<string>; sfx: boolean }> = ({ clip, index, emph, sfx }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const gA = clip.graphic ? Math.round(((clip.graphicAtMs ?? 900) / 1000) * fps) : 1e6;
  const gB = clip.graphic ? Math.round(((clip.graphicUntilMs ?? 1e7) / 1000) * fps) : 1e6;
  const kIn = interpolate(f, [gA, gA + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const kOut = interpolate(f, [gB, gB + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const k = kIn * (1 - kOut);
  const rect = lerp(FULL, SIDE, k);
  const zoom = interpolate(f, [0, clip.durationInFrames], [1.03, 1.1]);
  // whip-in: slide + blur for the first frames of every clip
  const w = interpolate(f, [0, WHIP], [1, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tagIn = spring({ frame: f - 4, fps, config: { damping: 16 } });
  const showG = clip.graphic && f >= gA && f < gB + 10;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 60% 45%, ${PAPER} 0%, #E2DDD4 75%, #D0CABF 100%)`, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${w * 260}px)`, filter: w > 0.02 ? `blur(${w * 18}px)` : undefined }}>
        <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.r, overflow: "hidden",
                      boxShadow: k > 0.01 ? "0 40px 90px rgba(30,25,20,.28)" : "none" }}>
          <OffthreadVideo src={staticFile(clip.src)} style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080,
            transform: `translate(-50%, -50%) scale(${Math.max(rect.w / 1920, rect.h / 1080) * zoom})` }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 62%, rgba(0,0,0,.6) 100%)", opacity: 1 - k }} />
        </div>
        {showG && (
          <div style={{ position: "absolute", left: 760, right: 70, top: 0, bottom: 150, display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 1 - kOut, transform: `scale(${0.92 + 0.08 * (1 - kOut)})` }}>
            <div style={{ transform: "scale(1.12)" }}><GraphicView g={clip.graphic!} f={f - gA - 4} /></div>
          </div>
        )}
        {/* topic tag */}
        <div style={{ position: "absolute", top: 64, left: 80 + k * 10, display: "flex", gap: 14, alignItems: "center", opacity: tagIn, transform: `translateY(${(1 - tagIn) * -20}px)` }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: ACCENT }}>{String(index + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: k > 0.5 ? INK2 : "white",
                        textShadow: k > 0.5 ? "none" : "0 2px 12px rgba(0,0,0,.7)" }}>{clip.tag}</div>
        </div>
        <Captions words={clip.words} emph={emph} dark={k > 0.5} left={k > 0.5 ? 0 : 0} />
      </AbsoluteFill>
      {sfx && <Audio src={staticFile("whoosh.wav")} volume={0.35} />}
      {sfx && clip.graphic && <Sequence from={gA + 6} layout="none"><Audio src={staticFile("pop.wav")} volume={0.35} /></Sequence>}
      {sfx && clip.graphic && clip.graphicUntilMs && <Sequence from={gB} layout="none"><Audio src={staticFile("whoosh.wav")} volume={0.2} /></Sequence>}
    </AbsoluteFill>
  );
};

const TitleV2: React.FC<{ title: string; subtitle: string; topics: string[]; frames: number }> = ({ title, subtitle, topics, frames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 13, stiffness: 120 } });
  const line = interpolate(f, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const out = interpolate(f, [frames - 10, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = title.split(" ");
  return (
    <AbsoluteFill style={{ background: INK2, opacity: out }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 50%, ${ACCENT}26 0%, transparent 50%)` }} />
      <div style={{ position: "absolute", left: 140, top: 300 }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, letterSpacing: 8, color: ACCENT, textTransform: "uppercase", opacity: line, marginBottom: 20 }}>{subtitle}</div>
        <div style={{ fontFamily: SERIF, fontSize: 210, lineHeight: 0.9, color: "white", letterSpacing: -4 }}>
          {words.map((w, i) => {
            const ws = spring({ frame: f - i * 5, fps, config: { damping: 12, stiffness: 140 } });
            return <span key={i} style={{ display: "inline-block", marginRight: 40, opacity: ws, transform: `translateY(${(1 - ws) * 80}px)`, fontStyle: i === words.length - 1 ? "italic" : "normal", color: i === words.length - 1 ? ACCENT : "white" }}>{w}</span>;
          })}
        </div>
        <div style={{ height: 6, width: 520 * line, background: ACCENT, marginTop: 30, opacity: s }} />
      </div>
      <div style={{ position: "absolute", right: 140, top: 200, width: 640 }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, letterSpacing: 6, color: "#8C867D", textTransform: "uppercase", marginBottom: 20, opacity: line }}>On this episode</div>
        {topics.map((t, i) => {
          const ts = spring({ frame: f - 14 - i * 4, fps, config: { damping: 15 } });
          return (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,.12)",
                                  opacity: ts, transform: `translateX(${(1 - ts) * 80}px)` }}>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 38, color: ACCENT, width: 50 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: "white" }}>{t}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const IntroV2: React.FC<IntroV2Props> = ({ clips, title, subtitle, topics, titleFrames, emphasis, sfx = true }) => {
  useFonts2();
  const emph = React.useMemo(() => new Set(emphasis.map(norm)), [emphasis]);
  let at = 0;
  return (
    <AbsoluteFill style={{ background: INK2 }}>
      {clips.map((c, i) => {
        const from = at; at += c.durationInFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={c.durationInFrames}>
            <ClipV2 clip={c} index={i} emph={emph} sfx={sfx} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={titleFrames}>
        <TitleV2 title={title} subtitle={subtitle} topics={topics} frames={titleFrames} />
        {sfx && <Audio src={staticFile("whoosh-long.wav")} volume={0.45} />}
      </Sequence>
    </AbsoluteFill>
  );
};

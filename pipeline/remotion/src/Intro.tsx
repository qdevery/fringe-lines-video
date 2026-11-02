import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { ACCENT, FONT, INK } from "./brand";
import { useFont } from "./useFont";
import type { Word } from "./types";

export type IntroClip = { src: string; durationInFrames: number; words: Word[]; tag: string };
export type IntroProps = { clips: IntroClip[]; title: string; subtitle: string; topics: string[]; titleFrames: number; durationInFrames: number };

const FLASH = 5;

const Caption: React.FC<{ words: Word[] }> = ({ words }) => {
  const f = useCurrentFrame();
  const ms = (f / 30) * 1000;
  // pages of up to 4 words / 26 chars
  const pages: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const len = cur.map((c) => c.text).join(" ").length + w.text.length;
    if (cur.length && (cur.length >= 4 || len > 26 || w.startMs - cur[cur.length - 1].endMs > 450)) { pages.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  const page = pages.find((p, i) => ms >= p[0].startMs - 80 && ms < (pages[i + 1]?.[0].startMs ?? Infinity));
  if (!page) return null;
  return (
    <div style={{ position: "absolute", bottom: 120, width: "100%", textAlign: "center", fontFamily: FONT, fontSize: 76,
                  textTransform: "uppercase", color: "white", WebkitTextStroke: "3px rgba(0,0,0,.85)", paintOrder: "stroke fill",
                  textShadow: "0 4px 18px rgba(0,0,0,.6)" }}>
      {page.map((w, i) => {
        const active = ms >= w.startMs && ms < (page[i + 1]?.startMs ?? Infinity);
        return <span key={i} style={{ color: active ? ACCENT : "white" }}>{w.text}{i < page.length - 1 ? " " : ""}</span>;
      })}
    </div>
  );
};

const ClipView: React.FC<{ clip: IntroClip; index: number }> = ({ clip, index }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(f, [0, clip.durationInFrames], [1.04, 1.12]);
  const tagIn = spring({ frame: f - 3, fps, config: { damping: 16 } });
  const flash = interpolate(f, [0, FLASH], [0.85, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 40%" }}>
        <OffthreadVideo src={staticFile(clip.src)} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(0,0,0,.55) 100%)" }} />
      <div style={{ position: "absolute", top: 70, left: 80, display: "flex", gap: 16, alignItems: "center",
                    transform: `translateX(${interpolate(tagIn, [0, 1], [-60, 0])}px)`, opacity: tagIn }}>
        <div style={{ fontFamily: FONT, fontSize: 26, color: INK, background: ACCENT, padding: "8px 16px", letterSpacing: 3 }}>
          {String(index + 1).padStart(2, "0")}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 34, color: "white", letterSpacing: 3, textTransform: "uppercase",
                      textShadow: "0 2px 12px rgba(0,0,0,.7)" }}>{clip.tag}</div>
      </div>
      <Caption words={clip.words} />
      <AbsoluteFill style={{ background: "white", opacity: flash }} />
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ title: string; subtitle: string; topics: string[]; frames: number }> = ({ title, subtitle, topics, frames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame: f, fps, config: { damping: 11, stiffness: 160 } });
  const line = interpolate(f, [6, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const fadeOut = interpolate(f, [frames - 10, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: INK, justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${ACCENT}33 0%, transparent 55%)` }} />
      <div style={{ fontFamily: FONT, color: "white", fontSize: 150, letterSpacing: 10, transform: `scale(${interpolate(slam, [0, 1], [1.6, 1])})`,
                    opacity: Math.min(1, slam * 2) }}>{title}</div>
      <div style={{ height: 8, width: 700 * line, background: ACCENT, margin: "18px 0 26px" }} />
      <div style={{ fontFamily: FONT, color: ACCENT, fontSize: 34, letterSpacing: 8, textTransform: "uppercase", opacity: line }}>{subtitle}</div>
      <div style={{ display: "flex", gap: 22, marginTop: 50, flexWrap: "wrap", justifyContent: "center", maxWidth: 1600 }}>
        {topics.map((t, i) => {
          const s = spring({ frame: f - 18 - i * 5, fps, config: { damping: 15 } });
          return <div key={i} style={{ fontFamily: FONT, color: "white", fontSize: 28, border: "2px solid rgba(255,255,255,.35)", padding: "10px 20px",
                                       textTransform: "uppercase", letterSpacing: 2, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>{t}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Intro: React.FC<IntroProps> = ({ clips, title, subtitle, topics, titleFrames }) => {
  useFont();
  let at = 0;
  return (
    <AbsoluteFill style={{ background: "black" }}>
      {clips.map((c, i) => {
        const from = at;
        at += c.durationInFrames;
        return <Sequence key={i} from={from} durationInFrames={c.durationInFrames}><ClipView clip={c} index={i} /></Sequence>;
      })}
      <Sequence from={at} durationInFrames={titleFrames}><TitleCard title={title} subtitle={subtitle} topics={topics} frames={titleFrames} /></Sequence>
    </AbsoluteFill>
  );
};

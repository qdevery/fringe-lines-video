import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import type { Word } from "./types";
import { ACCENT } from "./brand";
import { useFonts2, SERIF, SANS } from "./useFonts2";
import { Rich, INK2 } from "./Graphics";
import { Face, faceAt, frameVideo } from "./ShortV2";

// "How-to" short: the screen share fills the top half and pans/zooms to whatever is being explained;
// the speaker sits in the bottom half (face-tracked); one-to-three-word captions ride the seam.

export type Focus = { startMs: number; box: [number, number, number, number]; label?: string; mark?: [number, number, number, number] };
export type HowToProps = {
  screen: string; screenW: number; screenH: number;
  cam: string; camW: number; camH: number;
  durationInFrames: number;
  words: Word[];
  focus: Focus[];
  faces?: Face[];
  title: string; kicker?: string;
  titleEndMs?: number;
  outro?: string;
  screenClip?: [number, number, number, number];
};

const TOP = 1010;
const PAN = 700; // ms

const lerpBox = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number, number];

function paginate(words: Word[]) {
  const pages: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const len = cur.map((c) => c.text).join(" ").length + w.text.length;
    if (prev && (cur.length >= 3 || len > 16 || w.startMs - prev.endMs > 350 || /[.?!,]$/.test(prev.text))) { pages.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export const HowTo: React.FC<HowToProps> = (p) => {
  useFonts2();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  // ---- screen focus (pan/zoom between keyframes)
  let fi = 0;
  p.focus.forEach((f, i) => { if (ms >= f.startMs) fi = i; });
  const cur = p.focus[fi], prev = p.focus[fi - 1];
  const t = prev ? interpolate(ms - cur.startMs, [0, PAN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) : 1;
  const box = prev ? lerpBox(prev.box, cur.box, t) : cur.box;
  const bw = box[2] * p.screenW, bh = box[3] * p.screenH;
  const S = Math.min(1020 / bw, (TOP - 150) / bh);
  const cx = (box[0] + box[2] / 2) * p.screenW, cy = (box[1] + box[3] / 2) * p.screenH;
  const ox = 540 - cx * S, oy = (TOP + 50) / 2 - cy * S;

  // ---- speaker
  const camRect = { w: 1080, h: 1920 - TOP };
  const vf = frameVideo(camRect, faceAt(p.faces, ms), 1, 0, 0.4, p.camW, p.camH);

  // ---- captions on the seam
  const pages = React.useMemo(() => paginate(p.words), [p.words]);
  const page = pages.find((pg, i) => ms >= pg[0].startMs - 50 && ms < Math.min(pages[i + 1]?.[0].startMs ?? Infinity, pg[pg.length - 1].endMs + 400));

  // ---- title + label + outro
  const titleEnd = p.titleEndMs ?? 3200;
  const titleIn = spring({ frame, fps, config: { damping: 14 } });
  const titleOut = interpolate(ms, [titleEnd, titleEnd + 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const plain = p.title.replace(/\*/g, "");
  const typed = Math.floor(interpolate(frame, [4, 4 + plain.length * 0.9], [0, plain.length], { extrapolateRight: "clamp" }));
  // reveal the rich title char by char
  let left = typed;
  const typedRich = p.title.split(/(\*[^*]+\*)/).map((seg) => {
    const raw = seg.replace(/\*/g, "");
    const take = raw.slice(0, Math.max(0, left)); left -= raw.length;
    return seg.startsWith("*") ? (take ? `*${take}*` : "") : take;
  }).join("");
  const labelS = spring({ frame: frame - Math.round((cur.startMs / 1000) * fps), fps, config: { damping: 15 } });
  const outroF = frame - (durationInFrames - Math.round(2.6 * fps));
  const markS = cur.mark ? spring({ frame: frame - Math.round(((cur.startMs + PAN * 0.6) / 1000) * fps), fps, config: { damping: 14 } }) : 0;

  return (
    <AbsoluteFill style={{ background: INK2 }}>
      {/* screen */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: TOP, overflow: "hidden", background: "radial-gradient(ellipse at 50% 40%, #24242B 0%, #111116 80%)" }}>
        <div style={{ position: "absolute", left: ox, top: oy, width: p.screenW, height: p.screenH, transform: `scale(${S})`, transformOrigin: "0 0",
                      borderRadius: 18 / S, overflow: "hidden", boxShadow: p.screenClip ? undefined : `0 ${30 / S}px ${80 / S}px rgba(0,0,0,.6)` }}>
          <OffthreadVideo src={staticFile(p.screen)} muted style={{ width: p.screenW, height: p.screenH,
            clipPath: p.screenClip ? `inset(${p.screenClip[1] * 100}% ${(1 - p.screenClip[0] - p.screenClip[2]) * 100}% ${(1 - p.screenClip[1] - p.screenClip[3]) * 100}% ${p.screenClip[0] * 100}% round ${16 / S}px)` : undefined }} />
          {cur.mark && (
            <div style={{ position: "absolute", left: cur.mark[0] * p.screenW - 10 / S, top: cur.mark[1] * p.screenH - 10 / S,
                          width: cur.mark[2] * p.screenW + 20 / S, height: cur.mark[3] * p.screenH + 20 / S,
                          border: `${6 / S}px solid ${ACCENT}`, borderRadius: 16 / S, opacity: markS, transform: `scale(${1.15 - 0.15 * markS})`,
                          boxShadow: `0 0 ${30 / S}px ${ACCENT}88` }} />
          )}
        </div>
        {cur.label && (
          <div style={{ position: "absolute", top: 70, left: 50, display: "flex", alignItems: "center", gap: 14, opacity: labelS, transform: `translateX(${(1 - labelS) * -40}px)` }}>
            <div style={{ background: ACCENT, color: "white", fontFamily: SANS, fontWeight: 800, fontSize: 30, padding: "10px 20px", borderRadius: 999, letterSpacing: 1 }}>{cur.label}</div>
          </div>
        )}
        {/* progress */}
        <div style={{ position: "absolute", left: 0, top: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, background: ACCENT }} />
      </div>

      {/* speaker */}
      <div style={{ position: "absolute", left: 0, top: TOP, width: 1080, height: 1920 - TOP, overflow: "hidden" }}>
        <OffthreadVideo src={staticFile(p.cam)} style={{ position: "absolute", left: 0, top: 0, width: p.camW, height: p.camH, transformOrigin: "0 0",
          transform: `translate(${vf.tx}px, ${vf.ty}px) scale(${vf.S})` }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 18%)" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: TOP - 3, height: 6, background: ACCENT }} />

      {/* title card */}
      {titleOut < 1 && (
        <div style={{ position: "absolute", left: 70, right: 70, top: 330, opacity: titleIn * (1 - titleOut), transform: `translateY(${(1 - titleIn) * 40 - titleOut * 30}px)` }}>
          <div style={{ background: "white", borderRadius: 28, padding: "40px 46px", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
            {p.kicker && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: 4, color: ACCENT, textTransform: "uppercase", marginBottom: 14 }}>{p.kicker}</div>}
            <div style={{ fontFamily: SERIF, fontSize: 96, lineHeight: 1.0, color: INK2, minHeight: 192 }}>
              <Rich text={typedRich} /><span style={{ opacity: frame % 16 < 8 && typed < plain.length ? 1 : 0, color: ACCENT }}>|</span>
            </div>
          </div>
        </div>
      )}

      {/* seam captions */}
      {page && (
        <div style={{ position: "absolute", left: 40, right: 40, top: TOP - 52, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 70, letterSpacing: -1,
                      color: "white", WebkitTextStroke: "10px rgba(14,14,18,.95)", paintOrder: "stroke fill", textShadow: "0 6px 24px rgba(0,0,0,.5)" }}>
          {page.map((w, i) => {
            const wf = frame - Math.round((w.startMs / 1000) * fps);
            const s = spring({ frame: wf, fps, config: { damping: 15, stiffness: 260, mass: 0.5 } });
            const active = ms >= w.startMs && ms < (page[i + 1]?.startMs ?? w.endMs + 400);
            return <span key={i} style={{ display: "inline-block", marginRight: 18, opacity: wf < -1 ? 0.0 : 1, transform: `scale(${wf < -1 ? 0.8 : 0.85 + 0.15 * s})`, color: active ? ACCENT : "white" }}>{w.text}</span>;
          })}
        </div>
      )}

      {/* outro: follow for more */}
      {outroF >= 0 && (() => {
        const s = spring({ frame: outroF, fps, config: { damping: 13 } });
        const draw = interpolate(outroF, [6, 26], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        return (
          <div style={{ position: "absolute", left: 70, top: TOP + 90, opacity: s, transform: `scale(${0.9 + 0.1 * s})`, transformOrigin: "left top" }}>
            <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 0.95, color: "white", textShadow: "0 4px 24px rgba(0,0,0,.6)" }}>
              Follow for<br /><span style={{ fontStyle: "italic", color: ACCENT }}>more</span>
            </div>
            <svg width={260} height={220} viewBox="0 0 260 220" style={{ marginTop: 6, marginLeft: 40, overflow: "visible" }}>
              <path d="M20 10 C 10 110, 90 190, 220 170" fill="none" stroke="white" strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <path d="M180 135 L 224 170 L 178 200" fill="none" stroke="white" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={draw > 0.95 ? 1 : 0} />
            </svg>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

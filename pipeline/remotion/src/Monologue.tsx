import React, { useEffect, useState } from "react";
import { AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, spring,
         continueRender, delayRender } from "remotion";
import type { Shot } from "./types";
import { faceAt, frameVideo, type Face } from "./ShortV2";
// @ts-ignore - webpack asset imports
import serif from "../fonts/InstrumentSerif-Regular.ttf";
// @ts-ignore
import serifItalic from "../fonts/InstrumentSerif-Italic.ttf";
// @ts-ignore
import archivo from "../fonts/Archivo.ttf";
// @ts-ignore
import monoR from "../fonts/IBMPlexMono-Regular.ttf";
// @ts-ignore
import monoSB from "../fonts/IBMPlexMono-SemiBold.ttf";

// "Engaging monologue" (16:9 talking head). Motion language modelled on Ali Abdaal's 2026 videos, rendered in the
// FringeLines v2.1 kit: Instrument Serif display (one italic idea), Archivo text, IBM Plex Mono labels; green brand,
// blue for the second highlight, orange only for the number that matters; flat surfaces and hairlines.
// The speaker is full-frame most of the time; "paper" beats shrink them into a portrait picture-in-picture while a
// graphic builds on a warm paper canvas. Text is revealed word by word in sync with the speech (times from Python).

const SERIF = "FLMSerif", SANS = "FLMSans", MONO = "FLMMono";
export const C = {
  paper: "#F7F7F5", wash: "#EEF2EC", ink: "#14170F", body: "#3D423A", muted: "#5C6159", label: "#6B7067", rule: "#E3E5DF",
  green: ["#1A5A41", "#3D8A63", "#7FB99B", "#A6CDB6", "#C5DDCF", "#E8F0EA"], blue: ["#163F57", "#1A4F6B", "#4D88A8", "#8FBBD6", "#E0EDF3"],
  accent: "#D4622A", accentDark: "#F0863F",
};
const TONE = {
  green: { bg: "linear-gradient(160deg,#2c8360 0%,#1d6247 55%,#164a37 100%)", soft: "#E8F0EA", ink: "#1A5A41", sub: "#dbe9e0" },
  blue: { bg: "linear-gradient(160deg,#2e7a9e 0%,#1f5b78 55%,#163f57 100%)", soft: "#E0EDF3", ink: "#163F57", sub: "#d6e6ee" },
  orange: { bg: "linear-gradient(160deg,#d97b3d 0%,#b4501c 55%,#8a3a12 100%)", soft: "#F7E6D8", ink: "#8a3a12", sub: "#FCE0CE" },
};
type Tone = keyof typeof TONE;

// A token is one word, pre-split in Python: s = "n" normal, "i" italic highlight (*...*), "a" accent number ([...]).
export type Tok = { t: string; s: "n" | "i" | "a"; ms: number };
type Item = { text: string; ms: number; tone?: Tone; tokens?: Tok[] };
export type Beat =
  | { type: "title"; startMs: number; endMs: number; eyebrow?: string; tokens: Tok[] }
  | { type: "text"; startMs: number; endMs: number; eyebrow?: string; tokens: Tok[]; align?: "left" | "center" }
  | { type: "overlay"; startMs: number; endMs: number; tokens: Tok[] }
  | { type: "callout"; startMs: number; endMs: number; label?: string; tokens: Tok[]; tone?: Tone; side?: "left" | "right" }
  | { type: "name"; startMs: number; endMs: number; tokens: Tok[]; role?: string }
  | { type: "chips"; startMs: number; endMs: number; items: Item[]; side?: "left" | "right"; tone?: Tone }
  | { type: "cta"; startMs: number; endMs: number; tokens: Tok[]; sub?: string }
  | { type: "bw"; startMs: number; endMs: number }
  | { type: "roadmap"; startMs: number; endMs: number; items: Item[]; active?: number; zoomMs?: number }
  | { type: "compare"; startMs: number; endMs: number; title?: string; left: { label: string; items: Item[] }; right: { label: string; items: Item[] }; winner?: "left" | "right" }
  | { type: "stack"; startMs: number; endMs: number; title?: string; items: Item[] }
  | { type: "stat"; startMs: number; endMs: number; kicker?: string; prefix?: string; value: number; decimals?: number; suffix?: string; tokens: Tok[]; source: string }
  | { type: "steps"; startMs: number; endMs: number; title?: string; items: Item[] }
  | { type: "media"; startMs: number; endMs: number; src: string; video?: boolean; from?: number; title?: string; meta?: string; full?: boolean }
  | { type: "end"; startMs: number; endMs: number; eyebrow?: string; tokens: Tok[]; sub?: string; url?: string; tone?: Tone };

export type MonologueProps = {
  src: string; srcW?: number; srcH?: number; durationInFrames: number;
  shots: Shot[]; faces?: Face[]; beats: Beat[]; brand?: string;
};

const PAPER_BEATS = new Set(["text", "roadmap", "compare", "stack", "stat", "steps", "media"]);
const W = 1920, H = 1080;
const FULL = { x: 0, y: 0, w: W, h: H, r: 0, b: 0 };
const PIP = { x: 1420, y: 230, w: 400, h: 560, r: 18, b: 8 };
const MORPH = 14;   // frames for full <-> picture-in-picture
const EXIT = 9;     // frames for blur-out exits

function useKitFonts() {
  const [h] = useState(() => delayRender("monologue-fonts"));
  useEffect(() => {
    const faces = [
      new FontFace(SERIF, `url(${serif})`, { style: "normal" }), new FontFace(SERIF, `url(${serifItalic})`, { style: "italic" }),
      new FontFace(SANS, `url(${archivo})`, { weight: "100 900" }),
      new FontFace(MONO, `url(${monoR})`, { weight: "400" }), new FontFace(MONO, `url(${monoSB})`, { weight: "600" }),
    ];
    Promise.all(faces.map((f) => f.load())).then((ls) => { ls.forEach((l) => document.fonts.add(l)); continueRender(h); });
  }, [h]);
}

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pop = (f: number, fps: number, damping = 13) => spring({ frame: f, fps, config: { damping, stiffness: 170, mass: 0.6 } });

// Context handed to every beat: ms now, frames since start, and the exit progress (0 -> 1 over the last EXIT frames).
type Ctx = { ms: number; f: number; out: number; fps: number; toF: (m: number) => number };

// Word-by-word reveal: each word starts faint and soft, then sharpens to full ink when it is spoken.
const Words: React.FC<{ tokens: Tok[]; ctx: Ctx; dark?: boolean; gap?: number }> = ({ tokens, ctx, dark, gap = 0.26 }) => (
  <>
    {tokens.map((w, i) => {
      const wf = ctx.f - ctx.toF(w.ms);
      const k = interpolate(wf, [-1, 7], [0, 1], { ...clamp, easing: ease });
      const color = w.s === "a" ? (dark ? C.accentDark : C.accent) : w.s === "i" ? (dark ? "#FFFFFF" : C.blue[1]) : undefined;
      return (
        <span key={i} style={{ display: "inline-block", marginRight: `${gap}em`, opacity: 0.12 + 0.88 * k, filter: `blur(${(1 - k) * 6}px)`,
                               transform: `translateY(${(1 - k) * 0.12}em)`, fontStyle: w.s === "i" ? "italic" : "normal", color }}>
          {w.t}
        </span>
      );
    })}
  </>
);
const relTokens = (tokens: Tok[], startMs: number) => tokens.map((t) => ({ ...t, ms: t.ms - startMs }));

const Rich: React.FC<{ text: string; dark?: boolean }> = ({ text, dark }) => (
  <>{text.split(/(\*[^*]+\*)/).map((p, i) => p.startsWith("*")
    ? <span key={i} style={{ fontStyle: "italic", color: dark ? "white" : C.blue[1] }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>)}</>
);

const exitStyle = (out: number): React.CSSProperties => ({ opacity: 1 - out, filter: out > 0 ? `blur(${out * 14}px)` : undefined });

const Eyebrow: React.FC<{ text?: string; color?: string; style?: React.CSSProperties }> = ({ text, color = C.label, style }) =>
  text ? <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase", color, ...style }}>{text}</div> : null;

// ---------- overlay beats (speaker stays full-frame) ----------

const Title: React.FC<{ b: Extract<Beat, { type: "title" }>; c: Ctx }> = ({ b, c }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...exitStyle(c.out) }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(10,14,8,.62) 0%, rgba(10,14,8,.35) 60%, rgba(10,14,8,.15) 100%)",
                           opacity: interpolate(c.f, [0, 10], [0, 1], clamp) }} />
    <div style={{ position: "relative", textAlign: "center", maxWidth: 1500 }}>
      <Eyebrow text={b.eyebrow} color="#dbe9e0" style={{ marginBottom: 30, opacity: interpolate(c.f, [0, 10], [0, 1], clamp) }} />
      <div style={{ fontFamily: SERIF, fontSize: 168, lineHeight: 1.0, letterSpacing: "-0.01em", color: "white", textShadow: "0 6px 40px rgba(0,0,0,.35)" }}>
        <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} dark gap={0.22} />
      </div>
    </div>
  </AbsoluteFill>
);

const Overlay: React.FC<{ b: Extract<Beat, { type: "overlay" }>; c: Ctx }> = ({ b, c }) => (
  <AbsoluteFill style={exitStyle(c.out)}>
    <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(10,14,8,.6) 0%, rgba(10,14,8,0) 45%)", opacity: interpolate(c.f, [0, 8], [0, 1], clamp) }} />
    <div style={{ position: "absolute", left: 160, right: 160, bottom: 90, textAlign: "center", fontFamily: SERIF, fontSize: 86, lineHeight: 1.04,
                  color: "white", textShadow: "0 4px 26px rgba(0,0,0,.45)" }}>
      <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} dark />
    </div>
  </AbsoluteFill>
);

const Callout: React.FC<{ b: Extract<Beat, { type: "callout" }>; c: Ctx }> = ({ b, c }) => {
  const s = pop(c.f, c.fps, 15);
  const t = TONE[b.tone ?? "green"];
  const right = b.side === "right";
  return (
    <div style={{ position: "absolute", top: 80, [right ? "right" : "left"]: 80, width: 640, padding: "34px 40px 40px", borderRadius: 18, background: t.bg,
                  transformOrigin: right ? "100% 0" : "0 0", transform: `translateY(${(1 - s) * -30}px) scale(${0.92 + 0.08 * s})`, ...exitStyle(c.out),
                  opacity: Math.min(1, s * 1.6) * (1 - c.out) } as React.CSSProperties}>
      {b.label && <span style={{ display: "inline-block", fontFamily: MONO, fontWeight: 600, fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase",
                                  color: t.ink, background: "white", borderRadius: 8, padding: "7px 14px", marginBottom: 22 }}>{b.label}</span>}
      <div style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.06, color: "white" }}>
        <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} dark gap={0.24} />
      </div>
    </div>
  );
};

const Name: React.FC<{ b: Extract<Beat, { type: "name" }>; c: Ctx }> = ({ b, c }) => {
  const k = interpolate(c.f, [0, 12], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={exitStyle(c.out)}>
      <AbsoluteFill style={{ background: "linear-gradient(to top right, rgba(10,14,8,.55) 0%, rgba(10,14,8,0) 45%)", opacity: k }} />
      <div style={{ position: "absolute", left: 110, bottom: 100 }}>
        <div style={{ width: 96, height: 6, background: C.accent, transform: `scaleX(${k})`, transformOrigin: "left", marginBottom: 26 }} />
        <div style={{ fontFamily: SERIF, fontSize: 120, lineHeight: 1, color: "white", textShadow: "0 4px 26px rgba(0,0,0,.35)" }}>
          <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} dark gap={0.2} />
        </div>
        <Eyebrow text={b.role} color="#dbe9e0" style={{ marginTop: 18, opacity: interpolate(c.f, [8, 18], [0, 1], clamp) }} />
      </div>
    </AbsoluteFill>
  );
};

const Chips: React.FC<{ b: Extract<Beat, { type: "chips" }>; c: Ctx }> = ({ b, c }) => {
  const t = TONE[b.tone ?? "orange"];
  const left = b.side === "left";
  return (
    <div style={{ position: "absolute", top: 300, [left ? "left" : "right"]: 150, display: "flex", flexDirection: "column", alignItems: left ? "flex-start" : "flex-end", gap: 26, ...exitStyle(c.out) } as React.CSSProperties}>
      {b.items.map((it, i) => {
        const s = pop(c.f - c.toF(it.ms - b.startMs), c.fps, 11);
        if (s <= 0.001) return null;
        return (
          <div key={i} style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, color: "white", background: TONE[it.tone ?? (b.tone ?? "orange")].bg ?? t.bg,
                                padding: "16px 30px", borderRadius: 14, transform: `scale(${s}) rotate(${(i % 2 ? 2 : -2) * s}deg)`, transformOrigin: left ? "0 50%" : "100% 50%" }}>
            {it.text}
          </div>
        );
      })}
    </div>
  );
};

const Cta: React.FC<{ b: Extract<Beat, { type: "cta" }>; c: Ctx }> = ({ b, c }) => {
  const s = pop(c.f, c.fps, 14);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", flexDirection: "column", alignItems: "center", ...exitStyle(c.out),
                  transform: `translateY(${(1 - s) * 140}px)` }}>
      <div style={{ background: "white", borderRadius: 999, padding: "20px 44px", fontFamily: SANS, fontWeight: 500, fontSize: 40, color: C.ink, border: `2px solid ${C.rule}` }}>
        <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} gap={0.24} />
      </div>
      {b.sub && <div style={{ marginTop: -10, background: C.accent, color: "white", borderRadius: 999, padding: "8px 22px", fontFamily: MONO, fontWeight: 600, fontSize: 22,
                              letterSpacing: "0.12em", textTransform: "uppercase", opacity: interpolate(c.f, [10, 18], [0, 1], clamp) }}>{b.sub}</div>}
    </div>
  );
};

// ---------- paper beats (speaker shrinks to the picture-in-picture) ----------

const AREA = { left: 140, top: 110, width: 1180, height: 860 }; // left of the PiP

const TextSlide: React.FC<{ b: Extract<Beat, { type: "text" }>; c: Ctx }> = ({ b, c }) => (
  <div style={{ position: "absolute", ...AREA, display: "flex", flexDirection: "column", justifyContent: "center",
                textAlign: b.align === "center" ? "center" : "left", ...exitStyle(c.out) }}>
    <Eyebrow text={b.eyebrow} style={{ marginBottom: 30 }} />
    <div style={{ fontFamily: SERIF, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.005em", color: C.ink }}>
      <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} />
    </div>
  </div>
);

const Roadmap: React.FC<{ b: Extract<Beat, { type: "roadmap" }>; c: Ctx }> = ({ b, c }) => {
  const n = b.items.length, top = Math.ceil(n / 2);
  const cw = 360, ch = 250, gx = 50, gy = 80;
  const y0 = (AREA.height - (n > top ? 2 * ch + gy : ch)) / 2;
  const pos = b.items.map((_, i) => {
    const row = i < top ? 0 : 1, col = row ? i - top : i, cols = row ? n - top : top;
    const rowW = cols * cw + (cols - 1) * gx;
    return { x: (AREA.width - rowW) / 2 + col * (cw + gx), y: y0 + row * (ch + gy) };
  });
  // camera: zoom into the active card
  const zf = b.active !== undefined ? c.f - c.toF((b.zoomMs ?? b.startMs + 1400) - b.startMs) : -1;
  const z = b.active !== undefined ? interpolate(zf, [0, 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const a = b.active !== undefined ? pos[b.active] : { x: 0, y: 0 };
  const S = 1 + 1.1 * z;
  const cx = AREA.width / 2, cy = AREA.height / 2;
  const tx = (cx - (a.x + cw / 2)) * S * z, ty = (cy - (a.y + ch / 2)) * S * z;
  const tones: Tone[] = ["green", "blue", "orange"];
  return (
    <div style={{ position: "absolute", ...AREA, ...exitStyle(c.out) }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${cx}px ${cy}px`, transform: `translate(${tx}px, ${ty}px) scale(${S})` }}>
        <svg width={AREA.width} height={AREA.height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {pos.slice(1).map((p, i) => {
            const q = pos[i];
            const k = interpolate(c.f - 6 * (i + 1) - 4, [0, 10], [0, 1], clamp);
            const x1 = q.x + cw / 2, y1 = q.y + ch, x2 = p.x + cw / 2, y2 = p.y;
            const d = q.y === p.y ? `M ${q.x + cw} ${q.y + ch / 2} L ${p.x} ${p.y + ch / 2}` : `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 60}, ${x2} ${y2}`;
            return <path key={i} d={d} stroke={C.accent} strokeWidth={3} strokeDasharray="8 9" fill="none" opacity={k} />;
          })}
        </svg>
        {b.items.map((it, i) => {
          const s = pop(c.f - 6 * i, c.fps, 14);
          const t = TONE[it.tone ?? tones[i % 3]];
          const dim = b.active !== undefined && i !== b.active ? z : 0;
          return (
            <div key={i} style={{ position: "absolute", left: pos[i].x, top: pos[i].y, width: cw, height: ch, borderRadius: 16, background: t.soft,
                                  border: `2px solid ${t.ink}22`, padding: "24px 26px", boxSizing: "border-box", opacity: Math.min(1, s * 1.5) * (1 - 0.55 * dim),
                                  filter: dim ? `blur(${dim * 5}px)` : undefined, transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + 0.1 * s})` }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: t.ink, color: "white", fontFamily: MONO, fontWeight: 600, fontSize: 22,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ marginTop: 20, fontFamily: SERIF, fontSize: 48, lineHeight: 1.04, color: C.ink }}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Pill: React.FC<{ text: string; f: number; fps: number; bg: string; color: string; size?: number; mono?: boolean }> = ({ text, f, fps, bg, color, size = 40, mono }) => {
  const s = pop(f, fps, 11);
  if (s <= 0.001) return null;
  return (
    <div style={{ fontFamily: mono ? MONO : SANS, fontWeight: mono ? 600 : 600, fontSize: size, color, background: bg, borderRadius: 12, padding: `${size * 0.32}px ${size * 0.6}px`,
                  transform: `scale(${s})`, opacity: Math.min(1, s * 1.5), whiteSpace: "nowrap" }}>{text}</div>
  );
};

const Compare: React.FC<{ b: Extract<Beat, { type: "compare" }>; c: Ctx }> = ({ b, c }) => {
  const side = (x: { label: string; items: Item[] }, tone: Tone, lose: boolean) => {
    const t = TONE[tone];
    const at0 = x.items[0] ? x.items[0].ms - b.startMs - 350 : 400;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, opacity: lose ? 0.4 : 1 }}>
        <Pill text={x.label} f={c.f - c.toF(Math.max(0, at0))} fps={c.fps} bg={t.bg} color="white" size={64} />
        <div style={{ height: 12 }} />
        {x.items.map((it, i) => <Pill key={i} text={it.text} f={c.f - c.toF(it.ms - b.startMs)} fps={c.fps} bg={t.soft} color={t.ink} size={44} />)}
      </div>
    );
  };
  const wk = b.winner ? interpolate(c.f, [c.toF(b.endMs - b.startMs) - 45, c.toF(b.endMs - b.startMs) - 35], [0, 1], clamp) : 0;
  return (
    <div style={{ position: "absolute", ...AREA, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", ...exitStyle(c.out) }}>
      {b.title && <div style={{ border: `2px solid ${C.rule}`, borderRadius: 16, background: "white" }}><Pill text={b.title} f={c.f} fps={c.fps} bg="white" color={C.ink} size={58} /></div>}
      <svg width={700} height={80} style={{ marginTop: 6, opacity: interpolate(c.f, [6, 14], [0, 1], clamp) }}>
        <path d="M350 0 C350 40, 160 30, 160 80 M350 0 C350 40, 540 30, 540 80" stroke={C.label} strokeWidth={3} fill="none" />
      </svg>
      <div style={{ display: "flex", width: 1080, marginTop: 8, minHeight: 520 }}>
        {side(b.left, "blue", b.winner === "right" && wk > 0.5)}
        {side(b.right, "green", b.winner === "left" && wk > 0.5)}
      </div>
    </div>
  );
};

const Stack: React.FC<{ b: Extract<Beat, { type: "stack" }>; c: Ctx }> = ({ b, c }) => {
  const n = b.items.length;
  const lh = Math.min(140, 600 / n), base = 940, topW = 500;
  const fills = [C.green[0], C.green[1], C.blue[1], C.green[2], C.blue[2]];
  return (
    <div style={{ position: "absolute", ...AREA, ...exitStyle(c.out) }}>
      {b.title && <div style={{ position: "absolute", top: 30, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 76, color: C.ink,
                                opacity: interpolate(c.f, [0, 10], [0, 1], clamp), transform: `translateY(${interpolate(c.f, [0, 12], [20, 0], { ...clamp, easing: ease })}px)` }}><Rich text={b.title} /></div>}
      {b.items.map((it, i) => {
        // i = 0 is the bottom layer
        const wB = base - (base - topW) * (i / n), wT = base - (base - topW) * ((i + 1) / n);
        const y = 800 - (i + 1) * (lh + 10);
        const s = pop(c.f - c.toF(it.ms - b.startMs), c.fps, 12);
        if (s <= 0.001) return null;
        const inset = (wB - wT) / 2;
        return (
          <div key={i} style={{ position: "absolute", left: (AREA.width - wB) / 2, top: y, width: wB, height: lh, transform: `translateY(${(1 - s) * -160}px)`, opacity: Math.min(1, s * 2) }}>
            <svg width={wB} height={lh} style={{ position: "absolute" }}><path d={`M${inset} 0 L${wB - inset} 0 L${wB} ${lh} L0 ${lh} Z`} fill={it.tone ? TONE[it.tone].ink : fills[i % fills.length]} /></svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 600,
                          fontSize: Math.min(42, lh * 0.36, (wT - 2 * inset - 40) / (it.text.length * 0.52)), color: "white", whiteSpace: "nowrap", textAlign: "center", padding: `0 ${inset}px` }}>{it.text}</div>
          </div>
        );
      })}
    </div>
  );
};

const Steps: React.FC<{ b: Extract<Beat, { type: "steps" }>; c: Ctx }> = ({ b, c }) => (
  <div style={{ position: "absolute", ...AREA, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26, ...exitStyle(c.out) }}>
    {b.title && <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1.04, color: C.ink, marginBottom: 20, opacity: interpolate(c.f, [0, 10], [0, 1], clamp) }}><Rich text={b.title} /></div>}
    {b.items.map((it, i) => {
      const k = interpolate(c.f - c.toF(it.ms - b.startMs), [0, 10], [0, 1], { ...clamp, easing: ease });
      if (k <= 0) return null;
      return (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 30, borderTop: `2px solid ${C.rule}`, paddingTop: 20, opacity: k, transform: `translateX(${(1 - k) * -40}px)` }}>
          <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 30, color: C.green[0], width: 60 }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 50, color: C.body }}>{it.text}</div>
        </div>
      );
    })}
  </div>
);

const Stat: React.FC<{ b: Extract<Beat, { type: "stat" }>; c: Ctx }> = ({ b, c }) => {
  const k = interpolate(c.f, [4, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const v = (b.value * k).toFixed(b.decimals ?? 0);
  return (
    <div style={{ position: "absolute", ...AREA, display: "flex", flexDirection: "column", justifyContent: "center", ...exitStyle(c.out) }}>
      <Eyebrow text={b.kicker} style={{ opacity: interpolate(c.f, [0, 8], [0, 1], clamp) }} />
      <div style={{ fontFamily: SERIF, fontSize: 330, lineHeight: 0.95, color: C.accent, letterSpacing: "-0.02em", margin: "10px 0 20px" }}>{b.prefix ?? ""}{v}{b.suffix ?? ""}</div>
      <div style={{ fontFamily: SANS, fontSize: 52, lineHeight: 1.2, color: C.body, maxWidth: 1050 }}><Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} gap={0.25} /></div>
      <div style={{ marginTop: 40, fontFamily: MONO, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", color: C.label, opacity: interpolate(c.f, [20, 30], [0, 1], clamp) }}>{b.source}</div>
    </div>
  );
};

const Media: React.FC<{ b: Extract<Beat, { type: "media" }>; c: Ctx }> = ({ b, c }) => {
  const s = pop(c.f, c.fps, 16);
  const kb = interpolate(c.f, [0, c.toF(b.endMs - b.startMs)], [1, 1.05], clamp);
  const el = b.video
    ? <OffthreadVideo src={staticFile(b.src)} startFrom={c.toF((b.from ?? 0) * 1000)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />
    : <Img src={staticFile(b.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />;
  if (b.full) return <AbsoluteFill style={{ ...exitStyle(c.out), opacity: Math.min(1, s * 2) * (1 - c.out) }}>{el}</AbsoluteFill>;
  return (
    <div style={{ position: "absolute", ...AREA, display: "flex", flexDirection: "column", justifyContent: "center", ...exitStyle(c.out) }}>
      <div style={{ width: AREA.width, height: 664, borderRadius: 18, overflow: "hidden", border: `2px solid ${C.rule}`, background: "white",
                    transform: `translateY(${(1 - s) * 60}px) scale(${0.94 + 0.06 * s})`, opacity: Math.min(1, s * 1.5) }}>{el}</div>
      {(b.title || b.meta) && (
        <div style={{ marginTop: 24, opacity: interpolate(c.f, [8, 16], [0, 1], clamp) }}>
          {b.title && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: C.ink }}>{b.title}</div>}
          {b.meta && <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.08em", color: C.label, marginTop: 8 }}>{b.meta}</div>}
        </div>
      )}
    </div>
  );
};

const End: React.FC<{ b: Extract<Beat, { type: "end" }>; c: Ctx; brand: string }> = ({ b, c, brand }) => {
  const t = TONE[b.tone ?? "green"];
  const k = interpolate(c.f, [0, 12], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: t.bg, opacity: k, padding: "110px 160px", justifyContent: "center" }}>
      <Eyebrow text={b.eyebrow ?? brand} color={t.sub} style={{ position: "absolute", top: 90, left: 160 }} />
      <div style={{ width: 120, height: 7, background: C.accent, marginBottom: 40, transform: `scaleX(${k})`, transformOrigin: "left" }} />
      <div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 1.0, color: "white", maxWidth: 1500 }}><Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} dark gap={0.22} /></div>
      {b.sub && <div style={{ fontFamily: SANS, fontSize: 46, color: t.sub, marginTop: 34, opacity: interpolate(c.f, [14, 24], [0, 1], clamp) }}>{b.sub}</div>}
      <div style={{ position: "absolute", bottom: 90, left: 160, display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontSize: 28, color: t.sub }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: C.accent, display: "inline-block" }} />{b.url ?? "fringelines.co"}
      </div>
    </AbsoluteFill>
  );
};

// Decorative paper swoosh (faint, like the reference's background curve), drawn in the kit's green wash.
const Swoosh: React.FC<{ f: number }> = ({ f }) => (
  <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
    <path d={`M -100 ${820 + Math.sin(f / 90) * 10} C 400 ${560 + Math.sin(f / 70) * 14}, 900 1000, 2020 ${640 + Math.cos(f / 80) * 12}`} stroke={C.green[5]} strokeWidth={140}
          fill="none" strokeLinecap="round" opacity={0.75} />
  </svg>
);

export const Monologue: React.FC<MonologueProps> = ({ src, srcW = 1920, srcH = 1080, shots, faces, beats, brand = "FringeLines" }) => {
  useKitFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const toF = (m: number) => Math.round((m / 1000) * fps);

  // which beats are on screen (including their exit tail)
  const tail = (EXIT / fps) * 1000;
  const live = beats.filter((b) => ms >= b.startMs && ms < b.endMs + tail);
  const ctxOf = (b: Beat): Ctx => ({ ms, f: frame - toF(b.startMs), out: interpolate(frame, [toF(b.endMs), toF(b.endMs) + EXIT], [0, 1], clamp), fps, toF });

  // picture-in-picture amount: eases in at a paper beat's start and out at its end; gaps under 0.6 s stay in PiP
  const spans = React.useMemo(() => {
    const out: [number, number][] = [];
    beats.filter((b) => PAPER_BEATS.has(b.type)).map((b) => [b.startMs, b.endMs] as [number, number])
      .sort((a, b) => a[0] - b[0]).forEach(([s, e]) => {
        const last = out[out.length - 1];
        if (last && s - last[1] < 700) last[1] = Math.max(last[1], e); else out.push([s, e]);
      });
    return out;
  }, [beats]);
  let pip = 0;
  for (const [s, e] of spans) {
    const v = Math.min(interpolate(frame, [toF(s), toF(s) + MORPH], [0, 1], clamp), interpolate(frame, [toF(e), toF(e) + MORPH], [1, 0], clamp));
    pip = Math.max(pip, v);
  }
  pip = Easing.inOut(Easing.cubic)(pip);
  const fullMedia = live.find((b) => b.type === "media" && (b as { full?: boolean }).full);

  const R = { x: FULL.x + (PIP.x - FULL.x) * pip, y: FULL.y + (PIP.y - FULL.y) * pip, w: FULL.w + (PIP.w - FULL.w) * pip, h: FULL.h + (PIP.h - FULL.h) * pip,
              r: FULL.r + (PIP.r - FULL.r) * pip, b: FULL.b + (PIP.b - FULL.b) * pip };
  const shot = shots.find((s) => ms >= s.startMs && ms < s.endMs);
  const push = interpolate(ms - (shot?.startMs ?? 0), [0, 6000], [1, 1.03], clamp); // slow push-in inside each shot
  const zoom = ((shot ? shot.scale : 1) * push) * (1 - pip) + 1 * pip;
  const vf = frameVideo({ w: R.w, h: R.h }, faceAt(faces, ms), zoom, pip, 0.42, srcW, srcH);
  const bw = live.some((b) => b.type === "bw");
  const endBeat = live.find((b) => b.type === "end");

  const render = (b: Beat, i: number) => {
    const c = ctxOf(b);
    switch (b.type) {
      case "title": return <Title key={i} b={b} c={c} />;
      case "text": return <TextSlide key={i} b={b} c={c} />;
      case "overlay": return <Overlay key={i} b={b} c={c} />;
      case "callout": return <Callout key={i} b={b} c={c} />;
      case "name": return <Name key={i} b={b} c={c} />;
      case "chips": return <Chips key={i} b={b} c={c} />;
      case "cta": return <Cta key={i} b={b} c={c} />;
      case "roadmap": return <Roadmap key={i} b={b} c={c} />;
      case "compare": return <Compare key={i} b={b} c={c} />;
      case "stack": return <Stack key={i} b={b} c={c} />;
      case "steps": return <Steps key={i} b={b} c={c} />;
      case "stat": return <Stat key={i} b={b} c={c} />;
      case "media": return b.full ? null : <Media key={i} b={b} c={c} />;
      default: return null;
    }
  };

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {pip > 0 && <AbsoluteFill style={{ opacity: pip }}><Swoosh f={frame} /></AbsoluteFill>}
      {fullMedia && <Media b={fullMedia as Extract<Beat, { type: "media" }>} c={ctxOf(fullMedia)} />}
      {/* paper beats sit under the speaker; the speaker is drawn on top so the PiP never gets covered */}
      {live.filter((b) => PAPER_BEATS.has(b.type)).map(render)}
      <div style={{ position: "absolute", left: R.x - R.b, top: R.y - R.b, width: R.w + 2 * R.b, height: R.h + 2 * R.b, borderRadius: R.r + R.b, background: "white",
                    border: pip > 0.01 ? `2px solid ${C.rule}` : "none", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", left: R.b, top: R.b, width: R.w, height: R.h, borderRadius: R.r, overflow: "hidden", background: "#111" }}>
          <OffthreadVideo src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: srcW, height: srcH, transformOrigin: "0 0",
                                                        transform: `translate(${vf.tx}px, ${vf.ty}px) scale(${vf.S})`, filter: bw ? "grayscale(1) contrast(1.08)" : undefined }} />
        </div>
      </div>
      {live.filter((b) => !PAPER_BEATS.has(b.type) && b.type !== "end").map(render)}
      {endBeat && <End b={endBeat as Extract<Beat, { type: "end" }>} c={ctxOf(endBeat)} brand={brand} />}
    </AbsoluteFill>
  );
};

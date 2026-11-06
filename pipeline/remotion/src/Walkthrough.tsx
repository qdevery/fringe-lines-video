import React from "react";
import { AbsoluteFill, OffthreadVideo, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import type { Shot } from "./types";
import { faceAt, frameVideo, type Face } from "./ShortV2";
import { C, SERIF, SANS, MONO, TONE, type Tone, type Tok, type Ctx, useKitFonts, ease, clamp, pop, Words, relTokens, Rich, exitStyle,
         Eyebrow, Title, Name, Cta, End, LogoMark } from "./Monologue";

// "How-to screen share" (16:9). Motion language modelled on a 2026 creator walkthrough ("STOP using X like ChatGPT"):
// the speaker is full-frame about two-thirds of the time with small white pills stacking top-left as points are made;
// when the screen matters the camera dissolves to a paper canvas and the screen recording sits in a rounded card that
// the "camera" zooms and pans around, with highlight boxes drawn on, private bits blurred and the app's tile in the
// corner. Flow diagrams, check tables, numbered lists and serif chapter cards share the same paper canvas.
// Rendered in the FringeLines v2.1 kit: Instrument Serif display, Archivo text, Plex Mono labels, green brand,
// blue for the "before"/problem side, orange only for the number that matters, flat surfaces and hairlines.

type Box = [number, number, number, number]; // x, y, w, h as fractions of the screen recording
type Item = { text: string; ms: number; sub?: string; tone?: Tone; icon?: string; logo?: string; bleed?: boolean };
type Focus = { ms: number; box: Box };
type Mark = { ms: number; endMs?: number; box: Box; label?: string; kind?: "box" | "underline" };
type BlurR = { box: Box; ms?: number; endMs?: number };

export type WBeat =
  | { type: "title"; startMs: number; endMs: number; eyebrow?: string; tokens: Tok[] }
  | { type: "name"; startMs: number; endMs: number; tokens: Tok[]; role?: string }
  | { type: "cta"; startMs: number; endMs: number; tokens: Tok[]; sub?: string }
  | { type: "end"; startMs: number; endMs: number; eyebrow?: string; tokens: Tok[]; sub?: string; url?: string; tone?: Tone }
  | { type: "pills"; startMs: number; endMs: number; items: Item[]; side?: "left" | "right" }
  | { type: "big"; startMs: number; endMs: number; tokens: Tok[]; sub?: string; side?: "left" | "right" }
  | { type: "card"; startMs: number; endMs: number; label?: string; text: string; side?: "left" | "right"; typing?: boolean; logo?: string; bleed?: boolean }
  | { type: "logos"; startMs: number; endMs: number; items: Item[]; label?: string; side?: "left" | "right" }
  | { type: "screen"; startMs: number; endMs: number; from?: number; focus?: Focus[]; marks?: Mark[]; blur?: BlurR[];
      apps?: string[]; eyebrow?: string; pip?: boolean }
  | { type: "flow"; startMs: number; endMs: number; title?: string; items: Item[] }
  | { type: "table"; startMs: number; endMs: number; title?: string; columns: [string, string]; rows: (Item & { values: [boolean, boolean] })[]; highlight?: 0 | 1 }
  | { type: "list"; startMs: number; endMs: number; title?: string; items: Item[] }
  | { type: "chapter"; startMs: number; endMs: number; eyebrow?: string; text: string };

export type WalkthroughProps = {
  src: string; srcW?: number; srcH?: number; durationInFrames: number; shots: Shot[]; faces?: Face[];
  screen?: string; screenW?: number; screenH?: number; beats: WBeat[]; brand?: string;
};

const W = 1920, H = 1080;
const PAPER = new Set(["screen", "flow", "table", "list", "chapter"]);
const MORPH = 12;  // frames: camera <-> paper dissolve
const EXIT = 9;    // frames: blur-out exits
const FULL = { x: 0, y: 0, w: W, h: H, r: 0 };
const PIPR = { x: 1560, y: 700, w: 300, h: 300, r: 150 }; // round speaker bubble during screen beats with pip: true

// merged [start, end] spans of a beat set; gaps under 0.7 s are bridged so the canvas doesn't flicker
function spansOf(beats: WBeat[], pred: (b: WBeat) => boolean) {
  const out: [number, number][] = [];
  beats.filter(pred).map((b) => [b.startMs, b.endMs] as [number, number]).sort((a, b) => a[0] - b[0]).forEach(([s, e]) => {
    const l = out[out.length - 1];
    if (l && s - l[1] < 700) l[1] = Math.max(l[1], e); else out.push([s, e]);
  });
  return out;
}
const amountIn = (spans: [number, number][], frame: number, toF: (m: number) => number) => {
  let v = 0;
  for (const [s, e] of spans) v = Math.max(v, Math.min(interpolate(frame, [toF(s), toF(s) + MORPH], [0, 1], clamp), interpolate(frame, [toF(e), toF(e) + MORPH], [1, 0], clamp)));
  return Easing.inOut(Easing.cubic)(v);
};

// ---------- small icons (drawn, so no icon font is needed) ----------
const Icon: React.FC<{ kind?: string; size: number; color: string }> = ({ kind = "dot", size, color }) => {
  const s = size, st = { stroke: color, strokeWidth: s * 0.12, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "check") return <svg width={s} height={s} viewBox="0 0 10 10"><path d="M2.4 5.3 L4.3 7.1 L7.7 3.2" {...st} strokeWidth={1.3} /></svg>;
  if (kind === "x") return <svg width={s} height={s} viewBox="0 0 10 10"><path d="M3 3 L7 7 M7 3 L3 7" {...st} strokeWidth={1.3} /></svg>;
  if (kind === "arrow") return <svg width={s} height={s} viewBox="0 0 10 10"><path d="M2.5 5 H7.3 M5.2 2.9 L7.4 5 L5.2 7.1" {...st} strokeWidth={1.2} /></svg>;
  if (/^\d+$/.test(kind)) return <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: s * 0.62, color, lineHeight: 1 }}>{kind}</span>;
  return <svg width={s} height={s} viewBox="0 0 10 10"><circle cx="5" cy="5" r="1.7" fill={color} /></svg>;
};
const toneFill = (t?: Tone, icon?: string) => (t ? TONE[t].ink : icon === "x" ? C.blue[1] : C.green[1]);

// The round marker on pills, flow nodes and list cards: the company's logo when the item names one (with the ✓/✗
// circle beside it when an icon is also set), otherwise the coloured icon circle.
const IconDot: React.FC<{ it: Item; size: number; def: string }> = ({ it, size, def }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, background: toneFill(it.tone, it.icon), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Icon kind={it.icon ?? def} size={size * 0.81} color="white" />
  </div>
);
const Badge: React.FC<{ it: Item; size: number; def: string }> = ({ it, size, def }) => it.logo ? (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.16, flexShrink: 0 }}>
    {it.icon && <IconDot it={it} size={size} def={def} />}
    <LogoMark src={it.logo} bleed={it.bleed} size={size} />
  </div>
) : <IconDot it={it} size={size} def={def} />;
// A company with no logo in the library: its initial in a round tile, so a logo row stays even.
const Monogram: React.FC<{ text: string; size: number }> = ({ text, size }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, background: C.green[5], border: `2px solid ${C.rule}`, display: "flex", alignItems: "center",
                justifyContent: "center", fontFamily: SERIF, fontSize: size * 0.56, color: C.green[0], flexShrink: 0, boxSizing: "border-box" }}>
    {text.replace(/[*\[\]]/g, "").trim().charAt(0).toUpperCase()}
  </div>
);

// ---------- camera overlays ----------

// White pills that stack top-left as points are made (✓ green, ✗ blue, numbers, dots). Earlier pills stay.
const Pills: React.FC<{ b: Extract<WBeat, { type: "pills" }>; c: Ctx }> = ({ b, c }) => (
  <div style={{ position: "absolute", top: 64, ...(b.side === "right" ? { right: 64, alignItems: "flex-end" } : { left: 64, alignItems: "flex-start" }),
                display: "flex", flexDirection: "column", gap: 16, ...exitStyle(c.out) }}>
    {b.items.map((it, i) => {
      const f = c.f - c.toF(it.ms - b.startMs);
      if (f < 0) return null;
      const s = pop(f, c.fps, 12), k = interpolate(f, [0, 6], [0, 1], clamp);
      return (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, background: "white", borderRadius: 999, padding: "12px 30px 12px 12px",
                              border: `2px solid ${C.rule}`, opacity: k, filter: `blur(${(1 - k) * 8}px)`,
                              transform: `translateX(${(1 - s) * (b.side === "right" ? 40 : -40)}px) scale(${0.85 + 0.15 * s})`,
                              transformOrigin: b.side === "right" ? "right center" : "left center" }}>
          <Badge it={it} size={52} def="check" />
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: C.ink, whiteSpace: "nowrap" }}><Rich text={it.text} /></span>
        </div>
      );
    })}
  </div>
);

// A big serif figure in the corner ("[10] *minutes*"): the one number, orange; the unit italic.
const Big: React.FC<{ b: Extract<WBeat, { type: "big" }>; c: Ctx }> = ({ b, c }) => (
  <>
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${b.side === "right" ? "100%" : "0%"} 0%, rgba(10,14,8,.6) 0%, rgba(10,14,8,.25) 35%, rgba(10,14,8,0) 60%)`,
                         opacity: interpolate(c.f, [0, 8], [0, 1], clamp) * (1 - c.out) }} />
  <div style={{ position: "absolute", top: 60, ...(b.side === "right" ? { right: 80, textAlign: "right" } : { left: 80 }), ...exitStyle(c.out) }}>
    <div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 1, color: "white", textShadow: "0 4px 30px rgba(0,0,0,.35)" }}>
      <Words tokens={relTokens(b.tokens, b.startMs)} ctx={c} dark gap={0.18} />
    </div>
    {b.sub && <Eyebrow text={b.sub} color="white" style={{ marginTop: 12, textShadow: "0 2px 14px rgba(0,0,0,.5)", opacity: interpolate(c.f, [8, 16], [0, 1], clamp) }} />}
  </div>
  </>
);

// A small floating UI card (a prompt being typed, a command, a reply).
const Card: React.FC<{ b: Extract<WBeat, { type: "card" }>; c: Ctx }> = ({ b, c }) => {
  const s = pop(c.f, c.fps, 14);
  const dur = Math.max(1, (b.endMs - b.startMs) / 1000 * c.fps);
  const n = b.typing === false ? b.text.length : Math.round(interpolate(c.f, [6, Math.min(6 + b.text.length * 1.2, dur * 0.7)], [0, b.text.length], clamp));
  const caret = n < b.text.length || Math.floor(c.f / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", top: 70, ...(b.side === "right" ? { right: 70 } : { left: 70 }), width: 620, background: "white", borderRadius: 22,
                  border: `2px solid ${C.rule}`, padding: "24px 30px", ...exitStyle(c.out), opacity: (1 - c.out) * Math.min(1, s * 1.4),
                  transform: `translateY(${(1 - s) * -30}px) scale(${0.92 + 0.08 * s})`, transformOrigin: "top left" }}>
      {(b.label || b.logo) && <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        {b.logo ? <LogoMark src={b.logo} bleed={b.bleed} size={44} /> : <span style={{ width: 14, height: 14, borderRadius: 7, background: C.green[1] }} />}
        {b.label && <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase", color: C.label }}>{b.label}</span>}
      </div>}
      <div style={{ fontFamily: SANS, fontSize: 36, lineHeight: 1.3, color: C.ink, minHeight: 46 }}>
        {b.text.slice(0, n)}<span style={{ display: "inline-block", width: 3, height: 38, marginLeft: 3, verticalAlign: "-6px", background: C.green[1], opacity: caret ? 1 : 0 }} />
      </div>
    </div>
  );
};

// A row of company tiles over the camera (logo + name), each landing as it is named ("Apollo, Clay, Lemlist...").
const Logos: React.FC<{ b: Extract<WBeat, { type: "logos" }>; c: Ctx }> = ({ b, c }) => {
  const right = b.side === "right";
  return (
    <div style={{ position: "absolute", top: 64, ...(right ? { right: 64, alignItems: "flex-end" } : { left: 64, alignItems: "flex-start" }),
                  display: "flex", flexDirection: "column", gap: 16, ...exitStyle(c.out) }}>
      {b.label && <div style={{ background: "white", border: `2px solid ${C.rule}`, borderRadius: 999, padding: "10px 22px", opacity: interpolate(c.f, [0, 8], [0, 1], clamp) }}>
        <Eyebrow text={b.label} color={C.label} style={{ fontSize: 22 }} /></div>}
      <div style={{ display: "flex", gap: 14 }}>
        {b.items.map((it, i) => {
          // every tile keeps its slot from the start, so the row reads in spoken order on either side and nothing shifts
          const f = c.f - c.toF(it.ms - b.startMs);
          const s = f < 0 ? 0 : pop(f, c.fps, 12), k = f < 0 ? 0 : interpolate(f, [0, 6], [0, 1], clamp);
          return (
            <div key={i} style={{ background: "white", borderRadius: 24, border: `2px solid ${C.rule}`, padding: "18px 18px 14px", minWidth: 128, boxSizing: "border-box",
                                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: k, filter: `blur(${(1 - k) * 8}px)`,
                                  transform: `translateY(${(1 - s) * -24}px) scale(${0.85 + 0.15 * s})` }}>
              {it.logo ? <LogoMark src={it.logo} bleed={it.bleed} size={80} /> : it.icon ? <IconDot it={it} size={80} def="dot" /> : <Monogram text={it.text} size={80} />}
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: C.ink, whiteSpace: "nowrap" }}><Rich text={it.text} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- paper beats ----------

const AppTiles: React.FC<{ apps?: string[]; eyebrow?: string; f: number; fps: number }> = ({ apps = [], eyebrow, f, fps }) => (
  <div style={{ position: "absolute", left: 56, top: 52, display: "flex", alignItems: "flex-start", gap: 22 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {apps.map((a, i) => {
        const s = pop(f - 4 - i * 5, fps, 12);
        const img = /\.(png|jpe?g|svg|webp)$/i.test(a);
        return (
          <div key={i} style={{ width: 92, height: 92, borderRadius: 24, background: "white", border: `2px solid ${C.rule}`, display: "flex", alignItems: "center",
                                justifyContent: "center", overflow: "hidden", transform: `scale(${s})`, opacity: Math.min(1, s * 1.5) }}>
            {img ? <Img src={staticFile(a)} style={{ width: 64, height: 64, objectFit: "contain" }} />
                 : <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: a.length > 2 ? 22 : 34, color: C.green[0], textAlign: "center", lineHeight: 1.05 }}>{a}</span>}
          </div>
        );
      })}
    </div>
    {eyebrow && <div style={{ marginTop: apps.length ? 22 : 0, background: "white", border: `2px solid ${C.rule}`, borderRadius: 999, padding: "10px 22px",
                              opacity: interpolate(f, [6, 14], [0, 1], clamp) }}><Eyebrow text={eyebrow} color={C.label} style={{ fontSize: 22 }} /></div>}
  </div>
);

// The screen recording in a rounded card; focus keyframes zoom/pan the "camera", marks draw on, blur boxes hide details.
const VIEW = { cx: 960, cy: 600, w: 1720, h: 860 }; // where the focused region is fitted
const Screen: React.FC<{ b: Extract<WBeat, { type: "screen" }>; c: Ctx; screen?: string; sw: number; sh: number }> = ({ b, c, screen, sw, sh }) => {
  const sa = sw / sh;
  const cw = Math.min(1640, 860 * sa), ch = cw / sa;                     // card size at zoom 1
  const fit = (box: Box) => {
    const s = Math.max(1, Math.min(VIEW.w / (box[2] * cw), VIEW.h / (box[3] * ch), 3));
    return { s, x: (box[0] + box[2] / 2) * cw, y: (box[1] + box[3] / 2) * ch };
  };
  const keys = [{ ms: b.startMs, box: [0, 0, 1, 1] as Box }, ...(b.focus ?? [])].sort((a, z) => a.ms - z.ms);
  let cam = fit(keys[0].box);
  for (let i = 1; i < keys.length; i++) {
    const kf = c.toF(keys[i].ms - b.startMs);
    if (c.f < kf) break;
    const t = interpolate(c.f, [kf, kf + 22], [0, 1], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
    const nx = fit(keys[i].box);
    cam = { s: Math.exp(Math.log(cam.s) + (Math.log(nx.s) - Math.log(cam.s)) * t), x: cam.x + (nx.x - cam.x) * t, y: cam.y + (nx.y - cam.y) * t };
  }
  const k = interpolate(c.f, [0, 14], [0, 1], { ...clamp, easing: ease });
  // where the screen track starts playing at this beat's first frame: by default it is in sync with the camera clip
  const startFrom = c.toF(b.from !== undefined ? b.from * 1000 : b.startMs);
  const tx = VIEW.cx - cam.x * cam.s, ty = VIEW.cy - cam.y * cam.s + (1 - k) * 50;
  const live = (ms?: number, end?: number) => (ms === undefined || c.ms >= ms) && (end === undefined || c.ms < end);
  return (
    <AbsoluteFill style={{ ...exitStyle(c.out) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: cw, height: ch, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${cam.s * (0.97 + 0.03 * k)})`,
                    opacity: k, filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined }}>
        <div style={{ position: "absolute", inset: -10 / cam.s, borderRadius: 26 / cam.s, background: "white", border: `${2 / cam.s}px solid ${C.rule}` }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 16 / cam.s, overflow: "hidden", background: "white" }}>
          {screen && <Sequence from={c.toF(b.startMs)} layout="none"><OffthreadVideo src={staticFile(screen)} startFrom={startFrom} muted style={{ width: cw, height: ch }} /></Sequence>}
          {(b.blur ?? []).filter((r) => live(r.ms, r.endMs)).map((r, i) => (
            <div key={i} style={{ position: "absolute", left: r.box[0] * cw, top: r.box[1] * ch, width: r.box[2] * cw, height: r.box[3] * ch,
                                  backdropFilter: "blur(9px)", WebkitBackdropFilter: "blur(9px)", background: "rgba(247,247,245,.35)", borderRadius: 6 / cam.s }} />
          ))}
        </div>
        {(b.marks ?? []).filter((m) => c.ms >= m.ms).map((m, i) => {
          const f = c.f - c.toF(m.ms - b.startMs);
          const draw = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: ease });
          const gone = m.endMs !== undefined ? interpolate(c.f, [c.toF(m.endMs - b.startMs), c.toF(m.endMs - b.startMs) + 8], [1, 0], clamp) : 1;
          const pad = 8 / cam.s, x = m.box[0] * cw - pad, y = m.box[1] * ch - pad, w = m.box[2] * cw + 2 * pad, h = m.box[3] * ch + 2 * pad;
          const sw2 = 5 / cam.s;
          return (
            <div key={i} style={{ position: "absolute", left: 0, top: 0, opacity: gone }}>
              <svg width={cw} height={ch} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
                {m.kind === "underline"
                  ? <line x1={x} y1={y + h} x2={x + w * draw} y2={y + h} stroke={C.green[1]} strokeWidth={sw2 * 1.2} strokeLinecap="round" />
                  : <rect x={x} y={y} width={w} height={h} rx={10 / cam.s} fill={`rgba(61,138,99,${0.07 * draw})`} stroke={C.green[1]} strokeWidth={sw2}
                          pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />}
              </svg>
              {m.label && <div style={{ position: "absolute", left: x, top: y - 62 / cam.s, transformOrigin: "0 0", transform: `scale(${1 / cam.s})`,
                                        opacity: interpolate(f, [6, 12], [0, 1], clamp), background: C.green[1], color: "white", fontFamily: SANS, fontWeight: 600,
                                        fontSize: 32, padding: "8px 20px", borderRadius: 999, whiteSpace: "nowrap" }}>{m.label}</div>}
            </div>
          );
        })}
      </div>
      <AppTiles apps={b.apps} eyebrow={b.eyebrow} f={c.f} fps={c.fps} />
    </AbsoluteFill>
  );
};

const Heading: React.FC<{ text?: string; f: number }> = ({ text, f }) => text
  ? <div style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1.05, color: C.ink, textAlign: "center", marginBottom: 56, opacity: interpolate(f, [0, 10], [0, 1], clamp),
                  transform: `translateY(${interpolate(f, [0, 12], [20, 0], { ...clamp, easing: ease })}px)` }}><Rich text={text} /></div> : null;

// Nodes left to right; each arrow draws in before its node lands; the newest node is outlined in green.
const Flow: React.FC<{ b: Extract<WBeat, { type: "flow" }>; c: Ctx }> = ({ b, c }) => {
  const n = b.items.length, gap = 110, nw = Math.min(400, (1680 - gap * (n - 1)) / n);
  const shown = b.items.filter((it) => c.ms >= it.ms).length;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...exitStyle(c.out) }}>
      <Heading text={b.title} f={c.f} />
      <div style={{ display: "flex", alignItems: "center" }}>
        {b.items.map((it, i) => {
          const f = c.f - c.toF(it.ms - b.startMs);
          const s = pop(f, c.fps, 13), k = interpolate(f, [0, 6], [0, 1], clamp);
          const arrow = interpolate(f, [-8, 2], [0, 1], { ...clamp, easing: ease });
          const active = i === shown - 1;
          return (
            <React.Fragment key={i}>
              {i > 0 && <svg width={gap} height={40} style={{ opacity: f > -8 ? 1 : 0 }}>
                <line x1={14} y1={20} x2={14 + (gap - 34) * arrow} y2={20} stroke={C.muted} strokeWidth={3} strokeLinecap="round" />
                {arrow > 0.95 && <path d={`M ${gap - 30} 12 L ${gap - 20} 20 L ${gap - 30} 28`} stroke={C.muted} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>}
              <div style={{ width: nw, background: "white", borderRadius: 22, border: `${active ? 3 : 2}px solid ${active ? C.green[1] : C.rule}`, padding: "28px 26px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: k, filter: `blur(${(1 - k) * 8}px)`,
                            transform: `scale(${0.85 + 0.15 * s})`, boxSizing: "border-box" }}>
                <Badge it={it} size={64} def={String(i + 1)} />
                <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 38, color: C.ink, textAlign: "center", lineHeight: 1.15 }}><Rich text={it.text} /></div>
                {it.sub && <div style={{ fontFamily: MONO, fontSize: 22, color: C.label, textAlign: "center", letterSpacing: "0.04em" }}>{it.sub}</div>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Two-column check table; the highlighted column is a soft green panel with a green outline (the reference's "AI agents").
const Table: React.FC<{ b: Extract<WBeat, { type: "table" }>; c: Ctx }> = ({ b, c }) => {
  const hi = b.highlight ?? 1, colW = 300, rowH = 96, labW = 760;
  const k = interpolate(c.f, [0, 12], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...exitStyle(c.out) }}>
      <Heading text={b.title} f={c.f} />
      <div style={{ position: "relative", background: "white", borderRadius: 26, border: `2px solid ${C.rule}`, padding: "0 0 26px", opacity: k,
                    transform: `translateY(${(1 - k) * 30}px)` }}>
        <div style={{ position: "absolute", top: -14, bottom: -14, left: labW + hi * colW, width: colW, borderRadius: 24, border: `3px solid ${C.green[1]}`, background: C.green[5] }} />
        <div style={{ display: "flex", position: "relative", height: 130, alignItems: "flex-end", paddingBottom: 20, borderBottom: `2px solid ${C.rule}` }}>
          <div style={{ width: labW }} />
          {b.columns.map((col, j) => <div key={j} style={{ width: colW, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 40, color: j === hi ? C.green[0] : C.muted }}>{col}</div>)}
        </div>
        {b.rows.map((r, i) => {
          const f = c.f - c.toF(r.ms - b.startMs);
          const s = pop(f, c.fps, 12), rk = interpolate(f, [0, 6], [0, 1], clamp);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", height: rowH, position: "relative", opacity: rk, filter: `blur(${(1 - rk) * 6}px)`,
                                  borderBottom: i < b.rows.length - 1 ? `2px solid ${C.rule}` : "none" }}>
              <div style={{ width: labW, paddingLeft: 44, fontFamily: SANS, fontWeight: 500, fontSize: 40, color: C.ink, boxSizing: "border-box" }}><Rich text={r.text} /></div>
              {r.values.map((v, j) => (
                <div key={j} style={{ width: colW, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 28, transform: `scale(${s})`, display: "flex", alignItems: "center", justifyContent: "center",
                                background: v ? (j === hi ? C.green[1] : C.body) : "transparent", border: v ? "none" : `3px solid ${C.rule}` }}>
                    <Icon kind={v ? "check" : "x"} size={44} color={v ? "white" : C.label} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Numbered cards stacked vertically (the reference's "4 mistakes" list).
const List: React.FC<{ b: Extract<WBeat, { type: "list" }>; c: Ctx }> = ({ b, c }) => {
  const n = b.items.length, gap = Math.min(30, 300 / n), h = Math.min(120, (720 - gap * (n - 1)) / n);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...exitStyle(c.out) }}>
      <Heading text={b.title} f={c.f} />
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {b.items.map((it, i) => {
          const f = c.f - c.toF(it.ms - b.startMs);
          const s = pop(f, c.fps, 13), k = interpolate(f, [0, 6], [0, 1], clamp);
          return (
            <div key={i} style={{ width: 980, height: h, background: "white", borderRadius: 20, border: `2px solid ${C.rule}`, display: "flex", alignItems: "center",
                                  gap: 30, padding: "0 34px", boxSizing: "border-box", opacity: k, filter: `blur(${(1 - k) * 8}px)`, transform: `translateY(${(1 - s) * 24}px)` }}>
              <Badge it={it} size={h * 0.56} def={String(i + 1)} />
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: Math.min(44, h * 0.4), color: C.ink }}><Rich text={it.text} /></div>
              {it.sub && <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 24, color: C.label }}>{it.sub}</div>}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Chapter card: serif title rises from behind a green rule, then a mono tag drops in under it.
const Chapter: React.FC<{ b: Extract<WBeat, { type: "chapter" }>; c: Ctx }> = ({ b, c }) => {
  const line = interpolate(c.f, [0, 10], [0, 1], { ...clamp, easing: ease });
  const rise = interpolate(c.f, [5, 22], [1, 0], { ...clamp, easing: ease });
  const tag = pop(c.f - 16, c.fps, 12);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...exitStyle(c.out) }}>
      <div style={{ overflow: "hidden", paddingBottom: 8 }}>
        <div style={{ fontFamily: SERIF, fontSize: 180, lineHeight: 1, color: C.ink, textAlign: "center", maxWidth: 1600, transform: `translateY(${rise * 105}%)` }}><Rich text={b.text} /></div>
      </div>
      <div style={{ width: 140, height: 6, background: C.green[1], transform: `scaleX(${line})`, marginTop: 6 }} />
      {b.eyebrow && <div style={{ marginTop: 34, background: C.green[1], color: "white", fontFamily: MONO, fontWeight: 600, fontSize: 28, letterSpacing: "0.16em",
                                  textTransform: "uppercase", padding: "10px 24px", borderRadius: 8, transform: `scale(${tag})`, opacity: Math.min(1, tag * 1.5) }}>{b.eyebrow}</div>}
    </AbsoluteFill>
  );
};

export const Walkthrough: React.FC<WalkthroughProps> = ({ src, srcW = 1920, srcH = 1080, shots, faces, screen, screenW = 1920, screenH = 1080, beats, brand = "FringeLines" }) => {
  useKitFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const toF = (m: number) => Math.round((m / 1000) * fps);
  const tail = (EXIT / fps) * 1000;
  const live = beats.filter((b) => ms >= b.startMs && ms < b.endMs + tail);
  const ctxOf = (b: WBeat): Ctx => ({ ms, f: frame - toF(b.startMs), out: interpolate(frame, [toF(b.endMs), toF(b.endMs) + EXIT], [0, 1], clamp), fps, toF });

  const paperSpans = React.useMemo(() => spansOf(beats, (b) => PAPER.has(b.type)), [beats]);
  const pipSpans = React.useMemo(() => spansOf(beats, (b) => b.type === "screen" && !!b.pip), [beats]);
  const paper = amountIn(paperSpans, frame, toF);
  const pip = amountIn(pipSpans, frame, toF);

  const R = { x: FULL.x + (PIPR.x - FULL.x) * pip, y: FULL.y + (PIPR.y - FULL.y) * pip, w: FULL.w + (PIPR.w - FULL.w) * pip, h: FULL.h + (PIPR.h - FULL.h) * pip,
              r: FULL.r + (PIPR.r - FULL.r) * pip };
  const shot = shots.find((s) => ms >= s.startMs && ms < s.endMs);
  const push = interpolate(ms - (shot?.startMs ?? 0), [0, 6000], [1, 1.03], clamp);
  const zoom = ((shot ? shot.scale : 1) * push) * (1 - pip) + 1.25 * pip;
  const vf = frameVideo({ w: R.w, h: R.h }, faceAt(faces, ms), zoom, pip, 0.42, srcW, srcH);
  const endBeat = live.find((b) => b.type === "end");

  const render = (b: WBeat, i: number) => {
    const c = ctxOf(b);
    switch (b.type) {
      case "title": return <Title key={i} b={b} c={c} />;
      case "name": return <Name key={i} b={b} c={c} />;
      case "cta": return <Cta key={i} b={b} c={c} />;
      case "pills": return <Pills key={i} b={b} c={c} />;
      case "big": return <Big key={i} b={b} c={c} />;
      case "card": return <Card key={i} b={b} c={c} />;
      case "logos": return <Logos key={i} b={b} c={c} />;
      case "screen": return <Screen key={i} b={b} c={c} screen={screen} sw={screenW} sh={screenH} />;
      case "flow": return <Flow key={i} b={b} c={c} />;
      case "table": return <Table key={i} b={b} c={c} />;
      case "list": return <List key={i} b={b} c={c} />;
      case "chapter": return <Chapter key={i} b={b} c={c} />;
      default: return null;
    }
  };

  const camera = (
    <div style={{ position: "absolute", left: R.x - (pip > 0 ? 8 : 0), top: R.y - (pip > 0 ? 8 : 0), width: R.w + (pip > 0 ? 16 : 0), height: R.h + (pip > 0 ? 16 : 0),
                  borderRadius: R.r + 8, background: pip > 0 ? "white" : undefined, border: pip > 0.01 ? `2px solid ${C.rule}` : "none", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", left: pip > 0 ? 8 : 0, top: pip > 0 ? 8 : 0, width: R.w, height: R.h, borderRadius: R.r, overflow: "hidden", background: "#111" }}>
        <OffthreadVideo src={staticFile(src)} style={{ position: "absolute", left: 0, top: 0, width: srcW, height: srcH, transformOrigin: "0 0",
                                                      transform: `translate(${vf.tx}px, ${vf.ty}px) scale(${vf.S})`,
                                                      filter: paper > 0 && pip === 0 ? `blur(${paper * 24}px)` : undefined }} />
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {paper < 1 && pip === 0 && camera}
      {paper > 0 && <AbsoluteFill style={{ background: C.paper, opacity: paper }} />}
      {live.filter((b) => PAPER.has(b.type)).map(render)}
      {pip > 0 && camera}
      {live.filter((b) => !PAPER.has(b.type) && b.type !== "end").map(render)}
      {endBeat && <End b={endBeat as Extract<WBeat, { type: "end" }>} c={ctxOf(endBeat)} brand={brand} />}
    </AbsoluteFill>
  );
};

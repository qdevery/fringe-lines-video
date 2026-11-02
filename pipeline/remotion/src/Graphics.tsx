import React from "react";
import { interpolate, spring, useVideoConfig, Easing } from "remotion";
import { ACCENT } from "./brand";
import { SANS, SERIF } from "./useFonts2";

// Data-driven explainer graphics used by ShortV2 (and reusable in the episode intro).
// Every graphic gets `f` = frames since it appeared, so they animate in on their own.

export const INK2 = "#16161A";
export const MUTED = "#6E6A64";
export const PAPER = "#F3F0EA";

export type Graphic =
  | { type: "stat"; kicker?: string; prefix?: string; value: number; decimals?: number; suffix?: string; label: string }
  | { type: "people"; kicker?: string; value: string; label: string; filled: number }
  | { type: "lines"; kicker?: string; series: { label: string; shape: "up" | "flat" | "down" }[]; caption?: string }
  | { type: "quote"; text: string; by?: string }
  | { type: "headline"; source: string; title: string; highlight?: string }
  | { type: "list"; title: string; items: string[] }
  | { type: "bars"; kicker?: string; rows: { label: string; value: number; from?: number; note?: string; hi?: boolean }[];
      prefix?: string; suffix?: string; decimals?: number; signed?: boolean; caption?: string };

const sp = (f: number, fps: number, delay = 0, damping = 14) =>
  spring({ frame: f - delay, fps, config: { damping, stiffness: 140, mass: 0.7 } });

// *word* -> italic accent
export const Rich: React.FC<{ text: string; accent?: string }> = ({ text, accent = ACCENT }) => (
  <>
    {text.split(/(\*[^*]+\*)/).map((p, i) =>
      p.startsWith("*") ? (
        <span key={i} style={{ fontStyle: "italic", color: accent }}>{p.slice(1, -1)}</span>
      ) : (
        <span key={i}>{p}</span>
      ),
    )}
  </>
);

const Kicker: React.FC<{ text?: string; f: number }> = ({ text, f }) => {
  const { fps } = useVideoConfig();
  if (!text) return null;
  const s = sp(f, fps);
  return (
    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: 5, textTransform: "uppercase", color: MUTED,
                  opacity: s, transform: `translateY(${(1 - s) * 20}px)`, marginBottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ width: 36, height: 4, background: ACCENT, display: "inline-block", transform: `scaleX(${s})`, transformOrigin: "left" }} />
      {text}
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode; f: number; dark?: boolean; style?: React.CSSProperties }> = ({ children, f, dark, style }) => {
  const { fps } = useVideoConfig();
  const s = sp(f, fps);
  return (
    <div style={{ background: dark ? INK2 : "white", color: dark ? "white" : INK2, borderRadius: 36, padding: "56px 60px",
                  boxShadow: "0 40px 80px rgba(30,25,20,.18), 0 8px 20px rgba(30,25,20,.10)",
                  transform: `translateY(${(1 - s) * 120}px) scale(${0.9 + 0.1 * s}) rotate(${(1 - s) * -3}deg)`, opacity: Math.min(1, s * 1.5), ...style }}>
      {children}
    </div>
  );
};

const Stat: React.FC<Extract<Graphic, { type: "stat" }> & { f: number }> = ({ f, kicker, prefix = "", value, decimals = 0, suffix = "", label }) => {
  const { fps } = useVideoConfig();
  const t = interpolate(f, [4, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const n = (value * t).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const pop = sp(f, fps, 22, 8);
  const size = (prefix + value + suffix).length > 4 ? 230 : 300;
  return (
    <Card f={f} style={{ width: 860, textAlign: "left" }}>
      <Kicker text={kicker} f={f - 3} />
      <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 0.9, letterSpacing: -6, color: INK2, transform: `scale(${1 + 0.06 * Math.sin(Math.PI * Math.min(1, pop))})`, transformOrigin: "left center" }}>
        {prefix}{n}<span style={{ color: ACCENT, fontStyle: "italic" }}>{suffix}</span>
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, lineHeight: 1.2, marginTop: 30, color: INK2, opacity: sp(f, fps, 10) }}>
        <Rich text={label} />
      </div>
    </Card>
  );
};

const PersonIcon: React.FC<{ on: boolean; s: number }> = ({ on, s }) => (
  <svg width={56} height={70} viewBox="0 0 40 50" style={{ transform: `scale(${s})`, opacity: s }}>
    <circle cx={20} cy={12} r={10} fill={on ? ACCENT : "#D3CEC6"} />
    <path d="M2 50 C2 32 10 26 20 26 C30 26 38 32 38 50 Z" fill={on ? ACCENT : "#D3CEC6"} />
  </svg>
);

const People: React.FC<Extract<Graphic, { type: "people" }> & { f: number }> = ({ f, kicker, value, label, filled }) => {
  const { fps } = useVideoConfig();
  const cols = 10, rows = 5, total = cols * rows, on = Math.round(total * filled);
  return (
    <Card f={f} style={{ width: 860 }}>
      <Kicker text={kicker} f={f - 3} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 12px", marginBottom: 36 }}>
        {Array.from({ length: total }).map((_, i) => (
          <PersonIcon key={i} on={i < on && f > 14 + i * 0.5} s={sp(f, fps, 2 + i * 0.35, 12)} />
        ))}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 170, lineHeight: 0.9, letterSpacing: -3, opacity: sp(f, fps, 10) }}>{value}</div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 42, lineHeight: 1.2, marginTop: 18, opacity: sp(f, fps, 14) }}><Rich text={label} /></div>
    </Card>
  );
};

const Lines: React.FC<Extract<Graphic, { type: "lines" }> & { f: number }> = ({ f, kicker, series, caption }) => {
  const { fps } = useVideoConfig();
  const W = 740, H = 460;
  const path = (shape: string) => {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const x = (i / 8) * W;
      const y = shape === "up" ? H - 40 - Math.pow(i / 8, 1.6) * (H - 90) : shape === "down" ? 60 + (i / 8) * (H - 120) : H * 0.62 + Math.sin(i * 1.7) * 6;
      return [x, y];
    });
    return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  };
  const colors = [ACCENT, "#8A857D", "#3A6EA5"];
  return (
    <Card f={f} style={{ width: 860 }}>
      <Kicker text={kicker} f={f - 3} />
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#E6E1D9" strokeWidth={2} />)}
        {series.map((s, k) => {
          const draw = interpolate(f, [8 + k * 8, 38 + k * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
          const d = path(s.shape);
          const endY = s.shape === "up" ? 50 : s.shape === "down" ? H - 60 : H * 0.62;
          return (
            <g key={k}>
              <path d={d} fill="none" stroke={colors[k]} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <g opacity={interpolate(draw, [0.85, 1], [0, 1], { extrapolateLeft: "clamp" })}>
                <circle cx={W} cy={endY} r={16} fill={colors[k]} />
                <text x={W - 34} y={endY + (s.shape === "up" ? -34 : s.shape === "flat" ? 74 : -36)} textAnchor="end" fontFamily={SANS} fontWeight={800} fontSize={44} fill={colors[k]}>{s.label}</text>
              </g>
            </g>
          );
        })}
      </svg>
      {caption && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, marginTop: 36, opacity: sp(f, fps, 30) }}><Rich text={caption} /></div>}
    </Card>
  );
};

const Quote: React.FC<Extract<Graphic, { type: "quote" }> & { f: number }> = ({ f, text, by }) => {
  const { fps } = useVideoConfig();
  const words = text.match(/\*[^*]+\*\S*|\S+/g) ?? [];
  return (
    <Card f={f} dark style={{ width: 880 }}>
      <div style={{ fontFamily: SERIF, fontSize: 200, lineHeight: 0.6, color: ACCENT, height: 90 }}>“</div>
      <div style={{ fontFamily: SERIF, fontSize: 108, lineHeight: 1.0, letterSpacing: -1.5 }}>
        {words.map((w, i) => {
          const s = sp(f, fps, 4 + i * 2.2);
          return <span key={i} style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 30}px)`, marginRight: 22 }}><Rich text={w} /></span>;
        })}
      </div>
      {by && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: "#A9A39A", marginTop: 34, letterSpacing: 2, textTransform: "uppercase" }}>— {by}</div>}
    </Card>
  );
};

const Headline: React.FC<Extract<Graphic, { type: "headline" }> & { f: number }> = ({ f, source, title, highlight }) => {
  const sweep = interpolate(f, [14, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const parts = highlight ? title.split(highlight) : [title];
  return (
    <Card f={f} style={{ width: 880 }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 30, letterSpacing: 3, textTransform: "uppercase", color: MUTED, marginBottom: 26 }}>{source}</div>
      <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 1.05, letterSpacing: -1 }}>
        {parts[0]}
        {highlight && (
          <span style={{ backgroundImage: `linear-gradient(${ACCENT}55, ${ACCENT}55)`, backgroundRepeat: "no-repeat", backgroundSize: `${sweep * 100}% 42%`, backgroundPosition: "0 88%" }}>{highlight}</span>
        )}
        {parts[1]}
      </div>
    </Card>
  );
};

const List: React.FC<Extract<Graphic, { type: "list" }> & { f: number }> = ({ f, title, items }) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ width: 880 }}>
      <div style={{ fontFamily: SERIF, fontSize: 96, lineHeight: 1, marginBottom: 40, color: `var(--g-ink, ${INK2})`, opacity: sp(f, fps) }}><Rich text={title} /></div>
      {items.map((it, i) => {
        const s = sp(f, fps, 6 + i * 7);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, background: "white", borderRadius: 28, padding: "30px 36px", marginBottom: 22,
                                boxShadow: "0 20px 40px rgba(30,25,20,.12)", opacity: s, transform: `translateX(${(1 - s) * 200}px)` }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 80, color: ACCENT, width: 70 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, color: INK2 }}><Rich text={it} /></div>
          </div>
        );
      })}
    </div>
  );
};


// Real-data horizontal bars. Optional `from` draws a ghost bar (e.g. last year) under the value.
// Negative values grow left from a zero axis. `hi` rows are accent; others muted when any row is hi.
const Bars: React.FC<Extract<Graphic, { type: "bars" }> & { f: number }> = ({ f, kicker, rows, prefix = "", suffix = "", decimals = 0, signed, caption }) => {
  const { fps } = useVideoConfig();
  const BW = 740;
  const vals = rows.flatMap((r) => (r.from !== undefined ? [r.value, r.from] : [r.value]));
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * BW;
  const anyHi = rows.some((r) => r.hi);
  const fmt = (v: number) => (signed && v > 0 ? "+" : v < 0 ? "\u2212" : "") + prefix +
    Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  return (
    <Card f={f} style={{ width: 860 }}>
      <Kicker text={kicker} f={f - 3} />
      {rows.map((r, i) => {
        const t = interpolate(f, [8 + i * 4, 30 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const col = r.value < 0 ? "#3A6EA5" : !anyHi || r.hi ? ACCENT : "#B9B2A8";
        const z = x(0), e = x(r.value * t);
        return (
          <div key={i} style={{ marginBottom: 30, opacity: sp(f, fps, 4 + i * 4) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: SANS, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 36, color: INK2 }}><Rich text={r.label} /></span>
              <span style={{ fontWeight: 800, fontSize: 40, color: r.value < 0 ? "#3A6EA5" : INK2, whiteSpace: "nowrap", marginLeft: 20 }}>
                {r.from !== undefined && <span style={{ color: MUTED, fontWeight: 600 }}>{fmt(r.from)} → </span>}
                {fmt(r.value)}
                {r.note && <span style={{ color: ACCENT, fontStyle: "italic", fontWeight: 700, marginLeft: 14 }}>{r.note}</span>}
              </span>
            </div>
            <div style={{ position: "relative", width: BW, height: 40, background: "#F1EDE6", borderRadius: 8 }}>
              {r.from !== undefined && <div style={{ position: "absolute", left: Math.min(z, x(r.from)), width: Math.abs(x(r.from) - z), top: 0, bottom: 0, background: "#DAD4CA", borderRadius: 8 }} />}
              <div style={{ position: "absolute", left: Math.min(z, e), width: Math.abs(e - z), top: r.from !== undefined ? 8 : 0, bottom: r.from !== undefined ? 8 : 0, background: col, borderRadius: 8 }} />
              {lo < 0 && <div style={{ position: "absolute", left: z - 1.5, top: -6, bottom: -6, width: 3, background: INK2 }} />}
            </div>
          </div>
        );
      })}
      {caption && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, color: MUTED, marginTop: 6, opacity: sp(f, fps, 30) }}><Rich text={caption} /></div>}
    </Card>
  );
};

export const GraphicView: React.FC<{ g: Graphic; f: number }> = ({ g, f }) => {
  switch (g.type) {
    case "stat": return <Stat {...g} f={f} />;
    case "people": return <People {...g} f={f} />;
    case "lines": return <Lines {...g} f={f} />;
    case "quote": return <Quote {...g} f={f} />;
    case "headline": return <Headline {...g} f={f} />;
    case "list": return <List {...g} f={f} />;
    case "bars": return <Bars {...g} f={f} />;
  }
};

import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
// @ts-ignore - webpack asset imports
import archivo from "../fonts/Archivo.ttf";
// @ts-ignore
import monoR from "../fonts/IBMPlexMono-Regular.ttf";
// @ts-ignore
import monoSB from "../fonts/IBMPlexMono-SemiBold.ttf";

// FringeLines design kit v2 (Slide Master v2 / Clip Slides / Chart Kit v2), adapted to 1080x1350 carousel slides.
// Rules from the kit: one idea per slide; one orange accent per slide (the number that matters, never a series);
// green = default series, blue = comparison series or second text highlight; always a source line (+ N when known);
// nothing below 24px; backgrounds are soft washes. `*word*` marks a blue text highlight.

const ARCH = "FLArchivo";
const MONO = "FLMono";

export const K = {
  ink: "#14170f", ink2: "#3d423a", muted: "#5c6159", muted2: "#6b7067", faint: "#8b9088",
  rule: "#e3e5df", track: "#f2f4ef", accent: "#d4622a",
  green: ["#1a5a41", "#3d8a63", "#7fb99b", "#a6cdb6"], blue: "#4d88a8", blueInk: "#1a4f6b",
};

type Tone = "green" | "orange" | "blue";
const DARK: Record<Tone, { bg: string; eyebrow: string; sub: string }> = {
  green: { bg: "linear-gradient(165deg,#2c8360 0%,#1d6247 50%,#164a37 100%)", eyebrow: "#b9d4c4", sub: "#dbe9e0" },
  orange: { bg: "linear-gradient(165deg,#d97b3d 0%,#b4501c 48%,#8a3a12 100%)", eyebrow: "#F8DAC3", sub: "#FCE0CE" },
  blue: { bg: "linear-gradient(165deg,#2e7a9e 0%,#1f5b78 48%,#163f57 100%)", eyebrow: "#a9cadb", sub: "#d6e6ee" },
};
const QUOTE: Record<Tone, { bg: string; ink: string }> = {
  green: { bg: "linear-gradient(150deg,#F2F7F3 0%,#E2EEE6 100%)", ink: "#1a5a41" },
  orange: { bg: "linear-gradient(150deg,#FDF5EF 0%,#F7E6D8 100%)", ink: "#8a3a12" },
  blue: { bg: "linear-gradient(150deg,#F2F8FA 0%,#E0EDF3 100%)", ink: "#163f57" },
};
const LIGHT = "linear-gradient(180deg,#FFFFFF 0%,#F7F7F5 60%,#EFF2EC 100%)";
const NIGHT = "linear-gradient(150deg,#20261b 0%,#14170f 60%,#0e1109 100%)";

export type BarRow = { label: string; value: number; hi?: boolean };
export type SlideV2 =
  | { type: "cover"; eyebrow: string; title: string; sub?: string; tone?: Tone }
  | { type: "stat"; eyebrow: string; value: string; text: string; source: string }
  | { type: "bars"; title: string; sub?: string; rows: BarRow[]; suffix?: string; prefix?: string; signed?: boolean; source: string }
  | { type: "quote"; text: string; by: string; tone?: Tone }
  | { type: "list"; title: string; items: { title: string; text?: string }[] }
  | { type: "point"; number: string; title: string; text: string; source?: string }
  | { type: "closing"; title: string; sub?: string; links?: string[]; tone?: Tone };

export type CarouselV2Props = { slide: SlideV2; index: number; total: number; brand: string; durationInFrames: number };

function useKitFonts() {
  const [h] = useState(() => delayRender("kit fonts"));
  useEffect(() => {
    const faces = [
      new FontFace(ARCH, `url(${archivo})`, { weight: "100 900" }),
      new FontFace(MONO, `url(${monoR})`, { weight: "400" }),
      new FontFace(MONO, `url(${monoSB})`, { weight: "600" }),
    ];
    Promise.all(faces.map((f) => f.load())).then((ls) => { ls.forEach((l) => document.fonts.add(l)); continueRender(h); });
  }, [h]);
}

const Hl: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <>{text.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") ? <span key={i} style={{ color }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}</>
);

const monoLabel = (size: number, color: string): React.CSSProperties => ({
  fontFamily: MONO, fontSize: size, letterSpacing: "0.14em", textTransform: "uppercase", color, lineHeight: 1.45,
});

const Rule: React.FC<{ w?: number }> = ({ w = 160 }) => <div style={{ width: w, height: 12, background: K.accent, flex: "none" }} />;

const Page: React.FC<{ i: number; n: number; color: string }> = ({ i, n, color }) => (
  <span style={{ ...monoLabel(24, color), letterSpacing: "0.08em" }}>{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
);

const Source: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
    <div style={{ height: 2, background: "#dcdfd6" }} />
    <div style={{ ...monoLabel(24, K.muted2), letterSpacing: "0.06em" }}>{text}</div>
  </div>
);

const frame = (bg: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: bg, padding: "96px 90px 84px", display: "flex", flexDirection: "column", fontFamily: ARCH, ...extra,
});

const fmt = (v: number, prefix = "", suffix = "", signed = false) =>
  (v < 0 ? "−" : signed && v > 0 ? "+" : "") + prefix + Math.abs(v).toLocaleString("en-US") + suffix;

const Bars: React.FC<Extract<SlideV2, { type: "bars" }>> = ({ rows, prefix, suffix, signed }) => {
  const W = 900;
  const lo = Math.min(0, ...rows.map((r) => r.value)), hi = Math.max(0, ...rows.map((r) => r.value));
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * W;
  const z = x(0);
  let rank = 0;
  const BH = rows.length > 4 ? 64 : 78;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: rows.length > 4 ? 24 : 34 }}>
      {rows.map((r, i) => {
        const neg = r.value < 0;
        const fill = r.hi ? K.accent : neg ? K.blue : K.green[Math.min(rank++, K.green.length - 1)];
        const light = !r.hi && !neg && rank > 2;
        const left = Math.min(z, x(r.value)), w = Math.abs(x(r.value) - z);
        const inside = w >= 190;
        const label = fmt(r.value, prefix, suffix, signed);
        const vStyle: React.CSSProperties = { fontFamily: MONO, fontWeight: 600, fontSize: 38, position: "absolute", top: 0, height: BH, display: "flex", alignItems: "center" };
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 38, color: K.ink2, lineHeight: 1.15 }}><Hl text={r.label} color={K.blueInk} /></span>
            <div style={{ position: "relative", width: W, height: BH, background: K.track }}>
              <div style={{ position: "absolute", left, width: w, top: 0, bottom: 0, background: fill }} />
              {lo < 0 && <div style={{ position: "absolute", left: z - 1.5, top: -8, bottom: -8, width: 3, background: K.ink }} />}
              {inside ? (
                <span style={{ ...vStyle, color: light ? K.ink : "#fff", ...(neg ? { left: left + 24 } : { left: left + w - 24, transform: "translateX(-100%)" }) }}>{label}</span>
              ) : (
                <span style={{ ...vStyle, color: r.hi ? K.accent : neg ? K.blueInk : K.ink, ...(neg ? { left: left - 18, transform: "translateX(-100%)" } : { left: left + w + 18 }) }}>{label}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const CarouselV2: React.FC<CarouselV2Props> = ({ slide: s, index, total, brand }) => {
  useKitFonts();
  const head = (title: string, sub?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <span style={monoLabel(26, K.muted2)}>{brand}</span><Page i={index} n={total} color={K.faint} />
      </div>
      <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-0.03em", color: K.ink, lineHeight: 1.04, textWrap: "pretty" } as React.CSSProperties}>
        <Hl text={title} color={K.blueInk} />
      </div>
      {sub && <div style={monoLabel(26, K.muted2)}>{sub}</div>}
    </div>
  );

  switch (s.type) {
    case "cover": {
      const t = DARK[s.tone ?? "green"];
      const size = s.title.length > 34 ? 104 : 120;
      return (
        <AbsoluteFill style={frame(t.bg, { justifyContent: "space-between", padding: "110px 90px 96px" })}>
          <div style={monoLabel(30, t.eyebrow)}>{s.eyebrow}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
            <Rule />
            <div style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 0.98, color: "#fff", textWrap: "pretty" } as React.CSSProperties}>{s.title.replace(/\*/g, "")}</div>
            {s.sub && <div style={{ fontSize: 44, lineHeight: 1.35, color: t.sub, textWrap: "pretty" } as React.CSSProperties}>{s.sub.replace(/\*/g, "")}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...monoLabel(26, t.eyebrow) }}>
            <span>{brand}</span><span>Swipe →</span>
          </div>
        </AbsoluteFill>
      );
    }
    case "stat": {
      const n = s.value.length;
      const size = Math.min(380, Math.round(1500 / Math.max(n, 2.6)));
      return (
        <AbsoluteFill style={frame(LIGHT, { gap: 0 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={monoLabel(30, K.muted2)}>{s.eyebrow}</span><Page i={index} n={total} color={K.faint} />
          </div>
          <div style={{ margin: "auto 0", display: "flex", flexDirection: "column", gap: 56 }}>
            <div style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.82, color: K.accent, whiteSpace: "nowrap" }}>{s.value}</div>
            <div style={{ fontSize: 56, lineHeight: 1.25, color: K.ink, letterSpacing: "-0.02em", textWrap: "pretty" } as React.CSSProperties}><Hl text={s.text} color={K.blueInk} /></div>
          </div>
          <Source text={s.source} />
        </AbsoluteFill>
      );
    }
    case "bars":
      return (
        <AbsoluteFill style={frame(LIGHT, { gap: s.rows.length > 4 ? 48 : 64 })}>
          {head(s.title, s.sub)}
          <Bars {...s} />
          <Source text={s.source} />
        </AbsoluteFill>
      );
    case "quote": {
      const q = QUOTE[s.tone ?? "green"];
      const size = s.text.length > 90 ? 76 : 88;
      return (
        <AbsoluteFill style={frame(q.bg, { justifyContent: "center", gap: 60 })}>
          <Rule />
          <div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.18, letterSpacing: "-0.03em", color: q.ink, textWrap: "pretty" } as React.CSSProperties}>{s.text.replace(/\*/g, "")}</div>
          <div style={{ ...monoLabel(28, K.muted), letterSpacing: "0.1em" }}>{s.by}</div>
        </AbsoluteFill>
      );
    }
    case "list":
      return (
        <AbsoluteFill style={frame(NIGHT, { gap: 70 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: -40 }}>
            <span style={monoLabel(26, "#8b9088")}>{brand}</span><Page i={index} n={total} color="#8b9088" />
          </div>
          <div style={{ fontSize: 80, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.02, textWrap: "pretty" } as React.CSSProperties}>{s.title.replace(/\*/g, "")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 52, margin: "auto 0" }}>
            {s.items.map((it, i) => {
              const last = i === s.items.length - 1;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: 30, color: last ? K.accent : "#7fb99b" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: s.items.some((x) => x.text) ? 52 : 60, fontWeight: 600, letterSpacing: "-0.02em", color: last ? K.accent : "#fff", lineHeight: 1.18, textWrap: "pretty" } as React.CSSProperties}>{it.title.replace(/\*/g, "")}</span>
                  {it.text && <span style={{ fontSize: 34, lineHeight: 1.4, color: "#b9c0b3", textWrap: "pretty" } as React.CSSProperties}>{it.text.replace(/\*/g, "")}</span>}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      );
    case "point":
      return (
        <AbsoluteFill style={frame(LIGHT, { gap: 0 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={monoLabel(26, K.muted2)}>{brand}</span><Page i={index} n={total} color={K.faint} />
          </div>
          <div style={{ margin: "auto 0", display: "flex", flexDirection: "column", gap: 40 }}>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 44, color: K.accent }}>{s.number}</span>
            <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: "-0.03em", color: K.ink, lineHeight: 1.02, textWrap: "pretty" } as React.CSSProperties}><Hl text={s.title} color={K.blueInk} /></div>
            <div style={{ fontSize: 44, lineHeight: 1.4, color: K.muted, textWrap: "pretty" } as React.CSSProperties}><Hl text={s.text} color={K.blueInk} /></div>
          </div>
          {s.source ? <Source text={s.source} /> : <div style={{ height: 1 }} />}
        </AbsoluteFill>
      );
    case "closing": {
      const t = DARK[s.tone ?? "green"];
      return (
        <AbsoluteFill style={frame(t.bg.replace("165deg", "200deg"), { justifyContent: "center", gap: 50 })}>
          <Rule />
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: "-0.035em", color: "#fff", lineHeight: 1, textWrap: "pretty" } as React.CSSProperties}>{s.title.replace(/\*/g, "")}</div>
          {s.sub && <div style={{ fontSize: 44, lineHeight: 1.35, color: t.sub, textWrap: "pretty" } as React.CSSProperties}>{s.sub}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: MONO, fontSize: 30, color: t.eyebrow }}>
            {(s.links ?? [brand]).map((l) => <span key={l}>{l}</span>)}
          </div>
        </AbsoluteFill>
      );
    }
  }
};

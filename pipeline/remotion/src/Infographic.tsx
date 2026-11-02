import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { ACCENT } from "./brand";
import { useFonts2, SANS } from "./useFonts2";

// Editorial infographic, 1080x1350 (4:5): two-tone headline, dek, a hero (built-in block stack or an image)
// with numbered callouts + leader lines, a side callout, a three-column "why" row with icons, byline and sources.

export type Callout = { title: string; text: string };
export type InfographicProps = {
  headline: [string, string];           // line 1 ink, line 2 accent
  dek: string;
  hero: { label?: string; image?: string; fit?: "cover" | "contain"; focus?: [number, number] };
  callouts: Callout[];                  // 2–4 numbered items, left column
  side?: Callout;                       // optional right-column note
  why?: { title: string; items: { icon: IconName; title: string; text: string }[] };
  byline?: { name: string; org?: string };
  sources?: string;
  accent?: string;
  durationInFrames: number;
};

const INK = "#111114";
const MUTED = "#55535A";
const PAPER = "#F1EEE8";

export type IconName = "chart" | "rings" | "target" | "users" | "bolt" | "shield" | "dollar" | "clock" | "globe" | "check" | "mail" | "calendar" | "plug" | "brain";
const Icon: React.FC<{ name: IconName; color: string; size?: number }> = ({ name, color, size = 52 }) => {
  const p = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const g: Record<IconName, React.ReactNode> = {
    chart: <><path d="M4 28h28" {...p} /><rect x="7" y="18" width="4" height="10" {...p} /><rect x="14" y="13" width="4" height="15" {...p} /><rect x="21" y="8" width="4" height="20" {...p} /><rect x="28" y="4" width="0.1" height="0.1" {...p} /></>,
    rings: <><circle cx="13" cy="18" r="8" {...p} /><circle cx="23" cy="18" r="8" {...p} /></>,
    target: <><circle cx="17" cy="18" r="12" {...p} /><circle cx="17" cy="18" r="7" {...p} /><circle cx="17" cy="18" r="2" {...p} /><path d="M19 16l11-11M25 5h5v5" {...p} /></>,
    users: <><circle cx="13" cy="12" r="5" {...p} /><path d="M4 29c0-6 4-9 9-9s9 3 9 9" {...p} /><circle cx="25" cy="13" r="4" {...p} /><path d="M24 20c4 0 8 2 8 8" {...p} /></>,
    bolt: <path d="M19 3L7 20h9l-2 13 12-17h-9z" {...p} />,
    shield: <><path d="M18 3l12 5v9c0 8-6 13-12 16C12 30 6 25 6 17V8z" {...p} /><path d="M13 18l4 4 7-8" {...p} /></>,
    dollar: <><circle cx="18" cy="18" r="14" {...p} /><path d="M23 12c-1-2-3-3-5-3-3 0-5 2-5 4 0 6 10 3 10 9 0 2-2 4-5 4-2 0-4-1-5-3M18 6v24" {...p} /></>,
    clock: <><circle cx="18" cy="18" r="14" {...p} /><path d="M18 10v8l6 4" {...p} /></>,
    globe: <><circle cx="18" cy="18" r="14" {...p} /><path d="M4 18h28M18 4c5 5 5 23 0 28M18 4c-5 5-5 23 0 28" {...p} /></>,
    check: <><circle cx="18" cy="18" r="14" {...p} /><path d="M11 18l5 5 9-10" {...p} /></>,
    mail: <><rect x="4" y="8" width="28" height="20" rx="2" {...p} /><path d="M4 10l14 10 14-10" {...p} /></>,
    calendar: <><rect x="5" y="7" width="26" height="24" rx="2" {...p} /><path d="M5 14h26M12 4v6M24 4v6" {...p} /></>,
    plug: <><path d="M12 4v8M24 4v8M8 12h20v6a10 10 0 01-20 0zM18 28v5" {...p} /></>,
    brain: <><path d="M13 6a5 5 0 00-5 5 5 5 0 00-2 9 5 5 0 005 7 4 4 0 007 1V7a4 4 0 00-5-1zM23 6a5 5 0 015 5 5 5 0 012 9 5 5 0 01-5 7 4 4 0 01-7 1" {...p} /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 36 36">{g[name]}</svg>;
};

// Built-in hero: an isometric stack of accent blocks (one per callout), alternately offset like the reference.
const BlockStack: React.FC<{ n: number; label?: string; accent: string; x: number; y: number; w: number; h: number }> = ({ n, label, accent, x, y, w, h }) => {
  const d = 50, dy = d * 0.6, gap = 10;
  const bh = (h - dy - gap * (n - 1)) / n;
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <svg width={w + d + 40} height={h + 30} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={accent} /><stop offset="1" stopColor={accent} stopOpacity={0.88} /></linearGradient>
        </defs>
        <ellipse cx={(w + d) / 2} cy={h + 8} rx={(w + d) * 0.62} ry={16} fill="rgba(0,0,0,.18)" />
        {Array.from({ length: n }).map((_, i) => {
          const ox = i % 2 ? 16 : 0, y0 = dy + i * (bh + gap);
          return (
            <g key={i}>
              <polygon points={`${ox + w},${y0} ${ox + w + d},${y0 - dy} ${ox + w + d},${y0 + bh - dy} ${ox + w},${y0 + bh}`} fill={accent} />
              <polygon points={`${ox + w},${y0} ${ox + w + d},${y0 - dy} ${ox + w + d},${y0 + bh - dy} ${ox + w},${y0 + bh}`} fill="rgba(0,0,0,.32)" />
              {i === 0 && <polygon points={`${ox},${y0} ${ox + d},${y0 - dy} ${ox + w + d},${y0 - dy} ${ox + w},${y0}`} fill={accent} />}
              {i === 0 && <polygon points={`${ox},${y0} ${ox + d},${y0 - dy} ${ox + w + d},${y0 - dy} ${ox + w},${y0}`} fill="rgba(255,255,255,.22)" />}
              <rect x={ox} y={y0} width={w} height={bh} fill="url(#front)" />
              <rect x={ox} y={y0 + bh - 14} width={w} height={14} fill="rgba(0,0,0,.18)" />
            </g>
          );
        })}
      </svg>
      {label && <div style={{ position: "absolute", left: 56, top: dy + 16, fontFamily: SANS, fontWeight: 800, fontSize: 38, letterSpacing: -1, color: "white" }}>{label}</div>}
    </div>
  );
};

export const Infographic: React.FC<InfographicProps> = (p) => {
  useFonts2();
  const accent = p.accent ?? ACCENT;
  const n = p.callouts.length;
  // hero geometry
  const HX = 400, HY = 500, HW = 300, HH = 520;
  const dy = 30, gap = 10, bh = (HH - dy - gap * (n - 1)) / n;
  const anchorY = (i: number) => HY + dy + i * (bh + gap) + bh * 0.5;
  const colTop = (i: number) => anchorY(i) - 34;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #F7F5F1 0%, ${PAPER} 55%, #E3DFD7 100%)`, color: INK }}>
      {/* headline + dek */}
      <div style={{ position: "absolute", left: 66, right: 60, top: 64 }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 118, lineHeight: 0.92, letterSpacing: -5 }}>{p.headline[0]}</div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 118, lineHeight: 0.98, letterSpacing: -5, color: accent }}>{p.headline[1]}</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 33, lineHeight: 1.3, color: "#2A2A2E", marginTop: 26, maxWidth: 900 }}>{p.dek}</div>
      </div>

      {/* hero */}
      {p.hero.image ? (
        <div style={{ position: "absolute", left: HX - 10, top: HY - 20, width: 640, height: HH + 40, borderRadius: 20, overflow: "hidden" }}>
          <Img src={staticFile(p.hero.image)} style={{ width: "100%", height: "100%", objectFit: p.hero.fit ?? "cover", objectPosition: `${(p.hero.focus?.[0] ?? 0.5) * 100}% ${(p.hero.focus?.[1] ?? 0.5) * 100}%` }} />
        </div>
      ) : (
        <BlockStack n={n} label={p.hero.label} accent={accent} x={HX} y={HY} w={HW} h={HH} />
      )}

      {/* numbered callouts + leader lines */}
      {p.callouts.map((c, i) => {
        const tw = Math.min(250, 40 + c.title.length * 17);
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: 66, top: colTop(i), width: 300 }}>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 30, letterSpacing: -0.5, whiteSpace: "nowrap" }}>
                <span style={{ fontWeight: 600, fontSize: 20, color: accent, marginRight: 10, verticalAlign: "4px" }}>{String(i + 1).padStart(2, "0")}</span>{c.title}
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 19, lineHeight: 1.28, color: MUTED, marginTop: 6, width: 300 }}>{c.text}</div>
            </div>
            <div style={{ position: "absolute", left: 66 + tw + 18, top: colTop(i) + 19, width: HX + 26 + (i % 2 ? 16 : 0) - (66 + tw + 18), height: 2, background: INK }} />
            <div style={{ position: "absolute", left: HX + 22 + (i % 2 ? 16 : 0), top: colTop(i) + 13, width: 14, height: 14, borderRadius: 7, background: "white", border: `2px solid ${INK}` }} />
          </React.Fragment>
        );
      })}

      {/* side callout */}
      {p.side && (
        <div style={{ position: "absolute", left: 790, right: 50, top: HY + 20 }}>
          <div style={{ width: 40, height: 5, background: accent, marginBottom: 14 }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 32, letterSpacing: -0.5, marginBottom: 8 }}>{p.side.title}</div>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 22, lineHeight: 1.35, color: MUTED }}>{p.side.text}</div>
        </div>
      )}

      {/* why row */}
      {p.why && (
        <div style={{ position: "absolute", left: 56, right: 56, top: 1060, background: "rgba(255,255,255,.72)", borderRadius: 22, padding: "22px 26px 24px", boxShadow: "0 16px 40px rgba(0,0,0,.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 30, height: 5, background: accent }} />
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 30, letterSpacing: -0.5 }}>{p.why.title}</div>
          </div>
          <div style={{ display: "flex" }}>
            {p.why.items.map((it, i) => (
              <div key={i} style={{ flex: 1, padding: "0 16px", borderLeft: i ? "1.5px solid rgba(0,0,0,.14)" : "none", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Icon name={it.icon} color={accent} size={46} />
                <div>
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, lineHeight: 1.15, marginBottom: 4 }}>{it.title}</div>
                  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 19, lineHeight: 1.3, color: MUTED }}>{it.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* footer */}
      <div style={{ position: "absolute", left: 66, right: 60, bottom: 36, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          {p.byline && <>
            <div style={{ width: 36, height: 3, background: INK, marginBottom: 10 }} />
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24 }}>{p.byline.name}</div>
            {p.byline.org && <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 21, color: MUTED }}>{p.byline.org}</div>}
          </>}
        </div>
        {p.sources && <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 17, color: MUTED, maxWidth: 560, textAlign: "right" }}>Sources: {p.sources}</div>}
      </div>
    </AbsoluteFill>
  );
};

import React, { useEffect, useState } from "react";
import { AbsoluteFill, Img, continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import { ACCENT } from "./brand";
import { useFonts2, SANS, SERIF } from "./useFonts2";
import { GraphicView, Graphic, PAPER, INK2 } from "./Graphics";
// @ts-ignore - webpack asset import
import anton from "../fonts/Anton-Regular.ttf";

// 1080x1350 (4:5) carousel slides, rendered as stills (frame 60, so springs have settled).
// Also renders 1080x1080 squares for YouTube posts (props width/height; `sq` below tightens the layouts).
// Text markup everywhere: *word* = accent colour.

const DISPLAY = "FLDisplay";

export type Slide =
  | { type: "cover"; image?: string; graphic?: Graphic; focus?: [number, number]; kicker?: string; headline: string }
  | { type: "photo"; image: string; focus?: [number, number]; headline: string; credit?: string; fit?: "cover" | "contain" }
  | { type: "text"; title: string; subtitle?: string; body?: string; number?: string }
  | { type: "graphic"; graphic: Graphic; headline?: string; credit?: string }
  | { type: "image"; image: string }
  | { type: "cta"; headline: string; sub?: string };

export type CarouselProps = { slide: Slide; index: number; total: number; brand: string; accent?: string; durationInFrames: number };

function useDisplayFont() {
  const [h] = useState(() => delayRender("display font"));
  useEffect(() => {
    new FontFace(DISPLAY, `url(${anton})`).load().then((f) => { document.fonts.add(f); continueRender(h); });
  }, [h]);
}

const Accent: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <>{text.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") ? <span key={i} style={{ color }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}</>
);

// shrink long headlines so they stay within ~4–5 lines
const fit = (text: string, base: number, ref: number, min: number) => {
  const n = text.replace(/\*/g, "").length;
  return Math.max(min, Math.min(base, Math.round(base * Math.sqrt(ref / Math.max(n, 1)))));
};

const Mono: React.FC<{ brand: string; style?: React.CSSProperties; color?: string }> = ({ brand, style, color = "rgba(255,255,255,.85)" }) => {
  const initials = brand.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color, letterSpacing: -2, ...style }}>{initials}</div>;
};

// Screenshots/charts: show the whole image on a blurred, darkened copy of itself, above the headline.
const Contained: React.FC<{ image: string; sq?: boolean }> = ({ image, sq }) => (
  <>
    <Img src={staticFile(image)} style={{ position: "absolute", inset: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: "blur(40px) brightness(.35)" }} />
    <div style={{ position: "absolute", left: 50, right: 50, top: sq ? 80 : 110, height: sq ? 560 : 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Img src={staticFile(image)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,.6)" }} />
    </div>
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(8,8,10,.85) 80%, rgba(8,8,10,.95) 100%)" }} />
  </>
);

const Photo: React.FC<{ image: string; focus?: [number, number]; shade: number }> = ({ image, focus = [0.5, 0.4], shade }) => (
  <>
    <Img src={staticFile(image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%` }} />
    <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) ${100 - shade}%, rgba(8,8,10,.78) ${100 - shade * 0.45}%, rgba(8,8,10,.96) 100%)` }} />
  </>
);

export const Carousel: React.FC<CarouselProps> = ({ slide, index, total, brand, accent = ACCENT }) => {
  useFonts2();
  useDisplayFont();
  const sq = useVideoConfig().height < 1200; // square (YouTube) format
  const display: React.CSSProperties = { fontFamily: DISPLAY, textTransform: "uppercase", color: "white", lineHeight: 1.06, letterSpacing: 0.5, textAlign: "center" };

  if (slide.type === "cover") {
    const size = sq ? fit(slide.headline, 96, 55, 70) : fit(slide.headline, 118, 55, 84);
    return (
      <AbsoluteFill style={{ background: "black" }}>
        {slide.image ? <Photo image={slide.image} focus={slide.focus} shade={58} /> : (
          // no photo: dark field with an accent glow and a fine grid; optional graphic card up top
          <>
            <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 30%, ${accent}38 0%, #141417 55%, #070708 100%)` }} />
            <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
            {slide.graphic && (
              <div style={{ position: "absolute", top: sq ? 50 : 90, left: 0, right: 0, display: "flex", justifyContent: "center", transform: sq ? "scale(.6) rotate(-2deg)" : "scale(.82) rotate(-2deg)", transformOrigin: "50% 0", ["--g-ink" as string]: "white" } as React.CSSProperties}>
                <GraphicView g={slide.graphic} f={60} />
              </div>
            )}
          </>
        )}
        <div style={{ position: "absolute", left: 60, right: 60, ...(slide.image || slide.graphic ? { bottom: sq ? 100 : 120 } : { top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 26 }}>
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,.85)" }} />
            <div style={{ fontFamily: DISPLAY, fontSize: 34, letterSpacing: 4, color: "white", textTransform: "uppercase" }}>{slide.kicker ?? brand}</div>
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,.85)" }} />
          </div>
          <div style={{ ...display, fontSize: slide.image || slide.graphic ? size : Math.round(size * 1.25) }}><Accent text={slide.headline} color={accent} /></div>
        </div>
        <div style={{ position: "absolute", right: 60, bottom: 46, fontFamily: SANS, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: "rgba(255,255,255,.75)" }}>SWIPE →</div>
      </AbsoluteFill>
    );
  }

  if (slide.type === "photo") {
    const size = sq ? fit(slide.headline, 80, 90, 56) : fit(slide.headline, 92, 90, 64);
    return (
      <AbsoluteFill style={{ background: "black" }}>
        {slide.fit === "contain" ? <Contained image={slide.image} sq={sq} /> : <Photo image={slide.image} focus={slide.focus} shade={52} />}
        <Mono brand={brand} style={{ position: "absolute", top: 40, left: 48 }} />
        <div style={{ position: "absolute", left: 50, right: 50, bottom: slide.credit ? 110 : 80, ...display, fontSize: size }}>
          <Accent text={slide.headline} color={accent} />
        </div>
        {slide.credit && <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, textAlign: "center", fontFamily: SANS, fontSize: 24, color: "rgba(255,255,255,.55)" }}>{slide.credit}</div>}
        <div style={{ position: "absolute", top: 46, right: 52, fontFamily: SANS, fontWeight: 700, fontSize: 26, color: "rgba(255,255,255,.7)" }}>{index + 1}/{total}</div>
      </AbsoluteFill>
    );
  }

  if (slide.type === "text") {
    // text-only slides use larger type than the reference (readability on phones)
    const bodyLen = (slide.body ?? "").length + (slide.subtitle ?? "").length;
    const k = (bodyLen > 260 ? 0.82 : bodyLen > 180 ? 0.9 : 1) * (sq ? 0.84 : 1);
    return (
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 15% 0%, #2A2A2E 0%, #121214 45%, #050506 100%)" }}>
        {slide.number && (
          <div style={{ position: "absolute", top: 70, left: 84, fontFamily: SERIF, fontStyle: "italic", fontSize: sq ? 110 : 150, lineHeight: 1, color: accent, opacity: 0.9 }}>{slide.number}</div>
        )}
        <div style={{ position: "absolute", left: 84, right: 84, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92 * k, lineHeight: 1.05, letterSpacing: -2, color: accent, marginBottom: 44 }}>{slide.title}</div>
          {slide.subtitle && <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60 * k, lineHeight: 1.15, letterSpacing: -1, color: "white", marginBottom: 40 }}><Accent text={slide.subtitle} color={accent} /></div>}
          {slide.body && <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 52 * k, lineHeight: 1.3, color: "rgba(255,255,255,.92)" }}><Accent text={slide.body} color={accent} /></div>}
        </div>
        <Mono brand={brand} color="rgba(255,255,255,.45)" style={{ position: "absolute", bottom: 56, left: 0, right: 0, textAlign: "center" }} />
        <div style={{ position: "absolute", top: 56, right: 70, fontFamily: SANS, fontWeight: 700, fontSize: 26, color: "rgba(255,255,255,.45)" }}>{index + 1}/{total}</div>
      </AbsoluteFill>
    );
  }

  if (slide.type === "graphic") {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${PAPER} 0%, #E4DFD6 70%, #D2CCC1 100%)`, alignItems: "center" }}>
        {slide.headline && (
          <div style={{ position: "absolute", top: sq ? 70 : 110, left: 80, right: 80, textAlign: "center", fontFamily: SERIF, fontSize: sq ? 72 : 84, lineHeight: 1.0, color: INK2, textWrap: "balance" } as React.CSSProperties}>
            {slide.headline.split(/(\*[^*]+\*)/).map((p, i) => p.startsWith("*") ? <i key={i} style={{ color: accent }}>{p.slice(1, -1)}</i> : <span key={i}>{p}</span>)}
          </div>
        )}
        <div style={{ position: "absolute", top: slide.headline ? (sq ? 230 : 340) : 0, bottom: sq ? 90 : 120, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: sq ? "scale(.8)" : undefined }}><GraphicView g={slide.graphic} f={60} /></div>
        </div>
        {slide.credit
          ? <div style={{ position: "absolute", bottom: sq ? 36 : 52, left: 80, right: 80, textAlign: "center", fontFamily: SANS, fontSize: 24, color: "rgba(22,22,26,.55)" }}>{slide.credit}</div>
          : <Mono brand={brand} color="rgba(22,22,26,.4)" style={{ position: "absolute", bottom: 50, left: 0, right: 0, textAlign: "center" }} />}
      </AbsoluteFill>
    );
  }

  if (slide.type === "image") {
    // a finished 4:5 image (e.g. an infographic PNG) used as-is
    return <AbsoluteFill style={{ background: "black" }}><Img src={staticFile(slide.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></AbsoluteFill>;
  }

  // cta
  return (
    <AbsoluteFill style={{ background: INK2, justifyContent: "center", alignItems: "center", padding: 90 }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, ${accent}30 0%, transparent 55%)` }} />
      <div style={{ ...display, fontSize: fit(slide.headline, 120, 40, 80) }}><Accent text={slide.headline} color={accent} /></div>
      {slide.sub && <div style={{ marginTop: 40, fontFamily: SANS, fontWeight: 600, fontSize: 46, lineHeight: 1.3, color: "rgba(255,255,255,.85)", textAlign: "center" }}><Accent text={slide.sub} color={accent} /></div>}
      <div style={{ marginTop: 70, fontFamily: DISPLAY, fontSize: 40, letterSpacing: 10, color: accent }}>{brand.toUpperCase()}</div>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ShortProps, Word } from "./types";
import { ACCENT, FONT } from "./brand";
import { useFont } from "./useFont";

// Group words into caption pages of <=3 words; break on speaker change, pauses, sentence ends.
function paginate(words: Word[]): Word[][] {
  const pages: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const brk = prev && (cur.length >= 3 || (cur.map((c) => c.text).join(" ").length + w.text.length > 17) || w.speaker !== prev.speaker || w.startMs - prev.endMs > 450 || /[.?!]$/.test(prev.text));
    if (brk) { pages.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export const Short: React.FC<ShortProps> = ({ src, words, shots, accent = ACCENT }) => {
  useFont();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  const shot = shots.find((s) => ms >= s.startMs && ms < s.endMs);
  const scale = shot ? shot.scale : 1;

  const pages = React.useMemo(() => paginate(words), [words]);
  const page = pages.find((p, i) => {
    const end = Math.max(p[p.length - 1].endMs, Math.min((pages[i + 1]?.[0].startMs ?? Infinity), p[p.length - 1].endMs + 400));
    return ms >= p[0].startMs && ms < end;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 32%" }}>
        <OffthreadVideo src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {page && (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", top: "64%" }}>
          <div style={{ fontFamily: FONT, fontSize: 84, fontWeight: 700, textTransform: "uppercase", textAlign: "center",
                        maxWidth: 940, lineHeight: 1.1, letterSpacing: -1,
                        textShadow: "0 0 14px rgba(0,0,0,.65), 0 4px 0 rgba(0,0,0,.55)", WebkitTextStroke: "3px rgba(0,0,0,.85)",
                        paintOrder: "stroke fill" }}>
            {page.map((w, i) => {
              const active = ms >= w.startMs && ms < (page[i + 1]?.startMs ?? w.endMs + 400);
              return <span key={i} style={{ color: active ? accent : "white" }}>{w.text}{i < page.length - 1 ? " " : ""}</span>;
            })}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { ACCENT, FONT, INK } from "./brand";
import { useFont } from "./useFont";

export type LowerThirdProps = { kicker: string; title: string; durationInFrames: number };

export const LowerThird: React.FC<LowerThirdProps> = ({ kicker, title, durationInFrames }) => {
  useFont();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame: f, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(f, [durationInFrames - 14, durationInFrames - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const bar = interpolate(inS, [0, 1], [0, 1]) * (1 - out);
  const textX = interpolate(inS, [0, 1], [-40, 0]) - out * 40;
  const op = Math.min(1, inS * 1.4) * (1 - out);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 80, bottom: 110, display: "flex", alignItems: "stretch" }}>
        <div style={{ width: 10, background: ACCENT, transform: `scaleY(${bar})`, transformOrigin: "bottom" }} />
        <div style={{ overflow: "hidden" }}>
          <div style={{ background: `${INK}E6`, padding: "18px 30px 20px 26px", transform: `translateX(${textX}px)`, opacity: op,
                        clipPath: `inset(0 ${100 - bar * 100}% 0 0)` }}>
            <div style={{ fontFamily: FONT, color: ACCENT, fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>{kicker}</div>
            <div style={{ fontFamily: FONT, color: "white", fontSize: 46, marginTop: 4, whiteSpace: "nowrap" }}>{title}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

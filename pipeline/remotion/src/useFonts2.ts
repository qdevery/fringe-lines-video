import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
// @ts-ignore - webpack asset imports
import serif from "../fonts/InstrumentSerif-Regular.ttf";
// @ts-ignore
import serifItalic from "../fonts/InstrumentSerif-Italic.ttf";
// @ts-ignore
import inter from "../fonts/Inter.ttf";

export const SERIF = "FLSerif";
export const SANS = "FLSans";

// Loads the "v2" editorial type: Instrument Serif (regular + italic) and Inter (variable).
export function useFonts2() {
  const [handle] = useState(() => delayRender("fonts2"));
  useEffect(() => {
    const faces = [
      new FontFace(SERIF, `url(${serif})`, { style: "normal" }),
      new FontFace(SERIF, `url(${serifItalic})`, { style: "italic" }),
      new FontFace(SANS, `url(${inter})`, { weight: "100 900" }),
    ];
    Promise.all(faces.map((f) => f.load())).then((ls) => {
      ls.forEach((l) => document.fonts.add(l));
      continueRender(handle);
    });
  }, [handle]);
}

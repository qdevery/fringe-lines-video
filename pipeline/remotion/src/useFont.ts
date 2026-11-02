import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { FONT } from "./brand";
// @ts-ignore - webpack asset import
import montserrat from "../fonts/Montserrat-Bold.ttf";

export function useFont() {
  const [handle] = useState(() => delayRender("font"));
  useEffect(() => {
    const f = new FontFace(FONT, `url(${montserrat})`, { weight: "700" });
    f.load().then((l) => { document.fonts.add(l); continueRender(handle); });
  }, [handle]);
}

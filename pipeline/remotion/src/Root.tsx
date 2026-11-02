import React from "react";
import { Composition } from "remotion";
import { Short } from "./Short";
import { Intro } from "./Intro";
import { LowerThird } from "./LowerThird";
import { ShortV2 } from "./ShortV2";
import { IntroV2 } from "./IntroV2";
import { HowTo } from "./HowTo";
import { Carousel } from "./Carousel";
import { CarouselV2 } from "./CarouselV2";
import { Infographic } from "./Infographic";

type AnyFC = React.FC<Record<string, unknown>>;
const meta = ({ props }: { props: Record<string, unknown> }) => ({ durationInFrames: props.durationInFrames as number });

export const Root: React.FC = () => (
  <>
    <Composition id="Short" component={Short as unknown as AnyFC} width={1080} height={1920} fps={30} durationInFrames={300}
      defaultProps={{ src: "clip.mp4", durationInFrames: 300, words: [], shots: [] }} calculateMetadata={meta} />
    <Composition id="Intro" component={Intro as unknown as AnyFC} width={1920} height={1080} fps={30} durationInFrames={300}
      defaultProps={{ clips: [], title: "FRINGE LINES", subtitle: "", topics: [], titleFrames: 120, durationInFrames: 300 }} calculateMetadata={meta} />
    <Composition id="LowerThird" component={LowerThird as unknown as AnyFC} width={1920} height={1080} fps={30} durationInFrames={180}
      defaultProps={{ kicker: "Host", title: "Quinn", durationInFrames: 180 }} calculateMetadata={meta} />
    <Composition id="ShortV2" component={ShortV2 as unknown as AnyFC} width={1080} height={1920} fps={30} durationInFrames={300}
      defaultProps={{ src: "clip.mp4", durationInFrames: 300, words: [], shots: [], scenes: [{ startMs: 0, mode: "card" }], emphasis: [] }} calculateMetadata={meta} />
    <Composition id="IntroV2" component={IntroV2 as unknown as AnyFC} width={1920} height={1080} fps={30} durationInFrames={300}
      defaultProps={{ clips: [], title: "Fringe Lines", subtitle: "", topics: [], titleFrames: 120, durationInFrames: 300, emphasis: [] }} calculateMetadata={meta} />
    <Composition id="HowTo" component={HowTo as unknown as AnyFC} width={1080} height={1920} fps={30} durationInFrames={300}
      defaultProps={{ screen: "screen.mp4", screenW: 1920, screenH: 1080, cam: "cam.mp4", camW: 1280, camH: 720, durationInFrames: 300, words: [],
                      focus: [{ startMs: 0, box: [0, 0, 1, 1] }], title: "How to" }} calculateMetadata={meta} />
    <Composition id="Carousel" component={Carousel as unknown as AnyFC} width={1080} height={1350} fps={30} durationInFrames={61}
      defaultProps={{ slide: { type: "text", title: "Title" }, index: 0, total: 1, brand: "Fringe Lines", durationInFrames: 61 }} calculateMetadata={meta} />
    <Composition id="CarouselV2" component={CarouselV2 as unknown as AnyFC} width={1080} height={1350} fps={30} durationInFrames={1}
      defaultProps={{ slide: { type: "point", number: "01", title: "Title", text: "" }, index: 0, total: 1, brand: "FringeLines", durationInFrames: 1 }} calculateMetadata={meta} />
    <Composition id="Infographic" component={Infographic as unknown as AnyFC} width={1080} height={1350} fps={30} durationInFrames={1}
      defaultProps={{ headline: ["Headline", "accent."], dek: "", hero: {}, callouts: [], durationInFrames: 1 }} calculateMetadata={meta} />
  </>
);

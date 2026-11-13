import React from "react";
import { Composition } from "remotion";
import { SleepInertiaVideo } from "./SleepInertiaVideo";
import { CelyxiVideo } from "./CelyxiVideo";
import { FPS, TOTAL_FRAMES } from "./data/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SleepInertia3D"
        component={SleepInertiaVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Celyxi10s"
        component={CelyxiVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

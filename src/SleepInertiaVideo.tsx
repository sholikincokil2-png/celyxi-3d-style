import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile } from "remotion";
import { KineticCaptions } from "./components/KineticCaptions";

export const SleepInertiaVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#070B19" }}>
      <Audio src={staticFile("audio/narration.mp3")} />

      <OffthreadVideo
        src={staticFile("video/blender_3d_pass.mp4")}
        style={{
          width: 1080,
          height: 1920,
          objectFit: "cover",
        }}
      />

      {/* Subtle Cinematic Vignette */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 56%, rgba(5,8,20,0.42) 100%)",
        }}
      />

      <KineticCaptions />
    </AbsoluteFill>
  );
};

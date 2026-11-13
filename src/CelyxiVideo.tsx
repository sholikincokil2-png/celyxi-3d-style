import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export const CelyxiVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0D0A08" }}>
      <OffthreadVideo
        src={staticFile("video/celyxi_3d_pass.mp4")}
        muted
        style={{
          width: 1080,
          height: 1920,
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
};

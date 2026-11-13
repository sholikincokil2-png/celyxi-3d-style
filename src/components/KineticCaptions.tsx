import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_BURSTS } from "../data/timeline";

export const KineticCaptions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = CAPTION_BURSTS.find(
    (b) => frame >= b.startFrame && frame <= b.endFrame
  );

  if (!active) return null;

  const localFrame = frame - active.startFrame;
  const pop = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 220, mass: 0.5 },
  });

  const scale = 0.85 + pop * 0.17;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "flex-start",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "68%",
          transform: `translateY(-50%) scale(${scale})`,
          fontFamily: "'Arial Black', 'Montserrat', 'Impact', sans-serif",
          fontWeight: 900,
          fontSize: 78,
          lineHeight: 1.08,
          color: "#FFFFFF",
          textAlign: "center",
          WebkitTextStroke: "16px #000000",
          paintOrder: "stroke fill",
          textShadow: "0px 8px 18px rgba(0, 0, 0, 0.75)",
          padding: "0 48px",
          letterSpacing: "1px",
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};

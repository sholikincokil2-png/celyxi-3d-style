import React from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { interpolate, spring, useVideoConfig } from "remotion";
import { CameraMode } from "../data/timeline";

interface CameraRig3DProps {
  mode: CameraMode;
  localFrame: number;
  durationInFrames: number;
  targetPos?: [number, number, number];
}

export const CameraRig3D: React.FC<CameraRig3DProps> = ({
  mode,
  localFrame,
  durationInFrames,
  targetPos = [0, 1.25, 0],
}) => {
  const { camera } = useThree();
  const { fps } = useVideoConfig();
  const perspCam = camera as THREE.PerspectiveCamera;

  const progress = Math.min(1, Math.max(0, localFrame / Math.max(1, durationInFrames - 1)));

  let camX = 0;
  let camY = 1.5;
  let camZ = 5.5;
  let fov = 45;
  let lookX = targetPos[0];
  let lookY = targetPos[1];
  let lookZ = targetPos[2];

  if (mode === "zoom_in") {
    camX = interpolate(progress, [0, 1], [-0.4, 0.0]);
    camY = interpolate(progress, [0, 1], [1.9, 1.45]);
    camZ = interpolate(progress, [0, 1], [6.2, 4.3]);
    fov = 44;
  } else if (mode === "snap_push_in") {
    const sp = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 110 } });
    camX = interpolate(sp, [0, 1], [0.4, 0.0]);
    camY = interpolate(sp, [0, 1], [1.6, 1.35]);
    camZ = interpolate(sp, [0, 1], [6.4, 3.85]);
    fov = 42;
  } else if (mode === "lateral_left_to_right") {
    camX = interpolate(progress, [0, 1], [-1.7, 1.7]);
    camY = 1.45;
    camZ = 5.4;
    lookX = interpolate(progress, [0, 1], [-0.6, 0.5]);
    fov = 45;
  } else if (mode === "reveal_pull_back") {
    const sp = spring({ frame: localFrame, fps, config: { damping: 16, stiffness: 55 } });
    camX = 0;
    camY = interpolate(sp, [0, 1], [1.3, 1.4]);
    camZ = interpolate(sp, [0, 1], [2.4, 5.8]);
    fov = 46;
  } else if (mode === "shake_zoom") {
    const sp = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 140 } });
    const shakeAmp = Math.max(0, 1 - progress * 0.5) * 0.09;
    camX = Math.sin(localFrame * 1.9) * shakeAmp;
    camY = 1.2 + Math.cos(localFrame * 2.3) * shakeAmp;
    camZ = interpolate(sp, [0, 1], [5.2, 3.3]);
    fov = 45;
  } else if (mode === "dolly_zoom_vertigo") {
    // True Vertigo Effect:
    // Keep subject height H constant at target plane by matching camera Z to fov:
    // Z = H / (2 * tan(fov/2))
    const sp = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 45 } });
    fov = interpolate(sp, [0, 1], [28, 68]);
    const halfRad = (fov * Math.PI) / 360;
    const constantFrustumHeight = 3.2;
    camZ = constantFrustumHeight / (2 * Math.tan(halfRad));
    camX = 0;
    camY = 1.42;
  } else if (mode === "slow_zoom_out") {
    camX = interpolate(progress, [0, 1], [0.15, -0.1]);
    camY = interpolate(progress, [0, 1], [1.25, 1.55]);
    camZ = interpolate(progress, [0, 1], [3.8, 5.9]);
    fov = 46;
  } else if (mode === "lateral_right_to_left") {
    camX = interpolate(progress, [0, 1], [1.65, -1.65]);
    camY = 1.45;
    camZ = 5.4;
    lookX = interpolate(progress, [0, 1], [0.55, -0.55]);
    fov = 45;
  } else if (mode === "celebration_pull_back") {
    const sp = spring({ frame: localFrame, fps, config: { damping: 15, stiffness: 50 } });
    camX = interpolate(sp, [0, 1], [0.2, 0]);
    camY = interpolate(sp, [0, 1], [1.3, 1.85]);
    camZ = interpolate(sp, [0, 1], [4.1, 6.5]);
    fov = 46;
  }

  perspCam.position.set(camX, camY, camZ);
  if (perspCam.fov !== fov) {
    perspCam.fov = fov;
    perspCam.updateProjectionMatrix();
  }
  perspCam.lookAt(lookX, lookY, lookZ);

  return null;
};

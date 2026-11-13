import React, { useMemo } from "react";
import * as THREE from "three";
import { createStylizedToonRimMaterial } from "../shaders/customShaders";

export type StickmanExpression =
  | "sleeping"
  | "exhausted"
  | "confused"
  | "shocked"
  | "zombie"
  | "happy"
  | "doctor";

export type StickmanPose =
  | "sleeping"
  | "slouching"
  | "scratching_head"
  | "standing_shock"
  | "zombie_sit"
  | "doctor_pointing"
  | "leaping_joy";

interface Stickman3DProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  expression: StickmanExpression;
  pose: StickmanPose;
  localFrame: number;
  role?: "protagonist" | "doctor";
  showHeadCutaway?: boolean;
}

function drawFaceTexture(expression: StickmanExpression): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = "#1A1A1A";
  ctx.fillStyle = "#1A1A1A";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (expression === "sleeping") {
    // Peaceful curved closed eyes
    ctx.beginPath();
    ctx.arc(92, 125, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(164, 125, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // Soft smile
    ctx.beginPath();
    ctx.arc(128, 158, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (expression === "exhausted") {
    // >_< wincing eyes
    ctx.beginPath();
    ctx.moveTo(74, 108);
    ctx.lineTo(104, 122);
    ctx.lineTo(74, 136);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(182, 108);
    ctx.lineTo(152, 122);
    ctx.lineTo(182, 136);
    ctx.stroke();
    // Frown mouth
    ctx.beginPath();
    ctx.arc(128, 180, 20, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    // Blue anime sweat drop
    ctx.fillStyle = "#38BDF8";
    ctx.strokeStyle = "#0284C7";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(205, 68);
    ctx.quadraticCurveTo(226, 106, 205, 118);
    ctx.quadraticCurveTo(184, 106, 205, 68);
    ctx.fill();
    ctx.stroke();
  } else if (expression === "confused") {
    // Wide circle eyes o_o
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(92, 122, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(164, 122, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(96, 122, 6, 0, Math.PI * 2);
    ctx.arc(168, 122, 6, 0, Math.PI * 2);
    ctx.fill();
    // Raised brow
    ctx.beginPath();
    ctx.moveTo(72, 92);
    ctx.quadraticCurveTo(92, 80, 110, 92);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(146, 98);
    ctx.lineTo(182, 96);
    ctx.stroke();
    // Small confused mouth
    ctx.beginPath();
    ctx.arc(132, 168, 10, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expression === "shocked") {
    // Huge panicked eyes O_O
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(90, 118, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(166, 118, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(90, 118, 6, 0, Math.PI * 2);
    ctx.arc(166, 118, 6, 0, Math.PI * 2);
    ctx.fill();
    // Open gasping mouth
    ctx.fillStyle = "#991B1B";
    ctx.beginPath();
    ctx.ellipse(128, 174, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === "zombie") {
    // Half-lidded tired eyes + dark bags
    ctx.strokeStyle = "#64748B";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(92, 134, 16, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(164, 134, 16, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(72, 118);
    ctx.lineTo(112, 118);
    ctx.moveTo(144, 118);
    ctx.lineTo(184, 118);
    ctx.stroke();
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(92, 126, 6, 0, Math.PI * 2);
    ctx.arc(164, 126, 6, 0, Math.PI * 2);
    ctx.fill();
    // Flat tired mouth
    ctx.beginPath();
    ctx.moveTo(106, 170);
    ctx.lineTo(150, 172);
    ctx.stroke();
  } else if (expression === "happy") {
    // Joyful ^_^ curved eyes
    ctx.beginPath();
    ctx.arc(92, 122, 18, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(164, 122, 18, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    // Big open laughing smile
    ctx.fillStyle = "#991B1B";
    ctx.beginPath();
    ctx.arc(128, 152, 34, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (expression === "doctor") {
    // Round glasses + confident eyes
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(90, 120, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(166, 120, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(116, 120);
    ctx.lineTo(140, 120);
    ctx.stroke();
    // Pupils
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.arc(90, 120, 6, 0, Math.PI * 2);
    ctx.arc(166, 120, 6, 0, Math.PI * 2);
    ctx.fill();
    // Friendly smile
    ctx.beginPath();
    ctx.arc(128, 162, 18, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const Stickman3D: React.FC<Stickman3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  expression,
  pose,
  localFrame,
  role = "protagonist",
  showHeadCutaway = false,
}) => {
  const faceTexture = useMemo(() => drawFaceTexture(expression), [expression]);

  // Frame-accurate organic movement calculations
  const t = localFrame / 30;
  let torsoTiltX = 0;
  let torsoPosY = 0;
  let headTiltZ = 0;
  let headTiltX = 0;
  let leftArmRotZ = 0.25;
  let leftArmRotX = 0;
  let rightArmRotZ = -0.25;
  let rightArmRotX = 0;
  let leftLegRotX = 0;
  let rightLegRotX = 0;
  let breathScale = 1 + Math.sin(t * 2.5) * 0.025;

  if (pose === "sleeping") {
    breathScale = 1 + Math.sin(t * 2.2) * 0.04;
    headTiltZ = Math.sin(t * 1.1) * 0.04;
  } else if (pose === "slouching") {
    torsoTiltX = 0.24 + Math.sin(t * 3.0) * 0.03;
    headTiltX = 0.25 + Math.sin(t * 4.0) * 0.05;
    leftArmRotX = -0.7;
    leftArmRotZ = -0.45; // Clutching back/gut
    rightArmRotX = -0.65;
    rightArmRotZ = 0.45;
    leftLegRotX = -1.25; // Sitting on bed
    rightLegRotX = -1.25;
  } else if (pose === "scratching_head") {
    headTiltZ = Math.sin(t * 2.8) * 0.12;
    rightArmRotZ = -2.35 + Math.sin(t * 9.0) * 0.18; // Scratching head rapidly
    rightArmRotX = -0.4;
    leftArmRotZ = 0.35 + Math.sin(t * 2.0) * 0.05;
  } else if (pose === "standing_shock") {
    const jolt = Math.sin(t * 18) * 0.04;
    torsoPosY = Math.abs(Math.sin(t * 6)) * 0.05;
    headTiltZ = jolt;
    leftArmRotZ = 1.45 + Math.sin(t * 12) * 0.15;
    rightArmRotZ = -1.45 - Math.sin(t * 12) * 0.15;
  } else if (pose === "zombie_sit") {
    torsoTiltX = 0.18 + Math.sin(t * 1.5) * 0.02;
    headTiltX = 0.22;
    leftArmRotX = -0.85; // Holding coffee mug
    leftArmRotZ = -0.25;
    rightArmRotX = -0.4;
    leftLegRotX = -1.3;
    rightLegRotX = -1.3;
  } else if (pose === "doctor_pointing") {
    torsoPosY = Math.sin(t * 2.0) * 0.02;
    rightArmRotZ = -1.2 + Math.sin(t * 3.5) * 0.18; // Pointing pointer stick
    rightArmRotX = -0.3;
    leftArmRotZ = 0.45; // Hand on hip
  } else if (pose === "leaping_joy") {
    const jump = Math.abs(Math.sin(t * 4.5));
    torsoPosY = jump * 0.65;
    leftArmRotZ = 2.4 + Math.sin(t * 8) * 0.15;
    rightArmRotZ = -2.4 - Math.sin(t * 8) * 0.15;
    leftLegRotX = jump * 0.55;
    rightLegRotX = -jump * 0.45;
    headTiltZ = Math.sin(t * 4.5) * 0.08;
  }

  const torsoColor = role === "doctor" ? "#F8F9FA" : "#F5D018";
  const hairColor = role === "doctor" ? "#64748B" : "#5C3A21";

  const torsoMat = useMemo(
    () => createStylizedToonRimMaterial(torsoColor, role === "doctor" ? "#38BDF8" : "#FDE68A", 0.55),
    [torsoColor, role]
  );
  const headMat = useMemo(
    () => createStylizedToonRimMaterial("#FFFFFF", "#93C5FD", 0.5),
    []
  );
  const hairMat = useMemo(
    () => createStylizedToonRimMaterial(hairColor, "#FDE68A", 0.35),
    [hairColor]
  );
  const beltMat = useMemo(
    () => createStylizedToonRimMaterial("#78350F", "#F59E0B", 0.35),
    []
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group position={[0, torsoPosY, 0]} rotation={[torsoTiltX, 0, 0]}>
        {/* TORSO PILL */}
        <group scale={[1, breathScale, 1]}>
          <mesh position={[0, 0.9, 0]} castShadow receiveShadow material={torsoMat}>
            <capsuleGeometry args={[0.26, 0.52, 16, 24]} />
          </mesh>
          {/* Dark Outline Shell for Torso */}
          <mesh position={[0, 0.9, 0]} scale={[1.08, 1.04, 1.08]}>
            <capsuleGeometry args={[0.26, 0.52, 16, 24]} />
            <meshBasicMaterial color="#1A1A1A" side={THREE.BackSide} />
          </mesh>
          {/* Shirt Details */}
          {role === "protagonist" ? (
            <group>
              {/* Brown Belt */}
              <mesh position={[0, 0.68, 0]} material={beltMat}>
                <cylinderGeometry args={[0.268, 0.268, 0.07, 24]} />
              </mesh>
              {/* 2 Polo Buttons */}
              <mesh position={[0, 1.15, 0.26]}>
                <sphereGeometry args={[0.025, 12, 12]} />
                <meshStandardMaterial color="#1A1A1A" roughness={0.25} metalness={0.3} />
              </mesh>
              <mesh position={[0, 1.03, 0.26]}>
                <sphereGeometry args={[0.025, 12, 12]} />
                <meshStandardMaterial color="#1A1A1A" roughness={0.25} metalness={0.3} />
              </mesh>
            </group>
          ) : (
            /* Doctor Tie */
            <mesh position={[0, 1.04, 0.26]}>
              <boxGeometry args={[0.07, 0.34, 0.03]} />
              <meshStandardMaterial color="#0284C7" roughness={0.35} metalness={0.15} />
            </mesh>
          )}
        </group>

        {/* HEAD GROUP */}
        {!showHeadCutaway && (
          <group position={[0, 1.72, 0]} rotation={[headTiltX, 0, headTiltZ]}>
            {/* White Flattened Sphere Head with 3D Cel-PBR + Rim Shader */}
            <mesh scale={[1.08, 0.96, 0.78]} castShadow material={headMat}>
              <sphereGeometry args={[0.42, 32, 32]} />
            </mesh>
            {/* Inverted Hull Thick Black Outline */}
            <mesh scale={[1.15, 1.03, 0.84]}>
              <sphereGeometry args={[0.42, 32, 32]} />
              <meshBasicMaterial color="#1A1A1A" side={THREE.BackSide} />
            </mesh>
            {/* Hair Cap */}
            <mesh position={[0, 0.12, -0.02]} scale={[1.1, 0.85, 0.82]} material={hairMat}>
              <sphereGeometry args={[0.41, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
            </mesh>
            {/* Dynamic 2D Expression Face Plane */}
            <mesh position={[0, -0.02, 0.34]}>
              <planeGeometry args={[0.68, 0.68]} />
              <meshBasicMaterial map={faceTexture} transparent />
            </mesh>
          </group>
        )}

        {/* LEFT ARM */}
        <group position={[-0.28, 1.25, 0]} rotation={[leftArmRotX, 0, leftArmRotZ]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <cylinderGeometry args={[0.032, 0.032, 0.64, 12]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
          {/* Ball Hand */}
          <mesh position={[0, -0.66, 0]} castShadow>
            <sphereGeometry args={[0.065, 14, 14]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
        </group>

        {/* RIGHT ARM */}
        <group position={[0.28, 1.25, 0]} rotation={[rightArmRotX, 0, rightArmRotZ]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <cylinderGeometry args={[0.032, 0.032, 0.64, 12]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
          {/* Ball Hand */}
          <mesh position={[0, -0.66, 0]} castShadow>
            <sphereGeometry args={[0.065, 14, 14]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
          {/* Doctor Pointer Stick */}
          {pose === "doctor_pointing" && (
            <mesh position={[0, -0.95, 0.15]} rotation={[0.5, 0, 0]}>
              <cylinderGeometry args={[0.014, 0.01, 0.85, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.2} />
            </mesh>
          )}
        </group>

        {/* LEFT LEG */}
        <group position={[-0.12, 0.56, 0]} rotation={[leftLegRotX, 0, 0]}>
          <mesh position={[0, -0.34, 0]} castShadow>
            <cylinderGeometry args={[0.034, 0.034, 0.68, 12]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
          <mesh position={[0, -0.68, 0.07]} castShadow>
            <boxGeometry args={[0.08, 0.05, 0.18]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
        </group>

        {/* RIGHT LEG */}
        <group position={[0.12, 0.56, 0]} rotation={[rightLegRotX, 0, 0]}>
          <mesh position={[0, -0.34, 0]} castShadow>
            <cylinderGeometry args={[0.034, 0.034, 0.68, 12]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
          <mesh position={[0, -0.68, 0.07]} castShadow>
            <boxGeometry args={[0.08, 0.05, 0.18]} />
            <meshStandardMaterial color="#1E293B" roughness={0.32} metalness={0.22} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

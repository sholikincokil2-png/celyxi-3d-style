import React, { useMemo } from "react";
import * as THREE from "three";
import {
  createBedroomWallMaterial,
  createFabricClothMaterial,
  createFresnelBrainMaterial,
  createHoloWaveMaterial,
  createOakParquetMaterial,
  createStudioBackdropMaterial,
  createSunbeamMaterial,
} from "../shaders/customShaders";

export const Bedroom3D: React.FC<{
  mode: "night" | "morning" | "dim_zombie" | "celebration";
  localFrame: number;
  showAlarmRing?: boolean;
}> = ({ mode, localFrame, showAlarmRing = false }) => {
  const isNight = mode === "night";
  const isDim = mode === "dim_zombie";
  const brightness = isNight ? 0.55 : isDim ? 0.62 : 1.05;

  const woodMat = useMemo(() => createOakParquetMaterial(brightness), [brightness]);
  const sunbeamMat = useMemo(() => createSunbeamMaterial(), []);
  const wallMat = useMemo(() => createBedroomWallMaterial(isNight || isDim), [isNight, isDim]);
  const duvetMat = useMemo(
    () => createFabricClothMaterial(isNight ? "#172554" : "#1E3A8A", "#60A5FA"),
    [isNight]
  );
  const mattressMat = useMemo(() => createFabricClothMaterial("#F1F5F9", "#FDE68A"), []);

  const t = localFrame / 30;
  const bellVib = showAlarmRing ? Math.sin(t * 55) * 0.14 : 0;
  const ringPulse = showAlarmRing ? 1 + (Math.sin(t * 20) * 0.5 + 0.5) * 0.35 : 0;

  return (
    <group>
      {/* Procedural Oak Parquet Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={woodMat}>
        <planeGeometry args={[18, 18]} />
      </mesh>

      {/* Back & Side Walls with Procedural Plaster + AO + Bounce Shader */}
      <mesh position={[0, 3.5, -3.2]} receiveShadow material={wallMat}>
        <planeGeometry args={[18, 8]} />
      </mesh>
      <mesh position={[-4.5, 3.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wallMat}>
        <planeGeometry args={[14, 8]} />
      </mesh>

      {/* Window with Sky Backdrop */}
      <group position={[-2.2, 2.3, -3.12]}>
        <mesh>
          <planeGeometry args={[2.0, 2.2]} />
          <meshBasicMaterial
            color={isNight ? "#0A1931" : isDim ? "#475569" : "#7DD3FC"}
          />
        </mesh>
        {/* Window Frame */}
        <mesh position={[0, 1.1, 0.04]}>
          <boxGeometry args={[2.16, 0.1, 0.1]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
        <mesh position={[0, -1.1, 0.04]}>
          <boxGeometry args={[2.16, 0.1, 0.1]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[0.08, 2.2, 0.08]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[2.0, 0.08, 0.08]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>

        {/* Volumetric Sunbeams during morning/celebration */}
        {(mode === "morning" || mode === "celebration") && (
          <mesh
            position={[1.1, -0.8, 1.4]}
            rotation={[0.25, -0.35, -0.45]}
            material={sunbeamMat}
          >
            <planeGeometry args={[3.6, 4.5]} />
          </mesh>
        )}
      </group>

      {/* Stylized 3D Wooden Bed */}
      <group position={[0.4, 0, -1.3]}>
        {/* Bed Frame */}
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.35, 3.0]} />
          <meshStandardMaterial color="#78350F" roughness={0.55} />
        </mesh>
        {/* Headboard */}
        <mesh position={[0, 0.85, -1.42]} castShadow receiveShadow>
          <boxGeometry args={[2.35, 1.15, 0.14]} />
          <meshStandardMaterial color="#5C2D0C" roughness={0.55} />
        </mesh>
        {/* Mattress */}
        <mesh position={[0, 0.54, 0.02]} castShadow receiveShadow material={mattressMat}>
          <boxGeometry args={[2.14, 0.24, 2.82]} />
        </mesh>
        {/* Navy Duvet */}
        <mesh position={[0, 0.59, 0.38]} castShadow receiveShadow material={duvetMat}>
          <boxGeometry args={[2.18, 0.22, 2.08]} />
        </mesh>
        {/* Pillows */}
        <mesh position={[-0.45, 0.72, -1.02]} castShadow material={mattressMat}>
          <boxGeometry args={[0.75, 0.16, 0.45]} />
        </mesh>
        <mesh position={[0.45, 0.72, -1.02]} castShadow material={mattressMat}>
          <boxGeometry args={[0.75, 0.16, 0.45]} />
        </mesh>
      </group>

      {/* Nightstand + Lamp / Chrome Twin-Bell Alarm Clock */}
      <group position={[-1.4, 0, -2.0]}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.85, 0.9, 0.75]} />
          <meshStandardMaterial color="#78350F" roughness={0.5} />
        </mesh>

        {!showAlarmRing ? (
          /* Warm Bedside Lamp */
          <group position={[0, 0.9, 0]}>
            <mesh position={[0, 0.12, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.16, 0.24, 16]} />
              <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.38, 0]}>
              <cylinderGeometry args={[0.16, 0.26, 0.32, 20]} />
              <meshStandardMaterial
                color="#FEF3C7"
                emissive="#F59E0B"
                emissiveIntensity={isNight || isDim ? 1.4 : 0.2}
                roughness={0.5}
              />
            </mesh>
            {(isNight || isDim) && (
              <pointLight position={[0, 0.45, 0.2]} color="#FBBF24" intensity={2.4} distance={7} />
            )}
          </group>
        ) : (
          /* Glossy PBR Chrome Twin-Bell Alarm Clock */
          <group position={[0.1, 1.18, 0.1]} rotation={[0, 0.2, bellVib]} scale={1.35}>
            {/* Main Chrome Body */}
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 0.16, 32]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.95} roughness={0.08} />
            </mesh>
            {/* Clock Face */}
            <mesh position={[0, 0, 0.085]}>
              <circleGeometry args={[0.24, 32]} />
              <meshBasicMaterial color="#0F172A" />
            </mesh>
            {/* Red Glowing Hands */}
            <mesh position={[0, 0.06, 0.09]}>
              <boxGeometry args={[0.025, 0.14, 0.01]} />
              <meshBasicMaterial color="#EF4444" />
            </mesh>
            <mesh position={[0.05, 0, 0.09]}>
              <boxGeometry args={[0.11, 0.025, 0.01]} />
              <meshBasicMaterial color="#EF4444" />
            </mesh>
            {/* Twin Chrome Bells */}
            <mesh position={[-0.22, 0.26, 0]} rotation={[0, 0, 0.6]}>
              <sphereGeometry args={[0.11, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color="#F1F5F9" metalness={0.96} roughness={0.05} />
            </mesh>
            <mesh position={[0.22, 0.26, 0]} rotation={[0, 0, -0.6]}>
              <sphereGeometry args={[0.11, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color="#F1F5F9" metalness={0.96} roughness={0.05} />
            </mesh>
            {/* Red Soundwave Rings */}
            <mesh position={[0, 0, 0]} scale={ringPulse}>
              <ringGeometry args={[0.38, 0.42, 32]} />
              <meshBasicMaterial color="#EF4444" transparent opacity={0.75} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0]} scale={ringPulse * 1.28}>
              <ringGeometry args={[0.42, 0.45, 32]} />
              <meshBasicMaterial color="#F87171" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

export const ClockWall3D: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const woodMat = useMemo(() => createOakParquetMaterial(1.0), []);
  const wallMat = useMemo(() => createBedroomWallMaterial(false), []);
  const t = localFrame / 30;
  const xScale = 1 + Math.sin(t * 6) * 0.04;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={woodMat}>
        <planeGeometry args={[18, 18]} />
      </mesh>
      <mesh position={[0, 3.5, -2.5]} receiveShadow material={wallMat}>
        <planeGeometry args={[18, 8]} />
      </mesh>

      {/* Giant 3D Wall Clock */}
      <group position={[1.0, 2.25, -2.3]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.92, 0.92, 0.12, 40]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <circleGeometry args={[0.82, 40]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Clock Hands */}
        <mesh position={[0, 0.25, 0.075]} rotation={[0, 0, -t * 0.8]}>
          <boxGeometry args={[0.04, 0.5, 0.01]} />
          <meshBasicMaterial color="#1E293B" />
        </mesh>
        <mesh position={[0.18, 0, 0.075]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.05, 0.36, 0.01]} />
          <meshBasicMaterial color="#1E293B" />
        </mesh>
        {/* Bold Red X */}
        <group position={[0, 0, 0.1]} scale={xScale}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[1.5, 0.16, 0.04]} />
            <meshBasicMaterial color="#DC2626" />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[1.5, 0.16, 0.04]} />
            <meshBasicMaterial color="#DC2626" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export const HoloStage3D: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const holoMat = useMemo(() => createHoloWaveMaterial(), []);
  holoMat.uniforms.uTime.value = localFrame / 30;

  return (
    <group>
      {/* Dark Reflective Stage Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#090D16" metalness={0.8} roughness={0.18} />
      </mesh>
      {/* Glowing Pedestal Rings */}
      <mesh position={[0, 0.05, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.75, 48]} />
        <meshBasicMaterial color="#06B6D4" />
      </mesh>
      <mesh position={[0, 0.06, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.18, 48]} />
        <meshBasicMaterial color="#8B5CF6" />
      </mesh>

      {/* Custom GLSL Holographic Sleep Wave Panel */}
      <mesh position={[0, 1.55, -0.5]} material={holoMat}>
        <planeGeometry args={[3.4, 1.85]} />
      </mesh>
    </group>
  );
};

export const BrainCutaway3D: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const brainMat = useMemo(() => createFresnelBrainMaterial(), []);
  const t = localFrame / 30;
  brainMat.uniforms.uTime.value = t;

  return (
    <group>
      {/* Deep Warped Tunnel Walls for Dolly Zoom Vertigo Contrast */}
      <mesh position={[0, 1.5, -5]}>
        <planeGeometry args={[24, 18]} />
        <meshBasicMaterial color="#162038" />
      </mesh>
      {/* Subtle Rim Light & Cyan Halo Ring so black stickman limbs pop cleanly */}
      <pointLight position={[0, 1.6, -1.6]} intensity={2.2} color="#38BDF8" distance={8} />
      <mesh position={[0, 1.15, -1.4]}>
        <ringGeometry args={[1.15, 1.28, 48]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* Perspective Grid Pillars Behind for Dramatic Vertigo Effect */}
      {[-3.2, -1.8, 1.8, 3.2].map((px, i) => (
        <mesh key={i} position={[px, 2.0, -2.8]} castShadow>
          <boxGeometry args={[0.35, 6, 0.35]} />
          <meshStandardMaterial color="#1E293B" emissive="#2563EB" emissiveIntensity={0.45} />
        </mesh>
      ))}

      {/* Translucent Head Cutaway Shell */}
      <group position={[0, 1.78, 0]}>
        <mesh scale={[1.12, 0.96, 0.78]}>
          <sphereGeometry args={[0.46, 32, 32]} />
          <meshPhysicalMaterial
            color="#93C5FD"
            transparent
            opacity={0.22}
            depthWrite={false}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>
        {/* Glowing Fresnel 3D Brain Core */}
        <mesh position={[0, 0.04, 0]} scale={[1.15, 0.85, 0.95]} material={brainMat}>
          <icosahedronGeometry args={[0.29, 3]} />
        </mesh>
        {/* Jagged Red Alarm Shock Bolts */}
        {[-0.36, 0, 0.36].map((bx, idx) => (
          <mesh
            key={idx}
            position={[bx, 0.62 + Math.sin(t * 25 + idx) * 0.08, 0.1]}
            rotation={[0, 0, bx * -0.5]}
          >
            <coneGeometry args={[0.07, 0.38, 4]} />
            <meshBasicMaterial color="#EF4444" />
          </mesh>
        ))}
      </group>
    </group>
  );
};

export const DoctorStudio3D: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  const backdropMat = useMemo(
    () => createStudioBackdropMaterial("#1E3A8A", "#0F172A", "#38BDF8"),
    []
  );
  const t = localFrame / 30;
  const dialRot = -t * 0.45;

  return (
    <group>
      {/* Clean Glossy Studio Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1E293B" metalness={0.45} roughness={0.18} />
      </mesh>
      <mesh position={[0, 3.5, -2.5]} receiveShadow material={backdropMat}>
        <planeGeometry args={[20, 8]} />
      </mesh>

      {/* Glowing 3D 90-Minute Cycle Wheel */}
      <group position={[-0.7, 2.0, -1.6]}>
        {/* Outer Neon Ring */}
        <mesh rotation={[0, 0, dialRot]}>
          <torusGeometry args={[1.05, 0.08, 16, 48]} />
          <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={1.6} />
        </mesh>
        {/* Color-Coded Sleep Wedges */}
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[0.98, 32, 0, Math.PI * 0.66]} />
          <meshBasicMaterial color="#22C55E" />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[0.98, 32, Math.PI * 0.66, Math.PI * 0.66]} />
          <meshBasicMaterial color="#8B5CF6" />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[0.98, 32, Math.PI * 1.32, Math.PI * 0.68]} />
          <meshBasicMaterial color="#06B6D4" />
        </mesh>
        {/* Center White Hub */}
        <mesh position={[0, 0, 0.02]}>
          <circleGeometry args={[0.45, 32]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Rotating Pointer Hand */}
        <mesh position={[0, 0.25, 0.05]} rotation={[0, 0, dialRot * 2]}>
          <boxGeometry args={[0.05, 0.72, 0.02]} />
          <meshBasicMaterial color="#0F172A" />
        </mesh>
      </group>
    </group>
  );
};

import React from "react";
import { useCurrentFrame } from "remotion";
import { Environment, Lightformer } from "@react-three/drei";
import { SceneDef } from "../data/timeline";
import { CameraRig3D } from "../components/CameraRig3D";
import { Stickman3D } from "../components/Stickman3D";
import {
  Bedroom3D,
  BrainCutaway3D,
  ClockWall3D,
  DoctorStudio3D,
  HoloStage3D,
} from "../components/Environments3D";

export const SceneContent: React.FC<{ scene: SceneDef }> = ({ scene }) => {
  const localFrame = useCurrentFrame();

  return (
    <>
      {/* Studio Image-Based Lighting (IBL) for PBR Reflections */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[-4, 5, 3]} scale={[6, 4, 1]} color="#FEF3C7" />
        <Lightformer form="rect" intensity={1.6} position={[5, 4, -2]} scale={[5, 4, 1]} color="#38BDF8" />
        <Lightformer form="ring" intensity={1.2} position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]} scale={5} color="#FFFFFF" />
      </Environment>

      {/* Scene Lighting */}
      {scene.id === 1 && (
        <>
          <ambientLight intensity={0.35} color="#93C5FD" />
          <directionalLight position={[3, 6, 4]} intensity={0.45} color="#60A5FA" castShadow />
        </>
      )}
      {(scene.id === 2 || scene.id === 9) && (
        <>
          <ambientLight intensity={0.65} color="#FFFBEB" />
          <directionalLight position={[-4, 7, 5]} intensity={1.8} color="#FDE68A" castShadow />
        </>
      )}
      {scene.id === 3 && (
        <>
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 6, 5]} intensity={1.4} castShadow />
        </>
      )}
      {(scene.id === 4 || scene.id === 6) && (
        <>
          <ambientLight intensity={0.4} color="#818CF8" />
          <pointLight position={[0, 3, 2]} intensity={2.0} color="#38BDF8" />
        </>
      )}
      {(scene.id === 5 || scene.id === 7) && (
        <>
          <ambientLight intensity={0.42} color="#94A3B8" />
          <directionalLight position={[3, 5, 4]} intensity={0.85} castShadow />
        </>
      )}
      {scene.id === 8 && (
        <>
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 6, 5]} intensity={1.1} castShadow />
        </>
      )}

      {/* Scene 1: Tidur 8 Jam */}
      {scene.id === 1 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0.3, 0.9, -1.6]} />
          <Bedroom3D mode="night" localFrame={localFrame} />
          <Stickman3D
            position={[0.4, 0.55, -1.8]}
            rotation={[-Math.PI / 2.3, 0, 0]}
            expression="sleeping"
            pose="sleeping"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 2: Badan Remuk & Lemas */}
      {scene.id === 2 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0.35, 1.35, -0.4]} />
          <Bedroom3D mode="morning" localFrame={localFrame} />
          <Stickman3D
            position={[0.35, 0.35, -0.4]}
            rotation={[0, -0.15, 0]}
            expression="exhausted"
            pose="slouching"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 3: Bukan Durasi Tidur (Lateral Left -> Right) */}
      {scene.id === 3 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0, 1.4, -0.8]} />
          <ClockWall3D localFrame={localFrame} />
          <Stickman3D
            position={[-0.65, 0, -0.6]}
            rotation={[0, 0.25, 0]}
            expression="confused"
            pose="scratching_head"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 4: Fase Tidur Terpotong (GLSL Holo Wave) */}
      {scene.id === 4 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0, 1.4, -0.5]} />
          <HoloStage3D localFrame={localFrame} />
          <Stickman3D
            position={[-1.45, 0, 0.7]}
            rotation={[0, 0.45, 0]}
            scale={0.78}
            expression="shocked"
            pose="standing_shock"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 5: Alarm Berbunyi di Deep Sleep */}
      {scene.id === 5 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[-1.25, 1.15, -1.8]} />
          <Bedroom3D mode="morning" localFrame={localFrame} showAlarmRing={true} />
          <Stickman3D
            position={[0.45, 0.55, -1.7]}
            rotation={[-Math.PI / 2.4, 0, 0]}
            expression="exhausted"
            pose="sleeping"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 6: Otak Dipaksa Bangun (True Dolly Zoom Vertigo!) */}
      {scene.id === 6 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0, 1.42, 0]} />
          <BrainCutaway3D localFrame={localFrame} />
          <Stickman3D
            position={[0, 0, 0]}
            expression="shocked"
            pose="standing_shock"
            localFrame={localFrame}
            showHeadCutaway={true}
          />
        </>
      )}

      {/* Scene 7: Sleep Inertia (Zombie) */}
      {scene.id === 7 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0.35, 1.25, -0.4]} />
          <Bedroom3D mode="dim_zombie" localFrame={localFrame} />
          <Stickman3D
            position={[0.35, 0.35, -0.4]}
            expression="zombie"
            pose="zombie_sit"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 8: Solusi 90 Menit (Lateral Right -> Left) */}
      {scene.id === 8 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0, 1.45, -0.8]} />
          <DoctorStudio3D localFrame={localFrame} />
          <Stickman3D
            position={[0.75, 0, -0.5]}
            rotation={[0, -0.25, 0]}
            expression="doctor"
            pose="doctor_pointing"
            role="doctor"
            localFrame={localFrame}
          />
        </>
      )}

      {/* Scene 9: Tubuh Jauh Lebih Segar */}
      {scene.id === 9 && (
        <>
          <CameraRig3D mode={scene.cameraMode} localFrame={localFrame} durationInFrames={scene.durationInFrames} targetPos={[0.2, 1.5, -0.6]} />
          <Bedroom3D mode="celebration" localFrame={localFrame} />
          <Stickman3D
            position={[0.2, 0.2, -0.6]}
            expression="happy"
            pose="leaping_joy"
            localFrame={localFrame}
          />
        </>
      )}
    </>
  );
};

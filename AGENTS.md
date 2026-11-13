# RicksClips3000 3D — Blender 5.1 (`bpy`) + Remotion Production Pipeline (`AGENTS.md`)

This workspace uses a specialized **6-Agent Blender 3D + Remotion Team** designed to produce **RicksClips3000-style** animated 9:16 shorts (`https://www.youtube.com/@RicksClips3000/shorts`) using **Blender 5.1.2 Headless Python (`bpy`)**, **Cycles Raytracing + Shader Nodes**, **Solidify Inverted-Hull Outlines**, **Compositor Glare/Bloom**, and **Remotion** for final kinetic captions & audio sync.

---

## 1. Core Architectural Laws

1. **100% Real Blender 3D & Shader Nodes (No Flat Colors, No Static Frames)**:
   - All 3D environments, props, lighting, and characters are built procedurally in **Blender 5.1.2** via headless Python scripts (`blender.exe -b -P ...`) using **Cycles** (`use_denoising=False`, `samples=8..12`, `max_bounces=2` for fast ~1s/frame raytracing on headless Windows).
   - Every surface uses real **Blender Shader Nodes** (`Principled BSDF`, `Noise/Wave/Brick` procedural textures, `Bump`, `Fresnel` rim-lights, `ColorRamp` stylized cel-shading, and `Emission` + **Compositor Glare `FOG_GLOW`**).
2. **RicksClips3000 Character Rig (`Stickman` & `Doctor`)**:
   - Flattened white head + capsule torso with **Solidify Modifier Inverted-Hull Outlines** (`#141414`, `use_flip_normals=True`), articulated 3D stick limbs with keyframed animation across every scene, and dynamic procedural cartoon face expressions (`>_<`, `o_o`, `O_O`, `^_^`, sweat drops).
3. **True Mathematical 3D Camera Choreography**:
   - **Dolly Zoom (Vertigo)**: Simultaneously keyframes `camera.location` AND `camera.data.lens` so the subject stays fixed in scale while the 3D tunnel stretches/compresses behind them.
   - **Hero Low-Angles, Lateral Trucking, Snap Push-in, Reveal Pull-back**: Animated with Blender Bezier F-curves.
4. **Remotion Final Composite**:
   - Remotion (`src/SleepInertiaVideo.tsx`) composites the rendered Blender 3D video (`public/video/blender_3d_pass.mp4`), `public/audio/narration.mp3`, and **1–2 word kinetic pop-in captions** at **Y = 68%** (`#FFFFFF` fill, thick `#000000` stroke) into `1080x1920` 30fps MP4.

---

## 2. Roster of the 6 Specialized Agents

| # | Agent ID (`name`) | Role Title | Core Responsibility |
|---|---|---|---|
| **1** | `story-architect` | **Story & Beat Timing Architect** | Splits the voiceover into crisp 2–6s narrative beats (Hook -> Escalation -> Twist -> Payoff) with exact frame ranges at `30 fps`. |
| **2** | `script-captioner` | **Kinetic Caption Sync Engineer** | Extracts exact timestamps for 1–2 word pop-in subtitle bursts (`Y = 68%`, white fill, thick black stroke) synced to the audio track. |
| **3** | `character-rigger-3d` | **Blender 3D Character & Motion Artist** | Builds the procedural Blender `Stickman` & `Doctor` rigs (Solidify inverted-hull outlines, articulated limb joints, procedural face decals) and keyframes organic motion. |
| **4** | `shader-world-director` | **Blender Environment, Shader & Camera Director** | Builds detailed 3D sets (bedrooms, sky domes, holo-stages, cutaway brain, doctor studio), authors Blender Shader Nodes + Compositor Bloom, and animates 3D cameras. |
| **5** | `remotion-compositor` | **Remotion Video & Caption Compositor** | Composites the Blender 3D render with `<Audio>` and `<KineticCaptions />` in `src/Root.tsx` and `src/SleepInertiaVideo.tsx`. |
| **6** | `qa-renderer` | **Blender, Remotion & MP4 Verifier** | Runs headless Blender renders (`blender -b -P ...`), executes `npx remotion render`, and verifies the final `1080x1920` 30fps MP4 with `ffprobe`. |

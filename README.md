# Celyxi-Style 3D Short Pipeline (Blender 5.1.2 + Remotion)

Procedural 3D animated 9:16 shorts pipeline replicating the **`@Celyxi`** visual, shading, camera, and continuous-motion style using **Blender 5.1.2 (`bpy`)** Cycles CPU rendering and **Remotion**.

---

## 1. `@Celyxi` 3D Style Spec Summary

Detailed specification: [`celyxi_style_spec.md`](celyxi_style_spec.md) | Environment & API notes: [`celyxi_deps_report.md`](celyxi_deps_report.md)

- **Chibi 3D Stickman-Pill Rig**: Oversized slightly oblate cream-white head (`#F6F1E9`, ~`0.74 m` dia) on a tapered capsule torso with thin dark charcoal (`#14100E`) stick limbs, molded 3D hats/visors, X-scars, stubble, and layered props.
- **Inverted-Hull Ink Outlines**: `Solidify` modifier (`offset = 1.0`, `use_flip_normals = True`) driven by a camera-ray backface-only shader (`#14100E`) so internal geometry keeps clean 3D shading.
- **Soft-Lit Stylized Shaders**: `Principled BSDF` + procedural `Noise`/`Wave` textures + `Bump` + Fresnel/Layer Weight rim lights + metallic brass/gold (`#E6B333`) + emissive relics feeding Compositor **Glare (`Bloom`)**.
- **Expressions & Comic FX**: High-res `512x512` Pillow-generated RGBA face decals (`neutral`, `suspicious`, `shocked`, `panic`, `smug`, `blink`, grid teeth) + pulsing cyan sweat drops (`#8BE0FF`) + floating dust motes.
- **Continuous Motion & Camera**: Never freeze poses—layered breathing/talk-bob squash-stretch, `pytweening` `easeOutBack` snaps, `opensimplex` handheld micro-float & 11 Hz nervous tremor, shallow DOF (`f/2.6–2.8`), and `AgX` color management.

### 10-Second Silent Scene (`Celyxi10s` — 300 frames @ 30fps)
**"The Sheriff's Golden Relic Inspection"** (100% visually readable with zero audio):
1. **Beat 1 (`f1–75`)**: Frontier Main Street — Sheriff struts along the boardwalk, spots a `WANTED` post, and points toward the Courthouse.
2. **Beat 2 (`f76–150`)**: Courthouse Counter — Nervous Clerk buffs a glowing Gold-Studded Bell Relic, panics (`O_O`, sweat drops), and ducks behind the counter.
3. **Beat 3 (`f151–225`)**: Chiaroscuro Interrogation — Room dims to `#0D0A08` with a tight diagonal spotlight on the Sheriff's badge, then whip-cuts to the Clerk frantically waving in denial.
4. **Beat 4 (`f226–300`)**: Golden Bloom Payoff — The Relic Bell rises and spins in golden Compositor bloom, the Clerk recoils, and the Sheriff bursts into a smug `^_^` laugh.

---

## 2. Repository Layout

- `blender_pipeline/celyxi_rig_shaders.py` — Blender 5.1.2 `bpy` character rigs (`create_celyxi_character`), shaders, inverted-hull outlines, Compositor `Bloom`, `512x512` PIL face decals, and motion/camera helpers.
- `blender_pipeline/build_celyxi_10s.py` — Full 4-beat 300-frame scene builder & Cycles CPU CLI renderer.
- `src/CelyxiVideo.tsx` & `src/Root.tsx` — Remotion `Celyxi10s` (`1080x1920`, `30fps`, `300` frames, silent) composition (alongside `SleepInertia3D`).
- `celyxi_style_spec.md` & `celyxi_deps_report.md` — Reference visual breakdown and Blender 5.1.2 hardware/API compatibility report.

---

## 3. Prerequisites

- **Blender 5.1.2** (`C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`)
  - Python packages installed into Blender's user modules (`pillow`, `pytweening`, `opensimplex`) — see `celyxi_deps_report.md`.
- **FFmpeg** on `PATH`
- **Node.js & npm** (`npm install` to restore `node_modules/`)

---

## 4. Pipeline Commands

### Step 1 — Render 3D Frames in Headless Blender 5.1.2 (Cycles CPU)
```powershell
# Optional: benchmark 1 frame first
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b -P blender_pipeline/build_celyxi_10s.py -- --res 360x640 --samples 4 --bounces 1 --bench 160

# Render all 300 frames -> out/celyxi_frames/frame_0001.png .. frame_0300.png
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b -P blender_pipeline/build_celyxi_10s.py -- --res 360x640 --samples 4 --bounces 1
```

### Step 2 — Encode Silent 1080x1920 3D Pass via FFmpeg
```powershell
New-Item -ItemType Directory -Force -Path public/video | Out-Null
ffmpeg -y -framerate 30 -i out/celyxi_frames/frame_%04d.png -vf "hqdn3d=6:5:8:6,scale=1080:1920:flags=lanczos,vignette=angle=PI/9" -c:v libx264 -pix_fmt yuv420p -crf 17 -an public/video/celyxi_3d_pass.mp4
```

### Step 3 — Type-Check & Render Remotion `Celyxi10s` Composition
```powershell
npm install
npx tsc --noEmit
npx remotion render src/index.ts Celyxi10s out/celyxi_10s_silent.mp4 --muted
```

### Step 4 — Verify Output Stream (`ffprobe`)
```powershell
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration -of default=noprint_wrappers=1 out/celyxi_10s_silent.mp4
```

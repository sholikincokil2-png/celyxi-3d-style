# `@Celyxi` 3D Production Pipeline — Dependencies & Environment Report

## 1. Host & Tooling Verification

| Component | Version / Path | Status | Notes |
|---|---|---|---|
| **Blender** | `5.1.2` (`C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`) | Verified | Bundled Python `3.13`, `numpy 2.3.4` |
| **FFmpeg** | `9.0.2-full_build-www.gyan.dev` | Verified | Available on PATH (`ffmpeg`) |
| **Node / TypeScript** | `npx.cmd tsc --noEmit` | Verified | Existing Remotion + R3F project (`package.json`) compiles cleanly with exit code 0 |
| **Git** | `2.38.1.windows.1` | Verified | Available on PATH |

### Existing `package.json` Dependencies (Verified Untouched)
- `remotion@4.0.543`, `@remotion/cli@4.0.543`, `@remotion/media-utils@4.0.543`, `@remotion/three@4.0.543`
- `three@0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`, `@react-three/postprocessing@3.2.2`, `postprocessing@6.39.6`, `three-custom-shader-material@6.4.0`
- `react@19.3.1`, `react-dom@19.3.1`, `typescript@7.0.2`

No extra npm packages were needed or added because 3D geometry, procedural shaders, character motion, DOF, and Bloom compositing are executed directly in headless **Blender 5.1.2** (`bpy`) and exported as a silent MP4 for Remotion (`Celyxi10s`).

---

## 2. Installed Python Packages for Blender 5.1.2

Installed cleanly into Blender 5.1's user modules path (already on Blender's `sys.path`, without touching `Program Files` or existing workspace files):
`C:\Users\Administrator\AppData\Roaming\Blender Foundation\Blender\5.1\scripts\addons\modules`

Command used:
```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\5.1\python\bin\python.exe" -m pip install --target "C:\Users\Administrator\AppData\Roaming\Blender Foundation\Blender\5.1\scripts\addons\modules" pillow pytweening opensimplex
```

| Package | Installed Version | Purpose in `celyxi_rig_shaders.py` |
|---|---|---|
| `pillow` (`PIL`) | `13.0.0` | High-resolution anti-aliased `512x512` RGBA facial expression decals (`neutral`, `suspicious`, `shocked`, `panic`, `smug`, `blink`, X-scar, stubble, blush, grid teeth). |
| `pytweening` | `1.2.0` | Snappy `@Celyxi` easing curves (`easeOutBack`, `easeInOutQuad`, `easeOutCubic`) for character pops, recoils, arm gestures, and camera transitions. |
| `opensimplex` | `0.4.5.1` | Smooth deterministic 2D simplex noise for organic handheld camera micro-float, nervous 11 Hz character tremor, and floating dust mote drift. |

Verified inside headless Blender 5.1.2 (`blender.exe -b --python-expr "import bpy, numpy, PIL, pytweening, opensimplex; ..."`):
- `numpy 2.3.4`, `PIL 13.0.0`, `pytweening 1.2.0`, `opensimplex 0.4.5.1` all import cleanly with zero conflicts.

---

## 3. Critical Blender 5.1.2 Hardware & API Findings

1. **Render Engine & Hardware Budget (`Intel Core i5-3210M CPU`)**:
   - No CUDA/HIP GPU is present (`CYCLES_BACKENDS: []`, CPU-only `Intel Core i5-3210M CPU @ 2.50GHz`).
   - `BLENDER_EEVEE` **crashes headless with `EXCEPTION_ACCESS_VIOLATION`** on this system (`0x00007FF74FF672D0`).
   - **Solution**: Always use `CYCLES` with `device = 'CPU'`, `use_denoising = False` (OpenImageDenoise adds ~45s/frame on this CPU, whereas `use_denoising = False` renders in **~1.5–3s/frame** at `432x768`–`540x960` and scales cleanly), `use_adaptive_sampling = True`, `adaptive_threshold = 0.04`, `max_bounces = 2`.
2. **Blender 5.1 Compositor API (`scene.compositing_node_group`)**:
   - `scene.node_tree` does **not** exist in Blender 5.1 (`hasattr(scene, 'node_tree') == False`), and `scene.use_nodes` is deprecated.
   - Instead, create a `CompositorNodeTree` node group, assign `scene.compositing_node_group = ng`, set `scene.render.use_compositing = True` and `scene.render.compositor_device = 'CPU'`, and expose an `"Image"` output socket via `ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")` wired into `NodeGroupOutput`.
   - `CompositorNodeGlare` configures parameters via **input sockets** (`gl.inputs["Type"].default_value = "Bloom"`, `gl.inputs["Quality"].default_value = "High"`, `Threshold`, `Strength`, `Size`). Verified working in Cycles CPU render (~1.25s).
3. **Blender 5.1 Slotted Actions / F-Curve API**:
   - `action.fcurves` was removed in Blender 5.x (`hasattr(action, 'fcurves') == False`).
   - Interpolation/easing on keyframed curves must be set via `action.layers[0].strips[0].channelbag(obj.animation_data.action_slot).fcurves`.
4. **Material & World Node Trees**:
   - `bpy.data.materials.new(name).node_tree` and `bpy.data.worlds.new(name).node_tree` are initialized automatically without calling `.use_nodes = True` (avoiding Blender 6.0 deprecation warnings).

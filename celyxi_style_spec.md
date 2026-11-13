# `@Celyxi` 3D Visual & Motion Style Specification

> Grounded in frame-by-frame visual analysis of 4 downloaded `@Celyxi` Shorts (`assets/celyxi_ref/`):
> - `01_jKGeI0xWtbo.mp4` (75.0s, 608x1080 @ 30fps — *Titanic / Britannic Sailor*)
> - `02_BIeFvV79Lu8.mp4` (64.4s, 608x1080 @ 30fps — *Medieval Court / Letter T*)
> - `03_QPC9EuK_GMA.mp4` (68.0s, 608x1080 @ 30fps — *Imperial Judge & Bronze Bell*)
> - `04_SRV3V6seY38.mp4` (68.0s, 608x1080 @ 30fps — *Wild West Sheriff & Outlaw*)

---

## 1. Character Geometry & Proportions

`@Celyxi` uses a **chibi-proportioned 3D stickman-pill rig** with oversized round heads, chunky capsule torsos, thin dark stick limbs, and rich 3D costume hats/props:

| Part | Exact Proportions (Character height `~1.85 m`) | Blender Mesh Recipe |
|---|---|---|
| **Head** | Radius `0.36 – 0.39 m` (diameter `~0.74 m`). Slightly oblate/squashed (`scale = (1.02, 0.94, 0.96)`). Head-to-torso height ratio is **~1 : 1.15** (large expressive head). | UV Sphere (`32x24`, smooth shaded) + subtle flatten on front/back Z/Y. |
| **Neck** | Virtually none (`0.02 m` overlap into collar). | Head rests directly on torso dome/collar ring. |
| **Torso / Tunic / Coat** | Height `0.78 – 0.88 m`, width `0.54 – 0.62 m` (narrower than head!), depth `0.42 – 0.48 m`. | Rounded capsule / tapered pill cylinder (`Z` domed top, slightly flared skirt/coat hem at bottom with clean bevels). |
| **Arms (Stick Limbs)** | Tube radius `0.022 – 0.026 m`, upper arm `~0.28 m` + forearm `~0.28 m`. Curved smoothly rather than stiff sharp elbows. | 3D Bezier curve with `bevel_depth = 0.024` (or 2-bone subdivided smooth capsule chain) attached inside shoulder seam. |
| **Hands** | Small sphere mitts (`radius = 0.042 m`); swap to stylized 4-finger cartoon mitt only for dramatic close-up emphasis (`03_QPC9EuK_GMA/frame_180`). | UV Sphere / rounded mitt at wrist tip. |
| **Legs & Feet** | Tube radius `0.022 – 0.025 m`, length `0.48 – 0.56 m` descending from bottom of coat/torso. Minimal tiny wedge/L-tick feet (`0.09 m` long) or straight pin tips. | Straight/articulated 2-segment cylinders with knee bend during walks + small rounded wedge foot. |
| **3D Hair & Hats** | Molded 3D shell caps hugging top/back/sides of head sphere with sculpted jagged/curved hairline around white face; oversized hats tilted `3°–8°` for personality. | Solidified outer shell sphere cap (`scale ~ 1.04`) + dedicated hat meshes (broad-brim Stetson, flat cap, green translucent clerk visor, judge wing-hat). |
| **Layered Costume Details** | 3D belt + square gold buckle, collared V-neck/kerchief, buttons, sheriff 6-point star badge, apron/vest trim. | Separate beveled low-poly meshes parented to torso bone so outfits read crisply in 3D shadow. |

---

## 2. Outlines (Inverted-Hull Ink Silhouette)

`@Celyxi` relies on **clean, bold comic-ink silhouettes** over soft-shaded 3D geometry:
- **Outline Color**: Very dark warm charcoal-brown `#14100E` (linear RGB `(0.007, 0.005, 0.004)`), NOT harsh pure `#000000` in lit areas, though near-black.
- **Blender Implementation**: `Solidify` modifier (`offset = 1.0`, `use_flip_normals = True`, `material_offset = 1`) paired with a **Camera-Ray Backface-Only Emission Shader** (transparent to shadow/diffuse rays so the inner mesh receives full lighting cleanly).
- **Outline Thickness**:
  - **Hero Characters (Head, Torso, Hats)**: `0.020 – 0.026 m` (`~2.5%` of head diameter) — bold, readable at 9:16 mobile scale.
  - **Thin Stick Limbs**: Skip Solidify (limbs are already `#14100E` dark charcoal tubes) OR use ultra-thin `0.006 m` rim so arms don't bloat.
  - **Foreground Hero Props**: `0.014 – 0.018 m`.
  - **Background Architecture / Distant Props**: `0.008 – 0.012 m` (or none on far blurred buildings so DOF stays smooth).

---

## 3. Facial Style & Expressions

Faces sit on the **front hemisphere of the bright cream-white head** (`#F6F1E9`):
- **Rendering Method**: High-contrast dark ink (`#14100E`) procedural/decal geometry hovering `0.003–0.006 m` off the front face curvature (or crisp UV-mapped procedural shader mask / shrinkwrapped flat dark-ink meshes with zero cast shadows) so expressions can swap cleanly per frame/beat without Z-fighting.
- **Core Eye & Brow States**:
  1. **Neutral / Suspicious (`-_-"`)**: Thick half-lidded horizontal/D-shaped eyes (`width ~ 0.09 m`), heavy tapered pill eyebrows angled downward toward center.
  2. **Shocked / Panicked (`O_O`)**: Large white sclera circles (`radius ~ 0.075 m`) with crisp dark outlines + tiny pinprick dark pupils (`radius ~ 0.015 m`) + high-arched curved brows + wide open maroon-black `O` mouth or clenched white grid-teeth oval (`02_BIeFvV79Lu8/frame_005`, `04_SRV3V6seY38/frame_130`).
  3. **Smug / Laughing (`^_^`)**: Upward-curved happy ink arcs for eyes, raised curved brows, wide D-shaped dark-maroon open smile (`#3A0C0C`).
  4. **Blink / Squint (`>_<` / `-_-`)**: Brief 3-frame closed horizontal/chevron eye lines every `2.0–3.0 s` and during impact flinches.
- **Signature Facial Details**:
  - Stitched red-brown X-scar (`#6E1B16`) on cheek, small grey-brown stubble dots along lower jaw, subtle soft rosy cheek blush ovals (`#F0A89E`, subtle opacity), expressive curved mustache/beard meshes.
- **Comic Reaction FX**:
  - **Cartoon Cyan Sweat Drops**: Teardrop 3D/billboard meshes (`#8BE0FF` base -> `#FFFFFF` highlight, dark outline) popping around temples when nervous (`03_QPC9EuK_GMA/frame_180`, `04_SRV3V6seY38/frame_130`).
  - **Breath / Sigh Puffs**: Soft translucent white overlapping spheres drifting upward (`02_BIeFvV79Lu8/frame_080`).

---

## 4. Materials & Shaders (Soft-Lit Stylized 3D + Cel Rim)

`@Celyxi` is **NOT flat toon shading**. Every object has **rich 3D volume, soft shadow falloff, subtle procedural texture, and a crisp Fresnel rim**:
1. **Skin / Face Shader**:
   - Cream-white base (`#F6F1E9`), `Roughness = 0.55`, subtle `Subsurface Weight = 0.15` (or soft diffuse ramp blending warm key `#FFFBF4` into cool-lavender/taupe shadow `#C8C2CC`) + **strong Fresnel / Layer Weight Rim** (`Blend = 0.25`, `ColorRamp` crisp edge band tinted warm `#FFE7BA` or cool `#A8CEFF` depending on scene).
2. **Cloth / Hats / Wood Props**:
   - `Principled BSDF` (`Roughness = 0.65–0.80`) modulated by subtle procedural `Noise Texture` / `Wave Texture` (wood plank grain on floors/desks, dusty dirt road streaks, woven fabric micro-noise, polka-dot or plaid pattern masks) + `Bump` (`Strength = 0.05–0.12`) + subtle Fresnel edge catchlight.
3. **Brass / Gold / Badges / Buckles**:
   - Saturated gold (`#E6B333`), `Metallic = 0.85`, `Roughness = 0.28`, `Specular = 0.7`, catching bright warm highlights and subtle bloom.
4. **Translucent Props (e.g., Clerk Visor)**:
   - Emerald green (`#1F8A4C`) with `Transmission / Alpha ~ 0.65`, `Roughness = 0.15`, dark solid rim band.
5. **Glowing / Relic Materials**:
   - `Emission` shader (`#FFD466` to `#FFF6CC`, `Strength = 4.0–12.0`) driving Compositor Glare.

---

## 5. Lighting, Rim Light, Bloom, DOF & Atmosphere

- **3-Point Stylized Rig**:
  - **Key Light**: Warm sunlight / window / spotlight (`#FFE4B8`, `energy = 3.5–5.5`, soft area light or `SUN` with `angle = 4°–8°` for soft-edged shadows).
  - **Fill / Sky Bounce**: Cool slate-blue ambient fill (`#6E8FBD`, low strength `0.4–0.7`) so shadows never turn muddy grey.
  - **Strong Rim / Backlight**: Dedicated `AREA` or `SPOT` kicker behind/above hero (`#FFF0C4` in sunny scenes, `#8CA8FF` in tense dark scenes) grazing the character's head/shoulders right inside the dark ink outline.
- **Dramatic Chiaroscuro Shift** (Signature `@Celyxi` beat):
  - Dim environment/fill to near zero (`#0D0A08`), fire a tight warm diagonal `SPOT` across the character's face (`03_QPC9EuK_GMA/frame_180`) + cool indigo rim, creating instant comedic tension.
- **Compositor Effects**:
  - **Glare (`FOG_GLOW`)**: Threshold `1.1–1.4`, Size `7–8`, Mix `-0.35` so sunlit windows, gold badges, and glowing relics radiate soft golden bloom (`02_BIeFvV79Lu8/frame_175`).
  - **Subtle Dark Vignette**: Soft radial darkening (`~15–20%`) at screen corners.
- **Shallow Depth of Field (DOF)**:
  - **Crucial for `@Celyxi` look**: Enable Blender camera DOF focused on the active speaker (`f-stop = 2.4 – 3.2`, `focal_length = 40–55 mm`). Background buildings/crowds soften naturally while foreground hero stays tack-sharp.
- **Floating Dust Motes**:
  - 25–45 tiny glowing soft particles (`radius = 0.008–0.018 m`, warm cream `Emission` `#FFF2D0`) drifting slowly through light shafts in every interior/exterior shot.

---

## 6. Environments & Props

Vertical `9:16` frames are dressed with **foreground, midground, and background parallax layers**:
- **Exterior Frontier Street (`04_SRV3V6seY38`)**:
  - Procedural sandy-ochre dirt road with wagon-wheel track variation, raised wooden boardwalk planks, false-front saloon/general-store facades receding down both sides of the street (blurred by DOF), hanging colorful fabric pennants overhead, wooden barrel/crate in foreground corner, warm gradient sky with stylized outlined 3D clouds.
- **Interior Courthouse / Assay Office (`02_BIeFvV79Lu8`, `03_QPC9EuK_GMA`, `04_SRV3V6seY38`)**:
  - Checkered stone/tile or plank wood floor, red carpet runner with gold diamond trim, heavy dark-mahogany counter with brass rail/knobs, tall arched window pouring warm golden light shafts (`FOG_GLOW`), framed `WANTED` posters / banners on plaster-and-timber walls, small desk props (scrolled papers, playing card, inkwell, **Hero Ornate Gold-Studded Bell / Relic Box**).

---

## 7. Color Palette

- **Ink Outlines & Stick Limbs**: `#14100E` (Dark Espresso Charcoal)
- **Character Face White**: `#F6F1E9` (Warm Cream White) with `#C8C2CC` cool shadow tint
- **Western / Interior Warm Woods & Dirt**:
  - Sunlit Sand / Dust: `#C99D62`
  - Honey Pine / Countertop: `#8C5830`
  - Deep Mahogany: `#3D2114`
  - Warm Sunlight / Key: `#FFE4B8`
- **Hero Costume Accents**:
  - Sheriff Leather Brown: `#5A3928`
  - Crimson Kerchief / Carpet: `#B32622`
  - Sheriff Gold / Bell Studs: `#E6B333`
  - Clerk Emerald Visor: `#1F8A4C`
  - Cool Sky / Shadow Accent: `#6E8FBD` -> `#283A59`
  - Sweat Drop Cyan: `#8BE0FF`

---

## 8. Camera Work (`1080x1920`, Vertical 9:16)

- **Composition**: Keep hero faces in the **Y = 28%–55%** band from top (clean headroom for hats/architecture; bottom 25% kept readable for props/desk/ground).
- **Lenses**: `35 mm` (street establishing) to `55 mm` (tense character closeups with crisp background bokeh).
- **Continuous Camera Motion (NO Static Cameras)**:
  - Smooth creeping push-ins (`dolly-in` over 60–75 frames), gentle handheld micro-float (`sin/noise ±0.012 m` translation, `±0.4°` roll), snappy whip-cuts / quick lateral trucks (`4–6 frames` ease-out) between speakers, low-angle hero tilt-ups, and a dramatic `Vertigo / Dolly-Zoom` or snap pull-back on payoff.
- **Color Management**: `AgX` (`AgX - Medium High Contrast`), `exposure = 0.15–0.25`.

---

## 9. Continuous Character Motion Style (CRITICAL)

Across every analyzed `@Celyxi` frame sequence (`03_QPC9EuK_GMA/127-131`, `04_SRV3V6seY38/38-42`), characters are **continuously alive**:
1. **Never Freeze a Pose**: Every character runs an ongoing layered motion stack:
   - **Breathing / Talk-Bob**: Continuous `Z` squash-and-stretch (`scale_z = 1.0 ± 0.025`, volume-preserving `scale_xy = 1.0 ∓ 0.012`) + slight torso pitch/roll (`±2°–4°`).
   - **Head & Hat Follow-Through**: Head lags `2–3 frames` behind torso bounce; hat tilts/wobbles `±3°` on sudden stops.
2. **Snappy Ease-Out Back & Overshoot**:
   - Pose changes (leaning in, pointing, popping up, turning) happen fast (`5–9 frames`) with `8–12%` overshoot before settling into secondary bobbing.
3. **Expressive Stick-Arm Choreography**:
   - Smooth sweeping arcs (`Ease-In-Out`), rhythmic prop-polishing/waving, dramatic pointing, throwing both hands up in panic, slapping the desk, or clutching the hat.
4. **Nervous Jitter & Blink Cadence**:
   - Panicked characters tremble (`±0.012 m` high-frequency X/Z micro-jitter at 10–12 Hz) with pulsing cyan sweat drops; eyes blink naturally (`3 frames` closed) every `~60 frames` and snap wide `O_O` on surprises.

---

## 10. Beat-by-Beat 10-Second Silent Scene Plan (`300 frames @ 30fps`, NO Sound)

**Premise (100% Visually Readable Without Audio)**: *"The Sheriff's Golden Relic Inspection"* — A swaggering Frontier Sheriff spots a Wanted sign, confronts a nervous Clerk who is hiding a suspiciously glowing Gold-Studded Relic Bell under the counter, puts him in the dramatic spotlight interrogation, and pops the lid to reveal a glowing golden treasure/comedic prize.

> **Hard Law**: Both active characters AND the 3D camera are visibly moving in EVERY beat (`1–75`, `76–150`, `151–225`, `226–300`).

| Beat | Frames (Time) | Set, Lighting & Mood | Character(s) & Facial States | Continuous Character Motion | Camera Choreography |
|---|---|---|---|---|---|
| **Beat 1: Street Swagger & Wanted Clue** | **1–75** (`0.0s–2.5s`) | **Frontier Main Street**: Dusty road, boardwalk, blurred false-front shops (`f/2.8` DOF), pennants swaying overhead, warm golden sun (`#FFE4B8`) + cool sky fill (`#6E8FBD`), drifting dust motes. | **Sheriff** (brown Stetson, X-scar, red kerchief, gold star). Face: `f1–42` confident `-_-"` smirk -> `f43–75` suspicious narrowed squint `>_<` + raised brow. | `f1–42`: Strutting forward along boardwalk (`2` full walk steps: alternating leg swing, torso bounce `±0.04m`, swagger roll `±4°`, swinging stick arms, hat bob). `f43–75`: Snappy stop with overshoot lean toward a wooden **WANTED** post, raises right stick arm pointing down the street toward the Courthouse door while torso keeps breathing/bobbing & left hand rests on belt. | Tracking dolly push-in (`lens 35mm -> 44mm`), subtle lateral arc from `3/4` front-right to close `3/4` medium shot, gentle handheld drift throughout. |
| **Beat 2: The Nervous Clerk & Hidden Relic** | **76–150** (`2.5s–5.0s`) | **Courthouse / Assay Counter Interior**: Mahogany counter, red/gold diamond runner rug, sunlit arched window pouring golden `FOG_GLOW` light shaft behind, floating dust motes. | **Clerk** (green translucent visor, round glasses, stubble) + **Sheriff** entering left. Clerk face: `f76–104` anxious glance `o_o` -> `f105–150` panicked `O_O` + clenched grid-teeth + **3 pulsing cyan sweat drops**. Sheriff: stern `-_-"`. | `f76–104`: Clerk rapidly buffs/pushes an ornate **Green & Gold-Studded Bell Relic** on the counter (vigorous 2-arm circular motion + darting head glances left/right + rhythmic bob). `f105–116`: Sheriff strides/leans abruptly over counter (`Ease-Out Back` snap) slamming one hand down and pointing; Clerk flinches violently (`squash-stretch`), yanks bell down and **ducks halfway behind the counter edge** (`Z` drop `-0.35m`). `f117–150`: Clerk trembles continuously (`±0.014m` jitter) peeking above counter while sweat drops slide down and Sheriff taps fingers impatiently on counter. | Hard cut on `f76` to medium 2-shot across counter (`40mm`, `f/2.6`), then smooth creeping push-in (`40mm -> 52mm`) isolating the trembling Clerk and stern Sheriff. |
| **Beat 3: Chiaroscuro Spotlight Interrogation** | **151–225** (`5.0s–7.5s`) | **Dramatic Chiaroscuro Shift**: Room dims to deep warm-black `#0D0A08`; tight diagonal warm `SPOT` (`#FFD88E`) cuts across face + cool indigo rim (`#7DA0FF`) + bright drifting dust motes. | **f151–185**: Tight **Sheriff** (`-_-"` narrowed glare, holding up gleaming gold Sheriff Star / magnifying lens). **f186–225**: Tight **Clerk** (`O_O` wide panic -> pleading `>_<`, mouth wide `O`, flying sweat drops). | `f151–185`: Sheriff leans forward slowly into the spotlight, raises gleaming gold star/badge in a smooth arc toward camera while head tilts `6°` intimidatingly + continuous breathing bob. `f186–225`: Clerk frantically waves **both stick arms** overhead in rapid denial (`~2.5 Hz` alternating wave), shakes head rapidly (`yaw ±16°`), torso squashes/bounces nervously while sweat drops burst outward. | `f151–185`: Low-angle hero push-in on Sheriff (`45mm -> 58mm`) with subtle menacing tilt. `f186–225`: Whip-cut to tight Clerk closeup (`50mm`) with slight anxious handheld tremor (`±0.015m`). |
| **Beat 4: Golden Bloom Reveal & Smug Payoff** | **226–300** (`7.5s–10.0s`) | **Interior Snaps Bright + Golden Bloom**: Warm courthouse lights pop back up; the **Relic Bell** lifts off counter emitting radiant `#FFD466` **Compositor `FOG_GLOW` Bloom** + rising gold sparkles. | **Clerk**: shocked `O_O` sprawled/leaning back. **Sheriff**: bursts from stern into triumphant `@Celyxi` **smug laugh** (`^_^` happy arc eyes + big D-mouth smile). | `f226–245`: Relic Bell wobbles, pops upward spinning `360°` in golden bloom; Clerk recoils backward (`Ease-Out Back` fall/lean + flailing arms) with comic squash-and-stretch bounce. `f246–300`: Sheriff throws both hands on hips/chest and rocks back in a continuous **hearty laugh bounce** (`3.5 Hz` joyful shoulder/head bob + happy eye-squint), Clerk peeks sheepishly blinking (`-_-` -> `o_o`) as the glowing Relic floats & spins smoothly between them through frame 300! | `f226–250`: Dynamic **snap pull-back (`55mm -> 32mm`)** revealing the full counter, glowing Relic, recoiling Clerk, and laughing Sheriff. `f251–300`: Smooth upward celebratory pedestal/tilt + gentle settle drift through `f300` (zero freeze). |

---

## 11. Recommended Module Interface for `@rig-shader` & `@scene-director`

To keep `blender_pipeline/celyxi_rig_shaders.py` clean and fast under **Blender 5.1.2 Cycles** (`samples=8..12`, `use_denoising=False` or `AgX` fast render):
- **Rig Builder**: `create_celyxi_character(name, role="sheriff"|"clerk", location=(0,0,0))` returning a handle dict (`root`, `torso`, `head`, `hat`, `arm_l`, `arm_r`, `leg_l`, `leg_r`, `face_parts`, `sweat_drops`) with clean parent hierarchy and pivot origins at joints (shoulders, hips, neck, hat base).
- **Expression Switcher**: `set_face_expression(char, expr="neutral"|"suspicious"|"shocked"|"panic"|"smug"|"blink", frame=1, blink_duration=3)` keyframing visibility/scale cleanly on `CONSTANT` interpolation.
- **Shader & Outline Helpers**:
  - `make_celyxi_outline_mat(color=(0.007, 0.005, 0.004, 1.0))` + `add_outline(obj, thickness=0.022, mat=...)`
  - `make_celyxi_skin_mat(name, base_rgb, rim_rgb, rim_strength)` (warm cream + soft shadow + crisp Fresnel rim)
  - `make_celyxi_cloth_mat(name, base_rgb, pattern="solid"|"stripes"|"dots", roughness=0.7)`
  - `make_celyxi_gold_mat(name)` & `make_celyxi_emission_mat(name, color, strength)`
- **Compositor Setup**: `setup_celyxi_render_and_compositor(res_x=1080, res_y=1920, fps=30, samples=10)` — note Blender 5.1 Compositor API (`CompositorNodeGlare` with `FOG_GLOW`) should be verified in `@rig-shader`'s 1-frame probe!
- **Motion Helpers**:
  - `apply_continuous_bob(char, frame_start, frame_end, freq_hz=1.4, amp_z=0.025, squash=0.025, tilt_deg=2.5)`
  - `animate_walk_cycle(char, frame_start, frame_end, distance_y, steps=2)`
  - `animate_tremble(char, frame_start, frame_end, amp=0.012)`
  - `animate_ease_out_back(obj, attr, start_val, end_val, f_start, f_end, overshoot=1.70158)`
  - `spawn_dust_motes(count=35, bounds=..., frame_start=1, frame_end=300)`

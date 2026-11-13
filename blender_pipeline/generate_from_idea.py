"""Parameterized Idea-to-3D Blender 5.1.2 generator for @Celyxi-style 10s silent Shorts.

Reads a storyboard JSON (or uses built-in defaults), builds themed 3D environments,
hero/sidekick @Celyxi rigs, relic props, continuous motion, chiaroscuro Beat 3, and
golden bloom Beat 4, and renders frames via Cycles CPU.

CLI:
  blender.exe -b -P blender_pipeline/generate_from_idea.py -- \
    --storyboard out/web_jobs/demo/storyboard.json \
    --out-frames out/web_jobs/demo/frames \
    --res 360x640 --samples 4 --bounces 1 [--bench 160] [--range 1-300]
"""

import json
import math
import os
import random
import sys
import time

import bpy
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from celyxi_rig_shaders import (
    PALETTE,
    add_outline,
    animate_arm_gesture,
    animate_camera_handheld,
    animate_ease_out_back,
    animate_sweat_drops,
    animate_tremble,
    animate_walk_cycle,
    apply_continuous_bob,
    clear_scene,
    create_camera_rig,
    create_celyxi_character,
    hex_to_linear,
    link_character_to_collection,
    link_to_collection,
    make_celyxi_cloth_mat,
    make_celyxi_dirt_mat,
    make_celyxi_emission_mat,
    make_celyxi_gold_mat,
    make_celyxi_outline_mat,
    make_celyxi_wood_mat,
    set_face_expression,
    set_fcurve_interpolation,
    set_world_sky,
    setup_celyxi_render_and_compositor,
    spawn_dust_motes,
)

TOTAL_FRAMES = 300
FPS = 30

THEME_PRESETS = {
    "frontier_town": {
        "floor_mode": "dirt",
        "wall_rgb": hex_to_linear("#B8895A"),
        "counter_a": PALETTE["wood_honey"],
        "counter_b": PALETTE["wood_mahogany"],
        "trim_rgb": PALETTE["crimson"],
        "sky_top": (0.14, 0.28, 0.54),
        "sky_horizon": (0.76, 0.62, 0.46),
        "key_rgb": PALETTE["sun_key"],
        "sign_default": "WANTED",
        "is_night": False,
    },
    "courthouse": {
        "floor_mode": "wood",
        "wall_rgb": hex_to_linear("#D6C7AE"),
        "counter_a": PALETTE["wood_mahogany"],
        "counter_b": (0.04, 0.016, 0.008),
        "trim_rgb": PALETTE["crimson"],
        "sky_top": (0.14, 0.26, 0.48),
        "sky_horizon": (0.78, 0.64, 0.48),
        "key_rgb": PALETTE["sun_key"],
        "sign_default": "ORDER",
        "is_night": False,
    },
    "space_station": {
        "floor_mode": "metal",
        "wall_rgb": hex_to_linear("#263449"),
        "counter_a": hex_to_linear("#354760"),
        "counter_b": hex_to_linear("#16202E"),
        "trim_rgb": hex_to_linear("#22D3EE"),
        "sky_top": (0.015, 0.025, 0.06),
        "sky_horizon": (0.06, 0.14, 0.28),
        "key_rgb": hex_to_linear("#DCEEFF"),
        "sign_default": "ALERT",
        "is_night": True,
    },
    "neon_alley": {
        "floor_mode": "asphalt",
        "wall_rgb": hex_to_linear("#1F1B2C"),
        "counter_a": hex_to_linear("#2A2238"),
        "counter_b": hex_to_linear("#120D1A"),
        "trim_rgb": hex_to_linear("#FF3D8B"),
        "sky_top": (0.03, 0.02, 0.08),
        "sky_horizon": (0.16, 0.06, 0.24),
        "key_rgb": hex_to_linear("#C4D4FF"),
        "sign_default": "NO ENTRY",
        "is_night": True,
    },
    "cozy_studio": {
        "floor_mode": "wood",
        "wall_rgb": hex_to_linear("#E8DAC6"),
        "counter_a": hex_to_linear("#A66F42"),
        "counter_b": hex_to_linear("#5B371C"),
        "trim_rgb": hex_to_linear("#3B8C75"),
        "sky_top": (0.20, 0.36, 0.62),
        "sky_horizon": (0.85, 0.72, 0.56),
        "key_rgb": hex_to_linear("#FFE8C2"),
        "sign_default": "ON AIR",
        "is_night": False,
    },
}

DEFAULT_STORYBOARD = {
    "version": "1.0",
    "title": "The Golden Relic Inspection",
    "idea": "A suspicious hero confronts a nervous sidekick hiding a glowing golden relic",
    "durationSeconds": 10,
    "fps": 30,
    "totalFrames": 300,
    "theme": "courthouse",
    "heroRole": "sheriff",
    "sidekickRole": "clerk",
    "relicType": "golden_bell",
    "style": {
        "outlineThickness": 0.022,
        "rimIntensity": 0.42,
        "bloomStrength": 0.36,
        "chiaroscuroBeat3": True,
        "accentColor": "#E6B333",
        "secondaryColor": "#B32622",
    },
    "beats": [
        {
            "id": 1,
            "name": "The Clue",
            "frameStart": 1,
            "frameEnd": 75,
            "setting": "exterior",
            "heroExpr": "neutral",
            "heroExprLate": "suspicious",
            "sidekickExpr": "neutral",
            "sweatActive": False,
            "chiaroscuro": False,
            "relicBloom": False,
            "signText": "WANTED",
        },
        {
            "id": 2,
            "name": "The Counter Confrontation",
            "frameStart": 76,
            "frameEnd": 150,
            "setting": "interior",
            "heroExpr": "suspicious",
            "heroExprLate": "suspicious",
            "sidekickExpr": "shocked",
            "sidekickExprLate": "panic",
            "sweatActive": True,
            "chiaroscuro": False,
            "relicBloom": False,
        },
        {
            "id": 3,
            "name": "Spotlight Interrogation",
            "frameStart": 151,
            "frameEnd": 225,
            "setting": "interior",
            "heroExpr": "suspicious",
            "sidekickExpr": "panic",
            "sidekickExprLate": "blink",
            "sweatActive": True,
            "chiaroscuro": True,
            "relicBloom": False,
        },
        {
            "id": 4,
            "name": "Golden Bloom Reveal",
            "frameStart": 226,
            "frameEnd": 300,
            "setting": "interior",
            "heroExpr": "smug",
            "sidekickExpr": "shocked",
            "sidekickExprLate": "blink",
            "sweatActive": False,
            "chiaroscuro": False,
            "relicBloom": True,
        },
    ],
}


def merge_storyboard(raw: dict) -> dict:
    sb = json.loads(json.dumps(DEFAULT_STORYBOARD))
    if not raw:
        return sb
    for k in ("version", "title", "idea", "durationSeconds", "fps", "totalFrames", "theme", "heroRole", "sidekickRole", "relicType"):
        if k in raw and raw[k] is not None:
            sb[k] = raw[k]
    if isinstance(raw.get("style"), dict):
        sb["style"].update({k: v for k, v in raw["style"].items() if v is not None})
    if isinstance(raw.get("beats"), list) and len(raw["beats"]) >= 4:
        for i in range(4):
            if isinstance(raw["beats"][i], dict):
                sb["beats"][i].update({k: v for k, v in raw["beats"][i].items() if v is not None})
    return sb


def make_collection(name: str):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def key_hide(obj, start_f: int, end_f: int, total_frames: int = TOTAL_FRAMES):
    for prop in ("hide_render", "hide_viewport"):
        if start_f > 1:
            setattr(obj, prop, True)
            obj.keyframe_insert(data_path=prop, frame=1)
            obj.keyframe_insert(data_path=prop, frame=start_f - 1)
        setattr(obj, prop, False)
        obj.keyframe_insert(data_path=prop, frame=start_f)
        obj.keyframe_insert(data_path=prop, frame=end_f)
        if end_f < total_frames:
            setattr(obj, prop, True)
            obj.keyframe_insert(data_path=prop, frame=end_f + 1)
    set_fcurve_interpolation(obj, "hide_", "CONSTANT")


def hide_collection(col, start_f: int, end_f: int, total_frames: int = TOTAL_FRAMES, skip_objs=None):
    skip_set = set(skip_objs) if skip_objs else set()
    for obj in col.objects:
        if obj in skip_set:
            continue
        key_hide(obj, start_f, end_f, total_frames)


def init_hidden_fx(char: dict):
    for obj in list(char["face_parts"].values()) + list(char["sweat_drops"]):
        obj.hide_render = True
        obj.hide_viewport = True
        obj.keyframe_insert(data_path="hide_render", frame=1)
        obj.keyframe_insert(data_path="hide_viewport", frame=1)
        set_fcurve_interpolation(obj, "hide_", "CONSTANT")


def hide_fx_at(char: dict, frame: int):
    for obj in list(char["face_parts"].values()) + list(char["sweat_drops"]):
        obj.hide_render = True
        obj.hide_viewport = True
        obj.keyframe_insert(data_path="hide_render", frame=frame)
        obj.keyframe_insert(data_path="hide_viewport", frame=frame)
        set_fcurve_interpolation(obj, "hide_", "CONSTANT")


def add_box(col, name, loc, scale, mat, rot_deg=(0, 0, 0), outline_mat=None, outline_thick=0.0):
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=loc,
        rotation=tuple(math.radians(a) for a in rot_deg),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    if outline_thick > 0.0 and outline_mat is not None:
        add_outline(obj, thickness=outline_thick, mat=outline_mat)
    link_to_collection(obj, col)
    return obj


def add_cyl(col, name, loc, radius, depth, mat, rot_deg=(0, 0, 0), verts=20, outline_mat=None, outline_thick=0.0):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=tuple(math.radians(a) for a in rot_deg),
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    if outline_thick > 0.0 and outline_mat is not None:
        add_outline(obj, thickness=outline_thick, mat=outline_mat)
    link_to_collection(obj, col)
    return obj


def make_sign_mat(name: str, sign_text: str, sub_text: str, accent_hex: str):
    w, h = 256, 320
    img = Image.new("RGBA", (w, h), (236, 218, 182, 255))
    draw = ImageDraw.Draw(img)
    ink = (30, 22, 18, 255)
    ah = accent_hex.lstrip("#")
    acc = (int(ah[0:2], 16), int(ah[2:4], 16), int(ah[4:6], 16), 255) if len(ah) == 6 else (172, 34, 28, 255)

    draw.rectangle((10, 10, w - 10, h - 10), outline=ink, width=6)
    draw.rectangle((18, 18, w - 18, 76), fill=acc)
    try:
        font_lg = ImageFont.truetype("arialbd.ttf", 32)
        font_sm = ImageFont.truetype("arialbd.ttf", 20)
    except Exception:
        font_lg = ImageFont.load_default()
        font_sm = ImageFont.load_default()

    label = (sign_text or "WANTED")[:12].upper()
    draw.text((28, 28), label, fill=(255, 248, 232, 255), font=font_lg)
    draw.ellipse((78, 96, 178, 196), fill=(246, 241, 233, 255), outline=ink, width=6)
    draw.ellipse((102, 134, 122, 154), outline=ink, width=4)
    draw.ellipse((134, 134, 154, 154), outline=ink, width=4)
    draw.line((108, 170, 148, 170), fill=ink, width=5)
    draw.text((34, 222), (sub_text or "RELIC SUSPECT")[:18].upper(), fill=ink, font=font_sm)

    img = img.transpose(Image.FLIP_TOP_BOTTOM)
    pixels = (np.asarray(img, dtype=np.float32) / 255.0).ravel()
    b_img = bpy.data.images.new(name, width=w, height=h, alpha=True)
    b_img.pixels.foreach_set(pixels)
    b_img.pack()

    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.78
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = b_img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def add_poster_plane(col, name, loc, width, height, mat, rot_z_deg=0.0):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, height, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = (math.radians(90), 0.0, math.radians(rot_z_deg))
    obj.data.materials.append(mat)
    link_to_collection(obj, col)
    return obj


def build_relic_prop(col, relic_type: str, accent_rgb, outline_mat, outline_thick: float):
    """Build articulated relic prop parented to RelicPivot, returning (pivot, glow_mat)."""
    piv = bpy.data.objects.new("RelicPivot", None)
    bpy.context.collection.objects.link(piv)
    link_to_collection(piv, col)

    gold_mat = make_celyxi_gold_mat("RelicGold", rgb=accent_rgb)
    glow_mat = make_celyxi_emission_mat("RelicGlowMat", accent_rgb, strength=1.2)
    em_mat = make_celyxi_cloth_mat("RelicAccentCloth", PALETTE["emerald"], roughness=0.35)
    prop_out = max(0.008, outline_thick * 0.6)

    if relic_type == "crystal_orb":
        add_cyl(col, "OrbStand", (0, 0, 0.04), 0.14, 0.08, gold_mat, outline_mat=outline_mat, outline_thick=prop_out).parent = piv
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.17, location=(0, 0, 0.24))
        orb = bpy.context.active_object
        orb.name = "RelicOrb"
        orb.data.materials.append(glow_mat)
        add_outline(orb, thickness=prop_out, mat=outline_mat)
        link_to_collection(orb, col)
        orb.parent = piv
    elif relic_type == "crown":
        add_cyl(col, "CrownBase", (0, 0, 0.06), 0.19, 0.11, gold_mat, outline_mat=outline_mat, outline_thick=prop_out).parent = piv
        for i in range(6):
            ang = i * (math.tau / 6.0)
            bpy.ops.mesh.primitive_cone_add(
                vertices=4, radius1=0.055, depth=0.14, location=(math.cos(ang) * 0.15, math.sin(ang) * 0.15, 0.17)
            )
            spk = bpy.context.active_object
            spk.name = f"CrownSpike_{i}"
            spk.data.materials.append(gold_mat)
            add_outline(spk, thickness=prop_out * 0.7, mat=outline_mat)
            link_to_collection(spk, col)
            spk.parent = piv
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.11, location=(0, 0, 0.11))
        gem = bpy.context.active_object
        gem.name = "CrownGem"
        gem.data.materials.append(glow_mat)
        link_to_collection(gem, col)
        gem.parent = piv
    elif relic_type == "briefcase":
        dark_case = make_celyxi_cloth_mat("CaseLeather", (0.04, 0.025, 0.02), roughness=0.4)
        add_box(col, "CaseBottom", (0, 0, 0.08), (0.38, 0.26, 0.12), dark_case, outline_mat=outline_mat, outline_thick=prop_out).parent = piv
        add_box(col, "CaseLid", (0, 0.08, 0.18), (0.38, 0.26, 0.08), dark_case, rot_deg=(-22, 0, 0), outline_mat=outline_mat, outline_thick=prop_out).parent = piv
        add_box(col, "CaseGlowCore", (0, 0, 0.14), (0.30, 0.18, 0.06), glow_mat).parent = piv
    else:
        # golden_bell (default)
        add_cyl(col, "BellRim", (0, 0, 0.05), 0.18, 0.09, gold_mat, outline_mat=outline_mat, outline_thick=prop_out).parent = piv
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.15, location=(0, 0, 0.14))
        dome = bpy.context.active_object
        dome.name = "BellDome"
        dome.scale = (1.0, 1.0, 1.15)
        bpy.ops.object.shade_smooth()
        dome.data.materials.append(em_mat)
        add_outline(dome, thickness=prop_out, mat=outline_mat)
        link_to_collection(dome, col)
        dome.parent = piv
        add_cyl(col, "BellHandle", (0, 0, 0.34), 0.032, 0.12, gold_mat, outline_mat=outline_mat, outline_thick=prop_out * 0.6).parent = piv
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.06, location=(0, 0, 0.41))
        top_gem = bpy.context.active_object
        top_gem.name = "BellTopGlow"
        top_gem.data.materials.append(glow_mat)
        link_to_collection(top_gem, col)
        top_gem.parent = piv

    return piv, glow_mat


def _make_theme_floor_mat(theme_name: str, preset: dict):
    fm = preset["floor_mode"]
    if fm == "dirt":
        return make_celyxi_dirt_mat(f"{theme_name}_Floor")
    if fm == "metal":
        return make_celyxi_cloth_mat(
            f"{theme_name}_Floor", preset["counter_b"], pattern="plaid", accent_rgb=preset["counter_a"], roughness=0.35
        )
    if fm == "asphalt":
        return make_celyxi_cloth_mat(
            f"{theme_name}_Floor", (0.03, 0.03, 0.045), pattern="solid", roughness=0.24, rim_rgb=preset["trim_rgb"], rim_strength=0.25
        )
    return make_celyxi_wood_mat(f"{theme_name}_Floor", color_a=PALETTE["wood_honey"], color_b=PALETTE["wood_mahogany"])


def build_from_storyboard(sb: dict, res_x=360, res_y=640, samples=4, max_bounces=1):
    clear_scene()
    style = sb["style"]
    outline_thick = float(style.get("outlineThickness", 0.022))
    rim_strength = float(style.get("rimIntensity", 0.42))
    bloom_strength = float(style.get("bloomStrength", 0.36))
    chiaroscuro_enabled = bool(style.get("chiaroscuroBeat3", True))
    accent_rgb = hex_to_linear(style.get("accentColor", "#E6B333"))
    secondary_rgb = hex_to_linear(style.get("secondaryColor", "#B32622"))

    theme_name = sb.get("theme", "courthouse")
    preset = THEME_PRESETS.get(theme_name, THEME_PRESETS["courthouse"])
    hero_role = sb.get("heroRole", "sheriff")
    sidekick_role = sb.get("sidekickRole", "clerk")
    relic_type = sb.get("relicType", "golden_bell")
    beats = sb["beats"]

    setup_celyxi_render_and_compositor(
        res_x=res_x,
        res_y=res_y,
        fps=FPS,
        samples=samples,
        exposure=0.20,
        bloom_threshold=1.15,
        bloom_strength=bloom_strength,
        bloom_size=0.55,
        vignette=0.0,
    )
    scene = bpy.context.scene
    scene.cycles.max_bounces = max_bounces
    scene.cycles.diffuse_bounces = 1 if max_bounces >= 2 else 0
    scene.cycles.glossy_bounces = 0
    scene.cycles.transmission_bounces = 1
    scene.cycles.volume_bounces = 0
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.06
    scene.cycles.adaptive_min_samples = 2
    scene.render.use_persistent_data = True
    scene.frame_start = 1
    scene.frame_end = TOTAL_FRAMES

    ng = scene.compositing_node_group
    for node in ng.nodes:
        if node.bl_idname == "CompositorNodeGlare":
            node.inputs["Quality"].default_value = "Low"

    world_bg = set_world_sky(
        top_rgb=preset["sky_top"],
        horizon_rgb=preset["sky_horizon"],
        strength=0.45 if preset["is_night"] else 0.82,
    )
    outline_mat = make_celyxi_outline_mat()
    floor_mat = _make_theme_floor_mat(theme_name, preset)
    wall_mat = make_celyxi_cloth_mat(f"{theme_name}_Wall", preset["wall_rgb"], roughness=0.78)
    counter_mat = make_celyxi_wood_mat(f"{theme_name}_Counter", color_a=preset["counter_a"], color_b=preset["counter_b"])
    trim_mat = make_celyxi_cloth_mat(f"{theme_name}_Trim", preset["trim_rgb"], roughness=0.68)
    neon_mat = make_celyxi_emission_mat(f"{theme_name}_Neon", preset["trim_rgb"], strength=4.5)
    accent_glow_mat = make_celyxi_emission_mat(f"{theme_name}_AccGlow", accent_rgb, strength=4.5)
    win_mat = make_celyxi_emission_mat(
        f"{theme_name}_Win",
        (0.18, 0.72, 1.0) if theme_name == "space_station" else (0.98, 0.86, 0.56),
        strength=2.8,
    )

    cam_rig = create_camera_rig("IdeaCam", loc=(0.75, -3.55, 1.38), rot_deg=(87.0, 0.0, 10.0), lens=35.0, fstop=2.8)
    cam = cam_rig["cam"]

    animate_camera_handheld(cam_rig["rig"], 1, 185, amp_loc=0.010, amp_rot_deg=0.35, seed=19)
    animate_camera_handheld(cam_rig["rig"], 186, 225, amp_loc=0.018, amp_rot_deg=0.55, seed=29)
    animate_camera_handheld(cam_rig["rig"], 226, 300, amp_loc=0.011, amp_rot_deg=0.38, seed=39)

    # -----------------------------------------------------------------------
    # BEAT 1 (f1..75): Entry Zone + Clue Sign
    # -----------------------------------------------------------------------
    b1 = beats[0]
    b1_s, b1_e = int(b1["frameStart"]), int(b1["frameEnd"])
    c1 = make_collection("Beat1_Zone")
    add_box(c1, "B1_Floor", (0, 1.5, -0.05), (14, 18, 0.1), floor_mat)
    add_box(c1, "B1_Walkway", (-0.95, 1.5, 0.04), (2.2, 14, 0.12), counter_mat, outline_mat=outline_mat, outline_thick=0.008)

    # Background themed facades / bulkheads
    for i, by in enumerate((3.5, 6.8, 10.2)):
        for side, bx in ((-2.4, -2.5), (2.2, 2.3)):
            bmat = wall_mat if i % 2 == 0 else counter_mat
            add_box(c1, f"B1_Bg_{i}_{bx}", (bx, by, 2.1), (1.8, 2.2, 4.2), bmat, outline_mat=outline_mat, outline_thick=0.008)
            if preset["is_night"]:
                add_box(c1, f"B1_Neon_{i}_{bx}", (bx - (0.92 if bx > 0 else -0.92), by, 2.4), (0.06, 1.2, 0.14), neon_mat if i % 2 == 0 else accent_glow_mat)

    # Custom sign post on right of walkway
    sign_txt = b1.get("signText") or preset["sign_default"]
    sign_mat = make_sign_mat("B1_SignMat", sign_txt, sb.get("idea", "RELIC HUNT"), style.get("accentColor", "#E6B333"))
    add_box(c1, "B1_Post", (0.58, 0.65, 0.78), (0.10, 0.10, 1.56), counter_mat, outline_mat=outline_mat, outline_thick=0.010)
    add_box(c1, "B1_Board", (0.58, 0.60, 1.48), (0.72, 0.08, 0.88), counter_mat, rot_deg=(0, 0, -8), outline_mat=outline_mat, outline_thick=0.010)
    add_poster_plane(c1, "B1_Poster", (0.57, 0.552, 1.48), 0.60, 0.76, sign_mat, rot_z_deg=-8)

    spawn_dust_motes(c1, count=18, bounds=((-2.0, 2.0), (-1.0, 4.5), (0.4, 2.8)), frame_start=b1_s, frame_end=b1_e, seed=11)

    bpy.ops.object.light_add(type="AREA", location=(-2.4, -2.2, 4.2), rotation=(0.82, 0.1, -0.55))
    k1 = bpy.context.active_object
    k1.data.energy = 380.0
    k1.data.size = 2.6
    k1.data.color = preset["key_rgb"]
    link_to_collection(k1, c1)

    bpy.ops.object.light_add(type="AREA", location=(0.4, 2.6, 2.9), rotation=(-0.9, 0.0, 0.1))
    r1 = bpy.context.active_object
    r1.data.energy = 260.0
    r1.data.size = 2.0
    r1.data.color = accent_rgb if preset["is_night"] else (1.0, 0.92, 0.72)
    link_to_collection(r1, c1)

    hero_b1 = create_celyxi_character(
        "Hero_B1", hero_role, location=(-0.65, 2.0, 0.0), outline_mat=outline_mat,
        outline_thickness=outline_thick, rim_strength=rim_strength, accent_rgb=accent_rgb,
    )
    link_character_to_collection(hero_b1, c1)
    init_hidden_fx(hero_b1)
    hero_b1["root"].rotation_euler = (0, 0, math.radians(-12))

    mid_b1 = (b1_s + b1_e) // 2 + 5
    set_face_expression(hero_b1, b1.get("heroExpr", "neutral"), b1_s)
    set_face_expression(hero_b1, b1.get("heroExprLate", "suspicious"), mid_b1, blink_duration=3)
    animate_walk_cycle(hero_b1, b1_s, mid_b1 - 2, start_loc=(-0.75, 2.15, 0.0), end_loc=(-0.48, 0.30, 0.0), steps=2)
    apply_continuous_bob(hero_b1, mid_b1 - 1, b1_e, freq_hz=1.6, amp_z=0.024, squash=0.028, tilt_deg=2.8, step=2)
    animate_ease_out_back(hero_b1["torso_pivot"], "rotation_euler", (0.04, 0.0, 0.0), (0.14, -0.06, -0.18), mid_b1, mid_b1 + 8)
    animate_arm_gesture(hero_b1, "r", mid_b1, mid_b1 + 10, (12, 10, 0), (-78, -28, 0), (-20, 0, 0), (-12, 0, 0))
    animate_arm_gesture(hero_b1, "l", mid_b1, mid_b1 + 10, (-12, -10, 0), (-15, -24, 15), (-20, 0, 0), (-45, 0, 0))
    hide_fx_at(hero_b1, b1_e + 1)
    skip_b1 = list(hero_b1["face_parts"].values()) + list(hero_b1["sweat_drops"])
    hide_collection(c1, b1_s, b1_e, skip_objs=skip_b1)

    # -----------------------------------------------------------------------
    # BEATS 2, 3, 4 (f76..300): Counter / Console Confrontation Zone
    # -----------------------------------------------------------------------
    b2, b3, b4 = beats[1], beats[2], beats[3]
    c2 = make_collection("Beats234_Zone")
    add_box(c2, "Z2_Floor", (0, 0.6, -0.05), (12, 12, 0.1), floor_mat)
    add_box(c2, "Z2_Runner", (0, -0.6, 0.005), (2.4, 5.2, 0.02), trim_mat, outline_mat=outline_mat, outline_thick=0.006)
    add_box(c2, "Z2_BackWall", (0, 2.9, 2.4), (11, 0.2, 5.2), wall_mat)
    add_box(c2, "Z2_LeftWall", (-3.8, 0.5, 2.4), (0.2, 9.0, 5.2), wall_mat)

    # Arched / glowing viewport window behind counter
    add_box(c2, "Z2_Window", (-0.95, 2.75, 2.15), (1.75, 0.08, 2.10), win_mat, outline_mat=outline_mat, outline_thick=0.010)
    add_box(c2, "Z2_PosterBg", (1.25, 2.76, 2.15), (0.85, 0.06, 1.05), counter_mat, outline_mat=outline_mat, outline_thick=0.010)
    add_poster_plane(c2, "Z2_Poster", (1.25, 2.71, 2.15), 0.72, 0.90, sign_mat)

    # Counter / Console
    add_box(c2, "Z2_Counter", (0.15, 0.50, 0.45), (3.1, 0.75, 0.90), counter_mat, outline_mat=outline_mat, outline_thick=0.014)
    add_box(c2, "Z2_CounterTop", (0.15, 0.50, 0.93), (3.24, 0.88, 0.09), counter_mat, outline_mat=outline_mat, outline_thick=0.014)
    if preset["is_night"]:
        add_box(c2, "Z2_CounterNeon", (0.15, 0.08, 0.87), (2.9, 0.04, 0.06), neon_mat)

    # Relic Prop
    relic_piv, relic_glow_mat = build_relic_prop(c2, relic_type, accent_rgb, outline_mat, outline_thick)
    relic_emit_node = relic_glow_mat.node_tree.nodes["Emission"]
    relic_piv.location = (0.30, 0.36, 0.98)

    spawn_dust_motes(c2, count=22, bounds=((-1.8, 1.8), (-1.2, 2.4), (0.4, 2.8)), frame_start=76, frame_end=300, seed=77)

    # Key, Fill, Rim + Beat 3 Chiaroscuro Spotlight
    bpy.ops.object.light_add(type="AREA", location=(-1.8, -2.4, 3.2), rotation=(0.82, 0.0, -0.45))
    key2 = bpy.context.active_object
    key2.data.size = 2.4
    key2.data.color = preset["key_rgb"]
    link_to_collection(key2, c2)

    bpy.ops.object.light_add(type="AREA", location=(2.2, -1.6, 2.2), rotation=(1.05, 0.0, 0.75))
    fill2 = bpy.context.active_object
    fill2.data.size = 2.6
    fill2.data.color = PALETTE["sky_fill"]
    link_to_collection(fill2, c2)

    bpy.ops.object.light_add(type="AREA", location=(0.0, 2.2, 2.7), rotation=(-0.95, 0.0, 0.0))
    rim2 = bpy.context.active_object
    rim2.data.size = 2.2
    rim2.data.color = (1.0, 0.92, 0.72) if not preset["is_night"] else preset["trim_rgb"]
    link_to_collection(rim2, c2)

    bpy.ops.object.light_add(type="SPOT", location=(-0.9, -1.6, 2.9), rotation=(0.65, 0.0, -0.35))
    spot3 = bpy.context.active_object
    spot3.data.spot_size = math.radians(36)
    spot3.data.spot_blend = 0.45
    spot3.data.color = PALETTE["sun_key"]
    link_to_collection(spot3, c2)

    def _key_lighting(f, k_e, f_e, r_e, s_e, w_e):
        key2.data.energy = k_e
        fill2.data.energy = f_e
        rim2.data.energy = r_e
        spot3.data.energy = s_e
        world_bg.inputs["Strength"].default_value = w_e
        for lt in (key2, fill2, rim2, spot3):
            lt.data.keyframe_insert(data_path="energy", frame=f)
        world_bg.inputs["Strength"].keyframe_insert(data_path="default_value", frame=f)

    base_sky_e = 0.45 if preset["is_night"] else 0.72
    _key_lighting(76, 400.0, 110.0, 250.0, 0.0, base_sky_e)
    _key_lighting(150, 400.0, 110.0, 250.0, 0.0, base_sky_e)
    if chiaroscuro_enabled and b3.get("chiaroscuro", True):
        _key_lighting(151, 8.0, 5.0, 180.0, 460.0, 0.02)
        _key_lighting(185, 8.0, 5.0, 180.0, 460.0, 0.02)
        _key_lighting(186, 8.0, 5.0, 210.0, 460.0, 0.02)
        _key_lighting(225, 8.0, 5.0, 210.0, 460.0, 0.02)
        spot3.location = (-0.42, -1.85, 2.95)
        spot3.rotation_euler = (math.radians(54), 0.0, math.radians(6))
        spot3.keyframe_insert(data_path="location", frame=151)
        spot3.keyframe_insert(data_path="rotation_euler", frame=151)
        spot3.keyframe_insert(data_path="location", frame=185)
        spot3.keyframe_insert(data_path="rotation_euler", frame=185)
        spot3.location = (0.45, -1.55, 2.95)
        spot3.rotation_euler = (math.radians(56), 0.0, math.radians(-5))
        spot3.keyframe_insert(data_path="location", frame=186)
        spot3.keyframe_insert(data_path="rotation_euler", frame=186)
        spot3.keyframe_insert(data_path="location", frame=225)
        spot3.keyframe_insert(data_path="rotation_euler", frame=225)
        set_fcurve_interpolation(spot3, None, "CONSTANT")
    else:
        _key_lighting(151, 360.0, 100.0, 250.0, 0.0, base_sky_e)
        _key_lighting(225, 360.0, 100.0, 250.0, 0.0, base_sky_e)

    _key_lighting(226, 460.0, 140.0, 320.0, 0.0, base_sky_e + 0.15)
    _key_lighting(300, 460.0, 140.0, 320.0, 0.0, base_sky_e + 0.15)
    for lt in (key2, fill2, rim2, spot3):
        set_fcurve_interpolation(lt.data, "energy", "CONSTANT")
    set_fcurve_interpolation(bpy.context.scene.world.node_tree, None, "CONSTANT")

    # Characters for Beats 2-4
    hero = create_celyxi_character(
        "Hero_Main", hero_role, location=(-0.72, -0.35, 0.0), outline_mat=outline_mat,
        outline_thickness=outline_thick, rim_strength=rim_strength, accent_rgb=accent_rgb,
    )
    sidekick = create_celyxi_character(
        "Sidekick_Main", sidekick_role, location=(0.56, 1.15, 0.0), outline_mat=outline_mat,
        outline_thickness=outline_thick, rim_strength=rim_strength, accent_rgb=secondary_rgb,
    )
    link_character_to_collection(hero, c2)
    link_character_to_collection(sidekick, c2)
    init_hidden_fx(hero)
    init_hidden_fx(sidekick)

    hero["root"].rotation_euler = (0, 0, math.radians(-18))
    sidekick["root"].rotation_euler = (0, 0, math.radians(12))

    # Beat 2 (76..150): Sidekick scrubs relic -> Hero slams/leans -> Sidekick ducks & trembles
    set_face_expression(hero, b2.get("heroExpr", "suspicious"), 76)
    set_face_expression(sidekick, b2.get("sidekickExpr", "shocked"), 76)
    set_face_expression(sidekick, b2.get("sidekickExprLate", "panic"), 108, blink_duration=3)
    if b2.get("sweatActive", True):
        animate_sweat_drops(sidekick, 102, 150, active=True)

    for f in range(76, 105, 2):
        t = (f - 76) / 30.0
        sidekick["arm_l"].rotation_euler = (math.radians(-62 + math.sin(t * 14) * 14), math.radians(-18), math.radians(math.cos(t * 14) * 18))
        sidekick["arm_r"].rotation_euler = (math.radians(-62 - math.sin(t * 14) * 14), math.radians(18), math.radians(-math.cos(t * 14) * 18))
        sidekick["arm_l"].keyframe_insert(data_path="rotation_euler", frame=f)
        sidekick["arm_r"].keyframe_insert(data_path="rotation_euler", frame=f)

    animate_walk_cycle(hero, 76, 102, start_loc=(-1.05, -0.55, 0.0), end_loc=(-0.62, -0.24, 0.0), steps=1)
    animate_ease_out_back(hero["torso_pivot"], "rotation_euler", (0, 0, 0), (0.22, 0.06, -0.15), 102, 112)
    animate_arm_gesture(hero, "r", 102, 112, (0, 10, 0), (-82, -18, 0), (0, 0, 0), (-15, 0, 0))
    apply_continuous_bob(hero, 113, 150, freq_hz=1.5, amp_z=0.02, squash=0.022, tilt_deg=2.2, step=2)

    animate_ease_out_back(sidekick["root"], "location", (0.56, 1.15, 0.0), (0.56, 1.18, -0.28), 106, 116)
    animate_tremble(sidekick, 117, 150, amp=0.014, freq_hz=11.5)

    # Beat 3 (151..225): Hero leans into spotlight; Sidekick waves arms in panic
    set_face_expression(hero, b3.get("heroExpr", "suspicious"), 151)
    set_face_expression(sidekick, b3.get("sidekickExpr", "panic"), 151)
    set_face_expression(sidekick, b3.get("sidekickExprLate", "blink"), 195, blink_duration=3)
    if b3.get("sweatActive", True):
        animate_sweat_drops(sidekick, 186, 225, active=True)

    animate_ease_out_back(hero["torso_pivot"], "rotation_euler", (0.12, 0, 0), (0.22, -0.08, -0.06), 151, 165)
    animate_arm_gesture(hero, "r", 151, 168, (-30, 10, 0), (-95, -12, 0), (-20, 0, 0), (-35, 0, 0))
    apply_continuous_bob(hero, 151, 185, freq_hz=1.4, amp_z=0.018, squash=0.02, tilt_deg=2.0, step=2)

    animate_ease_out_back(sidekick["root"], "location", (0.56, 1.18, -0.28), (0.56, 1.15, 0.0), 186, 194)
    for f in range(186, 226, 2):
        t = (f - 186) / 30.0
        sidekick["arm_l"].rotation_euler = (math.radians(-130 + math.sin(t * 16) * 28), math.radians(-22), 0)
        sidekick["arm_r"].rotation_euler = (math.radians(-130 - math.sin(t * 16) * 28), math.radians(22), 0)
        sidekick["head"].rotation_euler = (0, 0, math.radians(math.sin(t * 18) * 14))
        sidekick["arm_l"].keyframe_insert(data_path="rotation_euler", frame=f)
        sidekick["arm_r"].keyframe_insert(data_path="rotation_euler", frame=f)
        sidekick["head"].keyframe_insert(data_path="rotation_euler", frame=f)
    animate_tremble(sidekick, 186, 225, amp=0.015, freq_hz=12.0, seed=17)

    # Beat 4 (226..300): Relic pops & spins in Bloom; Sidekick recoils; Hero smug laugh bounce
    set_face_expression(hero, b4.get("heroExpr", "smug"), 226)
    set_face_expression(sidekick, b4.get("sidekickExpr", "shocked"), 226)
    set_face_expression(sidekick, b4.get("sidekickExprLate", "blink"), 264, blink_duration=3)

    relic_piv.keyframe_insert(data_path="location", frame=225)
    relic_piv.keyframe_insert(data_path="rotation_euler", frame=225)
    animate_ease_out_back(relic_piv, "location", (0.30, 0.36, 0.98), (0.08, 0.36, 1.48), 226, 246)
    for f in range(226, 301, 2):
        u = (f - 226) / 74.0
        relic_piv.rotation_euler = (math.radians(math.sin(u * 6) * 8), 0.0, u * math.tau * 2.0)
        relic_piv.location.z = 1.48 + math.sin(u * math.pi * 4.0) * 0.06
        relic_piv.keyframe_insert(data_path="rotation_euler", frame=f)
        relic_piv.keyframe_insert(data_path="location", frame=f)

    relic_emit_node.inputs["Strength"].default_value = 1.2
    relic_emit_node.inputs["Strength"].keyframe_insert(data_path="default_value", frame=225)
    relic_emit_node.inputs["Strength"].default_value = 9.5 if b4.get("relicBloom", True) else 2.5
    relic_emit_node.inputs["Strength"].keyframe_insert(data_path="default_value", frame=232)
    set_fcurve_interpolation(relic_glow_mat.node_tree, None, "BEZIER")

    animate_ease_out_back(sidekick["root"], "location", (0.56, 1.15, 0.0), (0.72, 1.35, -0.05), 226, 242)
    animate_ease_out_back(sidekick["torso_pivot"], "rotation_euler", (0, 0, 0), (-0.28, 0.08, 0.14), 226, 242)
    apply_continuous_bob(sidekick, 243, 300, freq_hz=1.4, amp_z=0.020, squash=0.022, tilt_deg=2.2, step=2)

    animate_ease_out_back(hero["torso_pivot"], "rotation_euler", (0.15, 0, 0), (-0.12, 0, -0.10), 226, 238)
    animate_arm_gesture(hero, "l", 226, 238, (0, -10, 0), (-25, -42, 0), (0, 0, 0), (-75, 0, 0))
    animate_arm_gesture(hero, "r", 226, 238, (-40, 10, 0), (-25, 42, 0), (-20, 0, 0), (-75, 0, 0))
    apply_continuous_bob(hero, 239, 300, freq_hz=3.2, amp_z=0.036, squash=0.04, tilt_deg=4.0, step=2)

    skip_b234 = (
        list(hero["face_parts"].values())
        + list(hero["sweat_drops"])
        + list(sidekick["face_parts"].values())
        + list(sidekick["sweat_drops"])
    )
    hide_collection(c2, 76, 300, skip_objs=skip_b234)

    # -----------------------------------------------------------------------
    # Camera Choreography across all 4 beats (with CONSTANT hard cuts)
    # -----------------------------------------------------------------------
    def _key_cam(f, loc, rot_deg, lens, fstop, focus_dist):
        cam.location = loc
        cam.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        cam.data.lens = lens
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = focus_dist
        cam.keyframe_insert(data_path="location", frame=f)
        cam.keyframe_insert(data_path="rotation_euler", frame=f)
        cam.data.keyframe_insert(data_path="lens", frame=f)
        cam.data.dof.keyframe_insert(data_path="focus_distance", frame=f)

    _key_cam(1, (0.75, -3.55, 1.38), (87.0, 0.0, 10.0), 35.0, 2.8, 3.8)
    _key_cam(75, (0.15, -2.55, 1.32), (88.5, 0.0, 2.5), 42.0, 2.6, 2.8)
    _key_cam(76, (-0.10, -4.00, 1.48), (85.5, 0.0, 0.5), 31.0, 2.6, 4.2)
    _key_cam(150, (-0.02, -3.40, 1.42), (86.5, 0.0, -0.5), 35.5, 2.5, 3.8)
    _key_cam(151, (-0.68, -2.75, 1.34), (90.0, 0.0, 1.5), 34.0, 2.4, 2.55)
    _key_cam(185, (-0.64, -2.45, 1.38), (89.5, 0.0, 1.5), 38.0, 2.4, 2.25)
    _key_cam(186, (0.48, -2.25, 1.48), (88.0, 0.0, -2.0), 40.0, 2.4, 3.40)
    _key_cam(225, (0.46, -2.00, 1.50), (88.5, 0.0, -2.0), 44.0, 2.4, 3.15)
    _key_cam(226, (0.04, -2.50, 1.42), (88.0, 0.0, 0.0), 46.0, 2.8, 3.0)
    _key_cam(248, (0.02, -3.75, 1.48), (86.0, 0.0, 0.0), 31.0, 3.0, 4.2)
    _key_cam(300, (-0.06, -3.45, 1.62), (84.0, 0.0, -1.0), 33.0, 3.0, 3.9)

    for cut_f in (75, 150, 185, 225):
        cb = cam.animation_data.action.layers[0].strips[0].channelbag(cam.animation_data.action_slot)
        for fc in cb.fcurves:
            for kp in fc.keyframe_points:
                if abs(kp.co[0] - cut_f) < 0.1:
                    kp.interpolation = "CONSTANT"
        cb_d = cam.data.animation_data.action.layers[0].strips[0].channelbag(cam.data.animation_data.action_slot)
        for fc in cb_d.fcurves:
            for kp in fc.keyframe_points:
                if abs(kp.co[0] - cut_f) < 0.1:
                    kp.interpolation = "CONSTANT"

    return scene


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []

    storyboard_path = None
    out_frames = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "out", "celyxi_idea_frames"))
    res_x, res_y = 360, 640
    samples = 4
    max_bounces = 1
    bench_frame = None
    start_f, end_f = 1, TOTAL_FRAMES

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--storyboard" and i + 1 < len(args):
            storyboard_path = args[i + 1]
            i += 2
        elif a == "--out-frames" and i + 1 < len(args):
            out_frames = os.path.abspath(args[i + 1])
            i += 2
        elif a == "--res" and i + 1 < len(args):
            w, h = args[i + 1].split("x")
            res_x, res_y = int(w), int(h)
            i += 2
        elif a == "--samples" and i + 1 < len(args):
            samples = int(args[i + 1])
            i += 2
        elif a == "--bounces" and i + 1 < len(args):
            max_bounces = int(args[i + 1])
            i += 2
        elif a == "--bench" and i + 1 < len(args):
            bench_frame = int(args[i + 1])
            i += 2
        elif a == "--range" and i + 1 < len(args):
            s, e = args[i + 1].split("-")
            start_f, end_f = int(s), int(e)
            i += 2
        else:
            i += 1

    raw_sb = {}
    if storyboard_path and os.path.exists(storyboard_path):
        with open(storyboard_path, "r", encoding="utf-8") as f:
            raw_sb = json.load(f)
    sb = merge_storyboard(raw_sb)

    scene = build_from_storyboard(sb, res_x=res_x, res_y=res_y, samples=samples, max_bounces=max_bounces)
    os.makedirs(out_frames, exist_ok=True)

    if bench_frame is not None:
        t0 = time.perf_counter()
        scene.frame_set(bench_frame)
        out_path = os.path.join(out_frames, f"bench_{bench_frame:04d}.png")
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        dt = time.perf_counter() - t0
        print(f"[BENCH] Frame {bench_frame} ({res_x}x{res_y}, samples={samples}, bounces={max_bounces}) rendered in {dt:.2f}s -> {out_path}")
        return

    scene.frame_start = start_f
    scene.frame_end = end_f
    scene.frame_step = 1
    scene.render.filepath = os.path.join(out_frames, "frame_")
    t0 = time.perf_counter()
    bpy.ops.render.render(animation=True)
    print(f"[DONE] Rendered frames {start_f}..{end_f} in {time.perf_counter() - t0:.1f}s -> {out_frames}")


if __name__ == "__main__":
    main()

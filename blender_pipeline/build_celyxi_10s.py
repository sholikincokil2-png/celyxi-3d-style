"""Build & render a 10-second (300 frames @ 30fps, silent) @Celyxi-style 3D Short in Blender 5.1.2.

Story: "The Sheriff's Golden Relic Inspection" (100% visually readable without audio)
- Beat 1 (f1..75):   Frontier Main Street — Sheriff struts along boardwalk, spots WANTED post, points to Courthouse.
- Beat 2 (f76..150): Courthouse Counter — Nervous Clerk scrubs & hides glowing Gold-Studded Bell Relic behind counter.
- Beat 3 (f151..225):Chiaroscuro Interrogation — Dramatic dark spotlight on Sheriff's badge, then frantic Clerk denial.
- Beat 4 (f226..300):Golden Bloom Payoff — Relic Bell erupts in golden bloom, Clerk recoils, Sheriff bursts out laughing.
"""

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
    link_character_to_collection,
    link_to_collection,
    make_celyxi_cloth_mat,
    make_celyxi_dirt_mat,
    make_celyxi_emission_mat,
    make_celyxi_gold_mat,
    make_celyxi_outline_mat,
    make_celyxi_wood_mat,
    set_fcurve_interpolation,
    set_face_expression,
    set_world_sky,
    setup_celyxi_render_and_compositor,
    spawn_dust_motes,
)

TOTAL_FRAMES = 300
FPS = 30


# ---------------------------------------------------------------------------
# Generic Scene Helpers
# ---------------------------------------------------------------------------

def make_collection(name: str):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def key_hide(obj, start_f: int, end_f: int, total_frames: int = TOTAL_FRAMES):
    """Hide object outside [start_f..end_f] using Blender 5.1 CONSTANT interpolation."""
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


def hide_collection(col, start_f: int, end_f: int, skip_objs=None):
    skip_set = set(skip_objs) if skip_objs else set()
    for obj in col.objects:
        if obj in skip_set:
            continue
        key_hide(obj, start_f, end_f)


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


def init_hidden_fx(char: dict):
    """Initialize all face_parts & sweat_drops hidden at frame 1 so inactive characters never ghost."""
    for obj in list(char["face_parts"].values()) + list(char["sweat_drops"]):
        obj.hide_render = True
        obj.hide_viewport = True
        obj.keyframe_insert(data_path="hide_render", frame=1)
        obj.keyframe_insert(data_path="hide_viewport", frame=1)
        set_fcurve_interpolation(obj, "hide_", "CONSTANT")


def hide_fx_at(char: dict, frame: int):
    """Hide all face_parts & sweat_drops at given frame (when character leaves scene)."""
    for obj in list(char["face_parts"].values()) + list(char["sweat_drops"]):
        obj.hide_render = True
        obj.hide_viewport = True
        obj.keyframe_insert(data_path="hide_render", frame=frame)
        obj.keyframe_insert(data_path="hide_viewport", frame=frame)
        set_fcurve_interpolation(obj, "hide_", "CONSTANT")


def add_poster_plane(col, name, loc, width, height, mat, rot_z_deg=0.0):
    """Create an upright -Y-facing plane with clean 0..1 UVs for WANTED poster."""
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, height, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = (math.radians(90), 0.0, math.radians(rot_z_deg))
    obj.data.materials.append(mat)
    link_to_collection(obj, col)
    return obj


def make_wanted_poster_mat(name="WantedPosterMat"):
    """Draw a crisp stylized WANTED poster texture via Pillow."""
    w, h = 256, 320
    img = Image.new("RGBA", (w, h), (234, 214, 174, 255))
    draw = ImageDraw.Draw(img)
    ink = (36, 24, 18, 255)
    red = (172, 34, 28, 255)

    draw.rectangle((10, 10, w - 10, h - 10), outline=ink, width=6)
    draw.rectangle((18, 18, w - 18, 72), fill=red)
    try:
        font_lg = ImageFont.truetype("arialbd.ttf", 36)
        font_sm = ImageFont.truetype("arialbd.ttf", 22)
    except Exception:
        font_lg = ImageFont.load_default()
        font_sm = ImageFont.load_default()

    draw.text((48, 26), "WANTED", fill=(255, 244, 220, 255), font=font_lg)
    # Stick-figure outlaw silhouette + green visor hint
    draw.ellipse((78, 92, 178, 192), fill=(246, 241, 233, 255), outline=ink, width=6)
    draw.rectangle((72, 104, 184, 126), fill=(31, 138, 76, 255), outline=ink, width=4)
    draw.ellipse((100, 134, 122, 156), outline=ink, width=4)
    draw.ellipse((134, 134, 156, 156), outline=ink, width=4)
    draw.line((110, 170, 146, 170), fill=ink, width=5)
    draw.text((54, 214), "RELIC THIEF", fill=ink, font=font_sm)
    draw.text((64, 252), "$5,000 GOLD", fill=red, font=font_sm)

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


def make_checker_tile_mat(name="CheckerTile", c1=(0.76, 0.78, 0.82), c2=(0.36, 0.42, 0.50)):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.28

    tc = nt.nodes.new("ShaderNodeTexCoord")
    chk = nt.nodes.new("ShaderNodeTexChecker")
    chk.inputs["Scale"].default_value = 1.6
    chk.inputs["Color1"].default_value = (*c1, 1.0)
    chk.inputs["Color2"].default_value = (*c2, 1.0)

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.04

    nt.links.new(tc.outputs["Object"], chk.inputs["Vector"])
    nt.links.new(chk.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_plaster_mat(name="PlasterWall", rgb=(0.74, 0.67, 0.56)):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.85

    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 5.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = (rgb[0] * 0.82, rgb[1] * 0.82, rgb[2] * 0.82, 1.0)
    ramp.color_ramp.elements[1].position = 0.80
    ramp.color_ramp.elements[1].color = (*rgb, 1.0)

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08

    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_relic_bell(col, name, loc, outline_mat):
    """Build the ornate Green & Gold-Studded Relic Bell (matching @Celyxi ref) with glowing core."""
    piv = bpy.data.objects.new(name, None)
    piv.location = loc
    bpy.context.collection.objects.link(piv)
    link_to_collection(piv, col)

    emerald_mat = make_celyxi_cloth_mat(
        f"{name}_Shell", PALETTE["emerald"], pattern="dots", accent_rgb=PALETTE["gold"], roughness=0.38
    )
    gold_mat = make_celyxi_gold_mat(f"{name}_Gold")
    glow_mat = make_celyxi_emission_mat(f"{name}_GlowCore", PALETTE["relic_glow"], strength=3.8)

    # Bell body dome
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.20, location=(0, 0, 0.14))
    dome = bpy.context.active_object
    dome.name = f"{name}_Dome"
    dome.scale = (1.0, 1.0, 1.25)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    dome.data.materials.append(emerald_mat)
    add_outline(dome, thickness=0.014, mat=outline_mat)
    link_to_collection(dome, col)
    dome.parent = piv

    # Flared gold base ring
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.235, depth=0.06, location=(0, 0, 0.03))
    ring = bpy.context.active_object
    ring.name = f"{name}_Ring"
    bpy.ops.object.shade_smooth()
    ring.data.materials.append(gold_mat)
    add_outline(ring, thickness=0.012, mat=outline_mat)
    link_to_collection(ring, col)
    ring.parent = piv

    # Top gold finial knob
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.055, location=(0, 0, 0.40))
    knob = bpy.context.active_object
    knob.name = f"{name}_Knob"
    bpy.ops.object.shade_smooth()
    knob.data.materials.append(gold_mat)
    add_outline(knob, thickness=0.010, mat=outline_mat)
    link_to_collection(knob, col)
    knob.parent = piv

    # Glowing inner aura sphere (hidden/small until reveal beat!)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=0.16, location=(0, 0, 0.16))
    core = bpy.context.active_object
    core.name = f"{name}_Glow"
    bpy.ops.object.shade_smooth()
    core.visible_shadow = False
    core.data.materials.append(glow_mat)
    link_to_collection(core, col)
    core.parent = piv

    return {"pivot": piv, "dome": dome, "ring": ring, "knob": knob, "glow": core}


def build_sheriff_badge_prop(col, name, outline_mat):
    """Oversized gleaming gold Sheriff Star prop for close-up interrogation."""
    import bmesh

    gold_mat = make_celyxi_gold_mat(f"{name}_Mat")
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    bm = bmesh.new()
    pts_f, pts_b = [], []
    for i in range(12):
        ang = i * (math.pi / 6.0)
        r = 0.13 if i % 2 == 0 else 0.065
        pts_f.append(bm.verts.new((math.cos(ang) * r, -0.018, math.sin(ang) * r)))
        pts_b.append(bm.verts.new((math.cos(ang) * r, 0.018, math.sin(ang) * r)))
    bm.faces.new(pts_f)
    bm.faces.new(list(reversed(pts_b)))
    for i in range(12):
        n = (i + 1) % 12
        bm.faces.new((pts_f[i], pts_b[i], pts_b[n], pts_f[n]))
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(gold_mat)
    add_outline(obj, thickness=0.011, mat=outline_mat)
    link_to_collection(obj, col)
    return obj


# ---------------------------------------------------------------------------
# Beat 1: Frontier Main Street Set & Animation (Frames 1..75)
# ---------------------------------------------------------------------------

def build_beat1_street(outline_mat, wanted_mat, cam):
    col = make_collection("Beat1_Street")

    dirt_mat = make_celyxi_dirt_mat("StreetDirt")
    boardwalk_mat = make_celyxi_wood_mat("BoardwalkWood", PALETTE["wood_sand"], PALETTE["wood_honey"], scale=2.6)
    saloon_wood = make_celyxi_wood_mat("SaloonWood", PALETTE["wood_honey"], PALETTE["wood_mahogany"], scale=2.2)
    red_wood = make_celyxi_wood_mat("RedFacade", (0.48, 0.12, 0.10), (0.24, 0.06, 0.05), scale=2.0)
    cream_facade = make_plaster_mat("CreamFacade", (0.86, 0.78, 0.64))
    win_glow = make_celyxi_emission_mat("SaloonWinGlow", (1.0, 0.78, 0.36), strength=2.6)
    cloud_mat = make_celyxi_cloth_mat("CloudMat", (0.98, 0.95, 0.90), roughness=0.9, rim_strength=0.1)
    gold_mat = make_celyxi_gold_mat("StreetGold")

    # Ground Dirt Road
    bpy.ops.mesh.primitive_plane_add(size=42.0, location=(0, 8.0, 0.0))
    road = bpy.context.active_object
    road.name = "StreetRoad"
    road.data.materials.append(dirt_mat)
    link_to_collection(road, col)

    # Raised Wooden Boardwalks (left & right)
    add_box(col, "Boardwalk_L", (-2.6, 5.0, 0.08), (1.8, 22.0, 0.18), boardwalk_mat, outline_mat=outline_mat, outline_thick=0.010)
    add_box(col, "Boardwalk_R", (2.8, 5.0, 0.08), (1.8, 22.0, 0.18), boardwalk_mat, outline_mat=outline_mat, outline_thick=0.010)
    # Foreground boardwalk landing where Sheriff struts
    add_box(col, "HeroBoardwalk", (0.0, -0.5, 0.05), (4.8, 5.2, 0.10), boardwalk_mat)

    # Background False-Front Frontier Buildings (softened by DOF)
    bldg_specs = [
        ("Saloon_L1", (-4.4, 3.5, 2.2), (2.4, 3.8, 4.4), saloon_wood),
        ("Store_L2", (-4.6, 8.5, 2.6), (2.4, 4.0, 5.2), red_wood),
        ("Bank_L3", (-4.4, 13.8, 2.1), (2.2, 3.6, 4.2), cream_facade),
        ("Courthouse_R1", (4.5, 4.2, 2.5), (2.5, 4.2, 5.0), cream_facade),
        ("Assay_R2", (4.5, 9.2, 2.2), (2.4, 3.8, 4.4), saloon_wood),
        ("Church_End", (0.2, 19.5, 3.4), (3.4, 2.6, 6.8), cream_facade),
    ]
    for bname, bloc, bscale, bmat in bldg_specs:
        add_box(col, bname, bloc, bscale, bmat, outline_mat=outline_mat, outline_thick=0.010)
        # Parapet roof cap
        add_box(col, f"{bname}_Roof", (bloc[0], bloc[1], bloc[2] * 2 + 0.18), (bscale[0] + 0.25, bscale[1] + 0.2, 0.32), saloon_wood)

    # Glowing Saloon & Courthouse windows
    for wx, wy, wz in ((-3.18, 3.5, 2.0), (-3.18, 8.5, 2.2), (3.22, 4.2, 2.2), (3.22, 9.2, 2.0)):
        add_box(col, f"Win_{wy:.1f}", (wx, wy, wz), (0.08, 1.1, 1.3), win_glow)

    # Foreground Barrel + Crate + Hitching Post on left
    add_cyl(col, "FgBarrel", (-1.35, -0.8, 0.48), 0.34, 0.78, saloon_wood, verts=16, outline_mat=outline_mat, outline_thick=0.014)
    add_box(col, "FgCrate", (-1.55, -0.05, 0.34), (0.56, 0.56, 0.56), boardwalk_mat, rot_deg=(0, 0, 14), outline_mat=outline_mat, outline_thick=0.014)

    # WANTED Wooden Signpost on right side of boardwalk (Sheriff stops & looks at it!)
    add_cyl(col, "WantedPost", (1.05, 0.35, 0.95), 0.06, 1.85, saloon_wood, verts=10, outline_mat=outline_mat, outline_thick=0.012)
    add_box(col, "WantedBoard", (1.05, 0.28, 1.48), (0.72, 0.08, 0.90), boardwalk_mat, rot_deg=(0, 0, -18), outline_mat=outline_mat, outline_thick=0.014)
    add_poster_plane(col, "WantedPoster", (1.03, 0.225, 1.48), 0.58, 0.74, wanted_mat, rot_z_deg=-18)

    # Overhead Swaying Fabric Pennants strung across street
    pennant_cols = [PALETTE["crimson"], PALETTE["gold"], PALETTE["sky_fill"], PALETTE["emerald"]]
    pennant_mats = [make_celyxi_cloth_mat(f"Pennant_{i}", c) for i, c in enumerate(pennant_cols)]
    pennant_piv = bpy.data.objects.new("PennantString", None)
    pennant_piv.location = (0, 3.6, 3.9)
    bpy.context.collection.objects.link(pennant_piv)
    link_to_collection(pennant_piv, col)
    for pi in range(9):
        px = -2.8 + pi * 0.7
        sag = -0.32 * (1.0 - ((px / 2.8) ** 2))
        bpy.ops.mesh.primitive_cone_add(
            vertices=3, radius1=0.18, depth=0.38, location=(px, 0, sag - 0.18), rotation=(math.pi, 0, 0)
        )
        pen = bpy.context.active_object
        pen.name = f"Pennant_{pi}"
        pen.scale = (1.0, 0.15, 1.0)
        pen.data.materials.append(pennant_mats[pi % len(pennant_mats)])
        add_outline(pen, thickness=0.008, mat=outline_mat)
        link_to_collection(pen, col)
        pen.parent = pennant_piv
    for f in range(1, 76, 5):
        pennant_piv.rotation_euler = (math.radians(6.0 * math.sin(f * 0.16)), 0, 0)
        pennant_piv.keyframe_insert(data_path="rotation_euler", frame=f)

    # Stylized 3D Clouds in sky
    for ci, cloc in enumerate(((-2.5, 22.0, 7.6), (2.8, 24.0, 8.2), (0.0, 26.0, 9.0))):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1.1, location=cloc)
        cl = bpy.context.active_object
        cl.name = f"Cloud_{ci}"
        cl.scale = (1.8, 0.7, 0.7)
        bpy.ops.object.shade_smooth()
        cl.data.materials.append(cloud_mat)
        link_to_collection(cl, col)

    # Street Lighting (Warm Front-Left Sun Key + Bright Cool Front-Right Fill + Golden Rim Kicker)
    bpy.ops.object.light_add(type="AREA", location=(-1.6, -4.4, 3.6), rotation=(math.radians(60), 0, math.radians(-18)))
    key_l = bpy.context.active_object
    key_l.name = "Street_KeyLight"
    key_l.data.energy = 420.0
    key_l.data.size = 4.2
    key_l.data.color = PALETTE["sun_key"]
    link_to_collection(key_l, col)

    bpy.ops.object.light_add(type="AREA", location=(2.2, -3.8, 2.5), rotation=(math.radians(72), 0, math.radians(28)))
    fill_l = bpy.context.active_object
    fill_l.name = "Street_FillLight"
    fill_l.data.energy = 240.0
    fill_l.data.size = 4.5
    fill_l.data.color = (0.76, 0.84, 0.98)
    link_to_collection(fill_l, col)

    bpy.ops.object.light_add(type="AREA", location=(0.6, 2.8, 3.2), rotation=(math.radians(125), 0, 0))
    rim_l = bpy.context.active_object
    rim_l.name = "Street_RimLight"
    rim_l.data.energy = 260.0
    rim_l.data.size = 2.4
    rim_l.data.color = (1.0, 0.92, 0.72)
    link_to_collection(rim_l, col)

    spawn_dust_motes(col, count=24, bounds=((-1.8, 1.8), (-2.0, 3.0), (0.6, 2.9)), frame_start=1, frame_end=75, seed=11)

    # Sheriff Character (Beat 1)
    sheriff = create_celyxi_character("Sheriff_B1", role="sheriff", location=(-0.35, 1.35, 0.10), outline_mat=outline_mat)
    link_character_to_collection(sheriff, col)
    init_hidden_fx(sheriff)
    set_face_expression(sheriff, "neutral", frame=1)
    set_face_expression(sheriff, "neutral", frame=26, blink_duration=3)
    set_face_expression(sheriff, "suspicious", frame=43)
    hide_fx_at(sheriff, 76)

    # f1..42: Swagger walk forward toward WANTED post & camera
    animate_walk_cycle(
        sheriff,
        frame_start=1,
        frame_end=42,
        start_loc=(-0.45, 1.45, 0.10),
        end_loc=(-0.22, -0.05, 0.10),
        steps=2,
        swagger_deg=5.0,
    )
    # Fix arm abduction outside coat during walk cycle
    for f in range(1, 43):
        al_x = sheriff["arm_l"].rotation_euler[0]
        ar_x = sheriff["arm_r"].rotation_euler[0]
        sheriff["arm_l"].rotation_euler = (al_x, math.radians(18.0), 0)
        sheriff["arm_r"].rotation_euler = (ar_x, math.radians(-18.0), 0)
        sheriff["arm_l"].keyframe_insert(data_path="rotation_euler", frame=f)
        sheriff["arm_r"].keyframe_insert(data_path="rotation_euler", frame=f)

    # f43..75: Snappy stop, turn slightly toward WANTED sign, raise right stick arm pointing!
    animate_ease_out_back(sheriff["root"], "rotation_euler", (0, 0, 0), (0, 0, -14), 43, 53, is_deg_euler=True)
    # Continuous breathing bob from f43..75
    sheriff["torso_pivot"].location = (0, 0, 0.54)
    sheriff["torso_pivot"].rotation_euler = (0, 0, 0)
    sheriff["head"].rotation_euler = (0, 0, 0)
    apply_continuous_bob(sheriff, 43, 75, freq_hz=1.6, amp_z=0.024, squash=0.028, tilt_deg=3.0)

    # Left hand rests firmly on belt; right arm points decisively down-street toward Courthouse
    animate_arm_gesture(
        sheriff, "l", 43, 52,
        shoulder_start_deg=(0, 18, 0), shoulder_end_deg=(-12, 24, 0),
        elbow_start_deg=(-22, 0, 0), elbow_end_deg=(-68, -28, 0),
    )
    animate_arm_gesture(
        sheriff, "r", 43, 54,
        shoulder_start_deg=(0, -18, 0), shoulder_end_deg=(-72, -32, 0),
        elbow_start_deg=(-22, 0, 0), elbow_end_deg=(-12, 0, 0),
    )
    # Subtle animated pointing follow-through f55..75
    for f in range(55, 76, 3):
        bob = math.sin((f - 55) * 0.35) * 4.5
        sheriff["arm_r"].rotation_euler = (math.radians(-72 + bob), math.radians(-32), 0)
        sheriff["arm_r"].keyframe_insert(data_path="rotation_euler", frame=f)
        sheriff["head"].rotation_euler = (math.radians(-3 + bob * 0.5), 0, math.radians(-10))
        sheriff["head"].keyframe_insert(data_path="rotation_euler", frame=f)

    # Hide Beat 1 collection outside f1..75 (keep face_parts/sweat_drops untouched!)
    b1_skip = list(sheriff["face_parts"].values()) + list(sheriff["sweat_drops"])
    hide_collection(col, 1, 75, skip_objs=b1_skip)

    # Camera Choreography Beat 1 (f1..75): 33mm -> 37mm tracking arc push-in keeping Sheriff + WANTED sign framed
    cam.location = (0.55, -3.95, 1.38)
    cam.rotation_euler = (math.radians(87.0), 0.0, math.radians(6.0))
    cam.data.lens = 33.0
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.focus_distance = 4.3
    for dp in ("location", "rotation_euler"):
        cam.keyframe_insert(data_path=dp, frame=1)
    cam.data.keyframe_insert(data_path="lens", frame=1)
    cam.data.dof.keyframe_insert(data_path="focus_distance", frame=1)

    cam.location = (0.20, -3.50, 1.36)
    cam.rotation_euler = (math.radians(88.2), 0.0, math.radians(1.0))
    cam.data.lens = 36.5
    cam.data.dof.focus_distance = 3.55
    for dp in ("location", "rotation_euler"):
        cam.keyframe_insert(data_path=dp, frame=75)
    cam.data.keyframe_insert(data_path="lens", frame=75)
    cam.data.dof.keyframe_insert(data_path="focus_distance", frame=75)
    set_fcurve_interpolation(cam, None, "BEZIER")


# ---------------------------------------------------------------------------
# Beats 2, 3, 4: Courthouse Interior + Chiaroscuro + Golden Reveal (Frames 76..300)
# ---------------------------------------------------------------------------

def build_beats_2_3_4_courthouse(outline_mat, wanted_mat, cam, world_bg):
    col_env = make_collection("Beats234_CourthouseEnv")
    col_ch24 = make_collection("Beats24_Characters")
    col_ch3 = make_collection("Beat3_Interrogation")

    tile_mat = make_checker_tile_mat("CourthouseTiles")
    carpet_mat = make_celyxi_cloth_mat("CarpetRunner", PALETTE["crimson"], pattern="solid", roughness=0.82)
    gold_mat = make_celyxi_gold_mat("CourthouseGold")
    mahogany_mat = make_celyxi_wood_mat("MahoganyCounter", PALETTE["wood_mahogany"], (0.06, 0.025, 0.012), scale=2.0, roughness=0.45)
    plaster_mat = make_plaster_mat("CourthousePlaster", (0.64, 0.62, 0.66))
    timber_mat = make_celyxi_wood_mat("TimberTrim", PALETTE["wood_honey"], PALETTE["wood_mahogany"], scale=2.4)
    sun_win_mat = make_celyxi_emission_mat("ArchedWinGlow", (1.0, 0.88, 0.60), strength=4.2)
    parchment_mat = make_celyxi_cloth_mat("Parchment", (0.94, 0.88, 0.72), roughness=0.85)

    # Floor & Red/Gold Diamond Carpet Runner
    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0, 1.5, 0.0))
    fl = bpy.context.active_object
    fl.name = "CourthouseFloor"
    fl.data.materials.append(tile_mat)
    link_to_collection(fl, col_env)

    add_box(col_env, "Carpet", (0.0, 0.2, 0.012), (1.7, 7.5, 0.02), carpet_mat)
    add_box(col_env, "CarpetTrimL", (-0.82, 0.2, 0.016), (0.08, 7.5, 0.02), gold_mat)
    add_box(col_env, "CarpetTrimR", (0.82, 0.2, 0.016), (0.08, 7.5, 0.02), gold_mat)

    # Plaster & Timber Walls
    add_box(col_env, "BackWall", (0.0, 3.8, 2.8), (11.0, 0.25, 5.8), plaster_mat)
    add_box(col_env, "LeftWall", (-3.8, 0.5, 2.8), (0.25, 9.0, 5.8), plaster_mat)
    add_box(col_env, "RightWall", (3.8, 0.5, 2.8), (0.25, 9.0, 5.8), plaster_mat)
    add_box(col_env, "WainscotBack", (0.0, 3.65, 0.65), (10.8, 0.08, 1.3), timber_mat)
    add_box(col_env, "BeamTop", (0.0, 3.62, 3.7), (10.8, 0.16, 0.24), timber_mat)

    # Tall Sunlit Arched Window on Back Wall (blooms nicely with FOG_GLOW)
    add_box(col_env, "ArchedWinFrame", (-1.15, 3.64, 2.35), (1.35, 0.10, 2.25), timber_mat, outline_mat=outline_mat, outline_thick=0.010)
    add_box(col_env, "ArchedWinGlass", (-1.15, 3.60, 2.35), (1.12, 0.04, 2.02), sun_win_mat)
    add_box(col_env, "WinMullionV", (-1.15, 3.56, 2.35), (0.07, 0.06, 2.02), timber_mat)
    add_box(col_env, "WinMullionH", (-1.15, 3.56, 2.35), (1.12, 0.06, 0.07), timber_mat)

    # Framed WANTED Poster on back-right wall
    add_box(col_env, "WallPosterFrame", (1.25, 3.64, 2.25), (0.85, 0.06, 1.05), timber_mat, outline_mat=outline_mat, outline_thick=0.010)
    add_poster_plane(col_env, "WallPosterArt", (1.25, 3.59, 2.25), 0.72, 0.92, wanted_mat, rot_z_deg=0)

    # Heavy Mahogany Counter (placed at y = 0.65, top height z = 0.98m)
    add_box(col_env, "CounterBody", (0.15, 0.65, 0.46), (3.4, 0.85, 0.92), mahogany_mat, outline_mat=outline_mat, outline_thick=0.014)
    add_box(col_env, "CounterTop", (0.15, 0.65, 0.96), (3.58, 1.00, 0.08), timber_mat, outline_mat=outline_mat, outline_thick=0.014)
    # Brass drawer knobs on front of counter
    for kx in (-0.95, -0.25, 0.45, 1.15):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.035, location=(kx, 0.21, 0.66))
        knob = bpy.context.active_object
        knob.name = f"CounterKnob_{kx:.2f}"
        knob.data.materials.append(gold_mat)
        link_to_collection(knob, col_env)

    # Small Counter Props (Parchment scroll + Inkwell)
    add_box(col_env, "CounterPaper", (-0.65, 0.58, 1.01), (0.42, 0.32, 0.015), parchment_mat, rot_deg=(0, 0, 8))
    add_cyl(col_env, "Inkwell", (-0.98, 0.52, 1.05), 0.055, 0.10, mahogany_mat, verts=12, outline_mat=outline_mat, outline_thick=0.008)

    # Hero Relic Bell on counter (shared across Beats 2 & 4; hidden during Beat 3 closeups)
    relic = build_relic_bell(col_env, "RelicBell", (0.35, 0.55, 1.00), outline_mat)
    # Hide glowing aura sphere until Beat 4 reveal (f226)
    relic["glow"].scale = (0.2, 0.2, 0.2)
    relic["glow"].keyframe_insert(data_path="scale", frame=1)
    relic["glow"].keyframe_insert(data_path="scale", frame=225)
    relic["glow"].hide_render = True
    relic["glow"].hide_viewport = True
    relic["glow"].keyframe_insert(data_path="hide_render", frame=1)
    relic["glow"].keyframe_insert(data_path="hide_viewport", frame=1)
    set_fcurve_interpolation(relic["glow"], "hide_", "CONSTANT")

    # Lighting for Beats 2, 3, 4 (Keyframed for seamless Chiaroscuro Shift in Beat 3!)
    bpy.ops.object.light_add(type="AREA", location=(-1.4, -3.5, 3.3), rotation=(math.radians(58), 0, math.radians(-16)))
    ch_key = bpy.context.active_object
    ch_key.name = "Courthouse_Key"
    ch_key.data.size = 3.8
    ch_key.data.color = PALETTE["sun_key"]
    link_to_collection(ch_key, col_env)

    bpy.ops.object.light_add(type="AREA", location=(2.0, -3.2, 2.5), rotation=(math.radians(70), 0, math.radians(24)))
    ch_fill = bpy.context.active_object
    ch_fill.name = "Courthouse_Fill"
    ch_fill.data.size = 4.2
    ch_fill.data.color = (0.76, 0.85, 0.98)
    link_to_collection(ch_fill, col_env)

    bpy.ops.object.light_add(type="AREA", location=(-0.5, 2.8, 3.0), rotation=(math.radians(122), 0, 0))
    ch_rim = bpy.context.active_object
    ch_rim.name = "Courthouse_Rim"
    ch_rim.data.size = 2.2
    ch_rim.data.color = (1.0, 0.92, 0.72)
    link_to_collection(ch_rim, col_env)

    # Chiaroscuro Spotlights for Beat 3 (steeply angled onto speaker so back wall stays dark)
    bpy.ops.object.light_add(type="SPOT", location=(-0.75, -1.75, 2.75), rotation=(math.radians(46), 0, math.radians(-16)))
    spot_hero = bpy.context.active_object
    spot_hero.name = "Chiaroscuro_Spot"
    spot_hero.data.spot_size = math.radians(42)
    spot_hero.data.spot_blend = 0.45
    spot_hero.data.color = (1.0, 0.85, 0.58)
    link_to_collection(spot_hero, col_env)

    bpy.ops.object.light_add(type="AREA", location=(1.1, 1.2, 2.3), rotation=(math.radians(108), 0, math.radians(24)))
    spot_rim = bpy.context.active_object
    spot_rim.name = "Chiaroscuro_IndigoRim"
    spot_rim.data.size = 1.6
    spot_rim.data.color = (0.48, 0.62, 1.0)
    link_to_collection(spot_rim, col_env)

    # Golden Reveal Point Light at Relic during Beat 4
    bpy.ops.object.light_add(type="POINT", location=(0.05, 0.35, 1.55))
    relic_pt = bpy.context.active_object
    relic_pt.name = "Relic_GoldenLight"
    relic_pt.data.color = PALETTE["relic_glow"]
    link_to_collection(relic_pt, col_env)

    # Keyframe lighting states across Beats 1 -> 2 -> 3 -> 4
    def _set_lights(f, key_e, fill_e, rim_e, spot_e, indigo_e, relic_e, bg_strength, win_strength):
        vals = (
            (ch_key, key_e),
            (ch_fill, fill_e),
            (ch_rim, rim_e),
            (spot_hero, spot_e),
            (spot_rim, indigo_e),
            (relic_pt, relic_e),
        )
        for lobj, en in vals:
            lobj.data.energy = en
            lobj.data.keyframe_insert(data_path="energy", frame=f)
            set_fcurve_interpolation(lobj.data, "energy", "CONSTANT")
            lobj.hide_render = en <= 0.1
            lobj.keyframe_insert(data_path="hide_render", frame=f)
            set_fcurve_interpolation(lobj, "hide_render", "CONSTANT")
        world_bg.inputs["Strength"].default_value = bg_strength
        sun_win_mat.node_tree.nodes["Emission"].inputs["Strength"].default_value = win_strength
        world_bg.inputs["Strength"].keyframe_insert(data_path="default_value", frame=f)
        sun_win_mat.node_tree.nodes["Emission"].inputs["Strength"].keyframe_insert(data_path="default_value", frame=f)

    # Beat 1 (Street): bright sky
    _set_lights(1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.85, 0.0)
    # Beat 2 (Courthouse bright): warm interior
    _set_lights(76, 360.0, 210.0, 210.0, 0.0, 0.0, 0.0, 0.58, 3.2)
    # Beat 3A (Chiaroscuro Sheriff): deep dark room + tight spotlight
    _set_lights(151, 0.0, 0.0, 0.0, 480.0, 150.0, 0.0, 0.01, 0.0)
    # Beat 3B (Chiaroscuro Clerk): spotlight aimed directly at Clerk face (0.20, 0.25, 1.50)
    spot_hero.location = (-0.75, -1.75, 2.75)
    spot_hero.rotation_euler = (math.radians(48), 0, math.radians(-18))
    spot_hero.keyframe_insert(data_path="location", frame=151)
    spot_hero.keyframe_insert(data_path="rotation_euler", frame=151)
    spot_hero.location = (-0.42, -1.75, 2.05)
    spot_hero.rotation_euler = (math.radians(74), 0, math.radians(-19))
    spot_hero.keyframe_insert(data_path="location", frame=186)
    spot_hero.keyframe_insert(data_path="rotation_euler", frame=186)
    set_fcurve_interpolation(spot_hero, None, "CONSTANT")
    _set_lights(186, 0.0, 0.0, 0.0, 520.0, 95.0, 0.0, 0.01, 0.0)
    # Beat 4 (Golden Bloom Reveal): room snaps bright + balanced golden relic glow
    _set_lights(226, 340.0, 200.0, 220.0, 0.0, 0.0, 95.0, 0.62, 3.0)

    spawn_dust_motes(col_env, count=24, bounds=((-1.8, 1.8), (-1.2, 2.8), (0.6, 2.9)), frame_start=76, frame_end=300, seed=77)
    skip_env = [relic["glow"], ch_key, ch_fill, ch_rim, spot_hero, spot_rim, relic_pt]
    hide_collection(col_env, 76, 300, skip_objs=skip_env)

    # -----------------------------------------------------------------------
    # Characters for Beats 2 & 4 (`Sheriff_CH`, `Clerk_CH`)
    # -----------------------------------------------------------------------
    sheriff = create_celyxi_character("Sheriff_CH", role="sheriff", location=(-1.45, 0.15, 0.0), outline_mat=outline_mat)
    clerk = create_celyxi_character("Clerk_CH", role="clerk", location=(0.45, 1.38, 0.0), outline_mat=outline_mat)
    # Tilt Clerk's green translucent visor gently forward over glasses without dark outline bloat
    clerk["hat_pivot"].location = (0, -0.05, 0.51)
    clerk["hat_pivot"].rotation_euler = (math.radians(6), math.radians(-3), 0)
    if "CelyxiOutline" in clerk["hat"].modifiers:
        clerk["hat"].modifiers["CelyxiOutline"].thickness = 0.004

    link_character_to_collection(sheriff, col_ch24)
    link_character_to_collection(clerk, col_ch24)
    init_hidden_fx(sheriff)
    init_hidden_fx(clerk)

    # ---- BEAT 2 (f76..150): Clerk scrubs Relic -> Sheriff confronts -> Clerk ducks & trembles ----
    set_face_expression(sheriff, "neutral", frame=76)
    set_face_expression(sheriff, "suspicious", frame=105)
    set_face_expression(sheriff, "suspicious", frame=132, blink_duration=3)
    hide_fx_at(sheriff, 151)

    set_face_expression(clerk, "neutral", frame=76)
    set_face_expression(clerk, "shocked", frame=105)
    set_face_expression(clerk, "panic", frame=115)
    set_face_expression(clerk, "panic", frame=138, blink_duration=3)
    hide_fx_at(clerk, 151)

    # f76..104: Sheriff walks into counter left (kept well inside 9:16 frame!)
    animate_walk_cycle(
        sheriff, 76, 104,
        start_loc=(-1.30, 0.35, 0.0),
        end_loc=(-0.44, 0.08, 0.0),
        steps=1, swagger_deg=4.0,
    )
    for f in range(76, 105):
        al_x = sheriff["arm_l"].rotation_euler[0]
        ar_x = sheriff["arm_r"].rotation_euler[0]
        sheriff["arm_l"].rotation_euler = (al_x, math.radians(18.0), 0)
        sheriff["arm_r"].rotation_euler = (ar_x, math.radians(-18.0), 0)
        sheriff["arm_l"].keyframe_insert(data_path="rotation_euler", frame=f)
        sheriff["arm_r"].keyframe_insert(data_path="rotation_euler", frame=f)

    # f76..104: Clerk vigorously polishes/scrubs the Relic Bell on the counter (2-arm circular motion + head glances)
    clerk["root"].location = (0.45, 1.38, 0.0)
    clerk["root"].rotation_euler = (0, 0, math.radians(6))
    clerk["root"].keyframe_insert(data_path="location", frame=76)
    clerk["root"].keyframe_insert(data_path="rotation_euler", frame=76)
    apply_continuous_bob(clerk, 76, 104, freq_hz=2.4, amp_z=0.024, squash=0.025, tilt_deg=3.5)
    for f in range(76, 105, 2):
        ang = (f - 76) * 0.48
        clerk["arm_l"].rotation_euler = (math.radians(-58 + 14 * math.sin(ang)), math.radians(16 + 10 * math.cos(ang)), 0)
        clerk["arm_r"].rotation_euler = (math.radians(-58 - 14 * math.sin(ang)), math.radians(-16 - 10 * math.cos(ang)), 0)
        clerk["forearm_l"].rotation_euler = (math.radians(-42), 0, 0)
        clerk["forearm_r"].rotation_euler = (math.radians(-42), 0, 0)
        clerk["head"].rotation_euler = (0, 0, math.radians(12 * math.sin((f - 76) * 0.25)))
        for p in ("arm_l", "arm_r", "forearm_l", "forearm_r", "head"):
            clerk[p].keyframe_insert(data_path="rotation_euler", frame=f)

        # Relic wobbles gently while being scrubbed
        relic["pivot"].location = (0.35 + 0.03 * math.cos(ang), 0.55, 1.00)
        relic["pivot"].rotation_euler = (0, math.radians(5 * math.sin(ang)), 0)
        relic["pivot"].keyframe_insert(data_path="location", frame=f)
        relic["pivot"].keyframe_insert(data_path="rotation_euler", frame=f)

    # f105..118: Sheriff slams/leans toward counter pointing; Clerk flinches and ducks behind counter!
    animate_ease_out_back(sheriff["root"], "rotation_euler", (0, 0, 0), (0, 0, -24), 105, 115, is_deg_euler=True)
    animate_arm_gesture(
        sheriff, "r", 105, 115,
        shoulder_start_deg=(0, -18, 0), shoulder_end_deg=(-82, -22, 0),
        elbow_start_deg=(-22, 0, 0), elbow_end_deg=(-12, 0, 0),
    )
    animate_arm_gesture(
        sheriff, "l", 105, 115,
        shoulder_start_deg=(0, 18, 0), shoulder_end_deg=(-24, 24, 0),
        elbow_start_deg=(-22, 0, 0), elbow_end_deg=(-65, -24, 0),
    )
    apply_continuous_bob(sheriff, 116, 150, freq_hz=1.8, amp_z=0.022, squash=0.025, tilt_deg=2.8)
    for f in range(116, 151, 3):
        # Impatient finger/hand bounce on Sheriff
        sheriff["arm_r"].rotation_euler = (math.radians(-82 + 6 * math.sin(f * 0.5)), math.radians(-22), 0)
        sheriff["arm_r"].keyframe_insert(data_path="rotation_euler", frame=f)

    # Clerk ducks behind counter & yanks relic down out of sight
    animate_ease_out_back(clerk["root"], "location", (0.45, 1.38, 0.0), (0.45, 1.38, -0.44), 106, 118, overshoot=1.4)
    animate_ease_out_back(relic["pivot"], "location", (0.35, 0.55, 1.00), (0.42, 0.92, 0.52), 106, 116, overshoot=1.2)
    animate_arm_gesture(
        clerk, "l", 105, 116,
        shoulder_start_deg=(-58, 16, 0), shoulder_end_deg=(-95, 22, 0),
        elbow_start_deg=(-42, 0, 0), elbow_end_deg=(-35, 0, 0),
    )
    animate_arm_gesture(
        clerk, "r", 105, 116,
        shoulder_start_deg=(-58, -16, 0), shoulder_end_deg=(-95, -22, 0),
        elbow_start_deg=(-42, 0, 0), elbow_end_deg=(-35, 0, 0),
    )

    # f119..150: Clerk trembles peeking above counter + 3 pulsing cyan sweat drops!
    clerk["torso_pivot"].location = (0, 0, 0.54)
    animate_tremble(clerk, 119, 150, amp=0.015, freq_hz=11.5)
    animate_sweat_drops(clerk, 108, 150, active=True)

    # Hide Beat 2/4 characters during Beat 3 (f151..225)
    for ch in (sheriff, clerk):
        # Skip face_parts & sweat_drops so their per-frame expression/sweat visibility stays intact!
        skip = set(ch["face_parts"].values()) | set(ch["sweat_drops"])
        def _hide_body(obj):
            if obj in skip:
                return
            for prop in ("hide_render", "hide_viewport"):
                setattr(obj, prop, True)
                obj.keyframe_insert(data_path=prop, frame=1)
                obj.keyframe_insert(data_path=prop, frame=75)
                setattr(obj, prop, False)
                obj.keyframe_insert(data_path=prop, frame=76)
                obj.keyframe_insert(data_path=prop, frame=150)
                setattr(obj, prop, True)
                obj.keyframe_insert(data_path=prop, frame=151)
                obj.keyframe_insert(data_path=prop, frame=225)
                setattr(obj, prop, False)
                obj.keyframe_insert(data_path=prop, frame=226)
                obj.keyframe_insert(data_path=prop, frame=300)
            set_fcurve_interpolation(obj, "hide_", "CONSTANT")
            for c in obj.children:
                _hide_body(c)
        _hide_body(ch["root"])

    # Also hide Relic Bell during Beat 3 (f151..225)
    def _hide_relic_3(obj, is_glow=False):
        if is_glow:
            return
        for prop in ("hide_render", "hide_viewport"):
            setattr(obj, prop, True)
            obj.keyframe_insert(data_path=prop, frame=1)
            obj.keyframe_insert(data_path=prop, frame=75)
            setattr(obj, prop, False)
            obj.keyframe_insert(data_path=prop, frame=76)
            obj.keyframe_insert(data_path=prop, frame=150)
            setattr(obj, prop, True)
            obj.keyframe_insert(data_path=prop, frame=151)
            obj.keyframe_insert(data_path=prop, frame=225)
            setattr(obj, prop, False)
            obj.keyframe_insert(data_path=prop, frame=226)
            obj.keyframe_insert(data_path=prop, frame=300)
        set_fcurve_interpolation(obj, "hide_", "CONSTANT")
        for c in obj.children:
            _hide_relic_3(c, c == relic["glow"])
    _hide_relic_3(relic["pivot"])

    # -----------------------------------------------------------------------
    # BEAT 3 (f151..225): Chiaroscuro Spotlight Interrogation Closeups
    # -----------------------------------------------------------------------
    # Dedicated Beat 3 Chiaroscuro Dark Backdrop (in front of counter so counter never clips Clerk!)
    dark_void_mat = make_celyxi_cloth_mat("ChiaroscuroVoid", (0.008, 0.006, 0.006), roughness=0.98, rim_strength=0.0, bump_strength=0.0)
    void_wall = add_box(col_ch3, "ChiaroscuroBackdrop", (0.0, 0.45, 2.0), (10.0, 0.08, 6.0), dark_void_mat)

    # Dedicated Beat 3 Sheriff (f151..185) + Hero Gold Badge prop
    sheriff3 = create_celyxi_character("Sheriff_B3", role="sheriff", location=(-0.10, -0.25, 0.0), outline_mat=outline_mat)
    link_character_to_collection(sheriff3, col_ch3)
    init_hidden_fx(sheriff3)
    set_face_expression(sheriff3, "suspicious", frame=151)
    set_face_expression(sheriff3, "suspicious", frame=167, blink_duration=3)
    hide_fx_at(sheriff3, 186)

    badge_prop = build_sheriff_badge_prop(col_ch3, "HeroGoldBadge", outline_mat)
    badge_prop.parent = sheriff3["hand_r"]
    badge_prop.location = (0.0, -0.05, -0.04)
    badge_prop.rotation_euler = (0, 0, math.radians(12))

    # Sheriff leans forward slowly, raises gold Sheriff Star toward camera + continuous bob
    sheriff3["torso_pivot"].location = (0, 0, 0.54)
    sheriff3["torso_pivot"].rotation_euler = (0, 0, 0)
    sheriff3["head"].rotation_euler = (0, 0, math.radians(-5))
    apply_continuous_bob(sheriff3, 151, 185, freq_hz=1.4, amp_z=0.024, squash=0.025, tilt_deg=2.8)
    animate_arm_gesture(
        sheriff3, "r", 151, 174,
        shoulder_start_deg=(-25, -24, 0), shoulder_end_deg=(-88, -14, 0),
        elbow_start_deg=(-55, 0, 0), elbow_end_deg=(-28, 0, 0),
    )
    animate_arm_gesture(
        sheriff3, "l", 151, 174,
        shoulder_start_deg=(-12, 22, 0), shoulder_end_deg=(-18, 28, 0),
        elbow_start_deg=(-60, 0, 0), elbow_end_deg=(-72, -25, 0),
    )
    for f in range(151, 186, 2):
        u = (f - 151) / 34.0
        sheriff3["root"].location = (-0.10, -0.25 - 0.14 * u, 0.0)
        sheriff3["root"].keyframe_insert(data_path="location", frame=f)
        sheriff3["head"].rotation_euler = (math.radians(-4 * u), math.radians(7 * u), math.radians(-5))
        sheriff3["head"].keyframe_insert(data_path="rotation_euler", frame=f)
        if f >= 174:
            badge_prop.rotation_euler = (0, math.radians((f - 174) * 4.0), math.radians(12))
            badge_prop.keyframe_insert(data_path="rotation_euler", frame=f)

    # Dedicated Beat 3 Clerk (f186..225) — frantic wave + sweat burst
    clerk3 = create_celyxi_character("Clerk_B3", role="clerk", location=(0.20, -0.18, -0.06), outline_mat=outline_mat)
    clerk3["hat_pivot"].location = (0, -0.05, 0.51)
    clerk3["hat_pivot"].rotation_euler = (math.radians(6), math.radians(-3), 0)
    if "CelyxiOutline" in clerk3["hat"].modifiers:
        clerk3["hat"].modifiers["CelyxiOutline"].thickness = 0.004
    link_character_to_collection(clerk3, col_ch3)
    init_hidden_fx(clerk3)
    set_face_expression(clerk3, "shocked", frame=186)
    set_face_expression(clerk3, "panic", frame=204)
    set_face_expression(clerk3, "panic", frame=211, blink_duration=3)
    hide_fx_at(clerk3, 226)

    clerk3["torso_pivot"].location = (0, 0, 0.54)
    apply_continuous_bob(clerk3, 186, 225, freq_hz=2.8, amp_z=0.032, squash=0.038, tilt_deg=4.5)
    animate_sweat_drops(clerk3, 186, 225, active=True)
    # Rapid 2.5 Hz alternating arm wave overhead + frantic head-shake denial
    for f in range(186, 226):
        t = (f - 186) / 30.0
        w = 2.0 * math.pi * 2.6 * t
        clerk3["arm_l"].rotation_euler = (math.radians(-28 + 16 * math.sin(w)), math.radians(122 + 22 * math.sin(w)), 0)
        clerk3["arm_r"].rotation_euler = (math.radians(-28 - 16 * math.sin(w)), math.radians(-122 + 22 * math.sin(w)), 0)
        clerk3["forearm_l"].rotation_euler = (math.radians(-26), 0, 0)
        clerk3["forearm_r"].rotation_euler = (math.radians(-26), 0, 0)
        clerk3["head"].rotation_euler = (
            math.radians(4 * math.sin(w * 2)),
            math.radians(4 * math.cos(w)),
            math.radians(16 * math.sin(w * 1.4)),
        )
        for p in ("arm_l", "arm_r", "forearm_l", "forearm_r", "head"):
            clerk3[p].keyframe_insert(data_path="rotation_euler", frame=f)

    # Hide Sheriff3 outside 151..185 and Clerk3 outside 186..225
    def _hide_tree(obj, s_f, e_f, skip_set=None):
        if skip_set and obj in skip_set:
            return
        key_hide(obj, s_f, e_f)
        for c in obj.children:
            _hide_tree(c, s_f, e_f, skip_set)

    _hide_tree(void_wall, 151, 225)
    _hide_tree(sheriff3["root"], 151, 185, set(sheriff3["face_parts"].values()) | set(sheriff3["sweat_drops"]))
    _hide_tree(clerk3["root"], 186, 225, set(clerk3["face_parts"].values()) | set(clerk3["sweat_drops"]))

    # -----------------------------------------------------------------------
    # BEAT 4 (f226..300): Golden Bloom Reveal & Smug Sheriff Laugh Payoff
    # -----------------------------------------------------------------------
    # Reset positions smoothly on f226 for wide reveal shot (kept well inside 9:16 frame)
    sheriff["root"].location = (-0.50, -0.02, 0.0)
    sheriff["root"].rotation_euler = (0, 0, math.radians(-16))
    sheriff["root"].keyframe_insert(data_path="location", frame=226)
    sheriff["root"].keyframe_insert(data_path="rotation_euler", frame=226)
    set_face_expression(sheriff, "neutral", frame=226)
    set_face_expression(sheriff, "smug", frame=242)
    set_face_expression(sheriff, "smug", frame=276, blink_duration=3)

    clerk["root"].location = (0.52, 1.32, -0.10)
    clerk["root"].rotation_euler = (0, 0, math.radians(10))
    clerk["root"].keyframe_insert(data_path="location", frame=226)
    clerk["root"].keyframe_insert(data_path="rotation_euler", frame=226)
    set_face_expression(clerk, "shocked", frame=226)
    set_face_expression(clerk, "neutral", frame=265, blink_duration=3)
    animate_sweat_drops(clerk, 226, 254, active=True)

    # Relic Bell pops up from behind counter spinning 360° in Golden Bloom!
    relic["glow"].hide_render = False
    relic["glow"].hide_viewport = False
    relic["glow"].keyframe_insert(data_path="hide_render", frame=226)
    relic["glow"].keyframe_insert(data_path="hide_viewport", frame=226)
    animate_ease_out_back(relic["glow"], "scale", (0.2, 0.2, 0.2), (1.05, 1.05, 1.05), 226, 242, overshoot=1.5)
    animate_ease_out_back(relic["pivot"], "location", (0.42, 0.92, 0.52), (0.04, 0.45, 1.24), 226, 244, overshoot=1.6)
    for f in range(226, 301, 2):
        t = (f - 226) / 30.0
        if f >= 245:
            relic["pivot"].location = (0.04, 0.45, 1.24 + 0.07 * math.sin(t * 3.5))
            relic["pivot"].keyframe_insert(data_path="location", frame=f)
        relic["pivot"].rotation_euler = (
            math.radians(8 * math.sin(t * 4.0)),
            math.radians(6 * math.cos(t * 3.0)),
            math.radians((f - 226) * 8.0),
        )
        relic["pivot"].keyframe_insert(data_path="rotation_euler", frame=f)
        g_pulse = 0.98 + 0.12 * math.sin(t * 6.0)
        relic["glow"].scale = (g_pulse, g_pulse, g_pulse)
        relic["glow"].keyframe_insert(data_path="scale", frame=f)

    # Clerk recoils backward in shock (f226..245), then pops back sheepishly wobbling (f246..300)
    animate_ease_out_back(clerk["torso_pivot"], "rotation_euler", (0, 0, 0), (11, -6, 0), 226, 238, is_deg_euler=True)
    animate_arm_gesture(
        clerk, "l", 226, 238,
        shoulder_start_deg=(-60, 20, 0), shoulder_end_deg=(-35, 128, 0),
        elbow_start_deg=(-30, 0, 0), elbow_end_deg=(-18, 0, 0),
    )
    animate_arm_gesture(
        clerk, "r", 226, 238,
        shoulder_start_deg=(-60, -20, 0), shoulder_end_deg=(-35, -128, 0),
        elbow_start_deg=(-30, 0, 0), elbow_end_deg=(-18, 0, 0),
    )
    # Settle Clerk f246..300 with sheepish bobbing & head rub
    animate_ease_out_back(clerk["torso_pivot"], "rotation_euler", (11, -6, 0), (4, 0, 0), 246, 260, is_deg_euler=True)
    animate_ease_out_back(clerk["root"], "location", (0.52, 1.32, -0.10), (0.52, 1.32, -0.02), 246, 262, overshoot=1.3)
    animate_arm_gesture(
        clerk, "l", 246, 262,
        shoulder_start_deg=(-35, 128, 0), shoulder_end_deg=(-15, 22, 0),
        elbow_start_deg=(-18, 0, 0), elbow_end_deg=(-45, 0, 0),
    )
    animate_arm_gesture(
        clerk, "r", 246, 262,
        shoulder_start_deg=(-35, -128, 0), shoulder_end_deg=(-45, -108, 0),
        elbow_start_deg=(-18, 0, 0), elbow_end_deg=(-95, 20, 0),
    )
    for f in range(261, 301, 2):
        t = (f - 261) / 30.0
        clerk["torso_pivot"].location = (0, 0, 0.54 + 0.018 * math.sin(t * 7.0))
        clerk["torso_pivot"].keyframe_insert(data_path="location", frame=f)
        clerk["head"].rotation_euler = (math.radians(6 + 3 * math.sin(t * 5.0)), math.radians(-6), math.radians(-10))
        clerk["head"].keyframe_insert(data_path="rotation_euler", frame=f)

    # Sheriff transitions into triumphant hearty 3.5 Hz laugh bounce (f226..300)!
    animate_arm_gesture(
        sheriff, "l", 226, 244,
        shoulder_start_deg=(-24, 24, 0), shoulder_end_deg=(-15, 36, 0),
        elbow_start_deg=(-65, -24, 0), elbow_end_deg=(-72, -32, 0),
    )
    animate_arm_gesture(
        sheriff, "r", 226, 244,
        shoulder_start_deg=(-82, -22, 0), shoulder_end_deg=(-20, -36, 0),
        elbow_start_deg=(-12, 0, 0), elbow_end_deg=(-72, 32, 0),
    )
    sheriff["torso_pivot"].location = (0, 0, 0.54)
    sheriff["torso_pivot"].rotation_euler = (0, 0, 0)
    apply_continuous_bob(sheriff, 245, 300, freq_hz=3.4, amp_z=0.036, squash=0.042, tilt_deg=5.2, step=2)
    for f in range(245, 301, 2):
        t = (f - 245) / 30.0
        # Extra joyful head-back laugh rocking
        sheriff["head"].rotation_euler = (
            math.radians(-10 + 7 * math.sin(2 * math.pi * 3.4 * t)),
            math.radians(4 * math.cos(2 * math.pi * 1.7 * t)),
            math.radians(-12),
        )
        sheriff["head"].keyframe_insert(data_path="rotation_euler", frame=f)

    # -----------------------------------------------------------------------
    # Camera Choreography Beats 2, 3, 4 (f76..300)
    # -----------------------------------------------------------------------
    def _key_cam(f, loc, rot_deg, lens, fstop, focus_dist, interp="BEZIER"):
        cam.location = loc
        cam.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        cam.data.lens = lens
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = focus_dist
        for dp in ("location", "rotation_euler"):
            cam.keyframe_insert(data_path=dp, frame=f)
        cam.data.keyframe_insert(data_path="lens", frame=f)
        cam.data.dof.keyframe_insert(data_path="focus_distance", frame=f)
        if interp == "CONSTANT":
            set_fcurve_interpolation(cam, None, "CONSTANT")

    # Beat 2 (f76..150): Medium 2-shot across counter -> smooth creeping push-in (keeps Sheriff + Clerk framed!)
    _key_cam(76, (-0.10, -4.00, 1.48), (85.5, 0.0, 0.5), 31.0, 2.6, 4.2)
    _key_cam(150, (-0.02, -3.40, 1.42), (86.5, 0.0, -0.5), 35.5, 2.5, 3.8)

    # Beat 3A (f151..185): Hard cut to Low-Angle Hero Sheriff closeup push-in (full Stetson + Gold Badge visible)
    _key_cam(151, (-0.12, -2.65, 1.24), (91.5, 0.0, -1.5), 40.0, 2.4, 2.35)
    _key_cam(185, (-0.08, -2.35, 1.34), (90.0, 0.0, -1.0), 46.0, 2.4, 1.95)

    # Beat 3B (f186..225): Whip-cut to tight panicked Clerk closeup (face + waving stick arms + sweat framed)
    _key_cam(186, (0.20, -2.25, 1.48), (88.0, 0.0, 0.5), 42.0, 2.4, 2.50)
    _key_cam(225, (0.18, -2.00, 1.50), (88.5, 0.0, 0.5), 46.0, 2.4, 2.25)

    # Beat 4 (f226..300): Dynamic snap pull-back -> celebratory pedestal lift (both characters + glowing Relic framed)
    _key_cam(226, (0.04, -2.50, 1.42), (88.0, 0.0, 0.0), 46.0, 2.8, 3.0)
    _key_cam(248, (0.02, -3.75, 1.48), (86.0, 0.0, 0.0), 31.0, 3.0, 4.2)
    _key_cam(300, (-0.06, -3.45, 1.62), (84.0, 0.0, -1.0), 33.0, 3.0, 3.9)

    # Enforce CONSTANT cuts on exact cut frames (75->76, 150->151, 185->186, 225->226)
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


# ---------------------------------------------------------------------------
# Master Build & CLI Runner
# ---------------------------------------------------------------------------

def build_scene(res_x=432, res_y=768, samples=6, max_bounces=1, diffuse_bounces=0, vignette=0.0):
    clear_scene()
    setup_celyxi_render_and_compositor(
        res_x=res_x,
        res_y=res_y,
        fps=FPS,
        samples=samples,
        exposure=0.20,
        bloom_threshold=1.22,
        bloom_strength=0.30,
        bloom_size=0.55,
        vignette=vignette,
    )
    scene = bpy.context.scene
    scene.cycles.max_bounces = max_bounces
    scene.cycles.diffuse_bounces = diffuse_bounces
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

    # Use Low glare quality for fast CPU compositing
    ng = scene.compositing_node_group
    for node in ng.nodes:
        if node.bl_idname == "CompositorNodeGlare":
            node.inputs["Quality"].default_value = "Low"

    world_bg = set_world_sky(top_rgb=(0.14, 0.28, 0.54), horizon_rgb=(0.76, 0.62, 0.46), strength=0.85)
    outline_mat = make_celyxi_outline_mat()
    wanted_mat = make_wanted_poster_mat()

    cam_rig = create_camera_rig("CelyxiMainCam", loc=(0.75, -3.55, 1.38), rot_deg=(87.0, 0.0, 10.0), lens=35.0, fstop=2.8)
    cam = cam_rig["cam"]

    # Layer subtle continuous handheld micro-float (stronger during Beat 3B panic)
    animate_camera_handheld(cam_rig["rig"], 1, 185, amp_loc=0.010, amp_rot_deg=0.35, seed=19)
    animate_camera_handheld(cam_rig["rig"], 186, 225, amp_loc=0.018, amp_rot_deg=0.55, seed=29)
    animate_camera_handheld(cam_rig["rig"], 226, 300, amp_loc=0.011, amp_rot_deg=0.38, seed=39)

    build_beat1_street(outline_mat, wanted_mat, cam)
    build_beats_2_3_4_courthouse(outline_mat, wanted_mat, cam, world_bg)
    return scene


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []

    res_x, res_y = 360, 640
    samples = 4
    max_bounces = 1
    diffuse_bounces = 0
    bench_frame = None
    test_frames = None
    start_f, end_f = 1, TOTAL_FRAMES

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--res" and i + 1 < len(args):
            w, h = args[i + 1].split("x")
            res_x, res_y = int(w), int(h)
            i += 2
        elif a == "--samples" and i + 1 < len(args):
            samples = int(args[i + 1])
            i += 2
        elif a == "--bounces" and i + 1 < len(args):
            max_bounces = int(args[i + 1])
            diffuse_bounces = 1 if max_bounces >= 2 else 0
            i += 2
        elif a == "--bench" and i + 1 < len(args):
            bench_frame = int(args[i + 1])
            i += 2
        elif a == "--test" and i + 1 < len(args):
            test_frames = [int(x) for x in args[i + 1].split(",")]
            i += 2
        elif a == "--range" and i + 1 < len(args):
            s, e = args[i + 1].split("-")
            start_f, end_f = int(s), int(e)
            i += 2
        else:
            i += 1

    scene = build_scene(res_x=res_x, res_y=res_y, samples=samples, max_bounces=max_bounces, diffuse_bounces=diffuse_bounces)
    out_dir = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "out", "celyxi_frames"))
    os.makedirs(out_dir, exist_ok=True)

    if bench_frame is not None:
        t0 = time.perf_counter()
        scene.frame_set(bench_frame)
        out_path = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "out", f"celyxi_bench_{bench_frame:04d}.png"))
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        dt = time.perf_counter() - t0
        print(f"[BENCH] Frame {bench_frame} ({res_x}x{res_y}, samples={samples}, bounces={max_bounces}) rendered in {dt:.2f}s -> {out_path}")
        return

    if test_frames:
        for f in test_frames:
            t0 = time.perf_counter()
            scene.frame_set(f)
            out_path = os.path.join(out_dir, f"test_{f:04d}.png")
            scene.render.filepath = out_path
            bpy.ops.render.render(write_still=True)
            print(f"[TEST] Frame {f} rendered in {time.perf_counter() - t0:.2f}s -> {out_path}")
        return

    scene.frame_start = start_f
    scene.frame_end = end_f
    scene.frame_step = 1
    scene.render.filepath = os.path.join(out_dir, "frame_")
    t0 = time.perf_counter()
    bpy.ops.render.render(animation=True)
    print(f"[DONE] Rendered frames {start_f}..{end_f} in {time.perf_counter() - t0:.1f}s")


if __name__ == "__main__":
    main()

import math
import os
import sys
import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from shaders_and_rig import (
    clear_scene,
    setup_cycles_and_compositor,
    set_world_sky,
    make_outline_mat,
    make_stylized_pbr_rim_mat,
    make_oak_parquet_mat,
    make_plaster_wall_mat,
    make_fabric_mat,
    make_emissive_mat,
    make_fresnel_brain_mat,
    make_glass_shell_mat,
    build_stickman,
)

# Scene Frame Ranges (30 fps, matching src/data/timeline.ts)
SCENES = [
    (1, 1, 86, "night_sleep"),
    (2, 87, 179, "morning_exhausted"),
    (3, 180, 297, "clock_red_x"),
    (4, 298, 421, "holo_stage"),
    (5, 422, 520, "zombie_coffee"),
    (6, 521, 650, "brain_dolly_zoom"),
    (7, 651, 774, "alarm_ring_shock"),
    (8, 775, 976, "doctor_90min_wheel"),
    (9, 977, 1132, "morning_victory"),
]


def link_to_collection(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def make_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def add_box(col, name, loc, scale, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    link_to_collection(obj, col)
    return obj


def add_cyl(col, name, loc, radius, depth, mat, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    link_to_collection(obj, col)
    return obj


def key_hide(obj, start_f, end_f):
    # Hide before start_f, show during [start_f..end_f], hide after end_f
    for prop in ("hide_render", "hide_viewport"):
        setattr(obj, prop, True)
        obj.keyframe_insert(data_path=prop, frame=1)
        if start_f > 1:
            setattr(obj, prop, True)
            obj.keyframe_insert(data_path=prop, frame=start_f - 1)
        setattr(obj, prop, False)
        obj.keyframe_insert(data_path=prop, frame=start_f)
        setattr(obj, prop, False)
        obj.keyframe_insert(data_path=prop, frame=end_f)
        if end_f < 1132:
            setattr(obj, prop, True)
            obj.keyframe_insert(data_path=prop, frame=end_f + 1)


def hide_hierarchy(obj, start_f, end_f):
    key_hide(obj, start_f, end_f)
    for child in obj.children:
        hide_hierarchy(child, start_f, end_f)


def build_bedroom_props(col, mode="morning"):
    is_night = mode == "night"
    is_dim = mode == "dim"
    tint = (0.55, 0.62, 0.8) if is_night else (0.7, 0.72, 0.78) if is_dim else (1.0, 1.0, 1.0)

    wood_floor = make_oak_parquet_mat(f"WoodFloor_{mode}", tint)
    wall_rgb = (0.09, 0.13, 0.24) if is_night else (0.22, 0.26, 0.34) if is_dim else (0.86, 0.78, 0.64)
    wall_mat = make_plaster_wall_mat(f"Wall_{mode}", wall_rgb)
    wood_dark = make_stylized_pbr_rim_mat(f"WoodDark_{mode}", (0.34, 0.16, 0.06), (0.8, 0.6, 0.4), 0.15, 0.45)
    mattress_mat = make_fabric_mat(f"Mattress_{mode}", (0.92, 0.94, 0.97))
    duvet_mat = make_fabric_mat(f"Duvet_{mode}", (0.08, 0.16, 0.42) if is_night else (0.12, 0.24, 0.58))
    white_frame = make_stylized_pbr_rim_mat(f"WinFrame_{mode}", (0.95, 0.95, 0.95), (0.7, 0.85, 1.0), 0.2, 0.35)

    # Floor & Walls
    bpy.ops.mesh.primitive_plane_add(size=18.0, location=(0, 0, 0))
    fl = bpy.context.active_object
    fl.data.materials.append(wood_floor)
    link_to_collection(fl, col)

    add_box(col, "BackWall", (0, 3.2, 3.5), (16.0, 0.2, 7.2), wall_mat)
    add_box(col, "LeftWall", (-4.2, 0, 3.5), (0.2, 14.0, 7.2), wall_mat)
    add_box(col, "Baseboard", (0, 3.08, 0.12), (16.0, 0.08, 0.24), wood_dark)

    # Window Sky Plane + Frame
    sky_rgb = (0.03, 0.08, 0.24) if is_night else (0.22, 0.32, 0.48) if is_dim else (0.35, 0.75, 0.98)
    sky_mat = make_emissive_mat(f"WinSky_{mode}", sky_rgb, 1.8 if not is_night else 0.9)
    add_box(col, "WinSky", (-2.1, 3.06, 2.3), (1.9, 0.04, 2.1), sky_mat)
    add_box(col, "WinTop", (-2.1, 3.02, 3.35), (2.1, 0.1, 0.12), white_frame)
    add_box(col, "WinBot", (-2.1, 3.02, 1.25), (2.1, 0.1, 0.12), white_frame)
    add_box(col, "WinMidV", (-2.1, 3.02, 2.3), (0.08, 0.08, 2.1), white_frame)
    add_box(col, "WinMidH", (-2.1, 3.02, 2.3), (1.9, 0.08, 0.08), white_frame)

    # Framed Poster on right wall
    add_box(col, "PosterFrame", (2.0, 3.06, 2.35), (1.1, 0.06, 1.3), wood_dark)
    add_box(col, "PosterArt", (2.0, 3.02, 2.35), (0.9, 0.03, 1.1), make_emissive_mat(f"Poster_{mode}", (0.25, 0.55, 0.85), 0.7))

    # Bed
    add_box(col, "BedFrame", (0.45, 1.3, 0.28), (2.3, 3.0, 0.36), wood_dark)
    add_box(col, "Headboard", (0.45, 2.75, 0.85), (2.36, 0.16, 1.15), wood_dark)
    add_box(col, "Mattress", (0.45, 1.28, 0.54), (2.14, 2.82, 0.24), mattress_mat)
    add_box(col, "Duvet", (0.45, 0.92, 0.60), (2.18, 2.08, 0.22), duvet_mat)
    add_box(col, "PillowL", (0.0, 2.32, 0.72), (0.75, 0.45, 0.16), mattress_mat)
    add_box(col, "PillowR", (0.9, 2.32, 0.72), (0.75, 0.45, 0.16), mattress_mat)

    # Nightstand + Glowing Lamp
    add_box(col, "Nightstand", (-1.45, 2.0, 0.45), (0.85, 0.75, 0.9), wood_dark)
    gold_mat = make_stylized_pbr_rim_mat(f"Gold_{mode}", (0.85, 0.68, 0.22), (1.0, 0.9, 0.6), 0.3, 0.2)
    add_cyl(col, "LampBase", (-1.45, 2.0, 1.02), 0.14, 0.24, gold_mat)
    lamp_emit = make_emissive_mat(f"LampShade_{mode}", (1.0, 0.82, 0.42), 2.4 if (is_night or is_dim) else 0.6)
    add_cyl(col, "LampShade", (-1.45, 2.0, 1.28), 0.24, 0.32, lamp_emit)

    # Lighting
    bpy.ops.object.light_add(type="AREA", location=(-2.0, -0.5, 3.6), rotation=(0.8, 0.2, -0.4))
    key = bpy.context.active_object
    key.data.energy = 120.0 if is_night else 180.0 if is_dim else 420.0
    key.data.size = 2.5
    key.data.color = (0.55, 0.72, 1.0) if is_night else (1.0, 0.92, 0.78)
    link_to_collection(key, col)

    bpy.ops.object.light_add(type="POINT", location=(-1.45, 2.0, 1.35))
    pt = bpy.context.active_object
    pt.data.energy = 90.0 if (is_night or is_dim) else 35.0
    pt.data.color = (1.0, 0.72, 0.32)
    link_to_collection(pt, col)


def build_all(test_frames=None):
    clear_scene()
    setup_cycles_and_compositor(res_x=432, res_y=768, samples=5)
    set_world_sky((0.04, 0.08, 0.18), (0.14, 0.22, 0.38), 0.75)

    outline_mat = make_outline_mat()

    # Camera Rig
    bpy.ops.object.camera_add(location=(0.2, -4.6, 1.6), rotation=(math.radians(86), 0, 0))
    cam = bpy.context.active_object
    cam.name = "MainCamera"
    cam.data.lens = 38.0
    bpy.context.scene.camera = cam

    def key_cam(f, loc, rot_deg, lens=38.0):
        cam.location = loc
        cam.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        cam.data.lens = lens
        cam.keyframe_insert(data_path="location", frame=f)
        cam.keyframe_insert(data_path="rotation_euler", frame=f)
        cam.data.keyframe_insert(data_path="lens", frame=f)

    # --- SCENE 1: Night Sleep (1..86) ---
    c1 = make_collection("Scene1_Night")
    build_bedroom_props(c1, "night")
    s1 = build_stickman("Hero_S1", "protagonist", "sleeping", outline_mat)
    s1["root"].location = (0.45, 1.65, 0.78)
    s1["root"].rotation_euler = (math.radians(-78), 0, 0)
    for o in c1.objects:
        key_hide(o, 1, 86)
    hide_hierarchy(s1["root"], 1, 86)
    key_cam(1, (0.3, -2.5, 2.2), (68, 0, 0), 34.0)
    key_cam(86, (0.35, -1.5, 1.85), (72, 0, 0), 40.0)

    # --- SCENE 2: Morning Exhausted (87..179) ---
    c2 = make_collection("Scene2_Morning")
    build_bedroom_props(c2, "morning")
    s2 = build_stickman("Hero_S2", "protagonist", "exhausted", outline_mat)
    s2["root"].location = (0.45, 0.55, 0.45)
    s2["root"].rotation_euler = (0, 0, math.radians(-10))
    s2["l_leg"].rotation_euler = (math.radians(-75), 0, 0)
    s2["r_leg"].rotation_euler = (math.radians(-75), 0, 0)
    s2["l_arm"].rotation_euler = (math.radians(-35), math.radians(-22), 0)
    s2["r_arm"].rotation_euler = (math.radians(-35), math.radians(22), 0)
    for o in c2.objects:
        key_hide(o, 87, 179)
    hide_hierarchy(s2["root"], 87, 179)
    key_cam(87, (0.35, -3.1, 1.55), (86, 0, 0), 38.0)
    key_cam(179, (0.45, -2.5, 1.48), (87, 0, 0), 42.0)

    # --- SCENE 3: Clock Wall + Red X (180..297) ---
    c3 = make_collection("Scene3_Clock")
    add_box(c3, "Floor3", (0, 0, 0), (16, 16, 0.05), make_oak_parquet_mat("Wood3"))
    add_box(c3, "Wall3", (0, 2.5, 3.5), (16, 0.2, 7.2), make_plaster_wall_mat("Wall3", (0.86, 0.80, 0.68)))
    chrome = make_stylized_pbr_rim_mat("Chrome3", (0.7, 0.75, 0.82), (1, 1, 1), 0.3, 0.2)
    add_cyl(c3, "ClockRim", (0.9, 2.32, 2.2), 0.92, 0.14, chrome, (math.pi / 2, 0, 0), 36)
    add_cyl(c3, "ClockFace", (0.9, 2.24, 2.2), 0.82, 0.04, make_emissive_mat("ClkFace", (0.98, 0.98, 0.98), 0.9), (math.pi / 2, 0, 0), 36)
    red_x = make_emissive_mat("RedX", (0.95, 0.12, 0.14), 2.8)
    add_box(c3, "RedX1", (0.9, 2.12, 2.2), (1.5, 0.06, 0.18), red_x, (0, math.radians(45), 0))
    add_box(c3, "RedX2", (0.9, 2.12, 2.2), (1.5, 0.06, 0.18), red_x, (0, math.radians(-45), 0))
    bpy.ops.object.light_add(type="AREA", location=(-1.5, -2.5, 3.5), rotation=(0.8, 0, -0.3))
    bpy.context.active_object.data.energy = 320.0
    link_to_collection(bpy.context.active_object, c3)
    s3 = build_stickman("Hero_S3", "protagonist", "confused", outline_mat)
    s3["root"].location = (-0.65, 0.6, 0.0)
    s3["r_arm"].rotation_euler = (math.radians(-25), math.radians(-125), 0)
    for o in c3.objects:
        key_hide(o, 180, 297)
    hide_hierarchy(s3["root"], 180, 297)
    key_cam(180, (-1.1, -3.4, 1.55), (86, 0, 0), 38.0)
    key_cam(297, (1.1, -3.4, 1.55), (86, 0, 0), 38.0)

    # --- SCENE 4: Hologram Stage (298..421) ---
    c4 = make_collection("Scene4_Holo")
    dark_floor = make_stylized_pbr_rim_mat("DarkFloor4", (0.03, 0.05, 0.12), (0.1, 0.5, 0.9), 0.2, 0.18)
    add_box(c4, "StageFloor", (0, 0, 0), (18, 18, 0.05), dark_floor)
    cyan_em = make_emissive_mat("CyanRing", (0.05, 0.85, 1.0), 3.6)
    violet_em = make_emissive_mat("VioletRing", (0.55, 0.25, 1.0), 3.2)
    bpy.ops.mesh.primitive_torus_add(major_radius=2.2, minor_radius=0.04, location=(0, 0.8, 0.04))
    r1 = bpy.context.active_object
    r1.data.materials.append(cyan_em)
    link_to_collection(r1, c4)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.55, minor_radius=0.03, location=(0, 0.8, 0.04))
    r2 = bpy.context.active_object
    r2.data.materials.append(violet_em)
    link_to_collection(r2, c4)
    # 3D Hologram Frame + Wave Bars
    holo_bg = make_emissive_mat("HoloBG", (0.02, 0.08, 0.22), 1.4)
    add_box(c4, "HoloScreen", (0.3, 2.2, 1.9), (3.4, 0.04, 1.85), holo_bg)
    for i in range(12):
        x = -1.1 + i * 0.24
        z = 1.9 + math.sin(i * 0.8) * 0.45
        mat_bar = red_x if i == 6 else (cyan_em if i < 6 else violet_em)
        add_box(c4, f"WavePt_{i}", (x, 2.15, z), (0.14, 0.06, 0.14 if i != 6 else 1.7), mat_bar)
    bpy.ops.object.light_add(type="POINT", location=(0, -1.5, 2.6))
    bpy.context.active_object.data.energy = 140.0
    bpy.context.active_object.data.color = (0.3, 0.8, 1.0)
    link_to_collection(bpy.context.active_object, c4)
    s4 = build_stickman("Hero_S4", "protagonist", "confused", outline_mat)
    s4["root"].location = (-0.95, 0.4, 0.0)
    for o in c4.objects:
        key_hide(o, 298, 421)
    hide_hierarchy(s4["root"], 298, 421)
    key_cam(298, (1.1, -3.9, 1.6), (86, 0, 0), 36.0)
    key_cam(421, (-0.7, -3.9, 1.6), (86, 0, 0), 36.0)

    # --- SCENE 5: Zombie Coffee (422..520) ---
    c5 = make_collection("Scene5_Zombie")
    build_bedroom_props(c5, "dim")
    s5 = build_stickman("Hero_S5", "protagonist", "zombie", outline_mat)
    s5["root"].location = (0.45, 0.55, 0.45)
    s5["l_leg"].rotation_euler = (math.radians(-75), 0, 0)
    s5["r_leg"].rotation_euler = (math.radians(-75), 0, 0)
    s5["l_arm"].rotation_euler = (math.radians(-65), 0, 0)
    for o in c5.objects:
        key_hide(o, 422, 520)
    hide_hierarchy(s5["root"], 422, 520)
    key_cam(422, (0.45, -3.3, 1.55), (86, 0, 0), 38.0)
    key_cam(520, (0.45, -2.15, 1.55), (86, 0, 0), 42.0)

    # --- SCENE 6: Brain Cutaway Dolly Zoom (521..650) ---
    c6 = make_collection("Scene6_BrainDolly")
    add_box(c6, "TunnelBG", (0, 4.5, 2.0), (22, 0.1, 16), make_emissive_mat("TunBG", (0.04, 0.07, 0.16), 0.7))
    pillar_mat = make_stylized_pbr_rim_mat("Pillar6", (0.08, 0.14, 0.28), (0.15, 0.55, 1.0), 0.85, 0.3)
    for px in (-3.0, -1.7, 1.7, 3.0):
        add_box(c6, f"Pillar_{px}", (px, 2.6, 2.0), (0.35, 0.35, 6.0), pillar_mat)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.22, minor_radius=0.05, location=(0, 1.4, 1.35), rotation=(math.pi / 2, 0, 0))
    halo6 = bpy.context.active_object
    halo6.data.materials.append(cyan_em)
    link_to_collection(halo6, c6)
    # Glass Head + Glowing Fresnel Brain
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=0.46, location=(0, 0, 1.74))
    gh = bpy.context.active_object
    gh.scale = (1.1, 0.82, 0.96)
    bpy.ops.object.shade_smooth()
    gh.data.materials.append(make_glass_shell_mat())
    link_to_collection(gh, c6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.29, location=(0, 0, 1.76))
    br = bpy.context.active_object
    br.scale = (1.15, 0.95, 0.85)
    bpy.ops.object.shade_smooth()
    br.data.materials.append(make_fresnel_brain_mat())
    link_to_collection(br, c6)
    for bx in (-0.36, 0.0, 0.36):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.07, depth=0.38, location=(bx, 0, 2.38), rotation=(0, -bx * 0.5, 0))
        sp = bpy.context.active_object
        sp.data.materials.append(red_x)
        link_to_collection(sp, c6)
    bpy.ops.object.light_add(type="POINT", location=(0, -1.5, 2.0))
    bpy.context.active_object.data.energy = 140.0
    bpy.context.active_object.data.color = (0.35, 0.78, 1.0)
    link_to_collection(bpy.context.active_object, c6)
    s6 = build_stickman("Hero_S6", "protagonist", "confused", outline_mat)
    s6["head"].scale = (0.001, 0.001, 0.001)  # Hide solid head, show glass cutaway!
    s6["l_arm"].rotation_euler = (0, math.radians(-80), 0)
    s6["r_arm"].rotation_euler = (0, math.radians(80), 0)
    for o in c6.objects:
        key_hide(o, 521, 650)
    hide_hierarchy(s6["root"], 521, 650)
    # True Dolly Zoom: camera moves closer while lens widens!
    key_cam(521, (0, -5.2, 1.48), (89, 0, 0), 65.0)
    key_cam(650, (0, -2.55, 1.48), (89, 0, 0), 32.0)

    # --- SCENE 7: Alarm Ring Shock (651..774) ---
    c7 = make_collection("Scene7_Alarm")
    build_bedroom_props(c7, "dim")
    add_cyl(c7, "AlarmBody", (-1.45, 2.0, 1.1), 0.18, 0.16, chrome, (math.pi / 2, 0, 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.03, location=(-1.45, 1.9, 1.15), rotation=(math.pi / 2, 0, 0))
    sw = bpy.context.active_object
    sw.data.materials.append(red_x)
    link_to_collection(sw, c7)
    s7 = build_stickman("Hero_S7", "protagonist", "exhausted", outline_mat)
    s7["root"].location = (0.45, 0.55, 0.45)
    s7["l_arm"].rotation_euler = (0, math.radians(-85), 0)
    s7["r_arm"].rotation_euler = (0, math.radians(85), 0)
    for o in c7.objects:
        key_hide(o, 651, 774)
    hide_hierarchy(s7["root"], 651, 774)
    key_cam(651, (-0.1, -3.5, 1.55), (86, 0, 0), 36.0)
    key_cam(774, (-0.45, -2.3, 1.45), (87, 0, 0), 42.0)

    # --- SCENE 8: Doctor 90-Min Wheel (775..976) ---
    c8 = make_collection("Scene8_Doctor")
    add_box(c8, "StudioFloor", (0, 0, 0), (20, 20, 0.05), make_stylized_pbr_rim_mat("StFl", (0.08, 0.12, 0.22), (0.2, 0.6, 1.0), 0.2, 0.16))
    add_box(c8, "StudioBack", (0, 2.8, 3.5), (20, 0.1, 8.0), make_plaster_wall_mat("StBk", (0.06, 0.11, 0.24)))
    bpy.ops.mesh.primitive_torus_add(major_radius=1.05, minor_radius=0.07, location=(-0.65, 1.8, 2.05), rotation=(math.pi / 2, 0, 0))
    wh = bpy.context.active_object
    wh.data.materials.append(cyan_em)
    link_to_collection(wh, c8)
    add_cyl(c8, "WheelHub", (-0.65, 1.82, 2.05), 0.96, 0.04, make_emissive_mat("WhInner", (0.14, 0.45, 0.85), 1.2), (math.pi / 2, 0, 0), 36)
    bpy.ops.object.light_add(type="AREA", location=(0, -2.5, 3.8), rotation=(0.85, 0, 0))
    bpy.context.active_object.data.energy = 360.0
    link_to_collection(bpy.context.active_object, c8)
    s8 = build_stickman("Doctor_S8", "doctor", "doctor", outline_mat)
    s8["root"].location = (0.85, 0.6, 0.0)
    s8["l_arm"].rotation_euler = (math.radians(-20), math.radians(-65), 0)
    for o in c8.objects:
        key_hide(o, 775, 976)
    hide_hierarchy(s8["root"], 775, 976)
    key_cam(775, (0.1, -3.9, 1.65), (86, 0, 0), 36.0)
    key_cam(976, (0.1, -3.5, 1.65), (86, 0, 0), 40.0)

    # --- SCENE 9: Morning Victory (977..1132) ---
    c9 = make_collection("Scene9_Victory")
    build_bedroom_props(c9, "morning")
    s9 = build_stickman("Hero_S9", "protagonist", "happy", outline_mat)
    s9["root"].location = (0.0, 0.0, 0.0)
    s9["l_arm"].rotation_euler = (0, math.radians(-145), 0)
    s9["r_arm"].rotation_euler = (0, math.radians(145), 0)
    # Jump animation
    s9["root"].keyframe_insert(data_path="location", frame=977)
    s9["root"].location = (0.0, 0.0, 0.55)
    s9["root"].keyframe_insert(data_path="location", frame=1050)
    s9["root"].location = (0.0, 0.0, 0.0)
    s9["root"].keyframe_insert(data_path="location", frame=1132)
    for o in c9.objects:
        key_hide(o, 977, 1132)
    hide_hierarchy(s9["root"], 977, 1132)
    key_cam(977, (0.0, -2.9, 1.45), (88, 0, 0), 40.0)
    key_cam(1132, (0.0, -4.4, 1.75), (85, 0, 0), 34.0)

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 1132

    out_dir = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "out", "blender_frames"))
    os.makedirs(out_dir, exist_ok=True)

    if test_frames:
        for f in test_frames:
            bpy.context.scene.frame_set(f)
            bpy.context.scene.render.filepath = os.path.join(out_dir, f"test_{f:04d}.png")
            bpy.ops.render.render(write_still=True)
    else:
        bpy.context.scene.frame_step = 6  # 189 frames -> interpolated smoothly to 30fps via ffmpeg
        bpy.context.scene.render.filepath = os.path.join(out_dir, "frame_")
        bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    argv = sys.argv
    if "--" in argv:
        args = argv[argv.index("--") + 1 :]
    else:
        args = []
    if "--test" in args:
        idx = args.index("--test")
        frames = [int(x) for x in args[idx + 1].split(",")]
        build_all(test_frames=frames)
    else:
        build_all(test_frames=None)

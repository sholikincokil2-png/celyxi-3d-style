import math
import bpy


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_cycles_and_compositor(res_x=432, res_y=768, samples=5):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 1
    scene.cycles.diffuse_bounces = 1
    scene.cycles.glossy_bounces = 1
    scene.cycles.transmission_bounces = 1
    scene.cycles.transparent_max_bounces = 2
    scene.cycles.sample_clamp_indirect = 3.0

    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.render.image_settings.file_format = "PNG"

    # Filmic / AgX color management for punchy RicksClips look
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        scene.view_settings.view_transform = "Filmic"
        scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.15

    # Compositor Glare skipped on Blender 5.1 if NodeGroupOutput is required
    scene.use_nodes = False


def set_world_sky(top_rgb, horizon_rgb, strength=0.65):
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*horizon_rgb, 1.0)
    ramp.color_ramp.elements[1].position = 0.45
    ramp.color_ramp.elements[1].color = (*top_rgb, 1.0)

    nt.links.new(tex_coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def make_outline_mat(color=(0.04, 0.04, 0.04, 1.0)):
    """Cycles inverted-hull outline material: visible ONLY to camera rays on backfaces,
    completely transparent to shadow/light rays so the inner mesh stays brightly lit."""
    mat = bpy.data.materials.new("OutlineMat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = color
    emit.inputs["Strength"].default_value = 1.0
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    lp = nt.nodes.new("ShaderNodeLightPath")

    # With Solidify offset=1.0 + use_flip_normals=True:
    # Near-side faces have Backfacing=1 (must be Transparent).
    # Far-side silhouette rim has Backfacing=0 (must be Dark Outline when Is Camera Ray=1).
    inv_bf = nt.nodes.new("ShaderNodeMath")
    inv_bf.operation = "SUBTRACT"
    inv_bf.inputs[0].default_value = 1.0
    nt.links.new(geom.outputs["Backfacing"], inv_bf.inputs[1])

    mult = nt.nodes.new("ShaderNodeMath")
    mult.operation = "MULTIPLY"
    nt.links.new(lp.outputs["Is Camera Ray"], mult.inputs[0])
    nt.links.new(inv_bf.outputs["Value"], mult.inputs[1])

    nt.links.new(mult.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def make_stylized_pbr_rim_mat(name, base_rgb, rim_rgb=(0.45, 0.78, 1.0), rim_strength=0.45, roughness=0.35):
    """Principled BSDF + Fresnel Rim Light (fast Cycles raytracing without extra AO ray cost)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness

    # Fresnel Rim Light
    fresnel = nt.nodes.new("ShaderNodeLayerWeight")
    fresnel.inputs["Blend"].default_value = 0.28
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.52
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (*rim_rgb, 1.0)

    nt.links.new(fresnel.outputs["Facing"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = rim_strength
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_oak_parquet_mat(name="OakParquet", tint=(1.0, 1.0, 1.0)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.24

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (4.5, 4.5, 1.0)

    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.inputs["Scale"].default_value = 3.0
    brick.inputs["Mortar Size"].default_value = 0.015
    brick.inputs["Color1"].default_value = (0.36 * tint[0], 0.20 * tint[1], 0.09 * tint[2], 1.0)
    brick.inputs["Color2"].default_value = (0.48 * tint[0], 0.28 * tint[1], 0.13 * tint[2], 1.0)
    brick.inputs["Mortar"].default_value = (0.12, 0.07, 0.03, 1.0)

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 6.0

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.14

    nt.links.new(tc.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], brick.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_plaster_wall_mat(name, base_rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85

    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 24.0
    noise.inputs["Detail"].default_value = 5.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08

    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_fabric_mat(name, base_rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.88
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.65

    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 35.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12

    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_emissive_mat(name, rgb, strength=3.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*rgb, 1.0)
    emit.inputs["Strength"].default_value = strength
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_fresnel_brain_mat(name="FresnelBrain"):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 4.5

    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.1
    ramp.color_ramp.elements[0].color = (0.05, 0.45, 1.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (1.0, 0.15, 0.25, 1.0)

    nt.links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_glass_shell_mat(name="GlassShell"):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    gloss = nt.nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Color"].default_value = (0.65, 0.88, 1.0, 1.0)
    gloss.inputs["Roughness"].default_value = 0.08

    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.22

    nt.links.new(lw.outputs["Fresnel"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(gloss.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def _draw_line(buf, w, h, x0, y0, x1, y1, radius, color):
    steps = max(int(math.hypot(x1 - x0, y1 - y0) * 2), 1)
    for i in range(steps + 1):
        t = i / steps
        cx = x0 + (x1 - x0) * t
        cy = y0 + (y1 - y0) * t
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if dx * dx + dy * dy <= radius * radius:
                    px, py = int(cx + dx), int(cy + dy)
                    if 0 <= px < w and 0 <= py < h:
                        idx = (py * w + px) * 4
                        buf[idx : idx + 4] = color


def _draw_circle(buf, w, h, cx, cy, r, color, fill=True, thickness=4):
    for dy in range(-r - thickness, r + thickness + 1):
        for dx in range(-r - thickness, r + thickness + 1):
            d = math.hypot(dx, dy)
            if (fill and d <= r) or (not fill and abs(d - r) <= thickness * 0.5):
                px, py = int(cx + dx), int(cy + dy)
                if 0 <= px < w and 0 <= py < h:
                    idx = (py * w + px) * 4
                    buf[idx : idx + 4] = color


def _draw_arc(buf, w, h, cx, cy, r, a0, a1, thickness, color):
    steps = 80
    for i in range(steps):
        t0 = a0 + (a1 - a0) * (i / steps)
        t1 = a0 + (a1 - a0) * ((i + 1) / steps)
        _draw_line(
            buf,
            w,
            h,
            cx + math.cos(t0) * r,
            cy + math.sin(t0) * r,
            cx + math.cos(t1) * r,
            cy + math.sin(t1) * r,
            thickness,
            color,
        )


def make_face_image(expression: str):
    w, h = 256, 256
    img = bpy.data.images.new(f"face_{expression}", width=w, height=h, alpha=True)
    buf = [0.0] * (w * h * 4)
    dark = [0.06, 0.06, 0.06, 1.0]
    white = [1.0, 1.0, 1.0, 1.0]
    blue = [0.22, 0.74, 0.97, 1.0]

    # Note: Blender image Y=0 is bottom, Y=255 is top
    if expression == "sleeping":
        _draw_arc(buf, w, h, 92, 138, 18, math.pi * 1.15, math.pi * 1.85, 4, dark)
        _draw_arc(buf, w, h, 164, 138, 18, math.pi * 1.15, math.pi * 1.85, 4, dark)
        _draw_arc(buf, w, h, 128, 98, 16, math.pi * 1.15, math.pi * 1.85, 4, dark)
    elif expression == "exhausted":
        # >_< eyes
        _draw_line(buf, w, h, 70, 158, 106, 140, 6, dark)
        _draw_line(buf, w, h, 106, 140, 70, 122, 6, dark)
        _draw_line(buf, w, h, 186, 158, 150, 140, 6, dark)
        _draw_line(buf, w, h, 150, 140, 186, 122, 6, dark)
        # Frown
        _draw_arc(buf, w, h, 128, 72, 22, math.pi * 0.15, math.pi * 0.85, 6, dark)
        # Sweat drop
        _draw_circle(buf, w, h, 204, 178, 14, blue, fill=True)
    elif expression == "confused":
        _draw_circle(buf, w, h, 92, 140, 18, white, fill=True)
        _draw_circle(buf, w, h, 92, 140, 18, dark, fill=False, thickness=6)
        _draw_circle(buf, w, h, 92, 140, 6, dark, fill=True)
        _draw_circle(buf, w, h, 164, 140, 18, white, fill=True)
        _draw_circle(buf, w, h, 164, 140, 18, dark, fill=False, thickness=6)
        _draw_circle(buf, w, h, 164, 140, 6, dark, fill=True)
        _draw_line(buf, w, h, 72, 172, 110, 168, 4, dark)
        _draw_line(buf, w, h, 146, 176, 184, 166, 4, dark)
        _draw_line(buf, w, h, 108, 88, 148, 92, 4, dark)
    elif expression == "zombie":
        _draw_circle(buf, w, h, 92, 138, 16, white, fill=True)
        _draw_circle(buf, w, h, 92, 138, 16, dark, fill=False, thickness=5)
        _draw_circle(buf, w, h, 92, 136, 4, dark, fill=True)
        _draw_circle(buf, w, h, 164, 138, 16, white, fill=True)
        _draw_circle(buf, w, h, 164, 138, 16, dark, fill=False, thickness=5)
        _draw_circle(buf, w, h, 164, 136, 4, dark, fill=True)
        _draw_line(buf, w, h, 72, 148, 112, 148, 5, dark)
        _draw_line(buf, w, h, 144, 148, 184, 148, 5, dark)
        _draw_line(buf, w, h, 108, 86, 148, 86, 4, dark)
    elif expression == "happy" or expression == "doctor":
        _draw_circle(buf, w, h, 94, 144, 10, dark, fill=True)
        _draw_circle(buf, w, h, 162, 144, 10, dark, fill=True)
        _draw_arc(buf, w, h, 94, 164, 16, math.pi * 0.15, math.pi * 0.85, 3, dark)
        _draw_arc(buf, w, h, 162, 164, 16, math.pi * 0.15, math.pi * 0.85, 3, dark)
        # Wide cheerful smile with white teeth
        _draw_arc(buf, w, h, 128, 108, 28, math.pi * 1.1, math.pi * 1.9, 5, dark)
        _draw_line(buf, w, h, 102, 104, 154, 104, 4, dark)

    img.pixels.foreach_set(buf)
    img.pack()
    return img


def make_face_mat(expression: str):
    mat = bpy.data.materials.new(f"FaceMat_{expression}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = make_face_image(expression)

    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def add_solidify_outline(obj, outline_mat, thickness=0.032):
    obj.data.materials.append(outline_mat)
    mod = obj.modifiers.new("Outline", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.material_offset = 1


def build_stickman(name, role="protagonist", expression="happy", outline_mat=None):
    if outline_mat is None:
        outline_mat = make_outline_mat()

    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)

    torso_rgb = (0.96, 0.97, 0.98) if role == "doctor" else (0.96, 0.80, 0.09)
    hair_rgb = (0.35, 0.42, 0.52) if role == "doctor" else (0.32, 0.19, 0.10)
    rim_rgb = (0.25, 0.78, 1.0) if role == "doctor" else (1.0, 0.85, 0.45)

    torso_mat = make_stylized_pbr_rim_mat(f"{name}_Torso", torso_rgb, rim_rgb, 0.4, 0.38)
    head_mat = make_stylized_pbr_rim_mat(f"{name}_Head", (0.98, 0.98, 0.98), (0.55, 0.82, 1.0), 0.35, 0.32)
    hair_mat = make_stylized_pbr_rim_mat(f"{name}_Hair", hair_rgb, (0.9, 0.8, 0.6), 0.2, 0.45)
    limb_mat = make_stylized_pbr_rim_mat(f"{name}_Limb", (0.08, 0.09, 0.11), (0.35, 0.65, 0.95), 0.25, 0.3)

    # Torso Capsule
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.27, location=(0, 0, 0.88))
    torso = bpy.context.active_object
    torso.name = f"{name}_Torso"
    torso.scale = (1.0, 0.85, 1.75)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    torso.data.materials.append(torso_mat)
    add_solidify_outline(torso, outline_mat, 0.028)
    torso.parent = root

    # Belt or Tie
    if role == "protagonist":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.278, depth=0.08, location=(0, 0, 0.68))
        belt = bpy.context.active_object
        belt.scale = (1.0, 0.86, 1.0)
        belt.data.materials.append(make_stylized_pbr_rim_mat(f"{name}_Belt", (0.45, 0.20, 0.06), (0.9, 0.6, 0.2), 0.15, 0.4))
        belt.parent = torso
    else:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.24, 0.96))
        tie = bpy.context.active_object
        tie.scale = (0.04, 0.02, 0.19)
        tie.data.materials.append(make_stylized_pbr_rim_mat(f"{name}_Tie", (0.02, 0.52, 0.82), (0.4, 0.85, 1.0), 0.3, 0.3))
        tie.parent = torso

    # Head Pivot
    head_pivot = bpy.data.objects.new(f"{name}_HeadPivot", None)
    head_pivot.location = (0, 0, 1.70)
    bpy.context.collection.objects.link(head_pivot)
    head_pivot.parent = root

    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=20, radius=0.42, location=(0, 0, 0))
    head = bpy.context.active_object
    head.name = f"{name}_Head"
    head.scale = (1.08, 0.78, 0.96)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    head.data.materials.append(head_mat)
    add_solidify_outline(head, outline_mat, 0.032)
    head.parent = head_pivot

    # Hair Cap
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.43, location=(0, 0.02, 0.12))
    hair = bpy.context.active_object
    hair.scale = (1.10, 0.82, 0.72)
    bpy.ops.object.shade_smooth()
    hair.data.materials.append(hair_mat)
    hair.parent = head_pivot

    # Face Decal Plane (facing -Y towards camera, safely in front of Solidify shell)
    bpy.ops.mesh.primitive_plane_add(size=0.68, location=(0, -0.365, -0.02), rotation=(math.pi / 2, 0, 0))
    face = bpy.context.active_object
    face.name = f"{name}_Face"
    face.data.materials.append(make_face_mat(expression))
    face.parent = head_pivot

    def make_limb(limb_name, pivot_loc, length, radius=0.034, has_hand=True):
        piv = bpy.data.objects.new(f"{name}_{limb_name}", None)
        piv.location = pivot_loc
        bpy.context.collection.objects.link(piv)
        piv.parent = root

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=length, location=(0, 0, -length * 0.5))
        cyl = bpy.context.active_object
        bpy.ops.object.shade_smooth()
        cyl.data.materials.append(limb_mat)
        cyl.parent = piv

        if has_hand:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=10, radius=0.065, location=(0, 0, -length))
            hand = bpy.context.active_object
            bpy.ops.object.shade_smooth()
            hand.data.materials.append(limb_mat)
            hand.parent = piv
        else:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.06, -length))
            foot = bpy.context.active_object
            foot.scale = (0.045, 0.09, 0.028)
            foot.data.materials.append(limb_mat)
            foot.parent = piv
        return piv

    l_arm = make_limb("LeftArm", (-0.28, 0, 1.24), 0.62, 0.032, True)
    r_arm = make_limb("RightArm", (0.28, 0, 1.24), 0.62, 0.032, True)
    l_leg = make_limb("LeftLeg", (-0.12, 0, 0.54), 0.64, 0.034, False)
    r_leg = make_limb("RightLeg", (0.12, 0, 0.54), 0.64, 0.034, False)

    return {
        "root": root,
        "torso": torso,
        "head": head_pivot,
        "face": face,
        "l_arm": l_arm,
        "r_arm": r_arm,
        "l_leg": l_leg,
        "r_leg": r_leg,
    }

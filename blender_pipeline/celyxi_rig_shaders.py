"""Celyxi-style Blender 5.1.2 character rig, procedural shaders, compositor, and motion helpers.

Implements the visual and animation specification in celyxi_style_spec.md for headless
Cycles CPU rendering under Blender 5.1.2.
"""

import math
import random
import bpy
import bmesh
import pytweening
from mathutils import Vector, Euler
from opensimplex import OpenSimplex
from PIL import Image, ImageDraw


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_str: str) -> tuple[float, float, float]:
    h = hex_str.lstrip("#")
    r = srgb_to_linear(int(h[0:2], 16) / 255.0)
    g = srgb_to_linear(int(h[2:4], 16) / 255.0)
    b = srgb_to_linear(int(h[4:6], 16) / 255.0)
    return (r, g, b)


PALETTE = {
    "ink": hex_to_linear("#14100E"),
    "face_white": hex_to_linear("#F6F1E9"),
    "shadow_tint": hex_to_linear("#C8C2CC"),
    "wood_sand": hex_to_linear("#C99D62"),
    "wood_honey": hex_to_linear("#8C5830"),
    "wood_mahogany": hex_to_linear("#3D2114"),
    "sun_key": hex_to_linear("#FFE4B8"),
    "sky_fill": hex_to_linear("#6E8FBD"),
    "sky_deep": hex_to_linear("#283A59"),
    "leather_brown": hex_to_linear("#5A3928"),
    "crimson": hex_to_linear("#B32622"),
    "gold": hex_to_linear("#E6B333"),
    "emerald": hex_to_linear("#1F8A4C"),
    "sweat_cyan": hex_to_linear("#8BE0FF"),
    "relic_glow": hex_to_linear("#FFD466"),
    "dust_cream": hex_to_linear("#FFF2D0"),
    "clerk_shirt": hex_to_linear("#DDD6C8"),
    "clerk_vest": hex_to_linear("#2E2C30"),
}


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link_to_collection(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def _get_channelbag(obj):
    if not obj.animation_data or not obj.animation_data.action:
        return None
    action = obj.animation_data.action
    slot = obj.animation_data.action_slot
    if not action.layers:
        return None
    layer = action.layers[0]
    if not layer.strips:
        return None
    return layer.strips[0].channelbag(slot)


def set_fcurve_interpolation(obj, data_path_prefix=None, interp="BEZIER"):
    """Set interpolation on Blender 5.1 slotted Action channelbag F-Curves."""
    cb = _get_channelbag(obj)
    if cb is None:
        return
    for fc in cb.fcurves:
        if data_path_prefix is None or fc.data_path.startswith(data_path_prefix):
            for kp in fc.keyframe_points:
                kp.interpolation = interp


def setup_celyxi_render_and_compositor(
    res_x=540,
    res_y=960,
    fps=30,
    samples=10,
    exposure=0.2,
    bloom_threshold=1.05,
    bloom_strength=0.45,
    bloom_size=0.65,
    vignette=0.18,
):
    """Configure fast Cycles CPU rendering + AgX + Blender 5.1 Compositor Bloom & Vignette."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.04
    scene.cycles.use_denoising = False  # OIDN adds ~45s/frame on CPU; keep off for fast renders
    scene.cycles.max_bounces = 2
    scene.cycles.diffuse_bounces = 1
    scene.cycles.glossy_bounces = 1
    scene.cycles.transmission_bounces = 2
    scene.cycles.transparent_max_bounces = 6
    scene.cycles.sample_clamp_indirect = 3.5

    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        scene.view_settings.view_transform = "Filmic"
        scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = exposure

    # Blender 5.1 Compositor NodeGroup API
    scene.render.use_compositing = True
    scene.render.compositor_device = "CPU"

    ng = bpy.data.node_groups.new("CelyxiCompositor", "CompositorNodeTree")
    scene.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")

    rl = ng.nodes.new("CompositorNodeRLayers")
    glare = ng.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Quality"].default_value = "High"
    glare.inputs["Threshold"].default_value = bloom_threshold
    glare.inputs["Strength"].default_value = bloom_strength
    glare.inputs["Size"].default_value = bloom_size

    out = ng.nodes.new("NodeGroupOutput")
    ng.links.new(rl.outputs["Image"], glare.inputs["Image"])

    if vignette > 0.0:
        mask = ng.nodes.new("CompositorNodeEllipseMask")
        mask.inputs["Position"].default_value = (0.5, 0.5)
        mask.inputs["Size"].default_value = (0.95, 1.05)

        blur = ng.nodes.new("CompositorNodeBlur")
        blur.inputs["Size"].default_value = (max(res_x * 0.28, 80.0), max(res_y * 0.24, 120.0))

        mix_vig = ng.nodes.new("ShaderNodeMix")
        mix_vig.data_type = "RGBA"
        mix_vig.blend_type = "MULTIPLY"
        mix_vig.inputs[0].default_value = vignette

        # Invert mask smoothly via ColorRamp or mix dark corners with white center
        ramp = ng.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (0.18, 0.14, 0.12, 1.0)
        ramp.color_ramp.elements[1].position = 0.85
        ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)

        ng.links.new(mask.outputs["Mask"], blur.inputs["Image"])
        ng.links.new(blur.outputs["Image"], ramp.inputs["Fac"])
        ng.links.new(glare.outputs["Image"], mix_vig.inputs[6])  # RGBA A
        ng.links.new(ramp.outputs["Color"], mix_vig.inputs[7])  # RGBA B
        ng.links.new(mix_vig.outputs[2], out.inputs[0])
    else:
        ng.links.new(glare.outputs["Image"], out.inputs[0])

    return ng


def set_world_sky(
    top_rgb=(0.14, 0.24, 0.44),
    horizon_rgb=(0.68, 0.56, 0.45),
    strength=0.75,
):
    """Create vertical-gradient sky world and return the Background node for keyframing."""
    world = bpy.data.worlds.new("CelyxiWorld")
    bpy.context.scene.world = world
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength

    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.05
    ramp.color_ramp.elements[0].color = (*horizon_rgb, 1.0)
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[1].color = (*top_rgb, 1.0)

    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return bg


# ---------------------------------------------------------------------------
# Outlines & Procedural Shaders
# ---------------------------------------------------------------------------

def make_celyxi_outline_mat(color=None, name="CelyxiOutline"):
    """Inverted-hull ink outline: visible ONLY to camera rays on outer backface rim."""
    if color is None:
        color = (*PALETTE["ink"], 1.0)
    elif len(color) == 3:
        color = (*color, 1.0)

    mat = bpy.data.materials.new(name)
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


def add_outline(obj, thickness=0.022, mat=None):
    """Apply Solidify inverted-hull outline on slot 1 of obj."""
    if mat is None:
        mat = bpy.data.materials.get("CelyxiOutline") or make_celyxi_outline_mat()
    if len(obj.data.materials) == 0:
        raise ValueError(f"Object {obj.name} needs a base material before add_outline()")
    obj.data.materials.append(mat)
    mod = obj.modifiers.new("CelyxiOutline", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.material_offset = len(obj.data.materials) - 1
    return mod


def _add_fresnel_rim(nt, bsdf, rim_rgb, rim_strength, blend=0.25, edge_start=0.56):
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = blend
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = edge_start
    ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (*rim_rgb, 1.0)
    nt.links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = rim_strength


def make_celyxi_skin_mat(
    name="CelyxiSkin",
    base_rgb=None,
    shadow_rgb=None,
    rim_rgb=None,
    rim_strength=0.42,
):
    """Soft-lit cream-white character head/face material with warm-to-cool depth & Fresnel rim."""
    if base_rgb is None:
        base_rgb = PALETTE["face_white"]
    if shadow_rgb is None:
        shadow_rgb = PALETTE["shadow_tint"]
    if rim_rgb is None:
        rim_rgb = PALETTE["sun_key"]

    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.58

    # Subtle facing tint blending cream-white center with cool lavender-taupe edge shadow
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.22
    col_ramp = nt.nodes.new("ShaderNodeValToRGB")
    col_ramp.color_ramp.elements[0].position = 0.15
    col_ramp.color_ramp.elements[0].color = (*base_rgb, 1.0)
    col_ramp.color_ramp.elements[1].position = 0.85
    col_ramp.color_ramp.elements[1].color = (*shadow_rgb, 1.0)
    nt.links.new(lw.outputs["Facing"], col_ramp.inputs["Fac"])
    nt.links.new(col_ramp.outputs["Color"], bsdf.inputs["Base Color"])

    _add_fresnel_rim(nt, bsdf, rim_rgb, rim_strength, blend=0.25, edge_start=0.62)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_celyxi_cloth_mat(
    name,
    base_rgb,
    pattern="solid",
    accent_rgb=None,
    roughness=0.72,
    rim_rgb=None,
    rim_strength=0.25,
    bump_strength=0.07,
):
    """Stylized cloth/leather shader with procedural weave micro-bump, patterns, and Fresnel rim."""
    if accent_rgb is None:
        accent_rgb = tuple(min(1.0, c * 1.35 + 0.04) for c in base_rgb)
    if rim_rgb is None:
        rim_rgb = PALETTE["sun_key"]

    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.35

    tc = nt.nodes.new("ShaderNodeTexCoord")
    weave = nt.nodes.new("ShaderNodeTexNoise")
    weave.inputs["Scale"].default_value = 55.0
    weave.inputs["Detail"].default_value = 4.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    nt.links.new(tc.outputs["Object"], weave.inputs["Vector"])
    nt.links.new(weave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    if pattern == "stripes":
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.inputs["Scale"].default_value = 8.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (*base_rgb, 1.0)
        ramp.color_ramp.elements[1].position = 0.65
        ramp.color_ramp.elements[1].color = (*accent_rgb, 1.0)
        nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    elif pattern == "dots":
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 14.0
        vor.inputs["Randomness"].default_value = 0.08
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (*accent_rgb, 1.0)
        ramp.color_ramp.elements[1].position = 0.28
        ramp.color_ramp.elements[1].color = (*base_rgb, 1.0)
        nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
        nt.links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    elif pattern == "plaid":
        chk = nt.nodes.new("ShaderNodeTexChecker")
        chk.inputs["Scale"].default_value = 10.0
        chk.inputs["Color1"].default_value = (*base_rgb, 1.0)
        chk.inputs["Color2"].default_value = (*accent_rgb, 1.0)
        nt.links.new(tc.outputs["Object"], chk.inputs["Vector"])
        nt.links.new(chk.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        # Subtle micro-variation so solid surfaces are never dead flat
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs[0].default_value = 0.15
        mix.inputs[6].default_value = (*base_rgb, 1.0)
        mix.inputs[7].default_value = (*accent_rgb, 1.0)
        nt.links.new(weave.outputs["Fac"], mix.inputs[0])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])

    _add_fresnel_rim(nt, bsdf, rim_rgb, rim_strength)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_celyxi_wood_mat(
    name="CelyxiWood",
    color_a=None,
    color_b=None,
    scale=3.2,
    roughness=0.56,
    bump_strength=0.09,
):
    """Stylized wood plank grain using Brick planks + stretched Noise streaks."""
    if color_a is None:
        color_a = PALETTE["wood_honey"]
    if color_b is None:
        color_b = PALETTE["wood_mahogany"]

    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale * 0.28, scale)

    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.inputs["Scale"].default_value = 2.8
    brick.inputs["Mortar Size"].default_value = 0.014
    brick.inputs["Mortar Smooth"].default_value = 0.1
    brick.inputs["Brick Width"].default_value = 0.45
    brick.inputs["Row Height"].default_value = 1.6
    brick.inputs["Color1"].default_value = (*color_a, 1.0)
    brick.inputs["Color2"].default_value = (
        color_a[0] * 0.78 + color_b[0] * 0.22,
        color_a[1] * 0.78 + color_b[1] * 0.22,
        color_a[2] * 0.78 + color_b[2] * 0.22,
        1.0,
    )
    brick.inputs["Mortar"].default_value = (*color_b, 1.0)

    grain_map = nt.nodes.new("ShaderNodeMapping")
    grain_map.inputs["Scale"].default_value = (14.0, 1.8, 6.0)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.5
    noise.inputs["Detail"].default_value = 5.0

    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[0].default_value = 0.22
    nt.links.new(brick.outputs["Color"], mix.inputs[6])
    mix.inputs[7].default_value = (*color_b, 1.0)

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength

    nt.links.new(tc.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], brick.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], grain_map.inputs["Vector"])
    nt.links.new(grain_map.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], mix.inputs[0])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    _add_fresnel_rim(nt, bsdf, PALETTE["sun_key"], 0.12, edge_start=0.68)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_celyxi_dirt_mat(name="CelyxiDirt"):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.9

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (2.8, 0.55, 1.0)

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.5
    noise.inputs["Detail"].default_value = 6.0

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = (*PALETTE["wood_honey"], 1.0)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (*PALETTE["wood_sand"], 1.0)

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.16

    nt.links.new(tc.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_celyxi_gold_mat(name="CelyxiGold", rgb=None, rim_strength=0.35):
    if rgb is None:
        rgb = PALETTE["gold"]
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.86
    bsdf.inputs["Roughness"].default_value = 0.25
    _add_fresnel_rim(nt, bsdf, PALETTE["relic_glow"], rim_strength, edge_start=0.65)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_celyxi_visor_mat(name="CelyxiVisor"):
    """Noise-free translucent emerald green clerk visor (Transparent + Glossy Principled mix)."""
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    transp.inputs["Color"].default_value = (0.35, 0.95, 0.55, 1.0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*PALETTE["emerald"], 1.0)
    bsdf.inputs["Roughness"].default_value = 0.14
    _add_fresnel_rim(nt, bsdf, (0.35, 1.0, 0.55), 0.35, edge_start=0.6)
    mix.inputs["Fac"].default_value = 0.58
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(bsdf.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def make_celyxi_emission_mat(name, color, strength=6.0):
    if len(color) == 3:
        color = (*color, 1.0)
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = color
    emit.inputs["Strength"].default_value = strength
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_celyxi_sweat_mat(name="CelyxiSweat"):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*PALETTE["sweat_cyan"], 1.0)
    bsdf.inputs["Roughness"].default_value = 0.12
    bsdf.inputs["Emission Color"].default_value = (*PALETTE["sweat_cyan"], 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.75
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


# ---------------------------------------------------------------------------
# Crisp PIL Facial Expression Textures & Curved Decal Patch
# ---------------------------------------------------------------------------

EXPRESSION_NAMES = ("neutral", "suspicious", "shocked", "panic", "smug", "blink")


def make_celyxi_face_texture(expression: str, role: str = "sheriff"):
    """Draw crisp 512x512 RGBA @Celyxi cartoon face decal using Pillow."""
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    ink = (20, 16, 14, 255)
    white = (255, 255, 255, 255)
    maroon = (58, 12, 12, 255)
    blush = (240, 168, 158, 115)
    scar = (110, 27, 22, 240)
    stubble = (115, 102, 95, 190)

    # Subtle cheek blush ovals
    draw.ellipse((68, 268, 152, 314), fill=blush)
    draw.ellipse((360, 268, 444, 314), fill=blush)

    # Signature character facial marks
    if role == "sheriff":
        # Stitched red-brown X-scar on left cheek (viewer's right)
        draw.line((352, 206, 418, 264), fill=scar, width=10)
        draw.line((418, 206, 352, 264), fill=scar, width=10)
        draw.line((368, 222, 402, 248), fill=ink, width=4)
    elif role == "clerk":
        # Light stubble dots along lower jaw
        for sx, sy in (
            (172, 392), (198, 408), (228, 420), (256, 424),
            (284, 420), (314, 408), (340, 392),
            (188, 374), (218, 398), (256, 404), (294, 398), (324, 374),
        ):
            draw.ellipse((sx - 4, sy - 4, sx + 4, sy + 4), fill=stubble)

    if expression == "neutral":
        # Confident half-lidded -_-" eyes + heavy brows + smirk
        draw.rounded_rectangle((124, 198, 214, 224), radius=12, fill=ink)
        draw.rounded_rectangle((298, 198, 388, 224), radius=12, fill=ink)
        draw.line((118, 166, 218, 184), fill=ink, width=20)
        draw.line((294, 184, 394, 166), fill=ink, width=20)
        draw.arc((198, 278, 314, 348), start=15, end=160, fill=ink, width=14)

    elif expression == "suspicious":
        # Tightly narrowed glare + angled downward brows + flat tight frown
        draw.rounded_rectangle((128, 206, 216, 224), radius=9, fill=ink)
        draw.rounded_rectangle((296, 206, 384, 224), radius=9, fill=ink)
        draw.line((116, 156, 224, 194), fill=ink, width=22)
        draw.line((288, 194, 396, 156), fill=ink, width=22)
        draw.line((202, 314, 310, 304), fill=ink, width=14)

    elif expression == "shocked":
        # Big white sclera circles with crisp dark outlines & pinprick pupils + O mouth
        for cx in (172, 340):
            draw.ellipse((cx - 56, 162, cx + 56, 274), fill=white, outline=ink, width=12)
            draw.ellipse((cx - 12, 206, cx + 12, 230), fill=ink)
        draw.arc((118, 114, 224, 162), start=195, end=345, fill=ink, width=16)
        draw.arc((288, 114, 394, 162), start=195, end=345, fill=ink, width=16)
        draw.ellipse((212, 298, 300, 392), fill=maroon, outline=ink, width=12)

    elif expression == "panic":
        # Wide O_O sclera + pinpricks + clenched white grid-teeth oval!
        for cx in (172, 340):
            draw.ellipse((cx - 56, 160, cx + 56, 272), fill=white, outline=ink, width=12)
            draw.ellipse((cx - 11, 205, cx + 11, 227), fill=ink)
        draw.arc((116, 108, 224, 154), start=190, end=350, fill=ink, width=16)
        draw.arc((288, 108, 396, 154), start=190, end=350, fill=ink, width=16)
        # Clenched grid-teeth oval
        draw.rounded_rectangle((184, 294, 328, 376), radius=30, fill=white, outline=ink, width=12)
        draw.line((192, 335, 320, 335), fill=ink, width=7)
        for tx in (222, 256, 290):
            draw.line((tx, 298, tx, 372), fill=ink, width=6)

    elif expression == "smug":
        # Happy ^_^ upward arcs + raised brows + wide D-shaped maroon smile + top teeth bar
        draw.arc((124, 176, 218, 246), start=195, end=345, fill=ink, width=18)
        draw.arc((294, 176, 388, 246), start=195, end=345, fill=ink, width=18)
        draw.arc((122, 132, 220, 170), start=195, end=345, fill=ink, width=14)
        draw.arc((292, 132, 390, 170), start=195, end=345, fill=ink, width=14)
        # Wide D-shaped smile
        draw.chord((172, 252, 340, 392), start=0, end=180, fill=maroon, outline=ink, width=12)
        draw.rectangle((184, 316, 328, 334), fill=white)
        draw.line((172, 322, 340, 322), fill=ink, width=12)

    elif expression == "blink":
        # Tight >_< squint / 3-frame blink
        draw.line((128, 190, 214, 216), fill=ink, width=18)
        draw.line((214, 216, 128, 242), fill=ink, width=18)
        draw.line((384, 190, 298, 216), fill=ink, width=18)
        draw.line((298, 216, 384, 242), fill=ink, width=18)
        draw.arc((206, 308, 306, 356), start=195, end=345, fill=ink, width=12)

    # Flip vertically for Blender bottom-up image coordinates & convert to float buffer
    img = img.transpose(Image.FLIP_TOP_BOTTOM)
    pixels = [c / 255.0 for px in img.getdata() for c in px]

    b_img = bpy.data.images.new(f"celyxi_face_{role}_{expression}", width=w, height=h, alpha=True)
    b_img.pixels.foreach_set(pixels)
    b_img.pack()
    return b_img


def make_celyxi_face_mat(expression: str, role: str = "sheriff"):
    mat = bpy.data.materials.new(f"CelyxiFace_{role}_{expression}")
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.45

    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = make_celyxi_face_texture(expression, role)
    tex.extension = "CLIP"

    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def create_curved_face_patch(
    name: str,
    radius: float = 0.376,
    head_scale=(1.03, 0.94, 0.96),
    cols: int = 14,
    rows: int = 14,
    theta_span: float = 1.44,
    phi_span: float = 1.24,
):
    """Build a UV-mapped spherical patch hugging the -Y front hemisphere of the head."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    verts = []
    for r_i in range(rows + 1):
        v_frac = r_i / rows
        phi = (v_frac - 0.5) * phi_span - 0.04  # slightly below equator for hat room
        row_verts = []
        for c_i in range(cols + 1):
            u_frac = c_i / cols
            theta = (u_frac - 0.5) * theta_span
            # Spherical coords centered on -Y axis
            x = radius * math.cos(phi) * math.sin(theta) * head_scale[0]
            y = -radius * math.cos(phi) * math.cos(theta) * head_scale[1]
            z = radius * math.sin(phi) * head_scale[2]
            row_verts.append(bm.verts.new((x, y, z)))
        verts.append(row_verts)

    for r_i in range(rows):
        for c_i in range(cols):
            v00 = verts[r_i][c_i]
            v10 = verts[r_i][c_i + 1]
            v11 = verts[r_i + 1][c_i + 1]
            v01 = verts[r_i + 1][c_i]
            face = bm.faces.new((v00, v10, v11, v01))
            face.smooth = True
            uvs = (
                (c_i / cols, r_i / rows),
                ((c_i + 1) / cols, r_i / rows),
                ((c_i + 1) / cols, (r_i + 1) / rows),
                (c_i / cols, (r_i + 1) / rows),
            )
            for loop, uv in zip(face.loops, uvs):
                loop[uv_layer].uv = uv

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    # Disable shadow casting from transparent decal planes
    obj.visible_shadow = False
    return obj


# ---------------------------------------------------------------------------
# Character Builder (`Sheriff` & `Clerk`)
# ---------------------------------------------------------------------------

def _make_capsule_mesh_obj(name, radius=0.26, height=0.82, scale=(1.0, 0.80, 1.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=radius, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    # Stretch middle ring vertices vertically into a clean rounded capsule
    mesh = obj.data
    half_cyl = max(0.0, (height - 2.0 * radius) * 0.5)
    for v in mesh.vertices:
        if v.co.z > 0.001:
            v.co.z += half_cyl
        elif v.co.z < -0.001:
            v.co.z -= half_cyl
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    mesh.update()
    bpy.ops.object.shade_smooth()
    return obj


def _make_stick_segment(name, length, radius, mat, parent, loc=(0, 0, 0)):
    piv = bpy.data.objects.new(name, None)
    piv.location = loc
    bpy.context.collection.objects.link(piv)
    piv.parent = parent

    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=radius, depth=length, location=(0, 0, -length * 0.5))
    cyl = bpy.context.active_object
    cyl.name = f"{name}_Cyl"
    bpy.ops.object.shade_smooth()
    cyl.data.materials.append(mat)
    cyl.parent = piv
    return piv


def create_celyxi_character(name: str, role: str = "sheriff", location=(0, 0, 0), outline_mat=None):
    """Build an articulated @Celyxi character rig (~1.85m) matching celyxi_style_spec.md."""
    if outline_mat is None:
        outline_mat = bpy.data.materials.get("CelyxiOutline") or make_celyxi_outline_mat()

    root = bpy.data.objects.new(name, None)
    root.location = location
    bpy.context.collection.objects.link(root)

    limb_mat = make_celyxi_cloth_mat(
        f"{name}_Limb", PALETTE["ink"], roughness=0.55, rim_rgb=PALETTE["sky_fill"], rim_strength=0.18
    )
    skin_mat = make_celyxi_skin_mat(f"{name}_Skin")
    gold_mat = make_celyxi_gold_mat(f"{name}_Gold")

    if role == "sheriff":
        torso_mat = make_celyxi_cloth_mat(f"{name}_Coat", PALETTE["leather_brown"], roughness=0.68)
        hair_mat = make_celyxi_cloth_mat(f"{name}_Hair", (0.04, 0.025, 0.018), roughness=0.62)
        kerchief_mat = make_celyxi_cloth_mat(f"{name}_Kerchief", PALETTE["crimson"], roughness=0.72)
    else:
        torso_mat = make_celyxi_cloth_mat(f"{name}_Vest", PALETTE["clerk_vest"], roughness=0.75)
        hair_mat = make_celyxi_cloth_mat(f"{name}_Hair", (0.14, 0.09, 0.06), roughness=0.65)
        shirt_mat = make_celyxi_cloth_mat(f"{name}_Shirt", PALETTE["clerk_shirt"], roughness=0.78)

    # Torso Pivot (z = 0.54 at hip base -> center at z = 0.94, height ~0.82m)
    torso_piv = bpy.data.objects.new(f"{name}_TorsoPivot", None)
    torso_piv.location = (0, 0, 0.54)
    bpy.context.collection.objects.link(torso_piv)
    torso_piv.parent = root

    torso = _make_capsule_mesh_obj(f"{name}_Torso", radius=0.27, height=0.82, scale=(1.04, 0.80, 1.0))
    torso.location = (0, 0, 0.40)
    torso.data.materials.append(torso_mat)
    add_outline(torso, thickness=0.022, mat=outline_mat)
    torso.parent = torso_piv

    # Belt + Square Gold Buckle
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.285, depth=0.07, location=(0, 0, 0.16))
    belt = bpy.context.active_object
    belt.name = f"{name}_Belt"
    belt.scale = (1.03, 0.81, 1.0)
    bpy.ops.object.shade_smooth()
    belt.data.materials.append(
        make_celyxi_cloth_mat(f"{name}_BeltMat", (0.04, 0.025, 0.015), roughness=0.5)
    )
    belt.parent = torso_piv

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.235, 0.16))
    buckle = bpy.context.active_object
    buckle.name = f"{name}_Buckle"
    buckle.scale = (0.095, 0.035, 0.085)
    buckle.data.materials.append(gold_mat)
    add_outline(buckle, thickness=0.008, mat=outline_mat)
    buckle.parent = torso_piv

    if role == "sheriff":
        # Crimson kerchief collar + hanging triangle tip
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.19, minor_radius=0.048, location=(0, -0.02, 0.76), rotation=(0.12, 0, 0)
        )
        collar = bpy.context.active_object
        collar.name = f"{name}_Kerchief"
        bpy.ops.object.shade_smooth()
        collar.data.materials.append(kerchief_mat)
        add_outline(collar, thickness=0.012, mat=outline_mat)
        collar.parent = torso_piv

        bpy.ops.mesh.primitive_cone_add(
            vertices=4, radius1=0.11, depth=0.22, location=(0, -0.21, 0.62), rotation=(math.pi * 0.92, 0, math.pi * 0.25)
        )
        ktip = bpy.context.active_object
        ktip.name = f"{name}_KerchiefTip"
        ktip.scale = (1.0, 0.35, 1.0)
        ktip.data.materials.append(kerchief_mat)
        add_outline(ktip, thickness=0.010, mat=outline_mat)
        ktip.parent = torso_piv

        # 6-point Sheriff Gold Star Badge (bmesh star prism)
        star_mesh = bpy.data.meshes.new(f"{name}_SheriffStarMesh")
        bm = bmesh.new()
        pts_front = []
        pts_back = []
        for si in range(12):
            ang = si * (math.pi / 6.0)
            rad = 0.082 if si % 2 == 0 else 0.042
            pts_front.append(bm.verts.new((math.cos(ang) * rad, -0.012, math.sin(ang) * rad)))
            pts_back.append(bm.verts.new((math.cos(ang) * rad, 0.012, math.sin(ang) * rad)))
        bm.faces.new(pts_front)
        bm.faces.new(list(reversed(pts_back)))
        for si in range(12):
            sn = (si + 1) % 12
            bm.faces.new((pts_front[si], pts_back[si], pts_back[sn], pts_front[sn]))
        bm.to_mesh(star_mesh)
        bm.free()
        star = bpy.data.objects.new(f"{name}_SheriffStar", star_mesh)
        star.location = (-0.13, -0.222, 0.54)
        bpy.context.collection.objects.link(star)
        star.data.materials.append(gold_mat)
        add_outline(star, thickness=0.007, mat=outline_mat)
        star.parent = torso_piv
    else:
        # Clerk shirt collar + brass vest buttons
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.18, minor_radius=0.036, location=(0, -0.02, 0.76)
        )
        collar = bpy.context.active_object
        collar.name = f"{name}_ShirtCollar"
        bpy.ops.object.shade_smooth()
        collar.data.materials.append(shirt_mat)
        add_outline(collar, thickness=0.010, mat=outline_mat)
        collar.parent = torso_piv

        for bi, bz in enumerate((0.58, 0.44, 0.30)):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.024, location=(0, -0.222, bz))
            btn = bpy.context.active_object
            btn.name = f"{name}_Btn_{bi}"
            btn.data.materials.append(gold_mat)
            btn.parent = torso_piv

    # Head Pivot (no neck: sits right on torso dome at z = 1.34m)
    head_pivot = bpy.data.objects.new(f"{name}_HeadPivot", None)
    head_pivot.location = (0, 0, 0.80)  # relative to torso_piv (world z = 1.34)
    bpy.context.collection.objects.link(head_pivot)
    head_pivot.parent = torso_piv

    head_scale = (1.03, 0.94, 0.96)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.37, location=(0, 0, 0.32))
    head = bpy.context.active_object
    head.name = f"{name}_Head"
    head.scale = head_scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    head.data.materials.append(skin_mat)
    add_outline(head, thickness=0.024, mat=outline_mat)
    head.parent = head_pivot

    # Molded 3D Hair Shell Cap (back/top/sides, leaving front face open)
    hair_loc = (0, 0.045, 0.39) if role == "sheriff" else (0, 0.045, 0.37)
    hair_scale = (1.03, 0.90, 0.86) if role == "sheriff" else (1.045, 0.95, 0.92)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.386, location=hair_loc)
    hair = bpy.context.active_object
    hair.name = f"{name}_Hair"
    hair.scale = hair_scale
    bpy.ops.object.shade_smooth()
    hair.data.materials.append(hair_mat)
    add_outline(hair, thickness=0.015, mat=outline_mat)
    hair.parent = head_pivot

    # Hat Pivot (sits atop head for independent tilt & follow-through wobble)
    hat_pivot = bpy.data.objects.new(f"{name}_HatPivot", None)
    hat_pivot.location = (0, 0, 0.62)
    bpy.context.collection.objects.link(hat_pivot)
    hat_pivot.parent = head_pivot

    hat_obj = None
    if role == "sheriff":
        hat_mat = make_celyxi_cloth_mat(f"{name}_Stetson", PALETTE["leather_brown"], roughness=0.66)
        hat_pivot.rotation_euler = (math.radians(-4), math.radians(5), 0)

        # Broad curved Stetson brim
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.58, depth=0.045, location=(0, 0, 0))
        brim = bpy.context.active_object
        brim.name = f"{name}_HatBrim"
        brim.scale = (1.02, 1.12, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for v in brim.data.vertices:
            v.co.z += (v.co.x * v.co.x) * 0.24 - abs(v.co.y) * 0.05
        bpy.ops.object.shade_smooth()
        brim.data.materials.append(hat_mat)
        add_outline(brim, thickness=0.020, mat=outline_mat)
        brim.parent = hat_pivot

        # Crown + Gold Hatband
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.31, depth=0.28, location=(0, 0, 0.14))
        crown = bpy.context.active_object
        crown.name = f"{name}_HatCrown"
        crown.scale = (0.92, 1.04, 1.0)
        bpy.ops.object.shade_smooth()
        crown.data.materials.append(hat_mat)
        add_outline(crown, thickness=0.020, mat=outline_mat)
        crown.parent = hat_pivot

        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.32, depth=0.05, location=(0, 0, 0.04))
        band = bpy.context.active_object
        band.name = f"{name}_HatBand"
        band.scale = (0.92, 1.04, 1.0)
        band.data.materials.append(gold_mat)
        band.parent = hat_pivot
        hat_obj = brim
    else:
        # Clerk: Emerald translucent visor + solid headband + round wire glasses
        hat_pivot.location = (0, -0.04, 0.53)
        hat_pivot.rotation_euler = (math.radians(-10), math.radians(-3), 0)
        visor_mat = make_celyxi_visor_mat(f"{name}_VisorMat")

        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.43, depth=0.022, location=(0, -0.22, -0.02))
        visor = bpy.context.active_object
        visor.name = f"{name}_ClerkVisor"
        visor.scale = (0.95, 0.72, 1.0)
        bpy.ops.object.shade_smooth()
        visor.data.materials.append(visor_mat)
        add_outline(visor, thickness=0.010, mat=outline_mat)
        visor.parent = hat_pivot

        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.38, minor_radius=0.028, location=(0, 0.02, 0.02)
        )
        strap = bpy.context.active_object
        strap.name = f"{name}_VisorStrap"
        strap.scale = (1.02, 0.94, 1.0)
        bpy.ops.object.shade_smooth()
        strap.data.materials.append(limb_mat)
        strap.parent = hat_pivot

        # Round glasses attached to head_pivot
        for gx, side in ((-0.135, "L"), (0.135, "R")):
            bpy.ops.mesh.primitive_torus_add(
                major_radius=0.102, minor_radius=0.011, location=(gx, -0.358, 0.35), rotation=(math.pi / 2, 0, 0)
            )
            gl = bpy.context.active_object
            gl.name = f"{name}_Glass_{side}"
            bpy.ops.object.shade_smooth()
            gl.data.materials.append(limb_mat)
            gl.parent = head_pivot
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=8, radius=0.010, depth=0.08, location=(0, -0.362, 0.36), rotation=(0, math.pi / 2, 0)
        )
        bridge = bpy.context.active_object
        bridge.name = f"{name}_GlassBridge"
        bridge.data.materials.append(limb_mat)
        bridge.parent = head_pivot
        hat_obj = visor

    # Curved Expression Decals (6 expressions pre-built on head_pivot)
    face_parts = {}
    for expr in EXPRESSION_NAMES:
        patch = create_curved_face_patch(f"{name}_Face_{expr}", radius=0.376, head_scale=head_scale)
        patch.location = (0, 0, 0.32)
        patch.data.materials.append(make_celyxi_face_mat(expr, role))
        patch.parent = head_pivot
        is_default = expr == "neutral"
        patch.hide_render = not is_default
        patch.hide_viewport = not is_default
        face_parts[expr] = patch

    # 3D Cyan Sweat Drops (parented to head_pivot, hidden until animate_sweat_drops)
    sweat_mat = make_celyxi_sweat_mat(f"{name}_SweatMat")
    sweat_drops = []
    drop_offsets = ((-0.43, -0.22, 0.40), (0.44, -0.20, 0.34), (-0.41, -0.24, 0.20))
    for di, dloc in enumerate(drop_offsets):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.056, location=(0, 0, 0))
        drop = bpy.context.active_object
        drop.name = f"{name}_Sweat_{di}"
        for v in drop.data.vertices:
            v.co.x *= 0.72
            v.co.y *= 0.65
            v.co.z *= 1.38
            if v.co.z > 0:
                taper = max(0.22, 1.0 - v.co.z * 8.5)
                v.co.x *= taper
                v.co.y *= taper
        drop.data.update()
        drop.location = dloc
        bpy.ops.object.shade_smooth()
        drop.data.materials.append(sweat_mat)
        add_outline(drop, thickness=0.009, mat=outline_mat)
        drop.parent = head_pivot
        drop.hide_render = True
        drop.hide_viewport = True
        sweat_drops.append(drop)

    # Articulated Stick Arms (Shoulder -> Elbow -> Hand Mitt)
    arm_l = _make_stick_segment(f"{name}_ArmL", 0.28, 0.024, limb_mat, torso_piv, loc=(-0.27, 0, 0.68))
    arm_l.rotation_euler = (0, math.radians(-10), 0)
    forearm_l = _make_stick_segment(f"{name}_ForearmL", 0.27, 0.022, limb_mat, arm_l, loc=(0, 0, -0.28))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.045, location=(0, 0, -0.28))
    hand_l = bpy.context.active_object
    hand_l.name = f"{name}_HandL"
    bpy.ops.object.shade_smooth()
    hand_l.data.materials.append(limb_mat)
    hand_l.parent = forearm_l

    arm_r = _make_stick_segment(f"{name}_ArmR", 0.28, 0.024, limb_mat, torso_piv, loc=(0.27, 0, 0.68))
    arm_r.rotation_euler = (0, math.radians(10), 0)
    forearm_r = _make_stick_segment(f"{name}_ForearmR", 0.27, 0.022, limb_mat, arm_r, loc=(0, 0, -0.28))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.045, location=(0, 0, -0.28))
    hand_r = bpy.context.active_object
    hand_r.name = f"{name}_HandR"
    bpy.ops.object.shade_smooth()
    hand_r.data.materials.append(limb_mat)
    hand_r.parent = forearm_r

    # Articulated Stick Legs (Hip -> Knee -> Wedge Foot)
    leg_l = _make_stick_segment(f"{name}_LegL", 0.27, 0.024, limb_mat, root, loc=(-0.11, 0, 0.54))
    shin_l = _make_stick_segment(f"{name}_ShinL", 0.27, 0.022, limb_mat, leg_l, loc=(0, 0, -0.27))
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.04, -0.27))
    foot_l = bpy.context.active_object
    foot_l.name = f"{name}_FootL"
    foot_l.scale = (0.048, 0.095, 0.028)
    foot_l.data.materials.append(limb_mat)
    foot_l.parent = shin_l

    leg_r = _make_stick_segment(f"{name}_LegR", 0.27, 0.024, limb_mat, root, loc=(0.11, 0, 0.54))
    shin_r = _make_stick_segment(f"{name}_ShinR", 0.27, 0.022, limb_mat, leg_r, loc=(0, 0, -0.27))
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.04, -0.27))
    foot_r = bpy.context.active_object
    foot_r.name = f"{name}_FootR"
    foot_r.scale = (0.048, 0.095, 0.028)
    foot_r.data.materials.append(limb_mat)
    foot_r.parent = shin_r

    return {
        "root": root,
        "torso_pivot": torso_piv,
        "torso": torso,
        "head": head_pivot,
        "head_mesh": head,
        "hat_pivot": hat_pivot,
        "hat": hat_obj,
        "arm_l": arm_l,
        "forearm_l": forearm_l,
        "hand_l": hand_l,
        "arm_r": arm_r,
        "forearm_r": forearm_r,
        "hand_r": hand_r,
        "leg_l": leg_l,
        "shin_l": shin_l,
        "leg_r": leg_r,
        "shin_r": shin_r,
        "face_parts": face_parts,
        "sweat_drops": sweat_drops,
    }


def link_character_to_collection(char: dict, col):
    def _walk(obj):
        link_to_collection(obj, col)
        for ch in obj.children:
            _walk(ch)
    _walk(char["root"])


# ---------------------------------------------------------------------------
# Expression Switcher & Continuous 3D Motion / Easing Helpers
# ---------------------------------------------------------------------------

def set_face_expression(char: dict, expr: str = "neutral", frame: int = 1, blink_duration: int = 0):
    """Keyframe visibility of curved face decals on CONSTANT interpolation (Blender 5.1)."""
    if expr not in char["face_parts"]:
        raise ValueError(f"Unknown expression {expr!r}; choose from {EXPRESSION_NAMES}")

    def _apply_at(target_expr: str, f: int):
        for name, obj in char["face_parts"].items():
            vis = name == target_expr
            obj.hide_render = not vis
            obj.hide_viewport = not vis
            obj.keyframe_insert(data_path="hide_render", frame=f)
            obj.keyframe_insert(data_path="hide_viewport", frame=f)
            set_fcurve_interpolation(obj, "hide_", "CONSTANT")

    if blink_duration > 0:
        _apply_at("blink", frame)
        _apply_at(expr, frame + blink_duration)
    else:
        _apply_at(expr, frame)


def animate_ease_out_back(
    obj,
    attr: str,
    start_val,
    end_val,
    f_start: int,
    f_end: int,
    overshoot: float = 1.70158,
    is_deg_euler: bool = False,
):
    """Sample pytweening easeOutBack across [f_start..f_end] for snappy @Celyxi pops."""
    span = max(1, f_end - f_start)
    for f in range(f_start, f_end + 1):
        t = (f - f_start) / span
        e = pytweening.easeOutBack(t, s=overshoot)
        if isinstance(start_val, (tuple, list)):
            val = tuple(s + (d - s) * e for s, d in zip(start_val, end_val))
            if is_deg_euler:
                val = tuple(math.radians(a) for a in val)
        else:
            val = start_val + (end_val - start_val) * e
            if is_deg_euler:
                val = math.radians(val)
        setattr(obj, attr, val)
        obj.keyframe_insert(data_path=attr, frame=f)


def apply_continuous_bob(
    char: dict,
    frame_start: int,
    frame_end: int,
    freq_hz: float = 1.4,
    amp_z: float = 0.022,
    squash: float = 0.025,
    tilt_deg: float = 2.5,
    head_lag_frames: int = 2,
    fps: int = 30,
    step: int = 2,
):
    """Apply continuous squash-and-stretch breathing bob + delayed head/hat follow-through."""
    tp = char["torso_pivot"]
    hp = char["head"]
    hatp = char["hat_pivot"]

    base_z = tp.location.z
    base_tp_rot = tuple(tp.rotation_euler)
    base_hp_rot = tuple(hp.rotation_euler)
    base_hat_rot = tuple(hatp.rotation_euler)

    for f in range(frame_start, frame_end + 1, step):
        t = (f - frame_start) / fps
        w = 2.0 * math.pi * freq_hz * t
        s = math.sin(w)
        s_lag = math.sin(2.0 * math.pi * freq_hz * ((f - head_lag_frames - frame_start) / fps))
        s_hat = math.sin(2.0 * math.pi * freq_hz * ((f - head_lag_frames - 1 - frame_start) / fps))

        tp.location.z = base_z + s * amp_z
        sz = 1.0 + s * squash
        sxy = 1.0 - s * (squash * 0.5)
        tp.scale = (sxy, sxy, sz)
        tp.rotation_euler = (
            base_tp_rot[0] + math.radians(tilt_deg * 0.6 * math.cos(w)),
            base_tp_rot[1] + math.radians(tilt_deg * math.sin(w * 0.5)),
            base_tp_rot[2],
        )
        tp.keyframe_insert(data_path="location", frame=f)
        tp.keyframe_insert(data_path="scale", frame=f)
        tp.keyframe_insert(data_path="rotation_euler", frame=f)

        hp.rotation_euler = (
            base_hp_rot[0] + math.radians(-tilt_deg * 1.1 * s_lag),
            base_hp_rot[1] + math.radians(tilt_deg * 0.7 * math.cos(w * 0.5)),
            base_hp_rot[2],
        )
        hp.keyframe_insert(data_path="rotation_euler", frame=f)

        hatp.rotation_euler = (
            base_hat_rot[0] + math.radians(2.8 * s_hat),
            base_hat_rot[1] + math.radians(2.2 * math.cos(w * 0.5)),
            base_hat_rot[2],
        )
        hatp.keyframe_insert(data_path="rotation_euler", frame=f)


def animate_walk_cycle(
    char: dict,
    frame_start: int,
    frame_end: int,
    start_loc,
    end_loc,
    steps: int = 2,
    swagger_deg: float = 4.5,
    fps: int = 30,
):
    """Animate full stride walk cycle: alternating knees/legs, counter-swinging arms, torso bounce."""
    root = char["root"]
    tp = char["torso_pivot"]
    hp = char["head"]
    hatp = char["hat_pivot"]
    base_tp_z = tp.location.z
    base_hat_rot = tuple(hatp.rotation_euler)

    span = max(1, frame_end - frame_start)
    for f in range(frame_start, frame_end + 1):
        u = (f - frame_start) / span
        # Ease start/stop gently while maintaining confident stride
        e = pytweening.easeInOutSine(u)
        root.location = tuple(s + (d - s) * e for s, d in zip(start_loc, end_loc))
        root.keyframe_insert(data_path="location", frame=f)

        # Fade stride amplitude at very end for smooth stop
        envelope = math.sin(min(1.0, u * 4.0) * math.pi * 0.5) * math.sin(min(1.0, (1.0 - u) * 4.0) * math.pi * 0.5)
        phase = u * steps * 2.0 * math.pi

        stride = math.sin(phase) * envelope
        bounce = abs(math.sin(phase)) * envelope

        tp.location.z = base_tp_z + bounce * 0.045
        tp.rotation_euler = (
            math.radians(3.0 * envelope),
            math.radians(swagger_deg * math.cos(phase) * envelope),
            math.radians(swagger_deg * 0.8 * stride),
        )
        tp.keyframe_insert(data_path="location", frame=f)
        tp.keyframe_insert(data_path="rotation_euler", frame=f)

        hp.rotation_euler = (math.radians(-4.0 * bounce), 0, math.radians(-swagger_deg * 0.6 * stride))
        hp.keyframe_insert(data_path="rotation_euler", frame=f)
        hatp.rotation_euler = (
            base_hat_rot[0] + math.radians(3.5 * math.sin(phase - 0.5) * envelope),
            base_hat_rot[1],
            base_hat_rot[2],
        )
        hatp.keyframe_insert(data_path="rotation_euler", frame=f)

        # Alternating legs + knee bends
        char["leg_l"].rotation_euler = (math.radians(34.0 * stride), 0, 0)
        char["leg_r"].rotation_euler = (math.radians(-34.0 * stride), 0, 0)
        char["shin_l"].rotation_euler = (math.radians(max(0.0, -stride) * 32.0), 0, 0)
        char["shin_r"].rotation_euler = (math.radians(max(0.0, stride) * 32.0), 0, 0)

        # Counter-swinging arms + slight elbow curve
        char["arm_l"].rotation_euler = (math.radians(-28.0 * stride), math.radians(-10.0), 0)
        char["arm_r"].rotation_euler = (math.radians(28.0 * stride), math.radians(10.0), 0)
        char["forearm_l"].rotation_euler = (math.radians(-22.0), 0, 0)
        char["forearm_r"].rotation_euler = (math.radians(-22.0), 0, 0)

        for part in ("leg_l", "leg_r", "shin_l", "shin_r", "arm_l", "arm_r", "forearm_l", "forearm_r"):
            char[part].keyframe_insert(data_path="rotation_euler", frame=f)


def animate_arm_gesture(
    char: dict,
    side: str,
    frame_start: int,
    frame_end: int,
    shoulder_start_deg,
    shoulder_end_deg,
    elbow_start_deg=(0, 0, 0),
    elbow_end_deg=(0, 0, 0),
    ease: str = "out_back",
):
    """Animate upper arm + forearm smoothly using pytweening."""
    arm = char[f"arm_{side}"]
    forearm = char[f"forearm_{side}"]
    span = max(1, frame_end - frame_start)
    for f in range(frame_start, frame_end + 1):
        t = (f - frame_start) / span
        e = pytweening.easeOutBack(t, s=1.5) if ease == "out_back" else pytweening.easeInOutCubic(t)
        arm.rotation_euler = tuple(
            math.radians(s + (d - s) * e) for s, d in zip(shoulder_start_deg, shoulder_end_deg)
        )
        forearm.rotation_euler = tuple(
            math.radians(s + (d - s) * e) for s, d in zip(elbow_start_deg, elbow_end_deg)
        )
        arm.keyframe_insert(data_path="rotation_euler", frame=f)
        forearm.keyframe_insert(data_path="rotation_euler", frame=f)


def animate_tremble(
    char: dict,
    frame_start: int,
    frame_end: int,
    amp: float = 0.013,
    freq_hz: float = 11.0,
    fps: int = 30,
    seed: int = 7,
):
    """High-frequency nervous OpenSimplex tremor on torso & head."""
    noise = OpenSimplex(seed=seed)
    tp = char["torso_pivot"]
    hp = char["head"]
    base_loc = tuple(tp.location)
    base_rot = tuple(hp.rotation_euler)

    for f in range(frame_start, frame_end + 1):
        t = (f - frame_start) / fps
        nx = noise.noise2(t * freq_hz, 0.0)
        nz = noise.noise2(0.0, t * freq_hz)
        tp.location = (base_loc[0] + nx * amp, base_loc[1], base_loc[2] + abs(nz) * amp * 0.7)
        tp.keyframe_insert(data_path="location", frame=f)
        hp.rotation_euler = (
            base_rot[0] + math.radians(nz * 2.4),
            base_rot[1] + math.radians(nx * 2.8),
            base_rot[2],
        )
        hp.keyframe_insert(data_path="rotation_euler", frame=f)


def animate_sweat_drops(char: dict, frame_start: int, frame_end: int, active: bool = True, fps: int = 30):
    """Show, pulse, and slide cyan cartoon sweat drops down temple during panic beats."""
    for di, drop in enumerate(char["sweat_drops"]):
        base_loc = tuple(drop.location)
        drop.hide_render = not active
        drop.hide_viewport = not active
        drop.keyframe_insert(data_path="hide_render", frame=frame_start)
        drop.keyframe_insert(data_path="hide_viewport", frame=frame_start)
        set_fcurve_interpolation(drop, "hide_", "CONSTANT")

        if not active:
            continue

        for f in range(frame_start, frame_end + 1, 2):
            cycle = ((f - frame_start + di * 8) % 24) / 24.0
            pop = 0.78 + 0.36 * math.sin(cycle * math.pi)
            drop.location = (base_loc[0], base_loc[1], base_loc[2] - cycle * 0.14)
            drop.scale = (pop, pop, pop)
            drop.keyframe_insert(data_path="location", frame=f)
            drop.keyframe_insert(data_path="scale", frame=f)

        drop.hide_render = True
        drop.hide_viewport = True
        drop.keyframe_insert(data_path="hide_render", frame=frame_end + 1)
        drop.keyframe_insert(data_path="hide_viewport", frame=frame_end + 1)
        set_fcurve_interpolation(drop, "hide_", "CONSTANT")


# ---------------------------------------------------------------------------
# Camera Rig, Handheld Micro-Float & Floating Dust Motes
# ---------------------------------------------------------------------------

def create_camera_rig(
    name: str = "MainCamera",
    loc=(0.0, -4.0, 1.35),
    rot_deg=(88.0, 0.0, 0.0),
    lens: float = 42.0,
    fstop: float = 2.8,
    focus_dist: float = 4.0,
):
    """Create a parented CameraRig (for micro-float) + MainCamera (for clean dolly/cuts + DOF)."""
    rig = bpy.data.objects.new(f"{name}_Rig", None)
    bpy.context.collection.objects.link(rig)

    bpy.ops.object.camera_add(location=loc, rotation=tuple(math.radians(a) for a in rot_deg))
    cam = bpy.context.active_object
    cam.name = name
    cam.data.lens = lens
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = fstop
    cam.data.dof.focus_distance = focus_dist
    cam.parent = rig
    bpy.context.scene.camera = cam
    return {"rig": rig, "cam": cam}


def animate_camera_handheld(
    cam_rig_obj,
    frame_start: int,
    frame_end: int,
    amp_loc: float = 0.010,
    amp_rot_deg: float = 0.35,
    fps: int = 30,
    seed: int = 19,
):
    """Layer smooth OpenSimplex handheld micro-float onto CameraRig parent empty."""
    noise = OpenSimplex(seed=seed)
    for f in range(frame_start, frame_end + 1, 2):
        t = f / fps
        cam_rig_obj.location = (
            noise.noise2(t * 1.1, 1.0) * amp_loc,
            noise.noise2(t * 0.9, 5.0) * amp_loc * 0.5,
            noise.noise2(t * 1.3, 9.0) * amp_loc,
        )
        cam_rig_obj.rotation_euler = (
            math.radians(noise.noise2(t * 1.0, 13.0) * amp_rot_deg * 0.6),
            math.radians(noise.noise2(t * 1.2, 17.0) * amp_rot_deg),
            math.radians(noise.noise2(t * 0.8, 21.0) * amp_rot_deg * 0.6),
        )
        cam_rig_obj.keyframe_insert(data_path="location", frame=f)
        cam_rig_obj.keyframe_insert(data_path="rotation_euler", frame=f)


def spawn_dust_motes(
    col,
    count: int = 32,
    bounds=((-2.2, 2.2), (-1.5, 4.5), (0.3, 3.0)),
    frame_start: int = 1,
    frame_end: int = 300,
    seed: int = 42,
):
    """Spawn drifting glowing warm dust motes through light shafts."""
    rng = random.Random(seed)
    mote_mat = make_celyxi_emission_mat("CelyxiDustMote", PALETTE["dust_cream"], strength=3.2)
    motes = []
    for i in range(count):
        x0 = rng.uniform(*bounds[0])
        y0 = rng.uniform(*bounds[1])
        z0 = rng.uniform(*bounds[2])
        r = rng.uniform(0.009, 0.018)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=(x0, y0, z0))
        mote = bpy.context.active_object
        mote.name = f"DustMote_{i}"
        mote.visible_shadow = False
        mote.data.materials.append(mote_mat)
        link_to_collection(mote, col)

        vx = rng.uniform(-0.08, 0.08)
        vy = rng.uniform(-0.06, 0.06)
        vz = rng.uniform(0.04, 0.14)
        phase = rng.uniform(0, math.tau)
        for f in range(frame_start, frame_end + 1, 15):
            t = (f - frame_start) / 30.0
            mote.location = (
                x0 + vx * t + math.sin(t * 1.4 + phase) * 0.08,
                y0 + vy * t,
                z0 + vz * t + math.cos(t * 1.1 + phase) * 0.06,
            )
            mote.keyframe_insert(data_path="location", frame=f)
        motes.append(mote)
    return motes

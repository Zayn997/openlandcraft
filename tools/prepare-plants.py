"""Run with Blender --background --python tools/prepare-plants.py -- <Nature Kit folder>.

Builds the curated CC0 collection with one vertex-colored mesh/material per plant,
meter scale, a bottom-center origin, self-contained GLBs and rendered thumbnails.
The source pack is available at https://kenney.nl/assets/nature-kit.
"""
import bpy
import bmesh
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[sys.argv.index('--') + 1])
DEST = ROOT / 'apps/web/public/models/plants'
DEST.mkdir(parents=True, exist_ok=True)
PLANTS = [
    ('pine', 'Pine', 'tree_pineRoundA', 5.0, 'Trees'),
    ('oak', 'Oak', 'tree_oak', 5.5, 'Trees'),
    ('palm', 'Palm', 'tree_palm', 5.0, 'Trees'),
    ('shrub', 'Shrub', 'plant_bushDetailed', 1.2, 'Ground cover'),
    ('grass', 'Grass tuft', 'grass_large', 0.6, 'Ground cover'),
    ('flowers', 'Yellow flowers', 'flower_yellowC', 0.65, 'Flowers'),
]

def enum(owner, prop, value):
    values = {item.identifier for item in owner.bl_rna.properties[prop].enum_items}
    if value not in values:
        raise ValueError(f'{prop}: {value} unavailable; expected one of {values}')
    return value

manifest = []
def linear_color(hex_value):
    rgb = [int(hex_value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb) + (1,)

for slug, name, filename, height, category in PLANTS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    src = SOURCE / 'Models/GLTF format' / (filename + '.glb')
    bpy.ops.import_scene.gltf(filepath=str(src))
    meshes = [obj for obj in scene.objects if obj.type == 'MESH']
    before = sum(len(obj.data.polygons) for obj in meshes)
    # Bake source transforms before joining, so export has no empty hierarchy.
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = matrix
    select_actions = {item.identifier for item in bpy.ops.object.select_all.get_rna_type().properties['action'].enum_items}
    assert 'DESELECT' in select_actions
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=0.000001)
    bm.to_mesh(mesh)
    bm.free()
    # Kenney's models use flat material colors; preserve them as vertex colors.
    colors = mesh.color_attributes.new(name='PlantColor', type='FLOAT_COLOR', domain='CORNER')
    for face in mesh.polygons:
        mat = mesh.materials[face.material_index]
        node = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat.use_nodes else None
        if node and node.inputs['Base Color'].is_linked:
            raise ValueError(f'{filename}: texture baking required')
        color = node.inputs['Base Color'].default_value[:] if node else mat.diffuse_color[:]
        material_name = mat.name.lower()
        if 'leaf' in material_name or 'grass' in material_name:
            color = linear_color('6f8755' if 'dark' in material_name else '8fa86d')
        elif 'wood' in material_name:
            color = linear_color('80674d')
        elif 'yellow' in material_name:
            color = linear_color('d6b758')
        for loop in face.loop_indices:
            colors.data[loop].color = color
        face.material_index = 0
    mesh.materials.clear()
    mat = bpy.data.materials.new('Plant vertex colors')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.9
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'PlantColor'
    mat.node_tree.links.new(vertex.outputs['Color'], bsdf.inputs['Base Color'])
    mesh.materials.append(mat)
    bounds = [Vector(v) for v in obj.bound_box]
    lo = Vector([min(p[i] for p in bounds) for i in range(3)])
    hi = Vector([max(p[i] for p in bounds) for i in range(3)])
    factor = height / (hi.z - lo.z)
    center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in mesh.vertices:
        v.co = (v.co - center) * factor
    mesh.update()
    mesh.calc_loop_triangles()
    output = DEST / (slug + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                              export_animations=False, export_cameras=False, export_lights=False,
                              export_texcoords=False)
    manifest.append(dict(id=slug, name=name, source=filename+'.glb', category=category,
                         height=height, triangles=len(mesh.loop_triangles), sourceFaces=before,
                         sourceBytes=src.stat().st_size, bytes=output.stat().st_size,
                         url=f'/models/plants/{slug}.glb', thumbnail=f'/models/plants/{slug}.png'))
    # Render the optimized asset itself, using a consistent orthographic studio view.
    for other in list(scene.objects):
        if other != obj:
            bpy.data.objects.remove(other, do_unlink=True)
    bpy.context.view_layer.update()
    size = max(obj.dimensions)
    target = Vector((0, 0, height * 0.5))
    bpy.ops.object.camera_add(location=target + Vector((1.2, -1.8, 0.9)) * size)
    camera = bpy.context.object
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = enum(camera.data, 'type', 'ORTHO')
    camera.data.ortho_scale = size * 1.35
    scene.camera = camera
    bpy.ops.object.light_add(type='AREA', location=target+Vector((1, -2, 3))*size)
    light = bpy.context.object
    light.rotation_euler = (target-light.location).to_track_quat('-Z', 'Y').to_euler()
    light.data.energy = 160 * size * size
    light.data.shape = enum(light.data, 'shape', 'DISK')
    light.data.size = size * 3
    scene.world = bpy.data.worlds.new('Studio')
    scene.world.use_nodes = True
    background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (0.65, 0.7, 0.6, 1)
    background.inputs['Strength'].default_value = 0.7
    try:
        scene.render.engine = 'CYCLES'
    except TypeError as error:
        raise RuntimeError(str(error))
    scene.cycles.samples = 16
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = enum(scene.render.image_settings, 'file_format', 'PNG')
    scene.render.image_settings.color_mode = enum(scene.render.image_settings, 'color_mode', 'RGBA')
    scene.render.filepath = str(DEST / (slug + '.png'))
    bpy.ops.render.render(write_still=True)

(ROOT / 'apps/web/src/plant-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf8')
(DEST / 'LICENSE.txt').write_text((SOURCE / 'License.txt').read_text(), encoding='utf8')
print('PLANT_MANIFEST', json.dumps(manifest))

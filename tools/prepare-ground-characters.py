"""Blender --background --disable-autoexec --python tools/prepare-ground-characters.py.

Curates Quaternius CC0 horse and casual people from .reference/characters.
Keeps only baked Idle/Walk clips, meter dimensions, and embedded matte materials.
Source URLs and license records are shipped beside the generated models.
"""
import bpy
import math
import json
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/web/public/models/characters'
DEST.mkdir(parents=True, exist_ok=True)

for source_name, slug, height, identity in [
    ('Horse', 'horse', 2.1, 'horse-walk-v1'),
    ('Casual_Male', 'person-male', 1.78, 'person-walk-v1'),
    ('Casual_Female', 'person-female', 1.68, 'person-walk-v1'),
]:
    source = next((ROOT / '.reference/characters').rglob(source_name + '.blend'))
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == 'MESH']
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    # The old source materials use Blender Internal nodes. Rebuild portable PBR.
    for mat in bpy.data.materials:
        color = tuple(mat.diffuse_color)
        if mat.name == 'Skin': color = (0.48, 0.27, 0.15, 1) if source_name.endswith('Male') else (0.65, 0.41, 0.27, 1)
        if mat.name == 'Shirt': color = (0.08, 0.18, 0.24, 1) if source_name.endswith('Male') else (0.32, 0.16, 0.11, 1)
        if mat.name == 'Pants': color = (0.085, 0.095, 0.075, 1)
        if mat.name == 'Face': color = (0.12, 0.09, 0.065, 1)
        mat.use_nodes = True
        mat.node_tree.nodes.clear()
        output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        bsdf = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = 0.9
        mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        mat.diffuse_color = color
    if source_name != 'Horse':
        shoe = bpy.data.materials.new('Shoes'); shoe.diffuse_color = (0.045,0.05,0.045,1); shoe.use_nodes = True
        shoe.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = shoe.diffuse_color
        shoe.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 0.9
        for mesh in meshes:
            index = len(mesh.data.materials); mesh.data.materials.append(shoe)
            low = min(v.co.z for v in mesh.data.vertices)
            for face in mesh.data.polygons:
                if max(mesh.data.vertices[i].co.z for i in face.vertices) < low+0.2: face.material_index = index
    for o in scene.objects:
        o.select_set(False)
        if o.animation_data:
            o.animation_data.action = None
            for track in list(o.animation_data.nla_tracks): o.animation_data.nla_tracks.remove(track)
    actions = {name: bpy.data.actions[name] for name in ['Idle', 'Walk']}
    for action in list(bpy.data.actions):
        if action not in actions.values(): bpy.data.actions.remove(action)
    rig.animation_data_create()
    rig.animation_data.action = actions['Idle']
    scene.frame_set(0)
    bpy.context.view_layer.update()
    points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    root = bpy.data.objects.new(slug, None)
    scene.collection.objects.link(root)
    rig.parent = root
    scale = height / (max(p.z for p in points) - min(p.z for p in points))
    root.scale = (scale,) * 3
    root.location = (-(min(p.x for p in points)+max(p.x for p in points))/2*scale,
                     -(min(p.y for p in points)+max(p.y for p in points))/2*scale,
                     -min(p.z for p in points)*scale)
    root['openlandcraftAnimation'] = identity
    # Keep two independent NLA tracks: glTF bakes IK constraints into deform bones.
    rig.animation_data.action = None
    for name, action in actions.items():
        track = rig.animation_data.nla_tracks.new(); track.name = name
        strip = track.strips.new(name, 0, action)
        strip.action_frame_start = action.frame_range[0]
        strip.action_frame_end = action.frame_range[1]
        # Horse Walk returns to its first pose at source frame 32. The action's
        # padded 64-frame range otherwise bakes a frozen second half into glTF.
        if source_name == 'Horse' and name == 'Walk': strip.action_frame_end = 32
        track.mute = name != 'Idle'
    scene.render.fps = 30
    scene.frame_start = 0; scene.frame_end = 150 if source_name == 'Horse' else 100
    for o in [root, rig, *meshes]: o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(DEST / (slug + '.glb')), export_format='GLB',
        use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=True, export_extras=True, export_anim_slide_to_zero=True)
    data = (DEST / (slug + '.glb')).read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+length])
    print('PREPARED', slug, height, [(a['name'], len(a['channels'])) for a in doc.get('animations', [])])
    # Strip imported hidden scene props and pack the portable materials/source rig.
    for o in list(scene.objects):
        if o not in [root, rig, *meshes]: bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(DEST / (slug + '.blend')))
    camera_data = bpy.data.cameras.new('Preview'); camera = bpy.data.objects.new('Preview', camera_data)
    scene.collection.objects.link(camera); scene.camera = camera
    camera.location = (4,-6,3.3); target = Vector((0,0,height*0.48))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type = 'ORTHO'; camera_data.ortho_scale = height * (1.65 if source_name == 'Horse' else 1.3)
    for name, loc, power, size in [('Key',(-3,-4,6),450,5),('Fill',(4,2,4),300,4)]:
        light = bpy.data.lights.new(name,'AREA'); light.energy = power; light.size = size
        obj = bpy.data.objects.new(name,light); scene.collection.objects.link(obj); obj.location = loc
        obj.rotation_euler = (target-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
    scene.world = bpy.data.worlds.new('Preview world'); scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (0.5,0.5,0.5,1)
    scene.render.film_transparent = True
    scene.render.resolution_x = 256; scene.render.resolution_y = 256; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.filepath = str(DEST / (slug + '.png'))
    scene.frame_set(0)
    bpy.ops.render.render(write_still=True)

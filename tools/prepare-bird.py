"""Blender --background --python tools/prepare-bird.py -- <bird_0.blend>.

CC0 source: https://opengameart.org/content/bird (Fabio Gonzalez / noway).
Recolors the mesh, retains its skin weights, and authors a seamless flight cycle.
"""
import bpy
import math
import sys
import json
import struct
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/web/public/models/birds'
DEST.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
with bpy.data.libraries.load(sys.argv[sys.argv.index('--') + 1], link=False) as (src, dst):
    dst.objects = ['Bird', 'Bird Armature']
for obj in dst.objects:
    scene.collection.objects.link(obj)
mesh = next(o for o in dst.objects if o.type == 'MESH')
mesh.data.validate()
rig = next(o for o in dst.objects if o.type == 'ARMATURE')
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)

# An untextured, warm grey bird with dark flight feathers and an amber beak.
mesh.data.materials.clear()
mat = bpy.data.materials.new('Songbird plumage'); mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Roughness'].default_value = 0.85
vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor'); vertex.layer_name = 'Plumage'
mat.node_tree.links.new(vertex.outputs['Color'], bsdf.inputs['Base Color'])
mesh.data.materials.append(mat)
colors = mesh.data.color_attributes.new(name='Plumage', type='BYTE_COLOR', domain='CORNER')
for poly in mesh.data.polygons:
    center = sum((mesh.data.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
    x,y,z = center
    rgb = (0.09,0.065,0.04) if abs(x)>0.65 else (0.23,0.18,0.11)
    if y<0.98 and abs(x)<0.4: rgb = (0.48,0.4,0.28)
    if z<-0.72 and abs(x)<0.16: rgb = (0.7,0.38,0.08)
    for loop in poly.loop_indices: colors.data[loop].color = (*rgb,1)
    poly.use_smooth = False

# Normalize wingspan to 1.2 m; pitch the standing base mesh into a flight posture.
root = bpy.data.objects.new('Songbird', None); scene.collection.objects.link(root)
rig.parent = root
root.scale = (1.2/2.947528,)*3
root.rotation_euler.x = math.radians(-24)
root.rotation_euler.z = math.pi
root['openlandcraftAnimation'] = 'bird-flight-v1'

def rotate_bone(name, angle, axis=(0,0,1)):
    bone = rig.pose.bones[name]
    rest = bone.bone.matrix_local.to_quaternion()
    bone.rotation_mode = 'QUATERNION'
    bone.rotation_quaternion = rest.inverted() @ Quaternion(axis,angle) @ rest

scene.render.fps = 30; scene.frame_start = 0; scene.frame_end = 24
for name in ['Bone.013', 'Bone.017']:
    rotate_bone(name, 1.1, (1,0,0))
for frame in range(0,25):
    t = frame/24 * math.tau
    # Slightly faster downstroke; the outer wing lags at each reversal.
    flap = 0.64*math.sin(t+0.18*math.sin(t)) + 0.08
    tip = 0.22*math.sin(t-0.55)
    for name,angle in [('Bone',flap),('Bone.004',-flap),('Bone.002',tip),('Bone.006',-tip)]:
        rotate_bone(name,angle)
        rig.pose.bones[name].keyframe_insert('rotation_quaternion',frame=frame)
if rig.animation_data and rig.animation_data.action:
    action = rig.animation_data.action; action.name = 'Flight'
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points: key.interpolation = 'LINEAR'
scene.frame_set(0)
bpy.context.view_layer.update()
points = [mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
root.location = (-(min(v.x for v in points)+max(v.x for v in points))/2,
                 -(min(v.y for v in points)+max(v.y for v in points))/2,
                 -min(v.z for v in points))
bpy.context.view_layer.update()
for o in scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(DEST/'songbird.glb'), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_frame_range=True,
    export_force_sampling=True, export_extras=True)
# Give the single baked action a stable, engine-independent name.
glb = (DEST/'songbird.glb').read_bytes()
length = struct.unpack_from('<I',glb,12)[0]
doc = json.loads(glb[20:20+length]); doc['animations'][0]['name']='Flight'
payload = json.dumps(doc,separators=(',',':')).encode()
payload += b' ' * ((-len(payload)) % 4)
tail = glb[20+length:]
(DEST/'songbird.glb').write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),0x4e4f534a)+payload+tail)
bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'songbird.blend'))

# Transparent catalog preview using the actual asset.
camera_data=bpy.data.cameras.new('Preview'); camera=bpy.data.objects.new('Preview',camera_data)
scene.collection.objects.link(camera); scene.camera=camera
camera.location=(1.5,-2.4,1.6); target=Vector((0,0,0.25))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'; camera_data.ortho_scale=1.65
for name,loc,power,size in [('Key',(-2,-3,5),350,4),('Fill',(3,1,3),200,3)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Preview world'); scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(0.5,0.5,0.5,1)
scene.render.film_transparent=True; scene.render.resolution_x=256; scene.render.resolution_y=256; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(DEST/'songbird.png')
bpy.ops.render.render(write_still=True)
print('Bird prepared:', (DEST/'songbird.glb').stat().st_size, 'bytes')

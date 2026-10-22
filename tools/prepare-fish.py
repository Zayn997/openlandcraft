"""Prepare joyfulsquirrel's CC0 fish: Blender --background --python tools/prepare-fish.py -- <fish.blend>."""
import bpy, math, sys, json, struct
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/web/public/models/fish'
DEST.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(sys.argv[sys.argv.index('--') + 1]).resolve()))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
rig = bpy.data.objects['Armature']; mesh = bpy.data.objects['fish']
rig.animation_data_clear()
for bone in rig.pose.bones: bone.matrix_basis = Matrix.Identity(4)
for image in bpy.data.images:
    if image.source == 'FILE': image.pack()
# Rebuild the round source silhouette around its retained rig: tapered body,
# forked caudal fin, swept paired fins, and small lateral eyes. One shared mesh
# and vertex-colored material keep this suitable for the real-time viewer.
verts=[]; faces=[]; colors=[]; weights=[]
def vertex(point,color,skin):
    verts.append(point); colors.append(color); weights.append(skin); return len(verts)-1
def body_skin(y):
    if y<0.04: return {'body':1.0}
    if y<0.32:
        t=(y-0.04)/0.28; return {'body':1-t,'spine':t}
    t=min(1,(y-0.32)/0.28); return {'spine':1-t,'peduncle':t}
def shade(z,rz,y):
    t=(z/rz+1)/2
    belly=Vector((0.63,0.69,0.64)); flank=Vector((0.28,0.43,0.40)); back=Vector((0.045,0.12,0.13))
    rgb=belly.lerp(flank,min(1,t/0.6)) if t<0.6 else flank.lerp(back,(t-0.6)/0.4)
    # Narrow, muted lateral line; color variation is deliberately subtle.
    if abs(z/rz-0.12)<0.13: rgb*=0.84
    return (*rgb,1)
profile=[(-0.47,0.012,0.022),(-0.43,0.052,0.060),(-0.36,0.098,0.112),
 (-0.22,0.140,0.158),(-0.04,0.152,0.175),(0.15,0.125,0.150),
 (0.32,0.082,0.105),(0.47,0.044,0.057),(0.57,0.026,0.033),(0.63,0.022,0.028)]
segments=20
for y,rx,rz in profile:
    for j in range(segments):
        angle=j*math.tau/segments; x=rx*math.cos(angle); z=rz*math.sin(angle)
        vertex((x,y,z),shade(z,rz,y),body_skin(y))
for i in range(len(profile)-1):
    for j in range(segments):
        n=(j+1)%segments; faces.append((i*segments+j,i*segments+n,(i+1)*segments+n,(i+1)*segments+j))
faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+j for j in range(segments))])
body_faces=len(faces)
# Closed thin membranes avoid sorting artifacts from transparent fins.
def fin(points,bone,thickness=0.006,axis=0):
    first=len(verts); n=len(points)
    for side in [-1,1]:
        for i,p in enumerate(points):
            q=list(p); q[axis]+=side*thickness/2
            color=(0.17,0.25,0.20,1) if i in [0,n-1] else (0.25,0.32,0.23,1)
            vertex(q,color,{bone:1})
    faces.append(tuple(first+i for i in reversed(range(n))));faces.append(tuple(first+n+i for i in range(n)))
    for i in range(n): j=(i+1)%n; faces.append((first+i,first+j,first+n+j,first+n+i))
fin([(0,.61,-.026),(0,.80,-.185),(0,.855,-.17),(0,.76,0),(0,.855,.17),(0,.80,.185),(0,.61,.026)],'tail_fin')
fin([(0,-.22,.15),(0,-.10,.285),(0,.025,.25),(0,.23,.16),(0,.36,.095)],'top_fin')
fin([(0,.06,-.16),(0,.17,-.235),(0,.41,-.10),(0,.44,-.064)],'spine')
for sign,bone in [(1,'left_fin'),(-1,'right_fin')]:
    fin([(sign*.13,-.17,-.025),(sign*.265,.10,-.09),(sign*.21,.12,-.10),(sign*.11,-.045,-.08)],bone,axis=2)
    fin([(sign*.065,-.03,-.15),(sign*.11,.16,-.22),(sign*.04,.12,-.145)],'body',axis=0)
# Lateral eyes have a narrow bronze iris and a dark pupil, not white eyeballs.
for sign in [-1,1]:
    first=len(verts); rings=6; sides=12
    for i in range(rings+1):
        phi=math.pi*i/rings
        for j in range(sides):
            theta=math.tau*j/sides
            x=sign*(.092+.014*math.cos(phi));y=-.35+.026*math.sin(phi)*math.cos(theta);z=.045+.026*math.sin(phi)*math.sin(theta)
            color=(.008,.012,.011,1) if i<3 else (.24,.23,.12,1)
            vertex((x,y,z),color,{'body':1})
    for i in range(rings):
        for j in range(sides):
            n=(j+1)%sides; faces.append((first+i*sides+j,first+i*sides+n,first+(i+1)*sides+n,first+(i+1)*sides+j))
# Short gill-cover seams follow the flank rather than painted cartoon features.
for sign in [-1,1]:
    first=len(verts)
    for z,x in [(-.08,.112),(-.025,.137),(.04,.135),(.10,.105)]:
        for offset in [-.005,.005]: vertex((sign*x,-.235+offset,z),(.10,.19,.18,1),{'body':1})
    for j in range(3): faces.append(tuple(first+i for i in [j*2,j*2+1,j*2+3,j*2+2]))
data=bpy.data.meshes.new('Streamlined fish');data.from_pydata(verts,[],faces);data.update()
mesh.data=data
for group in list(mesh.vertex_groups): mesh.vertex_groups.remove(group)
for name in ['body','spine','peduncle','tail_fin','top_fin','left_fin','right_fin']: mesh.vertex_groups.new(name=name)
for i,skin in enumerate(weights):
    for name,weight in skin.items():
        if weight>0: mesh.vertex_groups[name].add([i],weight,'REPLACE')
# Preserve the source armature and add two joints for a traveling body wave.
rig.hide_set(False);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in [
 ('body',(0,-.22,0),(0,.04,0),None),('spine',(0,.04,0),(0,.32,0),'body'),
 ('peduncle',(0,.32,0),(0,.61,0),'spine'),('tail_fin',(0,.61,0),(0,.85,0),'peduncle'),
 ('top_fin',(0,-.03,.15),(0,.02,.28),'body'),
 ('left_fin',(.13,-.17,-.025),(.26,.10,-.09),'body'),
 ('right_fin',(-.13,-.17,-.025),(-.26,.10,-.09),'body')]:
    bone=rig.data.edit_bones.get(name) or rig.data.edit_bones.new(name)
    bone.head=head;bone.tail=tail;bone.parent=rig.data.edit_bones.get(parent) if parent else None;bone.use_connect=False
bpy.ops.object.mode_set(mode='OBJECT')
# Recompute outward normals for the closed membranes and both mirrored eyes.
import bmesh
bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
attribute=data.color_attributes.new(name='Fish colors',type='BYTE_COLOR',domain='CORNER')
for loop in data.loops: attribute.data[loop.index].color=colors[loop.vertex_index]
for poly in data.polygons: poly.use_smooth=True
mat=bpy.data.materials.new('Coastal fish silver'); mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); bsdf.inputs['Roughness'].default_value=0.39
vertex_color=mat.node_tree.nodes.new('ShaderNodeVertexColor'); vertex_color.layer_name='Fish colors'
mat.node_tree.links.new(vertex_color.outputs['Color'],bsdf.inputs['Base Color']); mesh.data.materials.append(mat)
root = bpy.data.objects.new('Reef fish', None); scene.collection.objects.link(root)
rig.parent = root
root.scale = (0.8/1.32466984,)*3
root['openlandcraftAnimation'] = 'fish-swim-v1'
root['openlandcraftRevision'] = 2
# Nose is -Y in Blender, exported as +Z. A traveling body/tail wave and
# lagging pectoral fins make a continuous swimming stroke without root drift.
scene.render.fps = 30; scene.frame_start = 0; scene.frame_end = 36
for frame in range(37):
    t = frame/36 * math.tau
    for name, angle, axis in [
        ('body',0.025*math.sin(t),(0,0,1)),
        ('spine',0.075*math.sin(t-0.4),(0,0,1)),
        ('peduncle',0.13*math.sin(t-0.85),(0,0,1)),
        ('tail_fin',0.26*math.sin(t-1.2),(0,0,1)),
        ('top_fin',0.08*math.sin(t-0.9),(0,1,0)),
        ('left_fin',0.18*math.sin(t-0.4),(0,0,1)),
        ('right_fin',-0.18*math.sin(t-0.4),(0,0,1))]:
        bone=rig.pose.bones[name]; rest=bone.bone.matrix_local.to_quaternion()
        bone.rotation_mode='QUATERNION'; bone.rotation_quaternion=rest.inverted() @ Quaternion(axis,angle) @ rest
        bone.keyframe_insert('rotation_quaternion',frame=frame)
rig.animation_data.action.name='Swim'
for layer in rig.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                for key in curve.keyframe_points: key.interpolation='LINEAR'
scene.frame_set(0); bpy.context.view_layer.update()
points=[mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
root.location=(-(min(v.x for v in points)+max(v.x for v in points))/2,
               -(min(v.y for v in points)+max(v.y for v in points))/2,-min(v.z for v in points))
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in [root,rig,mesh]:
    o.hide_set(False); o.hide_viewport=False; o.hide_render=False; o.select_set(True)
bpy.context.view_layer.objects.active=rig
for o in [root,rig,mesh]: o.hide_set(False); o.hide_viewport=False; o.hide_render=False
bpy.ops.export_scene.gltf(filepath=str(DEST/'reef-fish.glb'),export_format='GLB',use_selection=True,
 export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_extras=True)
# Give the single baked action a stable, engine-independent name.
glb = (DEST/'reef-fish.glb').read_bytes()
length = struct.unpack_from('<I',glb,12)[0]
doc = json.loads(glb[20:20+length]); doc['animations'][0]['name']='Swim'
payload = json.dumps(doc,separators=(',',':')).encode()
payload += b' ' * ((-len(payload)) % 4)
tail = glb[20+length:]
(DEST/'reef-fish.glb').write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),0x4e4f534a)+payload+tail)
bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'reef-fish.blend'),compress=True)

# Transparent catalog preview using the actual asset.
camera_data=bpy.data.cameras.new('Preview'); camera=bpy.data.objects.new('Preview',camera_data)
scene.collection.objects.link(camera); scene.camera=camera
camera.location=(2.4,-0.9,0.65); target=Vector((0,0,0.15))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'; camera_data.ortho_scale=0.95
for name,loc,power,size in [('Key',(-2,-3,5),350,4),('Fill',(3,1,3),200,3)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.world=bpy.data.worlds.new('Preview world'); scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(0.5,0.5,0.5,1)
scene.render.film_transparent=True; scene.render.resolution_x=256; scene.render.resolution_y=256; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(DEST/'reef-fish.png')
bpy.ops.render.render(write_still=True)
print('Fish prepared:', (DEST/'reef-fish.glb').stat().st_size, 'bytes')

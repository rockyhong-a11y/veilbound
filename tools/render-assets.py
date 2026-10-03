"""Original VEILBOUND models. Blender renders, then Python/Pillow stitches.

  Blender -b --factory-startup --python tools/render-assets.py [-- --combat]
  python3 tools/render-assets.py --stitch
"""
from pathlib import Path
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/private/tmp/veilbound-sprites')
SIZES = {'player': (192, 256), 'duelist': (192, 256), 'archer': (192, 256), 'warden': (192, 256), 'boss': (256, 320)}

if '--stitch' in sys.argv:
    from PIL import Image
    for name, (width, height) in SIZES.items():
        sheet = Image.new('RGBA', (width * 8, height))
        for frame in range(8):
            with Image.open(TEMP / f'{name}-{frame:02}.png') as image:
                image = image.convert('RGBA')
                assert image.size == (width, height), f'{name}: wrong frame size'
                left, top, right, bottom = image.getchannel('A').getbbox()
                assert 0 < left < right < width and 0 < top < bottom < height, f'{name}: clipped model'
                sheet.paste(image, (width * frame, 0))
        sheet.save(ROOT / 'assets' / f'{name}.png', optimize=True)
        print(f'{name}: {sheet.size}, 8 frames, RGBA', flush=True)
    sys.exit(0)

import bpy
from mathutils import Vector

TEMP.mkdir(parents=True, exist_ok=True)
(ROOT / 'assets').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.cycles.device = 'CPU'
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.world.color = (0.23, 0.28, 0.38)

def material(name, color, metallic=0, roughness=.5, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat

skin = material('porcelain warm skin', (.89, .63, .53), roughness=.72)
face_light = material('soft pale face', (.99, .79, .67), roughness=.72)
hair_white = material('moon silver hair', (.76, .83, .91), metallic=.14)
hair_shadow = material('silver hair shadow', (.34, .42, .57), metallic=.1)
hair_dark = material('midnight aubergine hair', (.10, .055, .16), metallic=.15)
black = material('eyeliner and lashes', (.018, .014, .031), roughness=.8)
eye = material('amber eyes', (1, .51, .1), emission=.9)
navy = material('indigo leather', (.045, .068, .14), roughness=.68)
navy_light = material('indigo fabric highlight', (.13, .19, .29))
purple = material('duelist wine armor', (.22, .085, .24), metallic=.25)
purple_light = material('duelist skirt fold', (.38, .16, .32))
crimson = material('blood red silk', (.66, .018, .065), roughness=.57)
crimson_dark = material('red silk underside', (.24, .006, .034))
steel = material('brushed moon steel', (.61, .73, .84), metallic=.75, roughness=.26)
steel_light = material('sharp steel edge', (.85, .91, 1), metallic=.8, roughness=.19)
gold = material('antique gold', (.71, .42, .13), metallic=.7, roughness=.3)
leather = material('warm dark leather', (.10, .065, .066), roughness=.72)
ochre = material('archer ochre hood', (.51, .30, .09), roughness=.8)
ochre_light = material('archer cloth folds', (.74, .48, .19), roughness=.7)
teal = material('warden oxidized teal', (.045, .24, .24), metallic=.25)
queen = material('queen black violet gown', (.034, .022, .066), metallic=.18)
queen_light = material('queen purple folds', (.115, .061, .15), metallic=.15)
ruby = material('enchanted ruby', (1, .018, .075), metallic=.15, roughness=.2, emission=2.4)

model_objects = []

def finish(obj, mat):
    obj.data.materials.append(mat)
    model_objects.append(obj)
    return obj

def ellipsoid(position, scale, mat, name='detail', segments=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=8, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return finish(obj, mat)

def tube(a, b, r1, r2, mat, name='limb', vertices=10):
    a, b = Vector(a), Vector(b)
    delta = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=delta.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return finish(obj, mat)

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return finish(obj, mat)

def chain(points, widths, mat, name):
    for i in range(len(points) - 1):
        tube(points[i], points[i + 1], widths[i], widths[i + 1], mat, name, vertices=7)

def robe(z, bottom, length, waist, mat, foldmat, phase=0, ywidth=.34):
    rings = []
    for level, (height, rx, ry) in enumerate([(z, waist, ywidth * .72), (z - length * .55, waist * 1.42, ywidth), (bottom, waist * 1.8, ywidth * 1.18)]):
        for i in range(12):
            angle = i * math.tau / 12
            flutter = .055 * math.sin(phase + i * 1.5) if level == 2 else 0
            rings.append((rx * math.cos(angle) - (level * .018), ry * math.sin(angle), height + flutter))
    faces = [(a + i, a + (i+1)%12, a+12+(i+1)%12, a+12+i) for a in (0,12) for i in range(12)]
    obj = mesh('tailored segmented skirt', rings, faces, mat)
    obj.data.materials.append(foldmat)
    for i, poly in enumerate(obj.data.polygons):
        poly.material_index = 1 if i % 3 == 0 else 0
    return obj

def cloak(top, bottom, phase, mat=crimson, width=.48, sweep=.5):
    vertices = []
    for row in range(7):
        t = row / 6
        for col in range(7):
            side = (col / 6 - .5) * 2
            vertices.append((- .14 - sweep * t - .11 * math.sin(phase + t * 4 + side), side * width * (.35 + .65 * t), top + (bottom - top) * t + .09 * math.sin(side * 5 + phase) * t))
    faces = [(r*7+c,r*7+c+1,(r+1)*7+c+1,(r+1)*7+c) for r in range(6) for c in range(6)]
    obj = mesh('flowing silk cape', vertices, faces, mat)
    obj.data.materials.append(crimson_dark)
    for i, poly in enumerate(obj.data.polygons):
        poly.material_index = int(i % 6 in (0, 4))
    modifier = obj.modifiers.new('cloth thickness', 'SOLIDIFY')
    modifier.thickness = .015

def sword(hand, angle=.38, length=1.1, magic=False):
    direction = Vector((math.cos(angle), 0, math.sin(angle)))
    hand = Vector(hand)
    tube(hand-direction*.13,hand+direction*.17,.045,.04,leather,'wrapped sword grip')
    ellipsoid(hand-direction*.15,(.055,.055,.055),gold,'gold pommel')
    guard=hand+direction*.2
    tube(guard+Vector((-.1,-.18,.04)),guard+Vector((.1,.18,-.04)),.035,.025,gold,'cross guard')
    side=Vector((-direction.z,0,direction.x))*.09
    depth=Vector((0,.026,0))
    end=guard+direction*length
    verts=[tuple(guard+side),tuple(guard-side),tuple(guard+depth),tuple(guard-depth),tuple(end)]
    mesh('diamond forged sword',verts,[(0,2,4),(2,1,4),(1,3,4),(3,0,4)],ruby if magic else steel_light)
    tube(guard+direction*.09+Vector((0,-.028,0)),end-direction*.16+Vector((0,-.015,0)),.013,.003,ruby if magic else steel,'sword fuller',vertices=5)

def face_and_hair(base, silver=True, phase=0, boss=False, hood=False):
    h=hair_white if silver else hair_dark
    ellipsoid((0,0,base),(.175,.14,.23),face_light,'adult feminine face',segments=16)
    ellipsoid((-.065,0,base+.075),(.185,.17,.19),h,'hair crown',segments=16)
    ellipsoid((.171,-.015,base-.015),(.055,.035,.045),skin,'slender nose',segments=10)
    tube((.166,-.079,base-.095),(.174,.025,base-.095),.012,.006,crimson,'subtle lips',vertices=6)
    for side in (-1,1):
        ellipsoid((.132,side*.10,base+.025),(.038,.025,.027),black,'eye outline')
        ellipsoid((.161,side*.100,base+.026),(.018,.022,.018),eye,'glowing amber iris')
        ellipsoid((.171,side*.107,base+.034),(.008,.006,.008),steel_light,'eye catchlight',segments=8)
        tube((.155,side*.065,base+.072),(.122,side*.133,base+.075),.012,.006,hair_shadow if silver else black,'angled eyebrow',vertices=6)
        ellipsoid((-.015,side*.144,base-.025),(.036,.025,.067),skin,'ear')
        ellipsoid((-.01,side*.168,base-.085),(.014,.012,.025),gold,'gold earring',segments=8)
        chain([(.105,side*.085,base+.17),(.148,side*.122,base+.12),(.10,side*.154,base-.02),(.045,side*.151,base-.23)], [.075,.058,.04,.009],h,'swept framing bangs')
    # The hairline stays open so the face reads at gameplay size.
    chain([(-.08,-.07,base+.20),(.035,-.128,base+.18),(.095,-.144,base+.115)],[.12,.075,.007],h,'swept fringe')
    if silver:
        for side in (-1,1):
            flow=.045*math.sin(phase+side)
            chain([(-.14,side*.08,base+.13),(-.30,side*.09,base-.04),(-.43+flow,side*.105,base-.30),(-.51+flow,side*.11,base-.65),(-.63+flow,side*.08,base-.92)],[.11,.12,.10,.055,.003],h,'long silver ponytail')
        ellipsoid((-.22,0,base+.02),(.06,.19,.08),gold if boss else crimson,'ponytail clasp')
    else:
        for side in (-1,1):
            chain([(-.12,side*.08,base+.07),(-.20,side*.12,base-.22),(-.28,side*.10,base-.45),(-.34+.05*math.sin(phase),side*.11,base-.63)],[.10,.12,.07,.006],h,'long dark hair')
    if hood:
        for side in (-1,1):
            chain([(.05,side*.20,base-.27),(-.14,side*.21,base+.1),(-.10,side*.10,base+.29),(.02,0,base+.28)],[.11,.12,.13,.04],ochre,'golden hunter hood')
    if boss:
        for side in (-1,1):
            points=[(.01,side*.13,base+.21),(-.04,side*.21,base+.35),(-.14,side*.27,base+.50),(-.19,side*.34,base+.70)]
            chain(points,[.035,.030,.023,.007],gold,'antler crown')
            chain([points[1],(.08,side*.31,base+.46),(.13,side*.35,base+.59)],[.023,.017,.002],gold,'crown tine')
        ellipsoid((.164,0,base+.17),(.039,.042,.053),ruby,'crown ruby')

def human(kind, phase, pose):
    is_boss = kind == 'boss'
    is_archer = kind == 'archer'
    is_warden = kind == 'warden'
    is_duelist = kind == 'duelist'
    z = .045*math.sin(phase*2) if not is_boss else .028*math.sin(phase)
    dodge = kind == 'player' and pose == 7
    attack = pose == 6
    windup = pose == 7 and not dodge
    if dodge:
        z = -.49
    elif attack:
        z = -.045
    torso_mat=queen if is_boss else ochre if is_archer else teal if is_warden else purple if is_duelist else navy
    fold_mat=queen_light if is_boss else ochre_light if is_archer else navy_light if is_warden else purple_light if is_duelist else navy_light
    torso_top = 2.28+z
    # Layered clothing follows a narrow waist and broader hip line.
    ellipsoid((0,0,1.68+z),(.22,.265,.29),torso_mat,'feminine armored hips')
    tube((0,0,1.65+z),(0,0,2.16+z),.175,.235,torso_mat,'fitted corseted tunic',vertices=12)
    for side in (-1,1):
        ellipsoid((.035,side*.108,2.035+z),(.175,.113,.14),torso_mat,'tailored chest armor')
        tube((-.035,side*.15,2.19+z),(.02,side*.105,1.81+z),.027,.022,gold,'corset gold piping',vertices=6)
    tube((0,0,2.15+z),(0,0,2.37+z),.09,.076,skin,'neck')
    ellipsoid((0,0,1.70+z),(.223,.271,.055),gold,'ornate belt')
    ellipsoid((.221,-.015,1.71+z),(.024,.056,.064),ruby if is_boss else steel,'belt gem')
    robe(1.72+z, .34+z if is_boss else 1.22+z,1.38 if is_boss else .50,.19,torso_mat,fold_mat,phase,ywidth=.36 if is_boss else .28)
    if not is_archer:
        cloak(2.25+z,.31+z if is_boss else .65+z,phase,crimson if not is_warden else teal,width=.58 if is_boss else .40,sweep=.74 if is_boss else .46)
    for side in (-1,1):
        step=math.sin(phase+(0 if side == -1 else math.pi))
        if attack or dodge:
            step = -1 if side == -1 else 1
        if is_boss:
            step *= .15
        hip=(0,side*.13,1.53+z)
        knee=(.20*step,side*.14,.68 if dodge else .95+z+.06*max(0,step))
        foot=(.35*step,side*.15,.23 if attack or dodge else .23+.13*max(0,-step))
        tube(hip,knee,.12,.094,navy if not is_duelist else purple,'fitted trouser thigh')
        ellipsoid(knee,(.11,.11,.13),steel if is_warden else leather,'knee armor')
        tube(knee,foot,.088,.058,leather,'armored boot shaft')
        ellipsoid((foot[0]+.065,foot[1],foot[2]-.08),(.16,.10,.105),steel if is_warden else leather,'heeled armored boot')
        tube((foot[0]+.01,foot[1]-.09,foot[2]+.07),(knee[0]+.015,knee[1]-.09,knee[2]-.10),.017,.023,gold if is_boss else steel,'boot shin trim',vertices=6)
    # Camera sees the right arm at negative Y; ready weapon stance across the body.
    hand=(.41+.025*math.sin(phase),-.29,1.66+z)
    if attack:
        hand=(.52,-.34,2.12+z)
    elif windup:
        hand=(.23,-.35,2.27+z)
    elif dodge:
        hand=(.30,-.34,1.24)
    if is_archer:
        hand=(.72 if attack else .45 if windup else .58,-.22,2.03+z if attack or windup else 1.93+z)
    if is_boss:
        hand=(.39,-.29,1.94+z)
    for side in (-1,1):
        shoulder=(0,side*.255,2.17+z)
        elbow=(.18 if side == -1 else -.1,side*.30,2.15+z if windup and not is_archer else 1.96+z if attack else 1.82+z)
        armhand=hand if side == -1 else ((-.19 if windup else .16,.20,2.02+z) if is_archer else (.16,.22,1.56+z))
        ellipsoid(shoulder,(.17,.13,.105),gold if is_boss else steel,'layered shoulder pauldron')
        tube(shoulder,elbow,.084,.066,torso_mat,'upper sleeve')
        ellipsoid(elbow,(.075,.079,.077),steel,'elbow armor')
        tube(elbow,armhand,.067,.050,leather,'long glove')
        ellipsoid(armhand,(.071,.061,.069),skin,'hand')
        tube(Vector(armhand)*.77+Vector(elbow)*.23,armhand,.069,.054,gold if is_boss else steel,'wrist vambrace')
    face_and_hair(2.59+z,silver=not (is_archer or is_duelist),phase=phase,boss=is_boss,hood=is_archer)
    if kind == 'player':
        ellipsoid((.02,0,2.29+z),(.16,.245,.075),crimson,'red neck scarf')
        chain([(.0,-.23,2.29+z),(-.30,-.28,2.35+z),(-.61,-.31,2.25+z),(-.93,-.31,2.31+z+.10*math.sin(phase))],[.072,.065,.045,.003],crimson,'long flying scarf')
        sword(hand,-.74 if attack else -.08 if dodge else .15+.11*math.sin(phase),1.08)
    elif is_duelist:
        sword(hand,-.86 if attack else .90 if windup else .32+.13*math.sin(phase),.92 if windup else 1.08,magic=True)
        ellipsoid((-.16,-.02,1.72+z),(.095,.18,.10),gold,'duelist belt ornament')
    elif is_archer:
        center=Vector(hand)+Vector((.09,0,0))
        points=[center+Vector((-.13,0,-.64)),center+Vector((.13,0,-.42)),center+Vector((.20,0,0)),center+Vector((.13,0,.42)),center+Vector((-.13,0,.64))]
        chain(points,[.020,.037,.042,.037,.020],gold,'golden recurve bow')
        if windup:
            draw=Vector((-.22,-.18,2.03+z))
            tube(points[0],draw,.007,.007,steel_light,'drawn lower bow string',vertices=6)
            tube(draw,points[-1],.007,.007,steel_light,'drawn upper bow string',vertices=6)
        else:
            tube(points[0],points[-1],.007,.007,steel_light,'bow string',vertices=6)
        arrowtip=1.27 if attack else .82 if windup else .97
        tube((-.25 if windup else .15 if attack else -.16,-.16,2.02+z),(arrowtip,-.16,2.02+z),.009,.009,leather,'nocked arrow',vertices=6)
        mesh('arrowhead',[(arrowtip,-.16,2.02+z),(arrowtip-.10,-.16,2.07+z),(arrowtip-.10,-.16,1.97+z)],[(0,1,2)],steel_light)
        tube((-.22,.14,1.67+z),(-.31,.15,2.29+z),.098,.10,leather,'back quiver')
        for i in range(4):
            tube((-.32+i*.025,.15,2.16+z),(-.40+i*.04,.15,2.5+z),.009,.009,gold,'spare arrow',vertices=6)
    elif is_warden:
        sword(hand,-.74 if attack else .90 if windup else .75,.92 if windup else 1.04)
        verts=[(.27,.20,2.08+z),(.33,.43,1.92+z),(.33,.43,1.38+z),(.28,.22,1.17+z),(.22,-.01,1.38+z),(.22,-.01,1.92+z)]
        mesh('warden kite shield',verts,[(0,1,2,3,4,5)],teal)
        for a,b in zip(verts,verts[1:]+verts[:1]):
            tube(a,b,.018,.018,gold,'shield gold rim',vertices=6)
        tube((.30,.215,1.92+z),(.30,.215,1.40+z),.034,.022,steel_light,'shield insignia')
    elif is_boss:
        weapon_start=len(model_objects)
        shaftbase=Vector((.39,-.29,.22))
        shafttop=Vector((.56,-.29,3.41+z))
        tube(shaftbase,shafttop,.035,.027,leather,'queen scythe shaft')
        for height in (.42,1.04,1.65,2.27,2.89):
            ellipsoid((.39+(height-.22)*.053,-.29,height),(.045,.045,.028),gold,'scythe gold bands')
        curve=[(.55,-.29,3.4+z),(.83,-.29,3.39+z),(1.12,-.29,3.18+z),(1.30,-.29,2.86+z),(1.32,-.29,2.56+z)]
        inside=[(.56,-.31,3.23+z),(.75,-.31,3.24+z),(.96,-.31,3.11+z),(1.14,-.31,2.82+z),(1.32,-.31,2.56+z)]
        mesh('crescent scythe blade',curve+inside,[(i,i+1,i+6,i+5) for i in range(4)],steel_light)
        chain(curve,[.021,.018,.015,.010,.001],ruby,'ruby crescent edge')
        ellipsoid((.56,-.29,3.34+z),(.11,.068,.095),ruby,'scythe ruby eye')
        if attack or windup:
            from mathutils import Matrix
            bpy.context.view_layer.update()
            pivot=Vector(hand)
            transform=Matrix.Translation(pivot) @ Matrix.Rotation(.72 if attack else -.55,4,'Y') @ Matrix.Translation(-pivot)
            for obj in model_objects[weapon_start:]:
                obj.matrix_world=transform @ obj.matrix_world
        # Long strands frame the queen's gown, giving a tall unmistakable silhouette.
        for side in (-1,1):
            chain([(-.12,side*.19,2.54+z),(-.19,side*.28,2.13+z),(-.26,side*.29,1.68+z),(-.32,side*.31,1.24+z)],[.08,.10,.06,.003],hair_white,'queen long hair')
        for side in (-1,1):
            tube((.11,side*.22,1.57+z),(.24,side*.34,.44+z),.014,.013,gold,'gown embroidered seam',vertices=6)

def light(name, location, energy, color, size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.color=color
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector((0,0,1.6))-obj.location).to_track_quat('-Z','Y').to_euler()

light('warm portrait key',(3,-5,6),650,(1,.84,.74),5)
light('blue moon rim',(-3,2,5),850,(.37,.61,1),4)
light('soft cool fill',(1,4,3),400,(.63,.79,1),5)
camera_data=bpy.data.cameras.new('sprite orthographic camera')
camera=bpy.data.objects.new('sprite orthographic camera',camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type='ORTHO'
camera.location=(6,-13,4.25)

for kind,(width,height) in SIZES.items():
    scene.render.resolution_x=width
    scene.render.resolution_y=height
    camera_data.ortho_scale=4.35 if kind == 'boss' else 3.57
    target=Vector((.15,0,1.79 if kind == 'boss' else 1.54))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    for frame in (range(6,8) if '--combat' in sys.argv else range(8)):
        for obj in model_objects:
            bpy.data.objects.remove(obj,do_unlink=True)
        model_objects.clear()
        human(kind,frame*math.tau/8,frame)
        if kind == 'player' and frame == 0:
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/'characters.blend'))
        scene.render.filepath=str(TEMP/f'{kind}-{frame:02}.png')
        bpy.ops.render.render(write_still=True)
        print(f'FINISHED {kind} {frame+1}/8',flush=True)

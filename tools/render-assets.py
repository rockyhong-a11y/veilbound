"""Original VEILBOUND models. Blender renders, then Python/Pillow stitches.

  Blender -b --factory-startup --python tools/render-assets.py [-- --combat]
  python3 tools/render-assets.py --stitch
"""
from pathlib import Path
import math
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/private/tmp/veilbound-sprites')
SIZES = {'player': (384, 320), 'duelist': (192, 256), 'archer': (192, 256), 'warden': (192, 256), 'boss': (256, 320)}
PLAYER_STATES = [('idle',6,8,True),('run',12,24,True),('jump',3,16,False),('fall',3,10,True),('land',3,24,False),('attack1',6,30,False),('attack2',6,30,False),('attack3',7,28,False),('dash',4,24,False),('cast',6,22,False),('hurt',3,20,False)]
PLAYER_FRAMES = [(state, frame, count) for state,count,_,_ in PLAYER_STATES for frame in range(count)]

def animation_manifest():
    start=0
    states={}
    for state,count,fps,loop in PLAYER_STATES:
        states[state]={'start':start,'frames':count,'fps':fps,'loop':loop}
        start+=count
    return {'player':{'frameW':384,'frameH':320,'columns':12,'anchor':{'x':192,'y':296},'states':states}}

if '--stitch' in sys.argv:
    from PIL import Image
    for name, (width, height) in SIZES.items():
        if '--player-only' in sys.argv and name != 'player':
            continue
        if '--enemies-only' in sys.argv and name=='player':
            continue
        count=len(PLAYER_FRAMES) if name=='player' else 8
        columns=12 if name=='player' else 8
        sheet = Image.new('RGBA', (width * columns, height * math.ceil(count/columns)))
        for frame in range(count):
            with Image.open(TEMP / f'{name}-{frame:02}.png') as image:
                image = image.convert('RGBA')
                assert image.size == (width, height), f'{name}: wrong frame size'
                left, top, right, bottom = image.getchannel('A').getbbox()
                assert 0 < left < right < width and 0 < top < bottom < height, f'{name}: clipped model'
                sheet.paste(image, (width * (frame%columns), height*(frame//columns)))
        sheet.save(ROOT / 'assets' / f'{name}.png', optimize=True)
        print(f'{name}: {sheet.size}, {count} frames, RGBA', flush=True)
    (ROOT/'assets'/'animations.json').write_text(json.dumps(animation_manifest(),indent=2)+'\n')
    sys.exit(0)

import bpy
from mathutils import Vector, Matrix

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

def face_and_hair(base, silver=True, phase=0, boss=False, hood=False, flow=0, lean=0):
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
            wave=.045*math.sin(phase+side)
            root=Vector((-.14,side*.08,base+.13))
            strand=[]
            for t in (0,.20,.40,.70,1):
                delta=Vector(((-.49-.74*flow)*t,side*.025*math.sin(t*math.pi),(-1.05+.86*min(flow,1))*t+wave*t*t))
                strand.append(root+Matrix.Rotation(-lean,3,'Y') @ delta)
            chain(strand,[.11,.12,.10,.055,.003],h,'long silver ponytail')
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
    model_start=len(model_objects)
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
    leg_start=len(model_objects)
    for side in (-1,1):
        step=math.sin(phase+(0 if side == -1 else math.pi))
        if attack or dodge:
            step = -1 if side == -1 else 1
        if is_boss:
            step *= .15
        hip=(0,side*.13,1.53+z)
        knee=(.36*step,side*.14,.68 if dodge else .95+z+.25*max(0,-step))
        foot=(.62*step,side*.15,.23 if attack or dodge else .23+.40*max(0,-step))
        tube(hip,knee,.12,.094,navy if not is_duelist else purple,'fitted trouser thigh')
        ellipsoid(knee,(.11,.11,.13),steel if is_warden else leather,'knee armor')
        tube(knee,foot,.088,.058,leather,'armored boot shaft')
        ellipsoid((foot[0]+.065,foot[1],foot[2]-.08),(.16,.10,.105),steel if is_warden else leather,'heeled armored boot')
        tube((foot[0]+.01,foot[1]-.09,foot[2]+.07),(knee[0]+.015,knee[1]-.09,knee[2]-.10),.017,.023,gold if is_boss else steel,'boot shin trim',vertices=6)
    leg_end=len(model_objects)
    # Camera sees the right arm at negative Y; ready weapon stance across the body.
    hand=(.41+.025*math.sin(phase),-.29,1.66+z)
    if attack:
        hand=(.65,-.34,1.94+z)
    elif windup:
        hand=(.04,-.35,2.06+z)
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
        sword(hand,-.67 if attack else 1.72 if windup else .12+.22*math.sin(phase),.92 if windup else 1.08,magic=True)
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
        sword(hand,-.67 if attack else 1.72 if windup else .75,.92 if windup else 1.04)
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
    if not is_boss:
        bpy.context.view_layer.update()
        pivot=Vector((0,0,1.65+z))
        lean=.26 if attack else -.10 if windup else .16+.04*math.sin(phase)
        transform=Matrix.Translation(pivot) @ Matrix.Rotation(lean,4,'Y') @ Matrix.Translation(-pivot)
        for i,obj in enumerate(model_objects[model_start:],start=model_start):
            if not leg_start<=i<leg_end:
                obj.matrix_world=transform @ obj.matrix_world

def player_pose(state, frame, count):
    t=frame/max(1,count-1)
    phase=frame*math.tau/count
    pose={'bob':.025*math.sin(phase),'lean':.05,'frontK':(.10,.91),'frontA':(.20,.17),'backK':(-.13,.87),'backA':(-.30,.17),
          'hand':(.45,1.62),'elbow':(.18,1.88),'offhand':(.05,1.62),'offelbow':(-.16,1.87),'sword':.12,'flow':.15,'phase':phase}
    if state=='run':
        pose.update(bob=.05*math.cos(phase*2),lean=.32+.06*math.sin(phase),flow=1.0)
        for label,angle in [('front',phase),('back',phase+math.pi)]:
            lift=max(0,math.sin(angle))
            pose[label+'K']=(.43*math.cos(angle)+.12,.90+.30*lift)
            pose[label+'A']=(.82*math.cos(angle),.16+.60*lift)
        pose.update(hand=(.32+.26*math.sin(phase),1.57-.20*math.sin(phase)),elbow=(.04+.14*math.sin(phase),1.93),
                    offhand=(.10-.43*math.sin(phase),1.60+.28*math.sin(phase)),offelbow=(-.10-.18*math.sin(phase),1.93),sword=-.45+.23*math.sin(phase))
    elif state=='jump':
        pose.update(bob=.02,lean=[-.16,.12,.22][frame],frontK=(.43,1.20),frontA=(.19,.82),backK=(-.31,1.01),backA=(-.58,.70),
                    hand=(.58,1.93),elbow=(.24,2.18),offhand=(-.31,2.05),offelbow=(-.33,2.21),sword=.45,flow=.8)
    elif state=='fall':
        pose.update(lean=.13,frontK=(.23,.97),frontA=(.32,.20),backK=(-.25,1.13),backA=(-.50,.55),
                    hand=(.63,2.04),elbow=(.32,2.25),offhand=(-.36,2.10),offelbow=(-.34,2.27),sword=.64,flow=.65)
    elif state=='land':
        squash=[1,.55,.10][frame]
        pose.update(bob=-.40*squash,lean=.48*squash,frontK=(.50,.64+.25*(1-squash)),frontA=(.50,.15),backK=(-.33,.68),backA=(-.52,.15),
                    hand=(.57,1.40),elbow=(.30,1.79),sword=-.20,flow=.9*squash)
    elif state.startswith('attack'):
        data={
            'attack1':{'hands':[(.13,2.12),(-.20,2.30),(.75,2.07),(.92,1.72),(.68,1.43),(.47,1.64)],'angles':[2.0,2.57,.26,-.27,-.72,.12],'leans':[-.17,-.28,.23,.42,.25,.08]},
            'attack2':{'hands':[(.48,1.43),(.18,1.22),(.81,1.38),(.92,2.06),(.45,2.33),(.48,1.65)],'angles':[-1.15,-1.68,-.24,.57,1.15,.12],'leans':[.08,-.17,.22,.36,.14,.07]},
            'attack3':{'hands':[(.23,2.07),(.03,2.43),(.05,2.43),(.86,1.55),(.76,1.20),(.60,1.36),(.46,1.63)],'angles':[1.45,1.59,1.80,-.46,-.30,-.31,.12],'leans':[-.05,-.17,-.27,.55,.46,.30,.06]},
        }[state]
        reach=[.0,.0,.55,.80,.70,.38,.15][frame]
        hand=data['hands'][frame]
        pose.update(hand=hand,elbow=(hand[0]*.42,2.10 if hand[1]>1.9 else 1.80),sword=data['angles'][frame],lean=data['leans'][frame],
                    bob=-.08 if frame>1 else .0,frontK=(.20+reach*.35,.87),frontA=(.28+reach*.62,.15),backK=(-.19-reach*.20,.81),backA=(-.42-reach*.35,.15),
                    offhand=(-.31,1.74+.13*math.sin(phase)),offelbow=(-.38,2.04),flow=.90 if frame>1 else .38)
        if state=='attack3' and frame in (3,4):
            pose['bob']=-.33
            pose['frontK']=(.62,.63)
    elif state=='dash':
        pose.update(bob=-.64,lean=.82+.05*math.sin(phase),frontK=(.63,.55),frontA=(.33,.15),backK=(-.43,.59),backA=(-.87,.20),
                    hand=(.55,1.47),elbow=(.28,1.82),offhand=(-.48,1.75),offelbow=(-.33,2.02),sword=-.29,flow=1.30)
    elif state=='cast':
        reach=math.sin(t*math.pi)
        pose.update(lean=.12+.14*reach,frontA=(.46,.16),backA=(-.45,.16),hand=(.25,2.05+.25*reach),elbow=(.08,2.23),sword=1.35,
                    offhand=(.31+.63*reach,1.90+.18*reach),offelbow=(.30+.30*reach,2.17),flow=.5+.3*reach)
    elif state=='hurt':
        recoil=[1,.55,.1][frame]
        pose.update(lean=-.30*recoil,bob=-.10*recoil,frontK=(.32,.94),frontA=(.48,.22),backK=(-.18,.82),backA=(-.43,.16),
                    hand=(.10,1.67),elbow=(-.11,1.95),offhand=(-.28,2.10),offelbow=(-.35,2.20),sword=.88,flow=-.40*recoil)
    return pose

def animated_player(state, frame, count):
    p=player_pose(state,frame,count)
    bob,phase,flow=p['bob'],p['phase'],p['flow']
    pivot=Vector((0,0,1.51))
    upper_start=len(model_objects)
    ellipsoid((0,0,1.55),(.20,.25,.22),navy,'mobile armored hips')
    tube((0,0,1.55),(0,0,2.11),.16,.225,navy,'fitted adventurer coat',vertices=12)
    for side in (-1,1):
        ellipsoid((.035,side*.105,1.99),(.165,.11,.125),navy_light,'tailored chest panel')
        tube((-.015,side*.15,2.14),(.035,side*.105,1.64),.021,.017,steel,'silver coat piping',vertices=6)
        tube((.06,side*.18,1.99),(.09,side*.15,1.76),.013,.009,gold,'buckled coat straps',vertices=6)
    tube((0,0,2.11),(0,0,2.33),.082,.070,skin,'neck')
    ellipsoid((0,0,1.57),(.215,.264,.060),leather,'waist belt')
    ellipsoid((.215,-.018,1.58),(.026,.06,.067),gold,'engraved belt buckle')
    ellipsoid((.243,-.018,1.58),(.018,.032,.037),ruby,'belt garnet')
    robe(1.59,1.24,.35,.19,navy,navy_light,phase,ywidth=.275)
    # Short split coat and long scarf expose the leg silhouette during sprinting.
    cloak(2.16,1.12,phase,crimson,width=.30,sweep=.35+.63*max(0,flow))
    for side in (-1,1):
        shoulder=(0,side*.25,2.12)
        elbow_x,elbow_z=p['elbow'] if side==-1 else p['offelbow']
        hand_x,hand_z=p['hand'] if side==-1 else p['offhand']
        elbow=(elbow_x,side*.31,elbow_z)
        hand=(hand_x,side*.34,hand_z)
        ellipsoid(shoulder,(.16,.13,.115),steel,'articulated shoulder armor')
        ellipsoid((-.035,side*.277,2.14),(.12,.11,.085),navy_light,'pauldron layered inset')
        tube(shoulder,elbow,.079,.061,navy,'bent upper sleeve')
        ellipsoid(elbow,(.070,.071,.070),steel,'elbow cap')
        tube(elbow,hand,.061,.047,leather,'leather forearm glove')
        cuff=Vector(hand)*.75+Vector(elbow)*.25
        tube(cuff,hand,.065,.052,steel,'engraved wrist bracer',vertices=8)
        ellipsoid(hand,(.074,.059,.069),skin,'gripping hand')
        if side==-1:
            sword(hand,p['sword']+p['lean'],.94)
    face_and_hair(2.53,silver=True,phase=phase,flow=flow,lean=p['lean'])
    ellipsoid((.01,0,2.22),(.15,.242,.066),crimson,'red neck scarf')
    chain([(.0,-.235,2.22),(-.30,-.28,2.27+.06*flow),(-.64-.18*flow,-.31,2.18+.13*flow),(-1.03-.42*flow,-.31,2.27+.16*flow+.13*math.sin(phase+.5))],[.065,.06,.040,.001],crimson,'wind whipped scarf')
    bpy.context.view_layer.update()
    upper_transform=Matrix.Translation(Vector((0,0,bob))+pivot) @ Matrix.Rotation(p['lean'],4,'Y') @ Matrix.Translation(-pivot)
    for obj in model_objects[upper_start:]:
        obj.matrix_world=upper_transform @ obj.matrix_world
    for side,label in [(-1,'front'),(1,'back')]:
        knee_x,knee_z=p[label+'K']
        ankle_x,ankle_z=p[label+'A']
        hip=(0,side*.145,1.48+bob)
        knee=(knee_x,side*.153,knee_z)
        ankle=(ankle_x,side*.165,ankle_z)
        tube(hip,knee,.113,.083,navy_light,'dynamic fitted thigh')
        ellipsoid(knee,(.094,.090,.097),steel,'flexing knee guard')
        tube(knee,ankle,.081,.055,leather,'jointed high boot')
        foot=ellipsoid((ankle_x+.065,side*.165,ankle_z-.072),(.17,.092,.083),leather,'pointed armored boot')
        foot.rotation_euler.y=.24*max(0,ankle_z-.2)
        tube((ankle_x+.02,side*.165-.083,ankle_z+.03),(knee_x+.015,side*.153-.09,knee_z-.09),.017,.020,steel,'silver boot shin plate',vertices=6)
        ellipsoid((ankle_x+.105,side*.165,ankle_z-.07),(.105,.096,.026),steel,'boot toe cap')

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
    if '--player-only' in sys.argv and kind!='player':
        continue
    if '--enemies-only' in sys.argv and kind=='player':
        continue
    scene.render.resolution_x=width
    scene.render.resolution_y=height
    camera_data.ortho_scale=4.72 if kind=='player' else 4.35 if kind == 'boss' else 3.57
    camera.location=(2.5,-16,3.55) if kind=='player' else (6,-13,4.25)
    target=Vector((0 if kind=='player' else .15,0,1.73 if kind=='player' else 1.79 if kind == 'boss' else 1.54))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    if kind=='player':
        from bpy_extras.object_utils import world_to_camera_view
        bpy.context.view_layer.update()
        ground=world_to_camera_view(scene,camera,Vector((0,0,.055)))
        camera.location+=camera.rotation_euler.to_matrix() @ Vector(((ground.x-.5)*camera_data.ortho_scale,(296-(1-ground.y)*height)*camera_data.ortho_scale/width,0))
    total=len(PLAYER_FRAMES) if kind=='player' else 8
    frames=range(total) if kind=='player' else range(6,8) if '--combat' in sys.argv else range(8)
    for frame in frames:
        if '--preview' in sys.argv and kind=='player' and frame not in (0,6,9,12,18,24,29,35,42,48,54,57):
            continue
        for obj in model_objects:
            bpy.data.objects.remove(obj,do_unlink=True)
        model_objects.clear()
        if kind=='player':
            state,local,count=PLAYER_FRAMES[frame]
            animated_player(state,local,count)
        else:
            human(kind,frame*math.tau/8,frame)
        if kind == 'player' and frame == 0:
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/'characters.blend'))
        scene.render.filepath=str(TEMP/f'{kind}-{frame:02}.png')
        bpy.ops.render.render(write_still=True)
        print(f'FINISHED {kind} {frame+1}/{total}',flush=True)

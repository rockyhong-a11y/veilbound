"""VEILBOUND's original weapon arsenal, modeled and rendered with Blender.

Blender -b --factory-startup --python tools/render-arsenal.py -- --preview
Blender -b --factory-startup --python tools/render-arsenal.py
python3 tools/render-arsenal.py --stitch

The heroine's clothing, face, lights and camera are shared with render-assets.py.
Only new arsenal-* assets are written. Each weapon has its own pose animation.
"""
from pathlib import Path
import math
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/private/tmp/veilbound-arsenal')
IDS = ['sword', 'gauntlet', 'spear', 'gun', 'bow', 'harpoon', 'greatsword', 'scythe']
ATLAS_IDS = IDS[1:]
PREVIEW = [0, 6, 9, 18, 24, 28, 29, 30, 34, 35, 36, 40, 42, 43, 48, 54]
NAMES = {'sword':'Moonsteel blade','gauntlet':'Ruby knuckles','spear':'Dawnspire spear',
         'gun':'Nocturne pistol','bow':'Gilded recurve','harpoon':'Abyssal chain harpoon',
         'greatsword':'Cathedral greatsword','scythe':'Crescent reaper'}

def manifest():
    return {'version':3,'renderer':'Blender Cycles','original':True,
            'frameW':384,'frameH':320,'columns':12,'rows':5,'frames':59,
            'anchor':{'x':192,'y':296},
            'animationManifest':'animations.json',
            'weapons':{weapon:{'name':NAMES[weapon],
                               'sprite':'player.png' if weapon=='sword' else f'arsenal-{weapon}.png',
                               'icon':f'arsenal-icon-{weapon}.png'} for weapon in IDS},
            'poses':{'gauntlet':'alternating straight punches and uppercut',
                     'spear':'two-handed thrusts and low sweep',
                     'gun':'two-handed aim and recoil',
                     'bow':'draw, hold, release, and re-nock',
                     'harpoon':'barbed thrust and chain cast',
                     'greatsword':'two-handed overhead and broad heavy cuts',
                     'scythe':'hooking sweep and crescent overhead cut'},
            'source':'tools/render-arsenal.py'}

def pack_icons():
    from PIL import Image
    for weapon in IDS:
        icon_path=ROOT/'assets'/f'arsenal-icon-{weapon}.png'
        image=Image.open(icon_path).convert('RGBA')
        bbox=image.getchannel('A').getbbox()
        assert bbox, f'{weapon} icon is empty'
        crop=image.crop(bbox)
        scale=230/max(crop.width,crop.height)
        crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
        packed=Image.new('RGBA',(256,256))
        packed.paste(crop,((256-crop.width)//2,(256-crop.height)//2))
        packed.save(icon_path,optimize=True)
    print('Packed 8 weapon icons with transparent 13px minimum margins',flush=True)

if '--pack-icons' in sys.argv:
    pack_icons()
    sys.exit(0)

if '--stitch' in sys.argv or '--stitch-ready' in sys.argv:
    from PIL import Image, ImageDraw
    preview = Image.new('RGBA',(8*384,5*320),(15,19,29,255))
    selected = [0,9,29,35,42]
    for column,weapon in enumerate(IDS):
        if weapon == 'sword':
            sheet = Image.open(ROOT/'assets'/'player.png').convert('RGBA')
        else:
            if '--stitch-ready' in sys.argv and not all((TEMP/f'{weapon}-{frame:02}.png').exists() for frame in range(59)):
                continue
            sheet = Image.new('RGBA',(4608,1600))
            for frame in range(59):
                image=Image.open(TEMP/f'{weapon}-{frame:02}.png').convert('RGBA')
                bbox=image.getchannel('A').getbbox()
                assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<384 and bbox[3]<320, f'{weapon}/{frame} clipped: {bbox}'
                sheet.paste(image,(384*(frame%12),320*(frame//12)))
            sheet.save(ROOT/'assets'/f'arsenal-{weapon}.png',optimize=True)
        for row,frame in enumerate(selected):
            tile=sheet.crop((384*(frame%12),320*(frame//12),384*(frame%12)+384,320*(frame//12)+320))
            preview.alpha_composite(tile,(column*384,row*320))
        print(f'{weapon}: 59 frames checked',flush=True)
    # Pack every icon tightly, preserving its silhouette and transparent edges.
    # A 256px icon should still read clearly in a 43px inventory button.
    pack_icons()
    draw=ImageDraw.Draw(preview)
    for column,weapon in enumerate(IDS):
        draw.text((column*384+15,14),NAMES[weapon],fill='#f5dfac')
    (ROOT/'artifacts').mkdir(exist_ok=True)
    preview.convert('RGB').save(ROOT/'artifacts'/'arsenal-art-preview.jpg',quality=94)
    preview.save(ROOT/'artifacts'/'arsenal-art-preview.png',optimize=True)
    (ROOT/'assets'/'arsenal-art.json').write_text(json.dumps(manifest(),indent=2)+'\n')
    sys.exit(0)

import bpy
from mathutils import Vector, Matrix
TEMP.mkdir(parents=True,exist_ok=True)
# Execute just the reusable model, light and camera definitions. Its render loop
# stays untouched, and this file can always reproduce the new original assets.
source=(ROOT/'tools'/'render-assets.py').read_text()
source=source.split('for kind,(width,height) in SIZES.items():')[0]
exec(compile(source,str(ROOT/'tools'/'render-assets.py'),'exec'),globals())
TEMP = Path('/private/tmp/veilbound-arsenal')
TEMP.mkdir(parents=True,exist_ok=True)
scene.cycles.samples=10
scene.render.resolution_x=384
scene.render.resolution_y=320
camera_data.ortho_scale=4.72
camera.location=(2.5,-16,3.55)
target=Vector((0,0,1.73))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()
ground=world_to_camera_view(scene,camera,Vector((0,0,.055)))
camera.location+=camera.rotation_euler.to_matrix() @ Vector(((ground.x-.5)*camera_data.ortho_scale,(296-(1-ground.y)*320)*camera_data.ortho_scale/384,0))
player_camera_location=camera.location.copy()
player_camera_rotation=camera.rotation_euler.copy()

obsidian=material('arsenal blackened steel',(.055,.072,.10),metallic=.85,roughness=.24)
brass=material('arsenal warm engraved brass',(.84,.53,.17),metallic=.78,roughness=.25)
cyan=material('arsenal moonstone inlay',(.15,.74,.96),metallic=.25,roughness=.20,emission=1.3)
ivory=material('arsenal ivory bowstring',(.88,.86,.73),roughness=.7)
grip=material('arsenal ruby leather wrapping',(.28,.012,.032),roughness=.66)
base_sword=sword
base_pose=player_pose
active_weapon='sword'
active_pose={}
icon_mode=False

def blade(origin,direction,length,width,mat=steel_light,name='faceted blade'):
    o,d=Vector(origin),Vector(direction)
    side=Vector((-d.z,0,d.x))*width
    depth=Vector((0,.035,0))
    tip=o+d*length
    mesh(name,[tuple(o+side),tuple(o-side),tuple(o+depth),tuple(o-depth),tuple(tip)],
         [(0,2,4),(2,1,4),(1,3,4),(3,0,4)],mat)
    tube(o+Vector((0,-.038,0)),tip-d*.12+Vector((0,-.021,0)),.014,.004,cyan if active_weapon=='spear' else ruby,'runic fuller',vertices=6)

def banded_pole(hand,d,start,end,radius=.03):
    tube(hand+d*start,hand+d*end,radius,radius*.8,obsidian,'blacksteel shaft')
    for t in (start+.1,-.18,.07,.28,end-.09):
        if start<t<end:
            tube(hand+d*(t-.025),hand+d*(t+.025),radius*1.55,radius*1.45,brass,'engraved pole band',vertices=8)
    tube(hand+d*(-.19),hand+d*.15,radius*1.7,radius*1.6,grip,'leather wrapped grip',vertices=10)

def knuckle(hand,d,off=False):
    side=Vector((-d.z,0,d.x))
    tube(hand-d*.23,hand+d*.06,.108,.095,obsidian,'forged armored gauntlet',vertices=8)
    tube(hand-d*.24,hand-d*.16,.122,.112,brass,'gilded gauntlet cuff',vertices=8)
    ellipsoid(hand+d*.02,(.124,.085,.112),steel,'segmented armored fist',segments=12)
    for t in (-.07,0,.07):
        center=hand+d*.07+side*t+Vector((0,-.075,0))
        ellipsoid(center,(.052,.034,.049),brass,'engraved knuckle plate',segments=8)
        tube(center,center+d*.14,.033,.003,ruby,'crimson knuckle spike',vertices=6)
    ellipsoid(hand-d*.10+Vector((0,-.106,0)),(.064,.019,.064),ruby,'gauntlet ruby core')

def arsenal_weapon(hand,angle=.2,length=1.1,magic=False):
    h=Vector(hand)
    d=Vector((math.cos(angle),0,math.sin(angle)))
    side=Vector((-d.z,0,d.x))
    weapon=active_weapon
    if weapon=='sword':
        base_sword(hand,angle,length,magic)
    elif weapon=='gauntlet':
        knuckle(h,d)
        off=Vector((active_pose.get('offhand',(-.18,1.72))[0],.34,active_pose.get('offhand',(-.18,1.72))[1]))
        if icon_mode:
            off=Vector((-.60,.1,.35))
        knuckle(off,Vector((math.cos(-.2 if icon_mode else active_pose.get('lean',0)),0,math.sin(-.2 if icon_mode else active_pose.get('lean',0)))),True)
    elif weapon in ('spear','harpoon'):
        banded_pole(h,d,-.72,1.09,.035 if weapon=='harpoon' else .029)
        head=h+d*1.03
        blade(head,d,.43,.115 if weapon=='harpoon' else .093,steel_light,'barbed harpoon head' if weapon=='harpoon' else 'spear diamond head')
        ellipsoid(head,(.09,.057,.09),brass,'gilded spear socket')
        if weapon=='spear':
            ellipsoid(head+d*.08+Vector((0,-.044,0)),(.065,.03,.09),cyan,'spear moonstone')
            for s in (-1,1):
                chain([head+side*.07*s,head-d*.13+side*.20*s,head-d*.28+side*.15*s],[.025,.017,.003],brass,'spear winged filigree')
        else:
            for s in (-1,1):
                points=[head+d*.05+side*.05*s,head-d*.18+side*.22*s,head-d*.07+side*.18*s]
                mesh('backward harpoon barb',[tuple(x) for x in points],[(0,1,2)],steel_light)
            center=h-d*.27+Vector((0,.12,0))
            for i in range(4):
                points=[center+Vector((.19*math.cos(j*math.tau/12),i*.045,.19*math.sin(j*math.tau/12))) for j in range(13)]
                chain(points,[.012]*len(points),grip,'coiled harpoon tether')
            chain([h-d*.71,h-d*.95+side*.15,h-d*1.04+side*.30,h-d*.90+side*.45],[.012,.012,.010,.004],brass,'dangling harpoon chain')
    elif weapon=='gun':
        tube(h-d*.19-side*.14,h+d*.13-side*.18,.066,.051,leather,'pistol carved grip',vertices=8)
        tube(h-d*.14,h+d*.72,.084,.070,obsidian,'octagonal pistol barrel',vertices=8)
        tube(h+d*.18,h+d*.26,.106,.100,brass,'gun engraved breach',vertices=8)
        tube(h+d*.70,h+d*.78,.097,.084,brass,'gold muzzle ring',vertices=10)
        tube(h-d*.18,h+d*.12,.075,.075,brass,'pistol gilded receiver',vertices=8)
        ellipsoid(h+d*.03+Vector((0,-.086,0)),(.08,.018,.058),ruby,'pistol chamber gemstone')
        chain([h-d*.04-side*.08,h+d*.16-side*.15,h+d*.21-side*.06],[.014,.012,.014],brass,'gun trigger guard')
        tube(h+d*.42+side*.09,h+d*.57+side*.09,.023,.022,steel_light,'pistol upper sight',vertices=8)
        tube(h-d*.08+side*.09,h-d*.10+side*.17,.018,.015,brass,'pistol ornate hammer',vertices=8)
        for t in (.33,.45,.57):
            tube(h+d*t+Vector((0,-.075,0)),h+d*(t+.03)+side*.03+Vector((0,-.075,0)),.012,.011,brass,'pistol barrel engraving',vertices=5)
    elif weapon=='bow':
        center=h+d*.10
        curve=[center-d*.11-side*.74,center+d*.17-side*.52,center+d*.24-side*.23,center,
               center+d*.24+side*.23,center+d*.17+side*.52,center-d*.11+side*.74]
        chain(curve,[.019,.039,.044,.039,.044,.039,.019],obsidian,'recurved blacksteel bow limbs')
        chain([v+Vector((0,-.035,0)) for v in curve],[.012]*7,brass,'gilded recurve edges')
        for s in (-1,1):
            ellipsoid(center+side*.40*s+d*.19+Vector((0,-.037,0)),(.043,.028,.084),cyan,'bow moonstone set')
            chain([center-side*.66*s-d*.02,center-side*.84*s-d*.17,center-side*.78*s-d*.26],[.029,.021,.002],brass,'bow ornamental horn tips')
        draw=Vector((active_pose.get('offhand',(.05,1.62))[0],.29,active_pose.get('offhand',(.05,1.62))[1]))
        if icon_mode:
            draw=center-d*.13
        tube(curve[0],draw,.007,.007,ivory,'drawn lower bowstring',vertices=5)
        tube(draw,curve[-1],.007,.007,ivory,'drawn upper bowstring',vertices=5)
        arrowtip=center+d*.89
        tube(draw,arrowtip,.009,.008,leather,'nocked arrow shaft',vertices=6)
        blade(arrowtip-d*.11,d,.17,.036,steel_light,'arrowhead')
        for s in (-1,1):
            mesh('arrow feather',[tuple(draw+d*.05),tuple(draw+d*.22+side*.055*s),tuple(draw+d*.24)],[(0,1,2)],crimson)
    elif weapon=='greatsword':
        tube(h-d*.27,h+d*.18,.058,.050,grip,'two hand leather greatsword grip')
        ellipsoid(h-d*.31,(.082,.076,.082),brass,'cathedral pommel')
        guard=h+d*.20
        chain([guard-side*.26-d*.08,guard-side*.16,guard,guard+side*.16,guard+side*.26-d*.08],[.025,.035,.04,.035,.025],brass,'winged cathedral crossguard')
        blade(guard,d,1.20,.16,steel_light,'broad cathedral greatblade')
        for t in (.23,.46,.69):
            point=guard+d*t+Vector((0,-.039,0))
            chain([point-side*.06,point+d*.03,point+side*.06],[.01,.012,.01],brass,'gothic blade inscription')
        ellipsoid(guard+d*.10+Vector((0,-.035,0)),(.083,.030,.08),ruby,'greatsword ruby crest')
    elif weapon=='scythe':
        banded_pole(h,d,-.77,1.03,.032)
        head=h+d*1.03
        curve=[head,head+side*.27-d*.03,head+side*.55-d*.22,head+side*.73-d*.55,head+side*.72-d*.92]
        inside=[head-d*.18,head+side*.24-d*.18,head+side*.43-d*.32,head+side*.59-d*.58,head+side*.72-d*.92]
        mesh('lunar crescent scythe',[tuple(v) for v in curve+inside],[(i,i+1,i+6,i+5) for i in range(4)],steel_light)
        chain(curve,[.023,.021,.019,.012,.002],cyan,'luminous lunar edge')
        ellipsoid(head+side*.06+Vector((0,-.04,0)),(.09,.045,.10),cyan,'scythe moonstone eye')
        chain([head-side*.07,head-side*.20-d*.09,head-side*.19-d*.22],[.025,.018,.003],brass,'scythe counter hook')

def weapon_pose(state,frame,count):
    global active_pose
    p=base_pose(state,frame,count)
    t=frame/max(1,count-1)
    attack=state.startswith('attack')
    weapon=active_weapon
    if weapon in ('gun','bow'):
        # Running still reads as a sprint, but weapons remain in a ready grip.
        p.update(hand=(.57,1.90),elbow=(.18,1.98),offhand=(.30,1.82),offelbow=(-.09,1.82),sword=.03)
        if weapon=='bow':
            p.update(hand=(.54,1.91),offhand=(.08,1.91),offelbow=(-.18,2.00),sword=0)
        if state=='run':
            p['hand']=(.47,1.83+.04*math.sin(p['phase']))
        if attack:
            fire=math.sin(t*math.pi)
            if weapon=='gun':
                recoil=[.05,.0,.20,.14,.07,.0,.0][frame]
                p.update(hand=(.76-recoil,1.98+.24*recoil),elbow=(.23,2.01),offhand=(.64-recoil,1.90),offelbow=(-.01,1.83),sword=.05+recoil*1.2,lean=.11-recoil*.45,flow=.40)
            else:
                draw=[.12,.42,.60,.18,.03,.02,.0][frame]
                p.update(hand=(.69,1.98),elbow=(.35,2.02),offhand=(.56-draw,1.98),offelbow=(-.28,2.10),sword=.02,lean=.07-.11*draw,flow=.3)
        if state in ('jump','fall'):
            p.update(hand=(.48,1.98),offhand=(.28,1.90),sword=.12)
        if state=='dash':
            p.update(hand=(.42,1.52),offhand=(.23,1.47),sword=-.05)
            if weapon=='bow':
                p.update(hand=(.30,1.97),offhand=(.12,1.89),sword=.02)
    elif weapon=='gauntlet':
        p.update(hand=(.50,1.94),offhand=(.11,2.04),elbow=(.11,2.00),offelbow=(-.17,1.97),sword=.02)
        if state=='run':
            p.update(hand=(.30+.27*math.sin(p['phase']),1.82-.17*math.sin(p['phase'])),offhand=(.15-.25*math.sin(p['phase']),1.86+.15*math.sin(p['phase'])))
        if attack:
            reach=[.08,.0,.91,1.15,.64,.17,.08][frame]
            if state=='attack2':
                p.update(offhand=(.10+reach,1.93),offelbow=(.24+reach*.4,2.01),hand=(.24,2.03),elbow=(-.02,1.99),sword=.0)
            elif state=='attack3':
                p.update(hand=(.43+reach*.50,1.61+.58*math.sin(t*math.pi)),elbow=(.12+reach*.30,1.88),offhand=(.21,1.97),sword=.55*math.sin(t*math.pi))
            else:
                p.update(hand=(.26+reach,1.94),elbow=(.14+reach*.40,2.05),offhand=(-.03,2.06),sword=.0)
            p.update(lean=.16+.15*reach,flow=.65)
        if state=='dash':
            p.update(hand=(.45,1.43),offhand=(-.40,1.74),sword=.04)
    elif weapon in ('spear','harpoon'):
        p.update(hand=(.49,1.67),elbow=(.19,1.86),offhand=(.12,1.62),offelbow=(-.16,1.80),sword=.55 if weapon=='spear' else .28)
        if state=='run':
            p.update(hand=(.40,1.61),offhand=(.02,1.63),sword=.08)
        if attack:
            reach=[.03,-.14,.40,.47,.28,.0,.0][frame]
            p.update(hand=(.36+reach,1.84),elbow=(.04+reach*.34,1.97),offhand=(-.18+reach*.66,1.82),offelbow=(-.34,1.96),sword=.03,lean=.06+.24*max(reach,0),flow=.60)
            if state=='attack3':
                p.update(hand=(.48+.36*math.sin(t*math.pi),1.56),offhand=(.01,1.68),sword=-.28+.53*math.sin(t*math.pi))
        if state=='dash':
            p.update(hand=(.30,1.33),offhand=(-.18,1.47),sword=.04)
        elif state in ('jump','fall'):
            p.update(hand=(.32,1.93),offhand=(-.11,1.81),sword=.73)
        elif state=='cast':
            p.update(hand=(.29,2.12),offhand=(-.16,1.94),sword=.99)
    elif weapon in ('greatsword','scythe'):
        p['sword']+=.27 if weapon=='scythe' else .40
        p['offhand']=(p['hand'][0]-.14,p['hand'][1]-.17)
        p['offelbow']=(-.13,1.92)
        if attack:
            # Both hands travel with the heavy weapon; the third attack slams.
            p['offhand']=(p['hand'][0]-.16*math.cos(p['sword']),p['hand'][1]-.16*math.sin(p['sword']))
            p['flow']=.98
            if state=='attack3' and frame in (1,2):
                p['hand']=(.01,2.18)
                p['offhand']=(-.12,2.00)
                p['sword']=1.22
        elif state=='run':
            p.update(hand=(.32,1.67),offhand=(.14,1.55),sword=.55 if weapon=='greatsword' else .98)
        elif state=='dash':
            p.update(hand=(.35,1.55),offhand=(.16,1.43),sword=.11)
    active_pose=p
    return p

sword=arsenal_weapon
player_pose=weapon_pose

def clear_model():
    for obj in model_objects:
        data=obj.data
        bpy.data.objects.remove(obj,do_unlink=True)
        if isinstance(data,bpy.types.Mesh) and data.users==0:
            bpy.data.meshes.remove(data)
    model_objects.clear()

def render_icons():
    global active_weapon,icon_mode,active_pose
    icon_mode=True
    scene.render.resolution_x=256
    scene.render.resolution_y=256
    scene.cycles.samples=24
    camera_data.ortho_scale=3.30
    camera.location=(.50,-12,3.25)
    target=Vector((.25,0,.45))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    for weapon in IDS:
        clear_model()
        active_weapon=weapon
        active_pose={}
        angle=.66 if weapon in ('sword','spear','harpoon','greatsword') else 1.16 if weapon=='scythe' else .10
        arsenal_weapon((-.35,0,.02),angle,1.25)
        # Frame the actual weapon bounds before rendering. This produces crisp
        # 256px details instead of enlarging a small silhouette afterwards.
        bpy.context.view_layer.update()
        points=[obj.matrix_world @ Vector(corner) for obj in model_objects for corner in obj.bound_box]
        center=sum(points,Vector())/len(points)
        camera.location=center+Vector((.50,-12,2.80))
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        axes=camera.rotation_euler.to_matrix().transposed()
        projected=[axes @ (point-center) for point in points]
        minx,maxx=min(v.x for v in projected),max(v.x for v in projected)
        miny,maxy=min(v.y for v in projected),max(v.y for v in projected)
        camera.location+=camera.rotation_euler.to_matrix() @ Vector(((minx+maxx)/2,(miny+maxy)/2,0))
        camera_data.ortho_scale=max(maxx-minx,maxy-miny)/.90
        scene.render.filepath=str(ROOT/'assets'/f'arsenal-icon-{weapon}.png')
        bpy.ops.render.render(write_still=True)
        print(f'ICON {weapon}',flush=True)
    icon_mode=False

render_ids=[] if '--icons-only' in sys.argv else [x for x in ATLAS_IDS if ('--only' not in sys.argv or x==sys.argv[sys.argv.index('--only')+1])]
for weapon in render_ids:
    active_weapon=weapon
    scene.render.resolution_x=384
    scene.render.resolution_y=320
    scene.cycles.samples=10
    camera_data.ortho_scale=4.72
    camera.location=player_camera_location
    camera.rotation_euler=player_camera_rotation
    for frame,(state,local,count) in enumerate(PLAYER_FRAMES):
        if '--frames' in sys.argv and frame not in [int(x) for x in sys.argv[sys.argv.index('--frames')+1].split(',')]:
            continue
        if '--preview' in sys.argv and frame not in PREVIEW:
            continue
        output=TEMP/f'{weapon}-{frame:02}.png'
        if '--resume' in sys.argv and output.exists():
            continue
        clear_model()
        animated_player(state,local,count)
        scene.render.filepath=str(output)
        bpy.ops.render.render(write_still=True)
        print(f'ARSENAL {weapon} {frame+1}/59 ({state}:{local})',flush=True)
if '--skip-icons' not in sys.argv:
    render_icons()
(ROOT/'assets'/'arsenal-art.json').write_text(json.dumps(manifest(),indent=2)+'\n')

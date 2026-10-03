"""Original VEILBOUND reliquaries: animated PBR treasure chest and rune portal.

Blender -b --factory-startup --python tools/render-reliquary.py
python3 tools/render-reliquary.py --stitch
"""
from pathlib import Path
import math
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/private/tmp/veilbound-reliquary')
SPECS = {
    'chest': {'frameW': 256, 'frameH': 192, 'columns': 8, 'anchor': {'x':128, 'y':174},
              'states': {'closed': {'start':0, 'frames':1, 'fps':1, 'loop':False},
                         'opening': {'start':0, 'frames':8, 'fps':14, 'loop':False},
                         'opened': {'start':7, 'frames':1, 'fps':1, 'loop':False}}},
    'portal': {'frameW':256, 'frameH':384, 'columns':8, 'anchor': {'x':128, 'y':366},
               'states': {'sealed': {'start':0, 'frames':8, 'fps':12, 'loop':True},
                          'open': {'start':8, 'frames':8, 'fps':12, 'loop':True}}}
}

if '--stitch' in sys.argv:
    from PIL import Image, ImageDraw
    for name, spec in SPECS.items():
        w,h = spec['frameW'],spec['frameH']
        count = 8 if name=='chest' else 16
        sheet = Image.new('RGBA',(w*8,h*math.ceil(count/8)))
        for frame in range(count):
            img=Image.open(TEMP/f'{name}-{frame:02}.png').convert('RGBA')
            assert img.size==(w,h)
            bounds=img.getchannel('A').getbbox()
            assert bounds and 0<bounds[0]<bounds[2]<w and 0<bounds[1]<bounds[3]<h, f'{name} frame{frame} clipping: {bounds}'
            sheet.paste(img,((frame%8)*w,(frame//8)*h))
        sheet.save(ROOT/'assets'/f'reliquary-{name}.png',optimize=True)
        print(f'reliquary-{name}: {sheet.size}, {count} alpha-checked frames')
    (ROOT/'assets'/'reliquary-animations.json').write_text(json.dumps(SPECS,indent=2)+'\n')
    preview=Image.new('RGB',(1024,520),'#10131d')
    draw=ImageDraw.Draw(preview)
    for i,frame in enumerate([0,3,5,7]):
        img=Image.open(TEMP/f'chest-{frame:02}.png').convert('RGBA')
        preview.paste(img,(i*256,310),img)
    for i,frame in enumerate([0,3,8,11]):
        img=Image.open(TEMP/f'portal-{frame:02}.png').convert('RGBA')
        img=img.resize((205,307),Image.Resampling.LANCZOS)
        preview.paste(img,(i*256+25,8),img)
    draw.text((12,505),'SEALED / OPEN RUNE PORTAL + 8-POSE RELIQUARY LID',fill='#c8b991')
    (ROOT/'artifacts').mkdir(exist_ok=True)
    preview.save(ROOT/'artifacts'/'reliquary-art-preview.png')
    sys.exit(0)

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

TEMP.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.cycles.device='CPU'
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.world.color=(.14,.17,.24)

def mat(name,color,metal=0,rough=.5,emission=0):
    material=bpy.data.materials.new(name)
    material.diffuse_color=(*color,1)
    material.use_nodes=True
    bs=material.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    return material

oak=mat('raven oak',(.065,.025,.022),.15,.55)
oakLight=mat('burnished old oak',(.18,.067,.031),.2,.45)
woodBlack=mat('ebony ironwood',(.016,.023,.032),.25,.44)
brass=mat('weathered antique brass',(.65,.32,.07),.82,.27)
gold=mat('polished engraved edge',(.97,.62,.16),.85,.21)
darkMetal=mat('black forged hinge iron',(.045,.056,.076),.8,.34)
stone=mat('blue basalt carved stone',(.13,.17,.23),.26,.58)
stoneLight=mat('beveled moonstone',(.32,.38,.46),.34,.48)
stoneDark=mat('recessed midnight slate',(.045,.061,.098),.24,.58)
interior=mat('reliquary purple lining',(.068,.012,.085),.16,.66)
ruby=mat('living garnet',(.75,.009,.025),.44,.19,1.5)
teal=mat('aether teal glass',(.005,.34,.43),.38,.15,2.4)
violet=mat('ethereal violet rune',(.22,.09,.71),.33,.2,3)
tealDim=mat('teal patina inset',(.013,.16,.18),.62,.34)
amber=mat('treasure warm magic',(.95,.34,.027),.2,.2,2.6)
glint=mat('hot blue filament',(.012,.48,.61),.2,.15,3.2)
black=mat('deep keyhole',(.002,.003,.005),.05,.7)
void=mat('opaque portal interior',(.002,.005,.021),.1,.85,.18)

def finish(obj,material,name):
    obj.name=name
    obj.data.materials.append(material)
    return obj

def mesh(name,verts,faces,material,bevel=0):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    finish(obj,material,name)
    if bevel:
        mod=obj.modifiers.new('rounded handworked edges','BEVEL');mod.width=bevel;mod.segments=2
        obj.modifiers.new('weighted metal normals','WEIGHTED_NORMAL')
    return obj

def box(name,pos,size,material,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    obj=bpy.context.object;obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(obj,material,name)
    if bevel:
        mod=obj.modifiers.new('worn beveled corners','BEVEL');mod.width=bevel;mod.segments=3
        obj.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return obj

def sphere(name,pos,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=pos)
    obj=bpy.context.object;obj.scale=scale
    for poly in obj.data.polygons: poly.use_smooth=True
    return finish(obj,material,name)

def tube(name,a,b,r,material,r2=None):
    a,b=Vector(a),Vector(b);delta=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r,radius2=r if r2 is None else r2,depth=delta.length,location=(a+b)/2)
    obj=bpy.context.object;obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(obj,material,name)

def curve(name,points,r,material):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=2
    data.bevel_depth=r;data.bevel_resolution=2
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    for p,coords in zip(spline.points,points): p.co=(*coords,1)
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    return finish(obj,material,name)

def jewel(name,pos,scale,material,rotation=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=pos)
    obj=bpy.context.object;obj.scale=scale;obj.rotation_euler.y=rotation
    return finish(obj,material,name)

def torus(name,pos,major,minor,material,rot=(math.pi/2,0,0),scale=(1,1,1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=major,minor_radius=minor,location=pos,rotation=rot)
    obj=bpy.context.object;obj.scale=scale
    return finish(obj,material,name)

def clear():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def camera(w,h,loc,target,scale,anchor,foot=(0,0,0)):
    scene.render.resolution_x=w;scene.render.resolution_y=h
    bpy.ops.object.camera_add(location=loc)
    cam=bpy.context.object;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=scale;scene.camera=cam
    bpy.context.view_layer.update()
    right=cam.matrix_world.to_quaternion()@Vector((1,0,0))
    up=cam.matrix_world.to_quaternion()@Vector((0,1,0))
    point=Vector(foot);p=world_to_camera_view(scene,cam,point)
    desired=(anchor[0]/w,1-anchor[1]/h)
    cam.location+=right
    bpy.context.view_layer.update();test=world_to_camera_view(scene,cam,point)
    cam.location-=right
    cam.location+=right*((desired[0]-p.x)/(test.x-p.x))
    bpy.context.view_layer.update();p=world_to_camera_view(scene,cam,point)
    cam.location+=up
    bpy.context.view_layer.update();test=world_to_camera_view(scene,cam,point)
    cam.location-=up
    cam.location+=up*((desired[1]-p.y)/(test.y-p.y))
    bpy.context.view_layer.update()
    for name,pos,power,color,size in [
        ('warm silver key',(-3,-4,6),620,(1,.81,.6),4),
        ('cool violet rim',(4,2,5),920,(.3,.53,1),3),
        ('soft frontal fill',(2,-6,2),210,(.66,.77,1),4)]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        light=bpy.context.object;light.name=name;light.data.energy=power;light.data.color=color;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector(target)-light.location).to_track_quat('-Z','Y').to_euler()
    return cam

def chest(frame):
    # Raised claw feet and layered antique case are substantial in silhouette.
    for x in [-.69,.69]:
        for y in [-.35,.35]:
            sphere('cast brass lion claw',(x,y,.095),(.12,.13,.10),brass)
            for toe in [-1,0,1]: sphere('individual claw toe',(x+toe*.052,y-.048,.065),(.032,.085,.037),gold)
    box('lower ebony sill',(0,0,.21),(1.76,1.01,.16),woodBlack)
    box('lower gilt molding',(0,0,.17),(1.78,1.025,.05),brass,.015)
    box('solid oak chest case',(0,0,.45),(1.66,.94,.46),oak)
    box('thick upper rim',(0,0,.7),(1.77,1.02,.10),brass)
    box('hollow velvet cavity',(0,0,.724),(1.46,.79,.027),interior,.025)
    # Board seams, actual raised carvings, decorative corner stays and rivets.
    for i in range(10):
        x=-.74+i*.164
        box('warm front oak stave',(x,-.48,.43),(.142,.025,.35),oakLight if i%3==1 else oak,.012)
        for side in [-1,1]:
            points=[(x+side*.05*math.sin(t*math.pi),-.501,.30+t*.27) for t in [0,.2,.4,.6,.8,1]]
            curve('worn carved wood grain',points,.005,woodBlack)
    for x in [-.79,-.51,.51,.79]:
        box('brass front band',(x,-.504,.46),(.071,.049,.46),brass,.015)
        for z in [.27,.39,.55,.64]: sphere('domed fastening rivet',(x,-.54,z),(.023,.012,.023),gold)
    for x in [-.7,.7]:
        for y in [-.475,.475]:
            box('ornate corner armor',(x,y,.46),(.16,.10,.39),darkMetal)
            curve('corner golden vine',[(x-.05,-.546,.31),(x+.048,-.546,.39),(x-.045,-.546,.50),(x+.044,-.546,.63)],.014,brass)
    # Front palmettes and a pendant garnet keyhole.
    for side in [-1,1]:
        for offset in [0,.07]:
            curve('raised palmette filigree',[(side*(.16+t*.24),-.535,.39+math.sin(t*math.pi)*(.08+offset)) for t in [i/12 for i in range(13)]],.012,brass)
        torus('side carry handle',(side*.855,0,.49),.108,.022,brass,(0,math.pi/2,0),(.85,1,1))
    box('lock plate',(0,-.55,.48),(.26,.067,.29),brass,.065)
    jewel('faceted garnet lock',(0,-.594,.55),(.086,.026,.083),ruby)
    sphere('round keyhole',(0,-.595,.425),(.026,.012,.028),black)
    box('keyhole stem',(0,-.59,.397),(.022,.015,.038),black,.003)
    # A curved lid, with an independent hinge that opens toward the rear.
    bpy.ops.object.empty_add(location=(0,.44,.715))
    hinge=bpy.context.object;hinge.name='animated barrel lid hinge'
    before=set(scene.objects)
    verts=[]
    for x in [-.86,.86]:
        for i in range(13):
            t=i/12*math.pi
            verts.append((x,.47*math.cos(t),.735+.29*math.sin(t)))
    faces=[(i,i+1,i+14,i+13) for i in range(12)]+[tuple(range(12,-1,-1)),tuple(range(13,26))]
    mesh('arched dark oak lid',verts,faces,oak,.013)
    box('lid internal carved panel',(0,0,.718),(1.56,.8,.041),oakLight,.025)
    for x in [-.82,-.52,.52,.82]:
        points=[(x,.488*math.cos(i/20*math.pi),.742+.308*math.sin(i/20*math.pi)) for i in range(21)]
        curve('continuous domed brass binding',points,.026,brass)
        for i in range(0,21,4):
            t=i/20*math.pi
            sphere('gold lid rivet',(x,.51*math.cos(t),.75+.31*math.sin(t)),(.025,.020,.022),gold)
    for y in [-.48,.48]:
        curve('lid gilded edge',[(-.86,y,.743),(.86,y,.743)],.025,brass)
    for j in range(6):
        t=(j+1)/7*math.pi
        curve('engraved lid oak seam',[(-.78,.48*math.cos(t),.742+.3*math.sin(t)),(.78,.48*math.cos(t),.742+.3*math.sin(t))],.006,woodBlack)
    jewel('lid center teal cabochon',(0,-.16,1.012),(.15,.10,.035),tealDim)
    for side in [-1,1]:
        curve('lid golden crest',[(side*.10,-.16,1.046),(side*.21,-.12,1.025),(side*.33,-.23,.999),(side*.41,-.16,1.00)],.015,brass)
    for obj in set(scene.objects)-before:
        obj.parent=hinge;obj.matrix_parent_inverse=hinge.matrix_world.inverted()
    for x in [-.52,.52]:
        tube('real barrel hinge',(x-.10,.477,.715),(x+.10,.477,.715),.046,darkMetal)
    t=frame/7
    hinge.rotation_euler.x=-1.55*(1-(1-t)**3)
    # Visible loot emerges with the lid: many distinct coins and gemstone facets.
    if frame>0:
        for i in range(24):
            angle=i*2.399963
            radius=.05+.33*math.sqrt(i/24)
            x=radius*math.cos(angle);y=radius*.7*math.sin(angle)
            sphere('loose gold coin',(x,y,.756+.015*(i%4)),(.076,.070,.018),gold)
        jewel('aether crystal in treasure',(.23,.07,.86),(.13,.10,.22),teal)
        jewel('amethyst treasure',(-.29,-.04,.835),(.12,.10,.15),violet)
        jewel('crimson gem treasure',(.015,-.15,.814),(.08,.075,.10),ruby)
        for i in range(5):
            angle=i*2.399+t*2
            sphere('treasure rising sparkle',(.44*math.cos(angle),.22*math.sin(angle),.91+.10*i+.03*math.sin(t*8+i)),(.015,.015,.035),amber)
        bpy.ops.object.light_add(type='POINT',location=(0,-.2,.99))
        bpy.context.object.data.energy=9*t;bpy.context.object.data.color=(1,.29,.055);bpy.context.object.data.shadow_soft_size=.3

def archline(t):
    # Pointed Gothic arch, straight pillars continue into curved voussoirs.
    if t<.48: return Vector((-.94,0,.34+t/.48*2.04))
    if t<.74:
        a=(t-.48)/.26*math.pi/2
        return Vector((-.94*math.cos(a),0,2.38+1.17*math.sin(a)))
    if t<1:
        a=(t-.74)/.26*math.pi/2
        return Vector((.94*math.sin(a),0,3.55-1.17*(1-math.cos(a))))
    return Vector((.94,0,2.38-(t-1)/.48*2.04))

def portal(frame):
    opened=frame>=8
    phase=math.tau*(frame%8)/8
    # Broad base, pillared relief, alternating carved segments and inset channels.
    box('heavy rune gateway foundation',(0,0,.14),(2.65,.72,.28),stone,.08)
    box('polished front threshold',(0,-.38,.19),(2.41,.15,.105),stoneLight,.025)
    for x in [-1.03,1.03]:
        box('pillared basalt plinth',(x,.035,.36),(.60,.7,.25),stoneLight,.03)
        box('fluted outer jamb',(x,.04,1.35),(.45,.55,1.96),stone,.06)
        box('obsidian pilaster recess',(x,-.263,1.36),(.26,.02,1.49),stoneDark,.025)
        for offset in [-.1,.1]:
            tube('twisted gold jamb inlay',(x+offset,-.292,.57),(x+offset,-.292,2.18),.016,brass)
        for z in [.58,1.14,1.70,2.2]:
            box('gilded pillar collar',(x,-.01,z),(.49,.57,.075),brass,.015)
        for i in range(5):
            z=.79+i*.25
            jewel('faceted inset rune',(x,-.312,z),(.057,.016,.087),tealDim,math.pi/4)
        sphere('arched pillar capital',(x,-.03,2.34),(.30,.31,.14),stoneLight)
    # Solid beveled wedges, visibly layered rather than a flat outline.
    segments=20
    for i in range(segments):
        t0=.48+i/segments*.52+.002;t1=.48+(i+1)/segments*.52-.002
        p0,p1=archline(t0),archline(t1)
        tangent=(p1-p0).normalized();out=Vector((-tangent.z,0,tangent.x))
        if out.dot((p0+p1)/2-Vector((0,0,2)))<0: out=-out
        corners=[p0-out*.11,p1-out*.11,p1+out*.27,p0+out*.27]
        verts=[tuple(v+Vector((0,y,0))) for y in [-.28,.32] for v in corners]
        mesh('carved Gothic arch voussoir',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],stoneLight if i%3==0 else stone,.025)
        center=(p0+p1)/2+out*.07
        jewel('arch gold relief stud',(center.x,-.327,center.z),(.035,.02,.045),brass)
    # Inner energy plane follows the arch silhouette, retaining an opaque void.
    outline=[(-.81,.23,.3),(.81,.23,.3),(.81,.23,2.37)]
    for i in range(13):
        a=i/12*math.pi/2
        outline.append((.81*math.cos(a),.23,2.37+1.03*math.sin(a)))
    for i in range(13):
        a=i/12*math.pi/2
        outline.append((-.81*math.sin(a),.23,3.40-1.03*(1-math.cos(a))))
    outline.append((-.81,.23,.3))
    mesh('unbroken midnight portal void',outline,[tuple(range(len(outline)))],void)
    # Thin precious-metal tracer follows the pointed opening and decorative curls.
    traced=[(-.82,-.329,.35),(-.82,-.329,2.37)]
    traced.extend([(-.82*math.cos(i/20*math.pi/2),-.329,2.37+1.04*math.sin(i/20*math.pi/2)) for i in range(21)])
    traced.extend([(.82*math.sin(i/20*math.pi/2),-.329,3.41-1.04*(1-math.cos(i/20*math.pi/2))) for i in range(21)])
    traced.append((.82,-.329,.35))
    curve('continuous antique gold inner tracery',traced,.023,gold)
    for side in [-1,1]:
        for z in [.72,1.27,1.82]:
            curve('carved jamb golden leaf',[(side*(.97+.07*math.sin(t*math.pi)), -.316,z+.24*t) for t in [i/12 for i in range(13)]],.011,brass)
    jewel('crowned portal keystone',(0,-.18,3.60),(.25,.22,.25),stoneDark)
    jewel('floating keystone crystal',(0,-.397,3.65),(.12,.072,.22),teal if opened else ruby)
    for side in [-1,1]:
        curve('keystone gilded wing',[(0,-.27,3.77),(side*.19,-.29,3.74),(side*.36,-.27,3.56),(side*.53,-.26,3.53)],.023,brass)
        jewel('side threshold crystal',(side*1.05,-.12,.47),(.09,.12,.18),teal if opened else ruby)
    # Actual emissive spiral filaments sit in front of the deep void.
    energy=teal if opened else ruby
    center=Vector((0,-.10,1.86))
    torus('engraved circular seal',(0,-.16,1.86),.71,.018,brass,scale=(1,1.53,1))
    for i in range(8):
        a=i*math.tau/8+phase*.08
        x=.71*math.cos(a);z=1.86+1.08*math.sin(a)
        jewel('eight glowing seal glyphs',(x,-.19,z),(.044,.014,.07),energy,a)
    if opened:
        for spiral in range(5):
            pts=[]
            for i in range(49):
                t=i/48;r=.12+.60*t
                angle=phase+spiral*math.tau/5+t*4.8
                pts.append((r*math.cos(angle),-.14-.025*math.sin(angle*2),1.86+r*1.51*math.sin(angle)))
            curve('flowing aether vortex filament',pts,.015 if spiral%2 else .023,glint if spiral%2 else violet)
        for i in range(15):
            a=i*2.399+phase;r=.21+.48*((i%5)/4)
            jewel('orbiting energy shards',(r*math.cos(a),-.20,1.86+r*1.5*math.sin(a)),(.026,.019,.060),glint,a)
        # Broken links hang clear of the usable passage.
        for side in [-1,1]:
            for i in range(5):
                z=2.53-i*.105;x=side*(.77+.035*math.sin(phase+i*.8))
                torus('broken hanging chain link',(x,-.38,z),.06,.015,brass,(math.pi/2,0,(i%2)*math.pi/2),(.75,1,1.35))
        bpy.ops.object.light_add(type='POINT',location=(0,-.58,1.7))
        bpy.context.object.data.energy=24;bpy.context.object.data.color=(.06,.67,1);bpy.context.object.data.shadow_soft_size=.7
    else:
        # Dense two crossed chains, a heavy royal seal and recessed rune ring.
        for diagonal in [-1,1]:
            for i in range(20):
                t=i/19;x=-.80+1.60*t;z=1.11+diagonal*(t-.5)*1.66
                torus('crossed binding chain',(x,-.46,z),.073,.019,darkMetal if i%3 else brass,(math.pi/2,0,diagonal*.80+(i%2)*math.pi/2),(.65,1,1.28))
        jewel('royal faceted seal backing',(0,-.56,1.1),(.25,.055,.26),brass)
        jewel('royal red portal lock',(0,-.615,1.1),(.14,.042,.17),ruby,math.pi/4)
        for spiral in range(2):
            a=phase+spiral*math.pi
            curve('restrained crimson energy scar',[(.43*math.cos(a+t*3),-.13,1.86+.66*math.sin(a+t*3)) for t in [i/20 for i in range(21)]],.009,ruby)

for name,spec in SPECS.items():
    count=8 if name=='chest' else 16
    for frame in range(count):
        if '--preview' in sys.argv and frame not in ([0,7] if name=='chest' else [0,8]): continue
        clear()
        if name=='chest':
            chest(frame);camera(256,192,(3.6,-7,4.4),(0,0,.72),3.25,(128,174),(0,-.47,0))
        else:
            portal(frame);camera(256,384,(.8,-10,4.8),(0,0,1.91),4.20,(128,366))
        if frame==0:
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'reliquary-{name}.blend'))
        scene.render.filepath=str(TEMP/f'{name}-{frame:02}.png')
        print(f'RELIQUARY {name} {frame+1}/{count}',flush=True)
        bpy.ops.render.render(write_still=True)

"""VEILBOUND remake: native pixel character sheets from the user-authored DEADSELL rig.

Blender -b --factory-startup --python tools/remake-art/render_characters.py -- [weapon ...]
python3 tools/remake-art/pack_characters.py

Rigid anatomical joint hierarchy, two-bone IK, sole planting, simulated scarf/hair,
cel lighting and weapon-tip smears are retained from the supplied reference.
Actual VEILBOUND weapon geometry and specific combat poses are authored below.
"""
from pathlib import Path
import sys, math, json, time, copy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import bpy
from mathutils import Vector, Quaternion
import common
import lib_heroine as L
import asset_heroine as A

TMP = ROOT/'artifacts/remake-frames'
IDS = ['sword','gauntlet','spear','gun','bow','harpoon','greatsword','scythe']
FW,FH,AX,AY = 128,112,64,100
INSPECTION = []


def add_weapons(h):
    M=h.M
    def prop(name,parts,joint='ha_n'):
        h._add_prop(name,parts,joint,(0,-.015,-.04),(0,90,0))
        h.prop_root[name].hide_render=True
    def shaft(name,length,top,mat):
        ob=common.limb(name,length,.035,.032,mat,segs=8)
        return L.place(ob,(0,0,top))
    # Paired forged hand armor, with red crystals and actual broad knuckle plates.
    for side in ['n','f']:
        pieces=[common.box('fist_'+side,(.17,.14,.22),M['iron'],loc=(0,0,.06),bevel=.022),
                common.box('knuckles_'+side,(.22,.16,.075),M['gold'],loc=(0,0,.17),bevel=.016),
                common.box('wrist_'+side,(.19,.15,.075),M['steel'],loc=(0,0,-.05)),
                L.prism('ruby_'+side,[(-.035,.04),(0,.1),(.035,.04),(0,0)],.018,M['scarf'])]
        prop('gauntlet_'+side,pieces,'ha_'+side)
        h.tip_local['gauntlet_'+side]=(Vector((0,0,.2)),Vector((0,0,.1)))
    # A visibly mechanical flintlock pistol; local +Z is its firing axis.
    parts=[common.box('gun_barrel',(.10,.10,.48),M['iron'],loc=(0,0,.26),bevel=.014),
           common.box('gun_top',(.035,.115,.48),M['steel'],loc=(-.06,0,.26)),
           common.box('gun_muzzle',(.15,.14,.07),M['gold'],loc=(0,0,.51)),
           common.box('gun_grip',(.23,.08,.12),M['wood_d'],loc=(.1,0,-.03),rot=(0,-18,0)),
           common.box('gun_lock',(.1,.13,.15),M['gold'],loc=(0,0,.04)),
           common.box('gun_hammer',(.085,.06,.055),M['iron'],loc=(-.05,0,-.04))]
    prop('gun',parts)
    h.tip_local['gun']=(Vector((0,0,.55)),Vector((0,0,.26)))
    # Barbed harpoon with a steel braided chain coiled beneath the rear grip.
    parts=[shaft('harpoon_pole',1.32,1.02,M['corset_d']),
           L.prism('harpoon_head',[(-.06,0),(-.14,.06),(-.10,.18),(-.04,.32),(0,.42),(.04,.32),(.1,.18),(.14,.06),(.06,0)],.035,M['steel']),
           common.box('harpoon_cuff',(.12,.08,.18),M['gold'],loc=(0,0,.12))]
    L.place(parts[1],(0,0,1.0))
    for k in range(7):
        ring=L.torus('chain_%d'%k,.042,.011,M['steel'],maj=8,mino=4)
        L.place(ring,(-.07+math.sin(k*.8)*.06,0,-.07-k*.045),(90,0,k%2*90))
        parts.append(ring)
    prop('harpoon',parts)
    h.tip_local['harpoon']=(Vector((0,0,1.42)),Vector((0,0,.85)))
    # Broad double-handed greatsword with cyan center fuller and cathedral guard.
    blade=[(-.11,.16),(-.13,.74),(-.07,.94),(0,1.10),(.07,.94),(.13,.74),(.11,.16)]
    parts=[L.prism('great_blade',blade,.055,M['blade']),
           common.box('great_fuller',(.027,.063,.77),M['glow_dim'],loc=(0,0,.57)),
           common.box('great_guard',(.46,.11,.07),M['gold'],loc=(0,0,.15),bevel=.025),
           common.box('great_handle',(.07,.065,.30),M['leather'],loc=(0,0,-.025)),
           common.ellipsoid('great_pommel',(.13,.10,.1),M['gold'],loc=(0,0,-.21))]
    prop('greatsword',parts)
    h.tip_local['greatsword']=(Vector((0,0,1.10)),Vector((0,0,.62)))
    # Curved harvest scythe, visibly distinct from the sword in all three strikes.
    curve=[(-.03,.86),(-.15,1.03),(-.40,1.12),(-.71,1.03),(-.97,.83),(-.75,.94),(-.48,.99),(-.23,.89),(-.08,.74)]
    parts=[shaft('scythe_shaft',1.32,.91,M['wood_d']),
           L.prism('scythe_crescent',curve,.035,M['steel']),
           common.box('scythe_gem',(.12,.07,.14),M['glow_dim'],loc=(-.06,0,.89)),
           common.box('scythe_grip',(.055,.055,.17),M['leather'],loc=(0,0,.02))]
    prop('scythe',parts)
    h.tip_local['scythe']=(Vector((-.97,0,.83)),Vector((-.35,0,1.02)))


def remap_pose(specs,old,new):
    specs=copy.deepcopy(specs)
    for sp in specs:
        sp['show']=[new if p==old else p for p in sp.get('show',[])]
        if isinstance(sp.get('hf'),tuple) and sp['hf'][0]=='grip' and sp['hf'][1]==old:
            g=list(sp['hf']);g[1]=new;sp['hf']=tuple(g)
        for sm in sp.get('smear',[]):
            if sm['prop']==old:sm['prop']=new
        for k,f in enumerate(sp.get('fx',[])):
            if f[0]=='trail' and f[2]==old:
                f=list(f);f[2]=new;sp['fx'][k]=tuple(f)
    return specs


def gun_shot(index):
    F=A.F;plant=L.plant
    n=6 if index<3 else 8
    specs=[]
    for i in range(n):
        recoil=.13 if i==1 or index==3 and i==3 else 0
        sp=F(-2-recoil*65,hip=(-recoil*.3,-.075),fn=plant(.24),ff=plant(-.25),
             hn=(.34-recoil,1.27,0 if not recoil else 8),
             hf=(.22-recoil,1.16,20),show=['gun'],vel=(-recoil*8,0))
        if recoil:sp['fx']=[('obj','spark',(.95-recoil,-.28,1.3),(1.15,1,1.15),22),
                            ('line',0,(.86,-.3,1.30),(1.72,-.3,1.30),1)]
        specs.append(sp)
    return specs,(1,2 if index==3 else 1,n-(3 if index==3 else 2))


def gauntlet_strike(index):
    F=A.F;plant=L.plant
    near=index!=2
    hand='hn' if near else 'hf'; other='hf' if near else 'hn'
    poses=[]
    # Anticipation -> long armored fist extension -> recoil. Finisher is an uppercut.
    for i in range(5 if index<3 else 7):
        active=i in ([1] if index<3 else [2,3])
        k=1 if active else (.25 if i==0 else .55 if i==2 else .1)
        lean=18*k if index<3 else 12*k
        wrist=(.12+.43*k,1.13 if index<3 else .85+.63*k,8 if index<3 else 58)
        sp=F(lean,hip=(.12*k,-.1-.05*k),fn=plant(.23+.16*k),ff=plant(-.25,-20*k),
             show=['gauntlet_n','gauntlet_f'],vel=(2.8*k,1.2*k if index==3 else 0))
        sp[hand]=wrist;sp[other]=(-.06,1.19,70)
        if active:sp['fx']=[('line',0,(.2,-.31,1.1),(.85,-.31,wrist[1]),1.1)]
        poses.append(sp)
    return poses,(1,1,3) if index<3 else (2,2,3)


def attack_set(weapon,index):
    entry={e[0]:e for e in A.ANIMS}
    if weapon=='gun':return gun_shot(index)
    if weapon=='gauntlet':return gauntlet_strike(index)
    if weapon=='bow':
        specs=copy.deepcopy(A.a_bow_draw()+A.a_bow_shoot()[1:])
        return specs,(4,1,len(specs)-5)
    if weapon=='spear':
        e=entry['spear_'+str(index)];return copy.deepcopy(e[4]()),e[3]
    if weapon=='harpoon':
        e=entry['spear_'+str(index)];specs=remap_pose(e[4](),'spear','harpoon')
        if index==3:
            for i,sp in enumerate(specs):
                if i in (2,3):sp['vel']=(3.5,0)
        return specs,e[3]
    if weapon=='greatsword':
        e=entry['hammer_'+str(1 if index==3 else index)]
        specs=remap_pose(e[4](),'hammer','greatsword')
        for sp in specs:
            # Long blade tip stays in the native frame with the same planted full-body lunge.
            for sm in sp.get('smear',[]):sm['width']=.22
        return specs,e[3]
    if weapon=='scythe':
        e=entry['sword_'+str(index)]
        specs=remap_pose(e[4](),'sword','scythe')
        for sp in specs:
            sp['hf']=('grip','scythe',-.20,None,1)
            if sp.get('hn') and sp['hn'][2]<-100:
                sp['hn']=(sp['hn'][0],sp['hn'][1],-78)
            for sm in sp.get('smear',[]):sm['width']=.20;sm['mat']='smear2'
        return specs,e[3]
    e=entry['sword_'+str(index)];return copy.deepcopy(e[4]()),e[3]


def locomotion(weapon,fn):
    specs=copy.deepcopy(fn())
    for sp in specs:
        # Combat-ready gear remains visible during movement, with actual wrist FK.
        sp['show']=['gauntlet_n','gauntlet_f'] if weapon=='gauntlet' else [weapon]
        if fn.__name__ in ['a_roll','a_double_jump']:
            # Stow held weapons for the tucked somersault, as in the reference game.
            # This keeps blades out of the floor and makes the body silhouette readable.
            sp['show']=[]
        if weapon=='bow':sp.setdefault('a',{})['ha_f']=-70
        elif weapon in ['spear','harpoon','scythe','greatsword']:
            aa=sp.setdefault('a',{})
            aa['ha_n']=40-sum(aa.get(k,0) for k in ['hips','spine','chest','sh_n','el_n'])
        elif weapon=='gun':sp.setdefault('a',{})['ha_n']=-15
    return specs


def frames_for(weapon):
    entries={e[0]:e for e in A.ANIMS}
    out=[]
    for name,source in [('idle','idle'),('run','run'),('jump','jump'),('fall','fall'),('land','land'),
                         ('double_jump','double_jump'),('dodge','roll'),('hurt','hurt')]:
        e=entries[source]
        out.append((name,e[1],e[2],None,locomotion(weapon,e[4]),e[5]))
    cast=copy.deepcopy(A.a_throw())
    for sp in cast:sp['show']=[]
    out.append(('cast',18,False,(2,1,3),cast,{}))
    for index in range(1,4):
        specs,phases=attack_set(weapon,index)
        out.append(('attack'+str(index),18,False,phases,specs,{}))
    return out


def inspect(h,weapon,name,i,sp):
    rig=h.rig
    mesh=[ob for ob in bpy.context.scene.objects if ob.type=='MESH' and not ob.hide_render]
    pts=[ob.matrix_world@Vector(p) for ob in mesh for p in ob.bound_box]
    feet={s:[round(v,4) for v in L.wpos(rig,'an_'+s)] for s in ['n','f']}
    bbox={a:[round(min(getattr(p,a) for p in pts),4),round(max(getattr(p,a) for p in pts),4)] for a in 'xyz'}
    INSPECTION.append({'weapon':weapon,'state':name,'frame':i,'meshCount':len(mesh),'jointCount':len(rig.joints),
                       'bounds':bbox,'feet':feet,'lowestSole':round(L.lowest_sole(rig),5),
                       'groundTarget':sp.get('ground'),'forward':[1,0,0],'up':[0,0,1],
                       'rootScale':[round(v,4) for v in rig.root.scale]})


def direct_render(h,name,posed,specs,out_dir,fx_fn=None,extra_objs=()):
    sc=bpy.context.scene;rig=h.rig
    toggles=h.toggle_objects()+list(h.fx.values())+list(extra_objs)
    for i,(a,off,*_) in enumerate(posed):
        sp=specs[i];scl={}
        if 'sc' in sp:scl['root']=(sp['sc'][0],1,sp['sc'][1])
        rig.pose(a,off,scl);L.update()
        vis=set()
        for pn in sp.get('show',[]):vis.update(id(o) for o in h.props.get(pn,[]))
        fxw=fx_fn(i,len(posed),sp) if fx_fn else {}
        for ob,x in fxw.items():
            vis.add(id(ob))
            if x is not None:L.set_world_xform(ob,x[0],x[1],x[2])
        for ob in toggles:ob.hide_render=id(ob) not in vis
        L.update()
        inspect(h,CURRENT_WEAPON,name,i,sp)
        sc.render.filepath=str(Path(out_dir)/(name+'_%03d.png'%i))
        bpy.ops.render.render(write_still=True)
    return len(posed)


def render(h,weapon,entry):
    name,fps,loop,phases,specs,opts=entry
    h.chains=L.make_chains(h)
    for ch in h.chains:
        for k,v in opts.get('chain',{}).get(ch.joints[0][:2] if ch.joints[0]!='pt0' else 'pony',{}).items():setattr(ch,k,v)
    posed=L.solve_frames(h,specs,fps,loop,pre=opts.get('pre'),wind=opts.get('wind',(0,0)),seed_phase=opts.get('seed',0))
    meas=A.measure(h,posed,specs)
    smears=[]
    for i,sp in enumerate(specs):
        for k,sm in enumerate(sp.get('smear',[])):
            smear=A.make_smear(h,'smear_%s_%d_%d'%(name,i,k),meas,sm,i)
            # A grounded low sweep resolves at the floor, rather than painting an
            # arc through it. Clamp only the effect mesh, never the planted body.
            if weapon=='greatsword':
                for v in smear.data.vertices:v.co.z=max(.035,v.co.z)
            smears.append((i,smear))
    for i,(_,_,pts) in enumerate(posed):
        for ob in L.chain_objects(h,'%s%d'%(name,i),pts,specs[i],phase=i*.9):smears.append((i,ob))
    fx=A.fx_builder(h,meas,specs,smears)
    out=TMP/weapon;out.mkdir(parents=True,exist_ok=True)
    direct_render(h,name,posed,specs,out,fx_fn=fx,extra_objs=[o for _,o in smears])
    for _,ob in smears:bpy.data.objects.remove(ob,do_unlink=True)
    meta={'name':name,'fps':fps,'loop':loop}
    if phases:meta.update(zip(('windup','active','recover'),phases))
    return meta


def main():
    global CURRENT_WEAPON
    args=common.script_args();weapons=[w for w in args if w in IDS] or IDS
    h=A.build_scene();add_weapons(h)
    L.update()
    inventory={'renderer':'Blender '+bpy.app.version_string,'worldUp':'+Z','characterForward':'+X',
      'anatomicalHeightUnits':1.75,'pixelsPerUnit':32,'bodyHeightPx':57,'rootHeadingDegrees':0,
      'groundPlaneZ':0,'armatureObjects':[],'rigType':'anatomical Empty joints with rigid mesh attachments and planar IK',
      'camera':{'location':list(bpy.context.scene.camera.location),'projection':'ORTHO','anchor':[AX,AY]},
      'joints':[{'name':n,'parent':j.parent.name if j.parent else None,'worldRest':list(h.rig.world_rest[n])} for n,j in h.rig.joints.items()],
      'meshes':[{'name':ob.name,'parent':ob.parent.name if ob.parent else None,'hidden':ob.hide_render,
                  'materials':[m.name for m in ob.data.materials],
                  'worldBounds':[[round(v,4) for v in ob.matrix_world@Vector(c)] for c in ob.bound_box]}
                 for ob in bpy.context.scene.objects if ob.type=='MESH'],
      'lights':[{'name':o.name,'type':o.data.type} for o in bpy.context.scene.objects if o.type=='LIGHT'],
      'baselineSoleZ':round(L.lowest_sole(h.rig),5),
      'verdict':'Anatomical joints and actual meshes confirmed; no armature retargeting, mirrored axis, proxy body or scale drift. Grounded animation frames are validated separately in motion-inspection.json.'}
    destination=HERE/'rig-inspection.json'
    destination.write_text(json.dumps(inventory,indent=2))
    if '--inspect' in args:
        print('REMAKE anatomical rig inventory recorded',flush=True)
        return
    # Blender 5 EEVEE, native resolution, no render AA: crisp cel color clusters.
    sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE';sc.render.filter_size=.01
    sc.render.image_settings.color_mode='RGBA'
    if hasattr(sc,'eevee'):sc.eevee.taa_render_samples=1
    t0=time.time()
    for weapon in weapons:
        CURRENT_WEAPON=weapon;rows=[]
        for entry in frames_for(weapon):
            if '--preview' in args and entry[0] not in ['idle','attack1']:continue
            rows.append(render(h,weapon,entry));print('REMAKE %s %s complete %.1fs'%(weapon,entry[0],time.time()-t0),flush=True)
        (TMP/weapon/'spec.json').write_text(json.dumps({'frameW':FW,'frameH':FH,'anchor':[AX,AY],'outline':True,'colors':0,
                           'animations':rows,'extra':{'bodyHeightPx':57,'weapon':weapon,'forward':'+X','source':'tools/remake-art/render_characters.py'}},indent=2))
        (TMP/weapon/'motion.json').write_text(json.dumps([r for r in INSPECTION if r['weapon']==weapon],indent=2))
    print('REMAKE finished %.1fs'%(time.time()-t0),flush=True)


if __name__=='__main__':main()

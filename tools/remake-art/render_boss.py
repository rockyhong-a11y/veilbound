"""Recover full queen flail motion using the authored reference rig, Blender 5.2.

Larger native transparent cells preserve original32px/u; no body rescaling.
Blender -b --factory-startup --python tools/remake-art/render_boss.py
"""
from pathlib import Path
import sys,runpy,json
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
import bpy
from mathutils import Vector
import lib_boss as B

RECORDS=[]
def direct_render(rig,fx,name,n,pose_fn,out_dir,vis_fn=None):
    fx.clear()
    scene=bpy.context.scene
    for i in range(n):
        result=pose_fn(i,n)
        rig.pose(result[0],result[1],result[2],result[3] if len(result)>3 else None)
        keys=vis_fn(i,n) if vis_fn else None
        for k,(ob,default) in fx.obs.items():ob.hide_render=(k not in keys) if keys is not None else not default
        bpy.context.view_layer.update()
        meshes=[ob for ob in bpy.context.scene.objects if ob.type=='MESH' and not ob.hide_render]
        pts=[ob.matrix_world@Vector(c) for ob in meshes for c in ob.bound_box]
        RECORDS.append({'state':name,'frame':i,'meshCount':len(meshes),'jointCount':len(rig.joints),
          'bounds':{a:[round(min(getattr(p,a) for p in pts),4),round(max(getattr(p,a) for p in pts),4)] for a in 'xyz'},
          'ankles':{s:[round(v,4) for v in rig.joints['an_'+s].matrix_world.translation] for s in ['n','f']}})
        scene.render.filepath=str(Path(out_dir)/f'{name}_{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    print(f'REMAKE QUEEN {name}: {n} frames',flush=True)

B.anim_render=direct_render
runpy.run_path(str(HERE/'asset_matron.py'),run_name='__main__')
(HERE/'boss-motion-inspection.json').write_text(json.dumps(RECORDS,indent=2))

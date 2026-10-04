"""Native 40x46 transparent HUD portrait from the actual heroine rig and palette."""
from pathlib import Path
import sys,copy
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
import bpy
import common
import lib_heroine as L
import asset_heroine as A
import render_characters as R
h=A.build_scene()
common.setup_sprite_camera(40,46,20,23,yaw_deg=20,pitch_deg=4,px_per_unit=80,target=(0,0,1.55))
specs=copy.deepcopy(A.a_idle()[:1]);specs[0]['show']=[]
R.CURRENT_WEAPON='portrait'
R.render(h,'portrait',('idle',10,True,None,specs,{}))
spec={'nativeSize':[40,46],'source':'tools/remake-art/render_portrait.py','role':'HUD head and shoulders portrait',
      'identity':'adult silver-haired heroine, teal armor and red scarf','forward':'+X'}
import json
(ROOT/'assets/remake/characters/portrait.json').write_text(json.dumps(spec,indent=2))
print('Native HUD portrait rendered',flush=True)

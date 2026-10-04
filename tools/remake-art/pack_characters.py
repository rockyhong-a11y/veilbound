"""Pack remake Blender renders, validate transparent footprint, and write provenance.

python3 tools/remake-art/pack_characters.py [weapon ...]
Native hard-alpha, four-neighbor one-pixel outline. No resizing of authored frames.
"""
from pathlib import Path
import sys,json,math
from PIL import Image,ImageDraw
import sheet

ROOT=Path(__file__).resolve().parents[2]
TMP=ROOT/'artifacts/remake-frames'
OUT=ROOT/'assets/remake/characters'
IDS=['sword','gauntlet','spear','gun','bow','harpoon','greatsword','scythe']
selected=[s for s in sys.argv[1:] if s in IDS] or IDS
report_path=ROOT/'tools/remake-art/motion-inspection.json'
reports=json.loads(report_path.read_text()) if report_path.exists() else {}
preview=Image.new('RGBA',(128*len(selected),112*5),(14,20,31,255))
for col,weapon in enumerate(selected):
    source=TMP/weapon;spec=json.loads((source/'spec.json').read_text())
    meta=sheet.pack(str(source),str(OUT/f'heroine-{weapon}.png'),spec['animations'],
                    spec['frameW'],spec['frameH'],spec['anchor'],True,0,spec['extra'])
    meta['version']=5;meta['provenance']='tools/remake-art/PROVENANCE.md'
    durations=[.23,.26,.34]
    delays=[.045,.055,.09]
    if weapon=='gauntlet':durations=[.13,.15,.2];delays=[.027,.033,.05]
    elif weapon=='spear':durations=[d*1.08 for d in durations];delays=[.065,.081,.097]
    elif weapon=='greatsword':durations=[d*1.75 for d in durations];delays=[.14,.165,.19]
    elif weapon=='scythe':durations=[d*1.18 for d in durations];delays=[.07,.088,.106]
    elif weapon in ['gun','bow','harpoon']:
        tempo={'gun':.86,'bow':1.3,'harpoon':1.55}[weapon]
        durations=[d*tempo for d in durations]
        delays=[.04]*3 if weapon=='gun' else [.12,.145,.17] if weapon=='bow' else [.16]*3
    for index in range(3):meta['animations']['attack'+str(index+1)]['damageAt']=round(delays[index]/durations[index],6)
    frames=[]
    for animation,row in meta['animations'].items():
        for frame in range(row['frames']):
            im=sheet.process(source/f'{animation}_{frame:03d}.png')
            bbox=im.getchannel('A').getbbox()
            if not bbox:raise AssertionError(f'{weapon}/{animation}/{frame}: empty')
            if not (bbox[0]>0 and bbox[1]>0 and bbox[2]<128 and bbox[3]<112):
                raise AssertionError(f'{weapon}/{animation}/{frame}: clipped {bbox}')
            alphas=set(im.getchannel('A').getdata())
            if not alphas<={0,255}:raise AssertionError('fractional alpha')
            frames.append({'state':animation,'frame':frame,'bbox':list(bbox)})
            if frame==0 and animation=='idle':meta['idleSilhouetteHeightPx']=bbox[3]-bbox[1]
    # One anatomical body across all weapons: a raised spear is not a taller woman.
    meta['bodyHeightPx']=57
    meta['animations']['dash']=dict(meta['animations']['dodge'])
    (OUT/f'heroine-{weapon}.json').write_text(json.dumps(meta,indent=2))
    motion=json.loads((source/'motion.json').read_text())
    grounded=[m for m in motion if m['groundTarget'] is not None]
    contactError=max(abs(m['lowestSole']-m['groundTarget']) for m in grounded)
    if contactError>.02:raise AssertionError(f'{weapon}: ground error {contactError}')
    reports[weapon]={'frames':len(frames),'bodyHeightPx':meta['bodyHeightPx'],
        'minEdgeMarginPx':min(min(f['bbox'][0],f['bbox'][1],128-f['bbox'][2],112-f['bbox'][3]) for f in frames),
        'groundedFrames':len(grounded),'maxSoleGroundErrorUnits':round(contactError,5),
        'forward':'+X','up':'+Z','rig':'rigid mesh parented to anatomical Empty joints, planar two-bone IK',
        'jointCount':motion[0]['jointCount'],'boneSemantics':['hips','spine','chest','neck','head','sh_n','sh_f','el_n','el_f','ha_n','ha_f','th_n','th_f','kn_n','kn_f','an_n','an_f'],
        'pixelBounds':frames,'sampledMotion':motion}
    for prow,(anim,frame) in enumerate([('idle',0),('run',3),('attack1',min(meta['animations']['attack1']['windup'],meta['animations']['attack1']['frames']-1)),('attack3',min(meta['animations']['attack3']['windup'],meta['animations']['attack3']['frames']-1)),('dodge',3)]):
        preview.alpha_composite(sheet.process(source/f'{anim}_{frame:03d}.png'),(col*128,prow*112))
    print(f'{weapon}: {len(frames)} frames, body {meta["bodyHeightPx"]} px, contact error {contactError:.5f} units')

(ROOT/'tools/remake-art/motion-inspection.json').write_text(json.dumps(reports,indent=2))
preview.save(ROOT/'artifacts/remake-character-contact.png')
manifest={'version':5,'frameW':128,'frameH':112,'anchor':[64,100],
    'heroine':{w:{'image':f'heroine-{w}.png','metadata':f'heroine-{w}.json'} for w in IDS},
    'enemies':{w:{'image':f'{w}.png','metadata':f'{w}.json'} for w in ['duelist','archer','warden','boss','lancer']},
    'title':'title-heroine.png','portrait':'portrait.png','source':'tools/remake-art/PROVENANCE.md','inspectionSource':'tools/remake-art/motion-inspection.json'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('All native frames fit canvas; hard alpha and grounded contacts checked.')

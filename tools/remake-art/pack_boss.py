"""Pack the unclipped Blender 5 queen frames and inspect all native enemy atlases."""
from pathlib import Path
import json,math
from PIL import Image
import sheet
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/remake/characters'
TMP=ROOT/'artifacts/remake-frames/boss'
spec=json.loads((TMP/'spec.json').read_text())
meta=sheet.pack(str(TMP),str(TMP/'boss-rows.png'),spec['animations'],spec['frameW'],spec['frameH'],spec['anchor'])
rows=Image.open(TMP/'boss-rows.png').convert('RGBA')
fw,fh=meta['frameW'],meta['frameH'];total=sum(c['frames'] for c in meta['animations'].values())
# Compact all141 frames into an11-column grid. Both texture dimensions stay
# below4096, and decoded RGBA memory falls from96MB to55MB.
columns=11;im=Image.new('RGBA',(columns*fw,math.ceil(total/columns)*fh))
start=0
for clip in meta['animations'].values():
    row=clip.pop('row');clip['start']=start
    for i in range(clip['frames']):
        frame=rows.crop((i*fw,row*fh,(i+1)*fw,(row+1)*fh))
        im.paste(frame,(((start+i)%columns)*fw,((start+i)//columns)*fh))
    start+=clip['frames']
meta['columns']=columns;meta['rows']=math.ceil(total/columns);meta['image']='boss.png'
im.save(OUT/'boss.png',optimize=True)
b=im.crop((0,0,meta['frameW'],meta['frameH'])).getchannel('A').getbbox()
meta.update({'bodyHeightPx':b[3]-b[1],'version':5,'source':'tools/remake-art/render_boss.py','provenance':'tools/remake-art/PROVENANCE.md'})
meta['animations']['summon'].update(windup=4,active=5,recover=3)
(OUT/'boss.json').write_text(json.dumps(meta,indent=2))
reports={}
for name in ['duelist','archer','warden','boss','lancer']:
    p=OUT/f'{name}.json';m=json.loads(p.read_text());im=Image.open(p.with_suffix('.png')).convert('RGBA')
    issues=[];count=0;margins=[]
    for anim,v in m['animations'].items():
        for i in range(v['frames']):
            count+=1;fw,fh=m['frameW'],m['frameH']
            index=v.get('start',0)+i
            sx=i*fw if 'row' in v else (index%m['columns'])*fw
            sy=v['row']*fh if 'row' in v else (index//m['columns'])*fh
            frame=im.crop((sx,sy,sx+fw,sy+fh))
            b=frame.getchannel('A').getbbox()
            if not b or min(b[:2])==0 or b[2]>=fw or b[3]>=fh:issues.append([anim,i,b])
            if b:margins.append(min(b[0],b[1],fw-b[2],fh-b[3]))
            assert set(frame.getchannel('A').getdata())<={0,255},(name,anim,i,'soft alpha')
    assert not issues,(name,issues)
    reports[name]={'frames':count,'boundsIssues':issues,'minEdgeMarginPx':min(margins),'bodyHeightPx':m['bodyHeightPx']}
    print(name,count,'frames; min transparent margin',min(margins))
(ROOT/'tools/remake-art/enemy-atlas-inspection.json').write_text(json.dumps(reports,indent=2))
print('Queen and all female enemy cells passed binary alpha and silhouette bounds.')

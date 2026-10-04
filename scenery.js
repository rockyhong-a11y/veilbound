import { ROOM_DEFS, W, H, FLOOR } from './world.js?v=5';

// The simulation retains its authored geometry. Art tiles only decorate those
// exact rectangles; they never quantise platforms, walls, or collision bounds.
const ROOT = 'assets/remake/scenery/';
const TILE = 48;
const THEMES = [
  { id:'prison', tiles:'prison', bg:'prison', sky:'#080d18', accent:'#8de3d2', stone:'#477b81', shade:'#111b2c', tint:'#163752', amount:.04 },
  { id:'aqueduct', tiles:'prison', bg:'prison', sky:'#051723', accent:'#9beafa', stone:'#477e96', shade:'#0b202d', tint:'#207eac', amount:.12, bgFilter:'hue-rotate(22deg) saturate(.85) brightness(1.03)', bgTint:'#164275', bgTintAlpha:.12 },
  { id:'archive', tiles:'ramparts', bg:'ramparts', sky:'#130e26', accent:'#d8bbf5', stone:'#766ca2', shade:'#1c142e', tint:'#6b339c', amount:.1 },
  { id:'garden', tiles:'ramparts', bg:'ramparts', sky:'#081b23', accent:'#c7e3ac', stone:'#6b877a', shade:'#0d2025', tint:'#478458', amount:.16, bgFilter:'hue-rotate(-92deg) saturate(.72) brightness(.95)', bgTint:'#164d45', bgTintAlpha:.16 },
  { id:'forge', tiles:'tower', bg:'tower', sky:'#1c090c', accent:'#ffc280', stone:'#a46743', shade:'#241014', tint:'#cc5e27', amount:.07 },
  { id:'cathedral', tiles:'ramparts', bg:'tower', sky:'#170e26', accent:'#eed8a7', stone:'#7d7297', shade:'#181124', tint:'#76519c', amount:.13, bgFilter:'hue-rotate(218deg) saturate(.65) brightness(.92)', bgTint:'#251e64', bgTintAlpha:.18 },
];

const hash = (x,y,s=1) => {
  let h = (Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s,2246822519))|0;
  h = Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296;
};
const mod = (n,d) => ((n%d)+d)%d;
const intersects = (r,v,p=80) => r.x+r.w>=v.camera-p && r.x<=v.camera+v.viewW+p && r.y+r.h>=v.cameraY-p && r.y<=v.cameraY+v.viewH+p;
const themeFor = v => THEMES[Math.max(0,Math.min(5,v.state.room|0))];
const defFor = v => ROOM_DEFS[v.state.room] || ROOM_DEFS[0];
const box = (x,y,w,h) => ({x,y,w,h});

function canvas(w,h) {
  const c = document.createElement('canvas'); c.width=w; c.height=h; return c;
}
function image(path) {
  return new Promise(resolve => {
    const im = new Image(); im.onload=()=>resolve(im); im.onerror=()=>resolve(null); im.src=ROOT+path+'?v=5';
  });
}
async function json(path) {
  try { const r=await fetch(ROOT+path+'?v=5'); return r.ok?await r.json():null; } catch { return null; }
}
function polygon(c,pts,fill) {
  c.fillStyle=fill; c.beginPath(); pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath(); c.fill();
}

/** A bounded renderer: small repeating textures, cached halos, visible slices. */
export async function createScenery() {
  const sources = {}, layers = {}, textures = new Map(), patterns = new WeakMap(), halos = new Map(), coloredLayers = new Map();
  await Promise.all(['prison','ramparts','tower'].map(async name => {
    const [im,atlas,bg,...imgs] = await Promise.all([image('tiles/'+name+'.png'),json('tiles/'+name+'.json'),json('bg/'+name+'.json'),...Array.from({length:4},(_,i)=>image('bg/'+name+'_'+i+'.png'))]);
    sources[name]={im,atlas}; layers[name]=(bg?.layers||[]).map((l,i)=>({...l,im:imgs[i]}));
  }));

  function texture(theme,kind) {
    const key=theme.id+'/'+kind;
    if(textures.has(key))return textures.get(key);
    const source=sources[theme.tiles], list=source.atlas?.[kind];
    if(!source.im||!list?.length)return null;
    const c=canvas(TILE*8,TILE*4),g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    for(let y=0;y<4;y++)for(let x=0;x<8;x++){
      const r=list[(y*8+x)%list.length];g.drawImage(source.im,r[0],r[1],r[2],r[3],x*TILE,y*TILE,TILE,TILE);
    }
    g.globalCompositeOperation='source-atop';g.globalAlpha=theme.amount;g.fillStyle=theme.tint;g.fillRect(0,0,c.width,c.height);
    textures.set(key,c);return c;
  }
  function fill(c,theme,kind,x,y,w,h) {
    if(w<=0||h<=0)return;
    const t=texture(theme,kind);
    if(!t){c.fillStyle=kind==='backwall'?theme.shade:theme.stone;c.fillRect(x,y,w,h);return;}
    let bank=patterns.get(c);if(!bank){bank=new Map();patterns.set(c,bank);}
    const key=theme.id+'/'+kind;let p=bank.get(key);if(!p){p=c.createPattern(t,'repeat');bank.set(key,p);}
    c.fillStyle=p;c.fillRect(x,y,w,h);
  }
  function region(c,theme,r,x,y,scale=2,opacity=1) {
    const im=sources[theme.tiles].im;if(!im||!r)return;
    c.save();c.globalAlpha*=opacity;c.imageSmoothingEnabled=false;
    c.drawImage(im,r[0],r[1],r[2],r[3],Math.round(x+(r[4]||0)*scale),Math.round(y+(r[5]||0)*scale),r[2]*scale,r[3]*scale);c.restore();
  }
  function halo(c,x,y,r,color,alpha=.4) {
    if(alpha<=0)return;
    let im=halos.get(color);
    if(!im){im=canvas(96,96);const g=im.getContext('2d'),gr=g.createRadialGradient(48,48,1,48,48,48);gr.addColorStop(0,color);gr.addColorStop(.25,color+'b0');gr.addColorStop(.62,color+'35');gr.addColorStop(1,color+'00');g.fillStyle=gr;g.fillRect(0,0,96,96);halos.set(color,im);}
    c.save();c.globalCompositeOperation='screen';c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;c.drawImage(im,x-r,y-r,r*2,r*2);c.restore();
  }

  function layerImage(theme,layer,index) {
    if(!theme.bgFilter||!layer.im)return layer.im;
    const key=theme.id+'/'+index;
    if(coloredLayers.has(key))return coloredLayers.get(key);
    // At most three recolored biomes × four native 1024×512 layers. Filtering
    // happens once on this small cached source, never on the frame canvas.
    const im=layer.im,c=canvas(im.width,im.height),g=c.getContext('2d');
    g.imageSmoothingEnabled=false;g.filter=theme.bgFilter;g.drawImage(im,0,0);g.filter='none';
    g.globalCompositeOperation='source-atop';g.globalAlpha=theme.bgTintAlpha;
    g.fillStyle=theme.bgTint;g.fillRect(0,0,c.width,c.height);
    coloredLayers.set(key,c);return c;
  }

  function parallax(c,v,theme,front=false) {
    const set=layers[theme.bg]||[], sc=1.8;
    for(let i=0;i<set.length;i++){
      if((i===3)!==front)continue;
      const l=set[i],im=layerImage(theme,l,i);if(!im)continue;
      const w=im.width*sc,h=im.height*sc;
      const slide=Math.min(Math.max(0,h-v.viewH),Math.max(0,H-v.viewH-v.cameraY)*(l.vpar||.08));
      const y=Math.round(v.cameraY+v.viewH-h+slide+(l.y||0)*sc);
      const start=v.camera-mod(v.camera*(l.parallax||.05),w)-w;
      c.save();c.imageSmoothingEnabled=false;c.globalAlpha=front?(theme.id==='garden'?.2:.16):i===0?.66:i===1?.5:.36;
      for(let x=start;x<v.camera+v.viewW+w;x+=w)c.drawImage(im,Math.round(x),y,w,h);
      c.restore();
    }
  }

  // Repeating vaulted bays provide depth without implying new collision walls.
  // Their columns are muted behind the playable surfaces and the open centres
  // retain all four parallax layers.
  function arcade(c,v,theme) {
    const atlas=sources[theme.tiles].atlas,dec=atlas?.backdeco;
    const spacing=theme.id==='cathedral'?560:480, height=theme.id==='cathedral'?470:350;
    const from=Math.floor((v.camera-160)/spacing),to=Math.ceil((v.camera+v.viewW+160)/spacing);
    for(let row=0;row<5;row++){
      const bottom=FLOOR-row*410+Math.round(v.cameraY*.04);
      if(bottom<v.cameraY-100||bottom-height>v.cameraY+v.viewH+120)continue;
      for(let col=from;col<=to;col++){
        const x=col*spacing+42+v.camera*.025,w=spacing-94,y=bottom-height;
        c.save();c.globalAlpha=.68;
        fill(c,theme,'backwall',x,y,34,height);fill(c,theme,'backwall',x+w-34,y,34,height);
        fill(c,theme,'backwall',x,y,w,32);
        c.fillStyle=theme.shade;c.globalAlpha=.55;c.fillRect(x,y,34,height);c.fillRect(x+w-34,y,34,height);
        c.globalAlpha=.65;
        polygon(c,[[x+32,y+height*.43],[x+32,y+105],[x+74,y+68],[x+w/2,y+26],[x+w-74,y+68],[x+w-32,y+105],[x+w-32,y+height*.43],[x+w-46,y+108],[x+w/2,y+52],[x+46,y+108]],theme.stone);
        c.globalAlpha=.35;c.fillStyle=theme.accent;c.fillRect(x+27,y+65,3,height-65);c.fillRect(x+w-30,y+65,3,height-65);
        // Small stone collar and arch cap, rather than featureless pillars.
        region(c,theme,dec?.pillar?.top,x-4,y,1.5,.9);region(c,theme,dec?.pillar?.bot,x-4,bottom-36,1.5,.9);
        region(c,theme,dec?.pillar?.top,x+w-63,y,1.5,.9);region(c,theme,dec?.pillar?.bot,x+w-63,bottom-36,1.5,.9);
        if(hash(col,row,8)>.6)region(c,theme,dec?.special2,x+w/2-32,y+96,1.4,.48);
        if(theme.id==='prison'&&row===0){
          // High cell bars sit deep in the opening; the floor remains legible.
          c.fillStyle='#07151c';c.globalAlpha=.5;
          for(let bx=x+88;bx<x+w-60;bx+=30)c.fillRect(bx,y+137,5,height-167);
          c.fillRect(x+70,bottom-62,w-140,7);
        }
        if(theme.id==='archive')books(c,x+57,bottom-15,w-115,2,.8);
        if(theme.id==='forge'){
          c.fillStyle='#bb552c';c.globalAlpha=.4;c.fillRect(x+58,bottom-85,w-116,11);
          for(let bx=x+65;bx<x+w-63;bx+=28){c.fillStyle='#070d17';c.fillRect(bx,bottom-80,11,48);}
          halo(c,x+w/2,bottom-62,140,'#ff9950',.28);
        }
        if(theme.id==='cathedral'){
          c.globalAlpha=.3;c.fillStyle='#dfcfa5';c.fillRect(x+w/2-3,y+89,6,90);c.fillRect(x+w/2-26,y+111,52,4);
          halo(c,x+w/2,y+123,190,'#d8a6f3',.18);
        }
        c.restore();
      }
    }
  }

  function books(c,x,y,w=110,scale=1,alpha=1) {
    c.save();c.globalAlpha*=alpha;c.fillStyle='#291b2c';c.fillRect(x,y,w,5*scale);
    for(let i=0;i<Math.ceil(w/(10*scale));i++){
      const xx=x+i*10*scale,h=(19+hash(i,x|0,17)*16)*scale;
      c.fillStyle=['#876158','#6d8795','#866b91','#b39763','#637670'][i%5];c.fillRect(xx,y-h,7*scale,h);
      c.fillStyle='#e3bf88';c.fillRect(xx+scale,y-h+5*scale,5*scale,scale);
    }c.restore();
  }
  function chain(c,x,y,h=330,alpha=.8) {
    c.save();c.globalAlpha*=alpha;
    for(let i=0;i<h;i+=17){const dx=Math.round(Math.sin(i*.021)*3);c.fillStyle='#101a25';c.fillRect(x+dx-5,y+i,10,13);c.fillStyle='#647882';c.fillRect(x+dx-3,y+i,2,12);c.fillRect(x+dx-3,y+i+1,6,2);c.fillRect(x+dx+3,y+i+2,2,10);}
    c.restore();
  }
  function vine(c,x,y,h,time,flower=false) {
    for(let branch=0;branch<3;branch++){
      let oldX=x+branch*15-15;
      for(let i=0;i<h;i+=15){
        const xx=Math.round(x+branch*15-15+Math.sin(i*.035+time*.75+branch)*10);
        c.fillStyle='#244438';c.fillRect(Math.min(oldX,xx),y+i,Math.abs(xx-oldX)+3,17);
        c.fillStyle=flower&&i%45===0?'#da98c0':'#648675';
        c.fillRect(xx+(i%30===0?-9:4),y+i+7,8,4);
        if(flower&&i%45===0){c.fillStyle='#f2d3df';c.fillRect(xx-3,y+i+5,4,5);}
        oldX=xx;
      }
    }
  }
  function waterfall(c,x,y,h,time,scale=1) {
    c.save();c.globalCompositeOperation='screen';c.globalAlpha=.35;
    c.fillStyle='#365c6d';c.fillRect(x-24*scale,y,48*scale,h);
    for(let i=0;i<12;i++){
      const xx=x-23*scale+i*4*scale,yy=y+mod(time*(145+i*3)+i*83,h);
      c.fillStyle=i%3===0?'#b3eafa':'#49899e';c.fillRect(xx,yy,2*scale,24+i%4*8);
    }
    c.globalAlpha=.22;c.fillStyle='#b8e9e8';for(let i=0;i<7;i++)c.fillRect(x-34*scale+i*10*scale,y+h-4-Math.round(Math.sin(time*3+i)*3),9*scale,3);
    c.restore();halo(c,x,y+h-7,100*scale,'#77d5ea',.12);
  }
  function torch(c,x,y,time,scale=1,theme=THEMES[0]) {
    c.save();c.translate(x,y);c.scale(scale,scale);
    c.fillStyle='#15212c';c.fillRect(-11,-3,22,12);c.fillRect(-4,6,8,17);c.fillStyle='#89927e';c.fillRect(-9,-5,18,3);c.fillRect(-3,10,2,12);
    const f=Math.round(Math.sin(time*15+x)*3);
    polygon(c,[[-7,-7],[-9,-17],[-4,-23],[1,-41-f],[5,-24],[9,-17],[6,-7]],theme.id==='aqueduct'?'#74dfed':'#eaaa60');
    polygon(c,[[-3,-8],[-4,-17],[1,-28-f],[4,-14],[2,-8]],'#fff2c3');
    halo(c,0,-21,125,theme.id==='aqueduct'?'#69cfe5':'#ffc276',.35+.035*Math.sin(time*17+x));c.restore();
  }
  function decoration(c,d,v,theme) {
    const sc=d.scale||1;if(!intersects(box(d.x-90*sc,d.y-80*sc,180*sc,420*sc),v,90))return;
    c.save();c.translate(d.x,d.y);c.scale(sc,sc);
    if(d.kind==='torch')torch(c,0,0,v.time,1,theme);
    else if(d.kind==='chain'){chain(c,0,0,310,.8);polygon(c,[[-12,310],[12,310],[18,334],[-18,334]],'#374552');}
    else if(d.kind==='banner'){
      c.fillStyle='#ab9270';c.fillRect(-26,-6,52,5);const sway=Math.round(Math.sin(v.time*1.7+d.x)*3);
      polygon(c,[[-22,0],[22,0],[19+sway,145],[sway,132],[-19+sway,145]],theme.id==='garden'?'#587251':'#72415c');
      c.fillStyle='#d8b582';c.fillRect(-17,2,2,117);c.fillRect(15,2,2,117);polygon(c,[[0,40],[9,52],[0,66],[-9,52]],'#e2c89a');
    }else if(d.kind==='waterfall')waterfall(c,0,0,350,v.time);
    else if(d.kind==='books')books(c,-55,0);
    else if(d.kind==='vines'||d.kind==='flowers')vine(c,0,d.kind==='flowers'?-55:0,d.kind==='flowers'?70:170,v.time,d.kind==='flowers');
    else if(d.kind==='pipe'){
      c.fillStyle='#1b2430';c.fillRect(-50,-10,59,21);c.fillRect(-10,0,21,165);c.fillStyle='#4f7980';c.fillRect(-50,-7,55,5);c.fillRect(-7,4,4,157);c.fillStyle='#877967';for(let y=24;y<166;y+=49)c.fillRect(-14,y,28,7);
    }c.restore();
  }

  function ambience(c,v,theme) {
    const n=theme.id==='forge'?40:24;
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<n;i++){
      const x=v.camera+mod(i*139+v.time*(theme.id==='garden'?8:3),v.viewW+60)-30;
      const y=v.cameraY+mod(i*83-v.time*(theme.id==='forge'?28:6),v.viewH+70)-35;
      const life=.2+.3*Math.sin(v.time*1.2+i);
      c.globalAlpha=Math.max(.05,life);c.fillStyle=theme.id==='forge'?'#ffc174':theme.id==='garden'?'#d7a7d7':theme.accent;
      c.fillRect(Math.round(x),Math.round(y),i%7===0?3:2,i%7===0?3:2);
    }c.restore();
  }

  function reliquaryBay(c,v,theme,x,foot,forge=false) {
    if(!intersects(box(x-135,foot-285,270,285),v,50))return;
    const atlas=sources[theme.tiles].atlas;
    c.save();c.globalAlpha=.8;
    fill(c,theme,'backwall',x-82,foot-234,164,220);
    c.fillStyle=theme.shade;c.globalAlpha=.55;c.fillRect(x-82,foot-234,164,220);c.globalAlpha=.9;
    region(c,theme,atlas?.backdeco?.arch,x-72,foot-212,2,.85);
    region(c,theme,atlas?.backdeco?.pillar?.top,x-103,foot-242,1.4,.9);
    region(c,theme,atlas?.backdeco?.pillar?.top,x+36,foot-242,1.4,.9);
    fill(c,theme,'fillMid',x-99,foot-206,16,184);fill(c,theme,'fillMid',x+83,foot-206,16,184);
    c.fillStyle=forge?'#e9bc85':theme.accent;c.globalAlpha=.65;
    polygon(c,[[x,foot-263],[x+10,foot-247],[x,foot-232],[x-10,foot-247]],c.fillStyle);
    halo(c,x,foot-128,175,forge?'#edaa65':theme.accent,.16+.03*Math.sin(v.time*2));
    torch(c,x-109,foot-115,v.time,.62,theme);torch(c,x+109,foot-115,v.time,.62,theme);
    c.restore();
  }

  function drawBackground(c,v) {
    const theme=themeFor(v);c.save();c.imageSmoothingEnabled=false;
    c.fillStyle=theme.sky;c.fillRect(v.camera-20,v.cameraY-20,v.viewW+40,v.viewH+40);
    parallax(c,v,theme);arcade(c,v,theme);
    if(theme.id==='aqueduct'){
      for(let x=Math.floor(v.camera/640)*640;x<v.camera+v.viewW+640;x+=640)waterfall(c,x+460,FLOOR-690,670,v.time,1.1);
      c.save();c.globalAlpha=.09;c.fillStyle='#74bbc8';c.fillRect(v.camera,FLOOR-50,v.viewW,50);c.restore();
    }
    if(theme.id==='garden'){
      for(let x=Math.floor(v.camera/530)*530;x<v.camera+v.viewW+530;x+=530){c.save();c.globalAlpha=.4;vine(c,x+120,FLOOR-500,480,v.time,true);c.restore();}
    }
    for(const shrine of defFor(v).shrines||[])reliquaryBay(c,v,theme,shrine.x,shrine.y,true);
    for(const vault of defFor(v).hordeVaults||[])reliquaryBay(c,v,theme,vault.x+(vault.w||48)/2,vault.y+(vault.h||35),false);
    for(const d of defFor(v).decorations||[])decoration(c,d,v,theme);
    ambience(c,v,theme);c.restore();
  }

  function drawBlock(c,r,v,options={}) {
    if(!intersects(r,v,60))return;
    const theme=themeFor(v),atlas=sources[theme.tiles].atlas, floating=!!options.floating;
    c.save();c.imageSmoothingEnabled=false;c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();
    fill(c,theme,'fillDeep',r.x,r.y,r.w,r.h);
    fill(c,theme,'fillMid',r.x,r.y,r.w,Math.min(r.h,TILE*2));
    fill(c,theme,'fill',r.x,r.y,r.w,Math.min(r.h,TILE));
    if(!floating&&r.h>TILE){fill(c,theme,'fill',r.x,r.y,Math.min(TILE,r.w),r.h);fill(c,theme,'fill',r.x+Math.max(0,r.w-TILE),r.y,Math.min(TILE,r.w),r.h);}
    // Deep masonry is calmer than the playable edges, which read at a glance.
    c.fillStyle=theme.shade;c.globalAlpha=.22;c.fillRect(r.x,r.y+Math.min(TILE*2,r.h),r.w,Math.max(0,r.h-TILE*2));c.globalAlpha=1;
    const first=Math.max(0,Math.floor((v.camera-r.x-50)/TILE)),last=Math.min(Math.ceil(r.w/TILE),Math.ceil((v.camera+v.viewW-r.x+50)/TILE));
    for(let i=first;i<last;i++){
      const useMoss=(theme.id==='garden'||theme.id==='aqueduct'||theme.id==='prison')&&hash(i,r.y|0,5)>.48;
      const list=useMoss?atlas?.topMoss:atlas?.top;
      if(list?.length)region(c,theme,list[Math.floor(hash(i,r.y|0,7)*list.length)],r.x+i*TILE,r.y,2);
    }
    c.fillStyle=theme.accent;c.globalAlpha=floating?.75:.48;c.fillRect(r.x,r.y,r.w,2);c.globalAlpha=.25;c.fillStyle='#fff4d8';c.fillRect(r.x,r.y+3,r.w,1);c.globalAlpha=1;
    if(options.cracked){
      c.strokeStyle='#efcf9e';c.lineWidth=3;c.beginPath();c.moveTo(r.x+r.w*.64,r.y+5);c.lineTo(r.x+r.w*.35,r.y+r.h*.21);c.lineTo(r.x+r.w*.66,r.y+r.h*.43);c.lineTo(r.x+r.w*.22,r.y+r.h*.62);c.lineTo(r.x+r.w*.53,r.y+r.h*.8);c.lineTo(r.x+r.w*.3,r.y+r.h);c.stroke();
    }
    c.restore();
    if(floating){
      c.save();c.fillStyle='#080f1b';c.globalAlpha=.65;c.fillRect(r.x+4,r.y+r.h,r.w-8,4);
      const list=atlas?.bottom;
      if(list?.length){
        c.beginPath();c.rect(r.x-3,r.y+r.h-12,r.w+6,30);c.clip();
        for(let i=first;i<last;i++)region(c,theme,list[Math.floor(hash(i,r.y|0,2)*list.length)],r.x+i*TILE,r.y+r.h-23,1.45,.7);
      }c.restore();
    }
  }

  function drawTerrain(c,v) {
    const def=defFor(v);c.save();c.imageSmoothingEnabled=false;
    for(const r of def.solids||[])drawBlock(c,r,v);
    drawBlock(c,box(0,FLOOR,def.width||W,Math.max(H,v.cameraY+v.viewH+80)-FLOOR),v);
    for(const r of def.platforms||[]){
      drawBlock(c,r,v,{floating:true});
      if(r.w>265&&intersects(r,v,70))torch(c,r.x+r.w-27,r.y-4,v.time,.7,themeFor(v));
    }
    // Waypoints are the same validated jumps used by the traversal tests.
    // Small marks on their true surfaces offer a route without painting arrows
    // across the action or revealing undiscovered parts of the map.
    const theme=themeFor(v);
    c.save();c.fillStyle=theme.accent;
    for(const wp of def.waypoints||[]){
      if(wp.action!=='jump'||!intersects(box(wp.x-12,wp.y-30,24,32),v,0))continue;
      c.globalAlpha=.38+.12*Math.sin(v.time*2+wp.x);
      c.fillRect(wp.x-7,wp.y-4,14,2);
      polygon(c,[[wp.x-4,wp.y-17],[wp.x,wp.y-23],[wp.x+4,wp.y-17],[wp.x+2,wp.y-17],[wp.x,wp.y-20],[wp.x-2,wp.y-17]],theme.accent);
    }c.restore();c.restore();
  }

  function drawForeground(c,v) {
    const theme=themeFor(v);c.save();parallax(c,v,theme,true);
    // Sparse high hanging accents are deliberately transparent and stay clear
    // of the heroine's feet and the main attack lane.
    const spacing=740;
    for(let i=Math.floor(v.camera/spacing)-1;i<=Math.ceil((v.camera+v.viewW)/spacing)+1;i++){
      const x=i*spacing+210+v.camera*.11,anchor=Math.floor(v.cameraY/410)*410-22;
      if(x<v.camera-40||x>v.camera+v.viewW+40)continue;
      c.globalAlpha=.28;
      if(theme.id==='garden')vine(c,x,anchor,130,v.time,true);else chain(c,x,anchor,145,.7);
    }
    c.restore();
  }

  return { drawBackground, drawTerrain, drawForeground, drawBlock };
}

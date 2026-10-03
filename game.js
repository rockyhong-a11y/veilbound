import { W, H, FLOOR, ROOM_DEFS, SKILLS, createRun, step, attack, jump, dash, heal, interact, chooseBoon, roomFor, skill, groundSlam, shatterAt } from './engine.js?v=2';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha:false });
const stage = $('stage'), menu = $('menu'), modal = $('modal');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let meta = {}, storageOK = true;
try { const saved = JSON.parse(localStorage.getItem('veilbound-v1') || '{}'); meta = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { storageOK = false; }
let state = createRun(meta), started = false, paused = false, camera = 0, cameraY = 180, viewW = 1100, viewH = 650, lastRoom = -1, mapOpen = false, cameraRoom = -1;
let lastTime = 0, uiAt = 0, bannerUntil = 0, lastMode = '', lastMessage = '', soundOn = false, audio, musicAt = 0, musicStep = 0;
const keys = new Set(), pointers = new Map();
const input = { move:0, attack:false, down:false }, images = {};
let animations = {}, lastTap = { at:0, x:0, y:0 }, renderedScale = 1, cameraOffsetX = 0, cameraOffsetY = 0;
const ambience = Array.from({ length:52 }, (_, i) => ({ x:(i * 431 + 73) % W, y:(i * 227 + 91) % H, size:i % 3 + .5, speed:9 + i % 23, phase:i * 1.71 }));
const assetPaths = { prison:'assets/bg-prison.png', cathedral:'assets/bg-cathedral.png', cover:'assets/cover.png', player:'assets/player.png', duelist:'assets/duelist.png', archer:'assets/archer.png', warden:'assets/warden.png', boss:'assets/boss.png' };

function save() {
  meta = { ...state.meta };
  try { localStorage.setItem('veilbound-v1', JSON.stringify(meta)); } catch { storageOK = false; }
}
function resize() {
  const rect = stage.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  viewH = Math.min(650, 1100 * rect.height / rect.width); viewW = viewH * rect.width / rect.height;
}
new ResizeObserver(resize).observe(stage);

function tone(freq, duration = .12, type = 'sine', volume = .04, slide = 1) {
  if (!soundOn || !audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, at); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), at + duration);
  g.gain.setValueAtTime(volume, at); g.gain.exponentialRampToValueAtTime(.001, at + duration);
  o.connect(g).connect(audio.destination); o.start(at); o.stop(at + duration);
}
function enableAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  audio.resume().catch(() => {});
}
function sound(event) {
  const tones = { attack:[170,.1,'sawtooth',.022,.3], hit:[90,.1,'triangle',.09,.4], hurt:[150,.18,'sawtooth',.035,.4], dash:[260,.17,'triangle',.03,.3], jump:[220,.1,'sine',.03,1.5], pickup:[660,.14,'sine',.025,1.5], heal:[440,.6,'sine',.04,1.5], kill:[120,.28,'triangle',.05,.4], clear:[330,.4,'sine',.05,2], choose:[440,.4,'sine',.04,2], dead:[110,1.2,'triangle',.055,.35], win:[440,1.5,'sine',.05,2], boss:[65,1.2,'sawtooth',.024,.7] };
  if (tones[event]) tone(...tones[event]);
  if(['hit','kill','shatter','slamHit','skill','storm'].includes(event)){
    const hard=['kill','shatter','slamHit','storm'].includes(event);
    tone(hard?58:82,hard?.25:.09,'triangle',hard?.09:.055,.28);
    tone(hard?1280:1750,.065,'square',.012,.2);
    if(hard)tone(220,.22,'sawtooth',.018,.25);
  }
}
function music(time) {
  if (!soundOn || time < musicAt) return;
  musicAt = time + (state.room === 5 && started ? .38 : .9);
  const notes = [146.83,220,293.66,349.23,293.66,220,164.81,220,130.81,196,261.63,329.63,261.63,196,164.81,196];
  const n = notes[musicStep++ % notes.length];
  tone(n,1.8,'sine',.012); if (musicStep % 4 === 0) tone(n/2,2.5,'triangle',.012);
}
$('sound').onclick = () => { try { enableAudio(); soundOn = !soundOn; } catch { soundOn = false; toast('이 브라우저에서는 소리를 사용할 수 없습니다.'); } $('sound').textContent = soundOn ? '♫' : '♪'; $('sound').setAttribute('aria-label', soundOn ? '소리 끄기' : '소리 켜기'); $('sound').style.color = soundOn ? '#d9ba7f' : ''; };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); } catch { toast('브라우저의 전체 화면 기능을 사용할 수 없습니다.'); } };

function legacy() {
  $('legacy').classList.toggle('hidden', !meta.embers && !meta.power);
  $('embers').textContent = meta.embers || 0;
  const cost = 5 + (meta.power || 0) * 3;
  $('upgrade-cost').textContent = (meta.power || 0) >= 12 ? '최대 강화' : `${cost} 불씨`;
  $('upgrade').disabled = (meta.embers || 0) < cost || (meta.power || 0) >= 12;
}
$('upgrade').onclick = () => {
  const cost = 5 + (meta.power || 0) * 3;
  if ((meta.embers || 0) < cost || (meta.power || 0) >= 12) return;
  meta.embers -= cost; meta.power = (meta.power || 0) + 1;
  state.meta = { ...meta }; save(); legacy(); sound('choose'); toast(`영구 검 강화 +${meta.power * 2} · 다음 여정에 적용됩니다.`);
};
function startRun() {
  state = createRun(meta); started = true; paused = false; mapOpen = false; lastMode = ''; lastRoom = -1; lastMessage = ''; cameraRoom = -1;
  menu.classList.add('hidden'); modal.classList.add('hidden'); $('hud').classList.remove('hidden'); $('map').classList.remove('hidden');
  for(const id of ['heal','skills','minimap-button','objective'])$(id).classList.remove('hidden');
  keys.clear(); pointers.clear(); input.move = 0; input.attack = false; input.down = false;
  if (soundOn) enableAudio(); canvas.focus({ preventScroll:true }); save();
}
$('start').onclick = startRun;

function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 3200); }
function banner() {
  const def = roomFor(state);
  $('room-banner').querySelector('small').textContent = `0${state.room + 1} · ${def.subtitle}`;
  $('room-banner').querySelector('strong').textContent = def.name;
  $('room-banner').querySelector('span').textContent = state.room === 5 ? '왕국의 마지막 밤.' : ['재 속에서, 다시.','가라앉은 기억을 지나.','잊혀진 이름을 찾아.','아름다움은 끝내 살아남는다.','검은 불길을 건너.'][state.room];
  $('room-banner').classList.add('show'); bannerUntil = performance.now() + 2600;
}
function openModal(eyebrow, title, description, action, callback) {
  $('modal').querySelector('.modal-body').classList.remove('map-modal');
  $('modal-eyebrow').textContent = eyebrow; $('modal-title').textContent = title; $('modal-description').textContent = description;
  $('modal-options').replaceChildren(); $('modal-options').className = '';
  $('modal-action').classList.remove('hidden'); $('modal-action').querySelector('span').textContent = action;
  $('modal-action').onclick = callback; modal.classList.remove('hidden'); $('modal-action').focus({ preventScroll:true });
}
function pauseGame() {
  if (!started || state.mode !== 'playing') return;
  paused = !paused; keys.clear(); input.move = 0; input.attack = false; pointers.clear();
  if (paused) openModal('A MOMENT BETWEEN LIVES','칼날 사이의 숨','왼쪽 드래그: 이동 · 오른쪽 터치/누르기: 연속 검격\n위로 쓸기: 이중 점프 · 옆으로 쓸기: 회피 · 아래로 쓸기: 낙하 공격\n오른쪽 두 번 터치: 혈월의 검기 · 스킬 아이콘: 두 가지 스킬\n상자와 균열 벽을 터치해 부수고, 열쇠와 숨겨진 보물을 찾으세요.\nR/T 스킬 · ↓ 낙하 · E 상호작용 · M 탐험 지도 · Q 회복','여정 계속하기', pauseGame);
  else { modal.classList.add('hidden'); canvas.focus({ preventScroll:true }); }
}
$('pause').onclick = pauseGame;
$('context').onclick = () => { if (!paused) interact(state); };
$('heal').onclick = () => { if (!paused) { if (!heal(state)) toast(state.player.flask ? '체력이 가득 찼습니다.' : '회복 물약이 없습니다.'); } };
for(let i=0;i<2;i++)$('skill-'+i).onclick=()=>{if(!paused&&started)skill(state,i);};
$('minimap-button').onclick=toggleMap;
function toggleMap(){
  if(!started||state.mode!=='playing')return;
  if(mapOpen){mapOpen=false;paused=false;modal.classList.add('hidden');canvas.focus({preventScroll:true});return;}
  paused=true;mapOpen=true;keys.clear();pointers.clear();input.move=0;input.attack=false;input.down=false;
  openModal('THE PATH YOU HAVE WALKED',roomFor(state).name,'','지도로부터 돌아가기',toggleMap);
  modal.querySelector('.modal-body').classList.add('map-modal');
  const mapCanvas=document.createElement('canvas');mapCanvas.className='full-map';mapCanvas.width=960;mapCanvas.height=480;
  const legend=document.createElement('p');legend.className='map-legend';legend.textContent='흰 점: 아리아 · 금빛 표식: 봉인 열쇠 · 붉은 점: 감시관 · 파란 문: 출구 · 빗금: 부서지는 벽';
  $('modal-options').append(mapCanvas,legend);drawMap(mapCanvas,true);
}
function returnToMenu() {
  save(); started = false; paused = false; modal.classList.add('hidden'); menu.classList.remove('hidden');
  for (const id of ['hud','map','boss-hud','context','heal','skills','objective','minimap-button']) $(id).classList.add('hidden');
  $('room-banner').classList.remove('show'); $('start-label').textContent = '다시, 운명을 쓰기'; legacy(); $('start').focus({ preventScroll:true });
}
function updateMode() {
  if (state.mode === lastMode) return; lastMode = state.mode;
  if (state.mode === 'boon') {
    openModal('A GIFT FROM THE VEIL','재의 축복','한 가지 힘을 선택하세요. 이 여정이 끝날 때까지 함께합니다.','선택하기',()=>{});
    $('modal-action').classList.add('hidden'); const options = $('modal-options'); options.className = 'boon-options';
    state.boonChoices.forEach((boon,index) => { const b = document.createElement('button'); b.className = 'boon'; const icon = document.createElement('span'); icon.textContent = ['blade','vitality','tempo','flask'].includes(boon.id) ? { blade:'†',vitality:'♡',tempo:'ϟ',flask:'✧' }[boon.id] : '◆'; icon.style.color = boon.color; const title=document.createElement('strong'); title.textContent=boon.name; const desc=document.createElement('small'); desc.textContent=boon.description; b.append(icon,title,desc); b.onclick=()=>{ chooseBoon(state,index); modal.classList.add('hidden'); canvas.focus({preventScroll:true}); }; options.append(b); });
    options.querySelector('button')?.focus({ preventScroll:true });
  } else if (state.mode === 'dead' || state.mode === 'won') {
    save(); const won=state.mode==='won';
    openModal(won?'THE DAWN IS YOURS':'DEATH IS ONLY THE BEGINNING',won?'마침내, 새벽':'불씨는 남는다',`${won?'공허의 여왕이 쓰러졌습니다. 왕국의 밤이 끝났습니다.':'육신은 쓰러졌지만, 여정은 끝나지 않았습니다.'}\n${state.kills}명 처치 · ${state.room + 1}/6 구역 · ${formatTime(state.time)}\n남겨진 불씨 ${meta.embers} — 다음 생의 검을 강화하세요.${storageOK?'':'\n브라우저 저장을 사용할 수 없어 성장 기록은 이번 접속에만 유지됩니다.'}`,won?'다시 시작되는 전설':'다음 생으로',returnToMenu);
  }
}
function formatTime(t) { return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`; }
function updateHUD(now) {
  if (!started) return;
  const p=state.player;
  $('hp-value').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`; $('health-fill').style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;
  $('flasks').textContent=`회복 ${p.flask} / ${p.maxFlask}`; $('gold').textContent=`${state.gold} 금화`; $('boon-count').textContent=`축복 ${state.boons.length}`;
  $('room-label').textContent=roomFor(state).name; $('timer').textContent=formatTime(state.time);
  if (lastRoom!==state.room) { lastRoom=state.room; banner(); $('map').replaceChildren(...state.rooms.map((r,i)=>{const el=document.createElement('span');el.className=`${r.visited?'visited ':''}${i===state.room?'current ':''}${i===5?'boss':''}`;el.title=ROOM_DEFS[i].name;return el;})); }
  if(now>bannerUntil)$('room-banner').classList.remove('show');
  const boss=state.rooms[state.room].enemies.find(e=>e.kind==='boss'&&!e.dead);
  $('boss-hud').classList.toggle('hidden',!boss||!state.bossActive);
  if(boss){$('boss-fill').style.width=`${boss.hp/boss.maxHp*100}%`;$('boss-phase').textContent=`공허의 여왕 · ${boss.stage}단계`;}
  const def=roomFor(state),room=state.rooms[state.room];
  const nearby=(def.exits||[]).find(e=>p.x-65<e.x+e.w&&p.x+p.w+65>e.x&&p.y-30<e.y+e.h&&p.y+p.h+35>e.y);
  const chest=(room.chests||[]).find(e=>!e.opened&&Math.hypot(p.x+p.w/2-e.x-e.w/2,p.y+p.h/2-e.y-e.h/2)<105);
  $('context').classList.toggle('hidden',paused||state.mode!=='playing'||(!nearby&&!chest));
  if(nearby||chest){$('context').firstChild.textContent=chest?'숨겨진 보물 열기 ':nearby.locked&&!room.cleared?'봉인된 문 ':'통로 이동 ';$('context').style.right='4%';$('context').style.left='auto';}
  const guards=room.enemies.filter(e=>e.guardian&&!e.dead).length;
  $('objective-label').textContent=state.room===5?'공허의 여왕을 쓰러뜨리세요':!room.keyCollected?'봉인 열쇠를 찾으세요':guards?`열쇠 획득 · 감시관 ${guards}명 남음`:'봉인 해제 · 열린 출구로 향하세요';
  for(let i=0;i<2;i++){const button=$('skill-'+i),cooldown=p.skillCooldowns?.[i]||0;button.classList.toggle('ready',cooldown<=0);button.querySelector('b').textContent=cooldown>0?Math.ceil(cooldown):'';button.querySelector('small').textContent=SKILLS[i].name;button.setAttribute('aria-label',`${SKILLS[i].name} ${cooldown>0?`${Math.ceil(cooldown)}초 후 사용 가능`:'사용'}`);}
  drawMap($('minimap'));
  $('heal').style.opacity=p.flask&&p.hp<p.maxHp?'1':'.45';
  if(state.message!==lastMessage&&state.messageTimer>0){lastMessage=state.message;toast(state.message);}
  updateMode();
}

window.addEventListener('keydown',e=>{
  if(e.code==='Tab'&&!modal.classList.contains('hidden')){const buttons=[...modal.querySelectorAll('button:not(.hidden)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyJ','KeyK','KeyQ','KeyE','KeyR','KeyT','KeyM'].includes(e.code)&&started)e.preventDefault();
  if(e.code==='KeyM'){if(!e.repeat)toggleMap();return;}
  if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat){if(mapOpen)toggleMap();else pauseGame();}return;}
  if(!started||paused||state.mode!=='playing')return;
  keys.add(e.code);
  if(!e.repeat){if(['Space','ArrowUp','KeyW'].includes(e.code))requestJump();if(['KeyK','ShiftLeft','ShiftRight'].includes(e.code))dash(state);if(e.code==='KeyQ')heal(state);if(e.code==='KeyE')interact(state);if(e.code==='KeyR')skill(state,0);if(e.code==='KeyT')skill(state,1);if(['ArrowDown','KeyS'].includes(e.code))groundSlam(state);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();pointers.clear();input.move=0;input.attack=false;if(started&&!paused&&state.mode==='playing')pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pointers.clear();if(started&&!paused&&state.mode==='playing')pauseGame();}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(!started||paused||state.mode!=='playing')return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);const r=canvas.getBoundingClientRect();
  const left=e.clientX-r.left<r.width*.46;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,left,used:false,at:performance.now()});
  const point=screenToWorld(e.clientX,e.clientY);shatterAt(state,point.x,point.y);
  if(left){$('touch-ring').style.left=`${e.clientX-r.left}px`;$('touch-ring').style.top=`${e.clientY-r.top}px`;$('touch-ring').classList.remove('hidden');}
  else{const now=performance.now();if(now-lastTap.at<280&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<55){skill(state,0);lastTap.at=0;}else{attack(state);lastTap={at:now,x:e.clientX,y:e.clientY};}}
});
canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;
  const dx=p.x-p.startX,dy=p.y-p.startY;
  if(!p.used&&dy<-32&&Math.abs(dy)>Math.abs(dx)*.8){requestJump();p.used=true;}
  else if(!p.used&&dy>36&&Math.abs(dy)>Math.abs(dx)*.8){groundSlam(state);input.down=true;p.used=true;}
  else if(!p.left&&!p.used&&Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)){state.player.facing=dx>0?1:-1;dash(state);p.used=true;}
});
function release(e){pointers.delete(e.pointerId);input.down=false;if(![...pointers.values()].some(p=>p.left))$('touch-ring').classList.add('hidden');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
function requestJump(){if(!jump(state))state.player.jumpBuffer=.13;}
function readInput(){
  let move=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),firing=keys.has('KeyJ')||keys.has('KeyF');
  for(const p of pointers.values()){if(p.left){const dx=p.x-p.startX;if(Math.abs(dx)>8)move=Math.max(-1,Math.min(1,dx/35));}else if(!p.used)firing=true;}
  input.move=move;input.attack=firing;input.down=keys.has('ArrowDown')||keys.has('KeyS')||[...pointers.values()].some(p=>p.used&&p.y-p.startY>36);return input;
}
function screenToWorld(x,y){const r=canvas.getBoundingClientRect(),rx=canvas.width/r.width,ry=canvas.height/r.height;return{x:camera+(x-r.left)*rx/renderedScale-cameraOffsetX/renderedScale,y:cameraY+(y-r.top)*ry/renderedScale-cameraOffsetY/renderedScale};}

function glow(x,y,r,color,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function path(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function visible(r,pad=100){return r.x+r.w>=camera-pad&&r.x<=camera+viewW+pad&&r.y+r.h>=cameraY-pad&&r.y<=cameraY+viewH+pad;}
function background(time){
  const boss=state.room===5,im=boss?images.cathedral:images.prison;
  ctx.fillStyle=boss?'#211222':'#12242b';ctx.fillRect(camera-80,cameraY-80,viewW+160,viewH+160);
  if(im){
    const tileW=1450,tileH=tileW*im.height/im.width;
    const originX=camera*.82,originY=cameraY*.83-110;
    ctx.save();ctx.globalAlpha=.67;
    for(let n=-1;n<=1;n++){const x=originX+(Math.floor((camera-originX)/tileW)+n)*tileW;ctx.drawImage(im,x,originY,tileW,tileH);}
    ctx.restore();
  }
  ctx.fillStyle=boss?'#170a243e':'#061a2440';ctx.fillRect(camera-80,cameraY-80,viewW+160,viewH+160);
  ctx.save();ctx.globalCompositeOperation='color';ctx.globalAlpha=.14;ctx.fillStyle=roomFor(state).color;ctx.fillRect(camera,cameraY,viewW,viewH);ctx.restore();
  // A second architectural layer moves more slowly than the playable stonework.
  for(let x=Math.floor(camera/580)*580-580;x<camera+viewW+580;x+=580){
    const xx=x+camera*.08,yy=cameraY*.15+760;
    ctx.strokeStyle='#71909317';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(xx,yy+1150);ctx.lineTo(xx,yy+160);ctx.quadraticCurveTo(xx+215,yy-130,xx+430,yy+160);ctx.lineTo(xx+430,yy+1150);ctx.stroke();
    ctx.strokeStyle='#07141b3b';ctx.lineWidth=35;ctx.beginPath();ctx.moveTo(xx+22,yy+1150);ctx.lineTo(xx+22,yy+180);ctx.stroke();
  }
  for(let i=0;i<3;i++){
    const x=camera+((time*8+i*470)%1600)-250,y=cameraY+viewH*.75+i*42;
    glow(x,y,340,'#a7c6c012');
  }
}
function masonry(x,y,w,h,floating=false,cracked=false){
  if(!visible({x,y,w,h},55))return;
  const g=ctx.createLinearGradient(0,y,0,y+Math.min(h,170));g.addColorStop(0,cracked?'#5b514f':'#41535a');g.addColorStop(.11,'#263a42');g.addColorStop(1,'#111f29');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const firstRow=Math.max(0,Math.floor((cameraY-y-35)/35)),lastRow=Math.min(Math.ceil(h/35),Math.ceil((cameraY+viewH-y+40)/35));
  for(let row=firstRow;row<lastRow;row++){
    const yy=y+row*35;ctx.fillStyle='#07151c88';ctx.fillRect(x,yy,w,2);
    const first=Math.floor((camera-x-70)/82)*82+x+(row%2)*41;
    for(let bx=Math.max(x-82,first);bx<Math.min(x+w,camera+viewW+82);bx+=82){
      ctx.fillStyle='#07151c99';ctx.fillRect(bx,yy,2,35);ctx.fillStyle='#74898719';ctx.fillRect(bx+6,yy+6,65,1);
      if((Math.floor(bx/82)+row)%5===0){ctx.fillStyle='#75807114';ctx.fillRect(bx+12,yy+12,32,17);}
    }
  }
  ctx.fillStyle=floating?'#a7c1ac':'#899f9c';ctx.fillRect(x,y,w,3);ctx.fillStyle='#101c21';ctx.fillRect(x,y+7,w,4);
  for(let i=0;i<w/24;i++){const xx=x+i*24;if(xx<camera-40||xx>camera+viewW+40)continue;ctx.fillStyle=i%3===0?'#75927888':'#5d786b66';ctx.fillRect(xx,y-4,12+i%9,6);}
  ctx.restore();
  if(floating){path([[x+4,y+h],[x+18,y+h+15],[x+36,y+h+2],[x+w*.4,y+h+22],[x+w*.52,y+h+2],[x+w-25,y+h+14],[x+w-4,y+h]],'#1c3038');}
  else{ctx.fillStyle='#06111855';ctx.fillRect(x+w-9,y+5,9,h-5);}
}
function candle(x,y,t,scale=1){
  glow(x,y-17,95*scale,'#ffb66c26');ctx.fillStyle='#8a8272';ctx.fillRect(x-4,y-9,8,17);ctx.fillStyle='#f4c58a';ctx.beginPath();ctx.ellipse(x,y-20,4+Math.sin(t*13+x)*.7,10,0,0,7);ctx.fill();ctx.fillStyle='#fff4ce';ctx.fillRect(x-1,y-26,2,9);
}
function decoration(d,time){
  if(!visible({x:d.x-80,y:d.y-30,w:160,h:420},100))return;
  ctx.save();ctx.translate(d.x,d.y);ctx.scale(d.scale||1,d.scale||1);
  if(d.kind==='torch'){ctx.fillStyle='#292c31';path([[-12,-3],[12,-3],[7,17],[-7,17]],'#656467');candle(0,-4,time);}
  else if(d.kind==='chain'){
    ctx.strokeStyle='#62727788';ctx.lineWidth=3;for(let y=0;y<330;y+=20){ctx.beginPath();ctx.ellipse(Math.sin(y*.05)*2,y,5,12,y%40?0:.3,0,7);ctx.stroke();}path([[-12,327],[12,327],[18,348],[-18,348]],'#485256');
  }else if(d.kind==='banner'){
    ctx.fillStyle='#ada080';ctx.fillRect(-25,-6,50,5);const sway=Math.sin(time*1.8+d.x)*4;path([[-22,0],[22,0],[20+sway,158],[sway,145],[-20+sway,158]],state.room===5?'#662653a8':'#814551a8');ctx.strokeStyle='#c6ac756a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-16,3);ctx.lineTo(-14+sway,136);ctx.moveTo(16,3);ctx.lineTo(14+sway,136);ctx.stroke();path([[0,45],[10,60],[0,75],[-10,60]],'#cdb77877');
  }else if(d.kind==='waterfall'){
    const g=ctx.createLinearGradient(-30,0,30,0);g.addColorStop(0,'#9ad7df00');g.addColorStop(.5,'#95d8e726');g.addColorStop(1,'#95d8df00');ctx.fillStyle=g;ctx.fillRect(-30,0,60,360);
    for(let i=0;i<9;i++){ctx.fillStyle='#b5e2e22b';ctx.fillRect(-23+i*6,((time*190+i*38)%330),2,28+i%3*12);}glow(0,340,65,'#a2cedd19');
  }else if(d.kind==='pipe'){
    ctx.strokeStyle='#151f26';ctx.lineWidth=20;ctx.beginPath();ctx.moveTo(-45,0);ctx.lineTo(0,0);ctx.lineTo(0,160);ctx.stroke();ctx.strokeStyle='#536267';ctx.lineWidth=12;ctx.stroke();ctx.fillStyle='#202f36';for(let y=20;y<150;y+=48)ctx.fillRect(-10,y,20,6);
  }else if(d.kind==='books'){
    ctx.fillStyle='#273a3c';ctx.fillRect(-55,0,110,5);for(let i=0;i<15;i++){ctx.fillStyle=['#78555a','#768477','#a38f6a','#506e77'][i%4];ctx.fillRect(-51+i*7,-18-i%5*4,5,18+i%5*4);ctx.fillStyle='#d3ba733d';ctx.fillRect(-51+i*7,-10,5,2);}
  }else if(d.kind==='vines'||d.kind==='flowers'){
    const flower=d.kind==='flowers';for(let i=0;i<4;i++){ctx.strokeStyle='#60846b88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(i*18-35,flower?0:160);ctx.bezierCurveTo(i*18-50,70,i*18+10,20,i*18-20,flower?-55:0);ctx.stroke();for(let j=0;j<5;j++){ctx.fillStyle=flower&&j<2?'#dda4be99':'#779b7066';ctx.beginPath();ctx.ellipse(i*18-28+(j%2)*14,j*24+(flower?-60:10),flower?6:11,4,j*.7,0,7);ctx.fill();}}
  }
  ctx.restore();
}
function breakable(b,time){
  if(b.broken||!visible(b,50))return;
  const x=b.x,y=b.y,w=b.w,h=b.h;
  if(b.kind==='wall'||b.kind==='rune'){
    masonry(x,y,w,h,false,true);glow(x+w/2,y+h*.5,60,'#dbb97c17');ctx.strokeStyle='#e8c899';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w*.64,y+7);ctx.lineTo(x+w*.35,y+h*.2);ctx.lineTo(x+w*.66,y+h*.43);ctx.lineTo(x+w*.2,y+h*.59);ctx.lineTo(x+w*.55,y+h*.76);ctx.lineTo(x+w*.28,y+h-4);ctx.stroke();ctx.strokeStyle='#eac39388';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+w*.35,y+h*.2);ctx.lineTo(x+4,y+h*.31);ctx.moveTo(x+w*.2,y+h*.59);ctx.lineTo(x+w-3,y+h*.66);ctx.stroke();
  }else if(b.kind==='urn'){
    ctx.save();ctx.translate(x+w/2,y+h);ctx.fillStyle='#4a4652';ctx.beginPath();ctx.moveTo(-7,-h);ctx.lineTo(7,-h);ctx.bezierCurveTo(4,-h*.66,22,-h*.7,17,-15);ctx.quadraticCurveTo(15,0,0,0);ctx.quadraticCurveTo(-15,0,-17,-15);ctx.bezierCurveTo(-22,-h*.7,-4,-h*.66,-7,-h);ctx.fill();ctx.strokeStyle='#baa287';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#b8a183';ctx.fillRect(-10,-h,20,4);ctx.fillRect(-15,-26,30,3);ctx.restore();
  }else{
    ctx.fillStyle='#644f44';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#b69971';ctx.lineWidth=3;ctx.strokeRect(x+2,y+2,w-4,h-4);ctx.strokeStyle='#302b2a';ctx.lineWidth=2;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x+i*w/4,y+3);ctx.lineTo(x+i*w/4,y+h-3);ctx.stroke();}ctx.strokeStyle='#9f8461';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+5,y+5);ctx.lineTo(x+w-5,y+h-5);ctx.moveTo(x+w-5,y+5);ctx.lineTo(x+5,y+h-5);ctx.stroke();ctx.fillStyle='#c9b28d';for(const dx of [5,w-8])for(const dy of [5,h-8])ctx.fillRect(x+dx,y+dy,3,3);
  }
  if(!b.broken&&Math.hypot(b.x-state.player.x,b.y-state.player.y)<240){ctx.fillStyle='#edce9277';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(b.secret?'균열 · 터치':'터치로 파괴',x+w/2,y-12);}
}
function chest(c,time){
  if(!visible(c,70))return;const x=c.x,y=c.y,w=c.w,h=c.h;
  if(!c.opened)glow(x+w/2,y+h/2,75,'#dfba822b');
  ctx.fillStyle=c.opened?'#332930':'#604742';ctx.fillRect(x,y+18,w,h-18);ctx.strokeStyle='#c6a774';ctx.lineWidth=3;ctx.strokeRect(x+1,y+19,w-2,h-20);
  ctx.save();ctx.translate(x+w/2,y+19);if(c.opened)ctx.rotate(-.4);ctx.fillStyle='#74524b';ctx.fillRect(-w/2,-20,w,20);ctx.strokeStyle='#c6a774';ctx.strokeRect(-w/2,-20,w,20);ctx.restore();ctx.fillStyle='#e9d4a1';ctx.fillRect(x+w/2-4,y+13,8,13);
  if(!c.opened){ctx.font='12px Georgia';ctx.textAlign='center';ctx.fillStyle='#dfc697';ctx.fillText('유물',x+w/2,y-9);}
}
function environment(time){
  const def=roomFor(state),room=state.rooms[state.room];
  for(const d of def.decorations||[])decoration(d,time);
  for(const r of def.solids||[])masonry(r.x,r.y,r.w,r.h);
  masonry(0,FLOOR,W,H-FLOOR);
  for(const r of def.platforms||[]){masonry(r.x,r.y,r.w,r.h,true);if(visible(r,70)&&r.w>240)candle(r.x+r.w-20,r.y-4,time);}
  for(const b of room.breakables)breakable(b,time);
  for(const c of room.chests)chest(c,time);
  for(const gate of def.exits||[]){
    if(!visible(gate,180))continue;
    const {x,y,w,h}=gate,sealed=gate.locked&&!room.cleared,col=sealed?'#ba677f':'#b4f8e3';
    glow(x+w/2,y+h/2,150,sealed?'#b554791c':'#a0efd933');ctx.fillStyle='#071019';ctx.fillRect(x,y,w,h);ctx.strokeStyle=sealed?'#946078':'#bdd2b4';ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);ctx.fillStyle=sealed?'#41243888':'#77c3b342';ctx.fillRect(x+8,y+8,w-16,h-8);
    ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w/2,y+20);ctx.lineTo(x+w/2+14,y+39);ctx.lineTo(x+w/2,y+58);ctx.lineTo(x+w/2-14,y+39);ctx.closePath();ctx.stroke();
    if(sealed){ctx.strokeStyle='#ab71877a';ctx.lineWidth=4;for(let bx=x+16;bx<x+w-8;bx+=18){ctx.beginPath();ctx.moveTo(bx,y+62);ctx.lineTo(bx,y+h-3);ctx.stroke();}}
    else{ctx.fillStyle='#d0ffed';for(let i=0;i<7;i++)ctx.fillRect(x+15+(i*31)%Math.max(20,w-30),y+h-((time*36+i*25)%h),2,4);}
    ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(sealed?'봉인된 통로':gate.label||'다음 구역',x+w/2,y-15);
  }
}
function sprite(kind,e,time,opacity=1){
  const im=images[kind];if(!im||!visible(e,200))return;
  const boss=kind==='boss',config=kind==='player'?animations.player:null;
  let fw=boss?256:192,fh=boss?320:256,sx=0,sy=0,anchorX=fw/2,anchorY=boss?288:fh-20,height=boss?205:kind==='warden'?133:kind==='archer'?108:kind==='duelist'?114:122;
  if(config&&im.width>=config.frameW*config.columns){
    fw=config.frameW;fh=config.frameH;anchorX=config.anchor.x;anchorY=config.anchor.y;
    const clip=config.states[e.anim]||config.states.idle;
    const elapsed=e.animTime||0,tempo=e.anim?.startsWith('attack')&&e.attackDuration>0?[.23,.26,.34][Number(e.anim.at(-1))-1]/e.attackDuration:1;let index=Math.floor(elapsed*clip.fps*tempo);
    if(e.anim==='run')index=Math.floor((e.runDistance||elapsed*390)/16);
    index=clip.loop?index%clip.frames:Math.min(index,clip.frames-1);index+=clip.start;sx=(index%config.columns)*fw;sy=Math.floor(index/config.columns)*fh;
  }else{
    const moving=Math.abs(e.vx||0)>25,frame=e.phase==='attack'?6:e.phase==='windup'?7:moving?Math.floor((e.animTime||time)*12)%6:0;sx=frame*fw;
  }
  const size=height/fh,foot=e.y+e.h;
  ctx.save();ctx.globalAlpha*=opacity;ctx.translate(e.x+e.w/2,foot);ctx.scale(e.facing||1,1);
  if(e.invulnerable>0&&Math.floor(time*22)%2===0)ctx.globalAlpha*=.62;
  if(e.hurt>0||e.hurtTimer>0)ctx.filter='brightness(1.9)';
  ctx.drawImage(im,sx,sy,fw,fh,-anchorX*size,-anchorY*size,fw*size,fh*size);ctx.restore();
}
function shadow(e){
  const foot=e.y+e.h,cx=e.x+e.w/2;let ground=FLOOR;
  for(const r of [...roomFor(state).platforms,...roomFor(state).solids])if(cx>=r.x&&cx<=r.x+r.w&&r.y>=foot-3)ground=Math.min(ground,r.y);
  const distance=Math.max(0,ground-foot);if(distance>430)return;
  ctx.save();ctx.globalAlpha=.5*Math.max(.15,1-distance/430);ctx.fillStyle='#020811';ctx.beginPath();ctx.ellipse(cx,ground+3,e.w*(.9+distance*.002),5,0,0,7);ctx.fill();ctx.restore();
}
function slashEffect(s){
  const age=1-s.life/s.maxLife,r=s.radius||112;
  ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.facing, s.combo===2?-1:1);ctx.globalAlpha=(1-age)**.65;
  const start=-1.5+age*.2,end=1.12+age*.55;
  ctx.rotate(s.combo===3?-.45:-.18);
  ctx.fillStyle=s.color+'45';ctx.beginPath();ctx.arc(0,0,r,start,end);ctx.arc(0,0,r*(.54+age*.3),end,start,true);ctx.closePath();ctx.fill();
  ctx.shadowBlur=reducedMotion?0:15;ctx.shadowColor=s.color;ctx.strokeStyle=s.color;ctx.lineWidth=(s.combo===3?16:11)*(1-age)+2;ctx.beginPath();ctx.arc(0,0,r,start,end);ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='#ffffef';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r+1,start+.15,end-.15);ctx.stroke();ctx.strokeStyle=s.color+'88';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r+15,start+.2,end-.35);ctx.stroke();ctx.restore();
}
function characters(time){
  const room=state.rooms[state.room],p=state.player;
  for(const trail of state.trails){sprite('player',trail,time,.18*trail.life/trail.maxLife);}
  for(const e of room.enemies){
    if(e.dead||!visible(e,200))continue;shadow(e);
    if(e.phase==='windup'){
      glow(e.x+e.w/2,e.y+e.h*.5,75,'#fa6b9931');ctx.font='bold 25px Georgia';ctx.textAlign='center';ctx.fillStyle='#fff1c7';ctx.fillText('!',e.x+e.w/2,e.y-27);
      if(e.intent==='daggers')for(const x of e.targets||[]){ctx.fillStyle='#d775b329';ctx.fillRect(x-17,cameraY,34,FLOOR-cameraY);ctx.strokeStyle='#f2a2db';ctx.lineWidth=2;ctx.strokeRect(x-20,FLOOR-5,40,5);}
      else if(e.intent==='arrow'){ctx.strokeStyle='#ed8b9c77';ctx.setLineDash([9,10]);ctx.beginPath();ctx.moveTo(e.x+e.w/2,e.y+25);ctx.lineTo(e.targetX,e.targetY);ctx.stroke();ctx.setLineDash([]);}
      else{const r=e.intent==='sweep'?330:e.intent==='lunge'?470:e.kind==='warden'?180:120,x=e.facing>0?e.x+e.w/2:e.x+e.w/2-r;ctx.fillStyle='#fa70992b';ctx.fillRect(x,e.y+e.h-16,r,16);ctx.fillStyle='#f2a6ac99';ctx.fillRect(x,e.y+e.h-2,r,2);}
    }
    sprite(e.kind,e,time);
    if(e.phase==='attack'&&['melee','sweep'].includes(e.intent))slashEffect({x:e.x+e.w/2,y:e.y+e.h*.4,facing:e.facing,combo:1,radius:e.kind==='boss'?270:e.kind==='warden'?150:105,color:'#ed7aa5',life:.11,maxLife:.2});
    if(e.hp<e.maxHp&&e.kind!=='boss'){ctx.fillStyle='#061017';ctx.fillRect(e.x-12,e.y-18,e.w+24,4);ctx.fillStyle=e.guardian?'#d2ac73':'#dc8aa1';ctx.fillRect(e.x-12,e.y-18,(e.w+24)*e.hp/e.maxHp,4);}
    if(e.guardian){ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e3c599';ctx.fillText('◆ 감시관',e.x+e.w/2,e.y-30);}
  }
  shadow(p);
  if(p.castTimer>0){glow(p.x+p.w/2,p.y+p.h*.5,110,'#df80aa2e');ctx.save();ctx.strokeStyle='#eb92cf77';ctx.lineWidth=2;ctx.translate(p.x+p.w/2,p.y+p.h*.4);ctx.rotate(time*6);ctx.beginPath();ctx.ellipse(0,0,76,34,.5,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(p.slam){ctx.strokeStyle='#ffd09caa';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y-75);ctx.lineTo(p.x+p.w/2,p.y+25);ctx.stroke();glow(p.x+p.w/2,p.y+p.h,65,'#ffb57455');}
  sprite('player',p,time);
  for(const s of state.slashes)slashEffect(s);
}
function pickups(time){
  for(const item of state.rooms[state.room].items){
    if(item.collected||!visible({x:item.x-10,y:item.y-10,w:20,h:20},60))continue;
    const yy=item.y+Math.sin(time*3+item.x)*4,col=item.kind==='ember'?'#c6a1ff':item.kind==='gold'?'#dfbf7e':item.kind==='sigil'?'#eddb9d':'#afe7ae';glow(item.x,yy,item.kind==='sigil'?75:28,col+'35');
    ctx.fillStyle=col;
    if(item.kind==='gold'){ctx.beginPath();ctx.ellipse(item.x,yy,4,6,0,0,7);ctx.fill();ctx.fillStyle='#fff1c2';ctx.fillRect(item.x-1,yy-3,1,6);}
    else if(item.kind==='sigil'){
      ctx.save();ctx.translate(item.x,yy);ctx.rotate(Math.sin(time)*.12);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.strokeRect(-12,-12,24,24);ctx.rotate(Math.PI/4);ctx.strokeRect(-9,-9,18,18);path([[0,-7],[5,0],[0,7],[-5,0]],'#fff3c4');ctx.restore();ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText('봉인 문양',item.x,yy-33);
    }else if(item.kind==='ember'){path([[item.x,yy-9],[item.x+6,yy],[item.x,yy+7],[item.x-6,yy]],col);}
    else{ctx.fillRect(item.x-5,yy-5,10,12);ctx.fillRect(item.x-2,yy-10,4,5);ctx.fillStyle='#e5f6c2';ctx.fillRect(item.x-1,yy-2,2,7);}
  }
}
function impactEffect(effect){
  const t=1-effect.life/effect.maxLife,r=effect.radius,alpha=(1-t)**.75;
  ctx.save();ctx.translate(effect.x,effect.y);ctx.globalAlpha=alpha;ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;ctx.lineWidth=2*(1-t)+.5;
  if(effect.kind==='storm'){
    glow(0,0,r*(.4+t*.8),effect.color+'26');ctx.rotate(t*2.2);for(let i=0;i<7;i++){ctx.rotate(Math.PI*2/7);ctx.lineWidth=6*(1-t)+1;ctx.beginPath();ctx.arc(0,0,r*(.4+t*.6),-.4,.32);ctx.stroke();path([[r*(.5+t*.5),0],[r*(.35+t*.5),-16],[r*(.35+t*.5),12]],'#fff0ff');}
    ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*(.5+t*.5),0,7);ctx.stroke();
  }else if(effect.kind==='slam'){
    ctx.scale(1,.28);ctx.lineWidth=9*(1-t)+1;ctx.beginPath();ctx.arc(0,0,r*(.2+t*.8),0,7);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*(.1+t*.65),0,7);ctx.stroke();
  }else if(['key','heal','jump','cast','touch','shatter'].includes(effect.kind)){
    ctx.beginPath();ctx.arc(0,0,r*(.25+t*.75),0,7);ctx.stroke();if(effect.kind==='key'||effect.kind==='shatter')for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*t*.7,Math.sin(a)*r*t*.7);ctx.lineTo(Math.cos(a)*r*(t*.8+.2),Math.sin(a)*r*(t*.8+.2));ctx.stroke();}
  }else{
    ctx.rotate(effect.x*.17);for(let i=0;i<9;i++){const a=i*Math.PI*2/9,len=(i%2?.6:1)*r;ctx.beginPath();ctx.moveTo(Math.cos(a)*len*t*.6,Math.sin(a)*len*t*.6);ctx.lineTo(Math.cos(a)*len*(.15+t*.85),Math.sin(a)*len*(.15+t*.85));ctx.stroke();}glow(0,0,36*(1-t)+8,'#fff3d559');
  }
  ctx.restore();
}
function effects(time){
  for(const shot of state.projectiles){
    if(!visible(shot,130))continue;
    ctx.save();ctx.translate(shot.x+shot.w/2,shot.y+shot.h/2);
    if(shot.kind==='wave'){
      ctx.scale(shot.facing||1,1);glow(0,0,95,'#ff5d962e');ctx.strokeStyle='#ff789b';ctx.lineWidth=13;ctx.shadowColor='#ff5685';ctx.shadowBlur=reducedMotion?0:18;ctx.beginPath();ctx.arc(-30,0,65,-1.25,1.25);ctx.stroke();ctx.strokeStyle='#fff3dc';ctx.lineWidth=3;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ff91c580';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-42,0,75,-1.2,1.2);ctx.stroke();for(let i=0;i<4;i++){ctx.globalAlpha=.3-i*.05;ctx.fillStyle='#e96393';ctx.fillRect(-45-i*18,-45+i*26,36,2);}
    }else{
      ctx.rotate(Math.atan2(shot.vy,shot.vx));ctx.strokeStyle=shot.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(14,0);ctx.stroke();path([[22,0],[9,-5],[9,5]],'#f4d5e8');
    }
    ctx.restore();
  }
  for(const effect of state.impacts)impactEffect(effect);
  for(const p of state.particles){
    if(!visible({x:p.x,y:p.y,w:p.size,h:p.size},25))continue;
    ctx.save();ctx.globalAlpha=Math.min(1,p.life/p.maxLife*1.6);ctx.translate(p.x,p.y);ctx.fillStyle=p.color;
    if(p.kind==='stone'){
      ctx.rotate(p.rotation);path([[-p.size*.7,-p.size*.45],[p.size*.8,-p.size*.5],[p.size*.6,p.size*.55],[-p.size*.45,p.size*.8]],p.color);ctx.fillStyle='#fff1c036';ctx.fillRect(-p.size*.45,-p.size*.4,p.size*.9,1.5);
    }else if(p.kind==='dust'){
      ctx.globalAlpha*=.35;ctx.beginPath();ctx.ellipse(0,0,p.size*2,p.size,0,0,7);ctx.fill();
    }else if(p.kind==='spark'){
      ctx.strokeStyle=p.color;ctx.lineWidth=p.size*.55;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-p.vx*.025,-p.vy*.025);ctx.stroke();ctx.fillStyle='#fffbe3';ctx.fillRect(-1,-1,2,2);
    }else{
      ctx.rotate(p.rotation);ctx.fillRect(-p.size/2,-p.size/2,p.size*.65,p.size*1.15);
    }
    ctx.restore();
  }
  for(const a of ambience){
    const x=(a.x+Math.sin(time*.12+a.phase)*35)%W,y=(a.y-time*a.speed*.25+H*100)%H;
    if(!visible({x,y,w:4,h:4},10))continue;ctx.fillStyle=a.size>2?'#ddcda653':'#d2dfd12d';ctx.fillRect(x,y,a.size,a.size);
  }
  for(const text of state.damageTexts){
    ctx.save();ctx.globalAlpha=Math.min(1,text.life/text.maxLife*2);ctx.font=`${text.critical?'bold 23':'bold 16'}px Georgia`;ctx.textAlign='center';ctx.strokeStyle='#061018';ctx.lineWidth=3;ctx.strokeText(text.text,text.x,text.y-12);ctx.fillStyle=text.color;ctx.fillText(text.text,text.x,text.y-12);ctx.restore();
  }
}
function drawMap(target,full=false){
  const g=target.getContext('2d'),room=state.rooms[state.room],def=roomFor(state),sx=target.width/W,sy=target.height/H,known=(x,y)=>room.explored[Math.floor(y/128)*room.exploreCols+Math.floor(x/128)];
  g.clearRect(0,0,target.width,target.height);g.fillStyle='#0c1a24';g.fillRect(0,0,target.width,target.height);g.save();g.scale(sx,sy);
  g.beginPath();for(let i=0;i<room.explored.length;i++)if(room.explored[i])g.rect((i%room.exploreCols)*128,Math.floor(i/room.exploreCols)*128,128,128);g.clip();
  g.fillStyle='#233d48';g.fillRect(0,0,W,H);
  g.fillStyle='#789a9c';for(const r of [...def.solids,{x:0,y:FLOOR,w:W,h:H-FLOOR}])g.fillRect(r.x,r.y,r.w,r.h);
  g.fillStyle='#a9c6b5';for(const r of def.platforms)g.fillRect(r.x,r.y,r.w,full?r.h:18);
  for(const b of room.breakables)if(!b.broken&&(b.kind==='wall'||b.kind==='rune')){g.fillStyle='#d9ae8a';g.fillRect(b.x,b.y,b.w,b.h);g.strokeStyle='#263d44';g.lineWidth=8;for(let yy=b.y;yy<b.y+b.h;yy+=45){g.beginPath();g.moveTo(b.x,yy);g.lineTo(b.x+b.w,yy+36);g.stroke();}}
  for(const exit of def.exits){g.fillStyle=exit.locked&&!room.cleared?'#9d6179':'#a1e5e1';g.fillRect(exit.x,exit.y,exit.w,exit.h);}
  for(const item of room.items)if(!item.collected&&item.kind==='sigil'){g.fillStyle='#ffdf87';g.beginPath();g.arc(item.x,item.y,full?22:28,0,7);g.fill();}
  for(const chest of room.chests)if(!chest.opened){g.fillStyle='#d8b790';g.fillRect(chest.x,chest.y,chest.w,chest.h);}
  for(const e of room.enemies)if(!e.dead){g.fillStyle=e.guardian?'#fc869c':'#b5677f';g.beginPath();g.arc(e.x+e.w/2,e.y+e.h/2,e.guardian?25:14,0,7);g.fill();}
  if(full){g.font='46px sans-serif';g.textAlign='center';g.fillStyle='#d0e0d0';for(const z of def.zones||[])if(known(z.x+z.w/2,z.y+z.h/2))g.fillText(z.label,z.x+z.w/2,z.y+z.h/2);}
  g.restore();
  g.save();g.scale(sx,sy);g.strokeStyle='#c4eee43e';g.lineWidth=full?5:10;g.strokeRect(camera,cameraY,viewW,viewH);g.fillStyle='#fff7dd';g.beginPath();g.arc(state.player.x+state.player.w/2,state.player.y+state.player.h/2,full?22:31,0,7);g.fill();g.strokeStyle='#ffffffaa';g.lineWidth=7;g.beginPath();g.moveTo(state.player.x+state.player.w/2,state.player.y+state.player.h/2);g.lineTo(state.player.x+state.player.w/2+state.player.facing*63,state.player.y+state.player.h/2);g.stroke();g.restore();
}
function menuScene(time){
  const im=images.cover||images.prison;if(im){const scale=Math.max(canvas.width/im.width,canvas.height/im.height);ctx.drawImage(im,(canvas.width-im.width*scale)*.65,(canvas.height-im.height*scale)*.5,im.width*scale,im.height*scale);}
  ctx.fillStyle='#07111522';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let i=0;i<18;i++){const x=(i*131+Math.sin(time*.2+i)*30)%canvas.width,y=(canvas.height-(time*9+i*61)%canvas.height);ctx.fillStyle='#e5d8b64d';ctx.fillRect(x,y,1.5,1.5);}
}
function render(time,dt){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#061014';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(!started){menuScene(time);return;}
  const p=state.player,scale=Math.min(canvas.width/viewW,canvas.height/viewH),offsetX=(canvas.width-viewW*scale)/2,offsetY=(canvas.height-viewH*scale)/2;
  const tx=Math.max(0,Math.min(W-viewW,p.x+p.w/2-viewW*.42+p.facing*Math.min(65,Math.abs(p.vx)*.1))),ty=Math.max(0,Math.min(H-viewH,p.y+p.h-viewH*.76+Math.max(-75,Math.min(60,p.vy*.055))));
  if(cameraRoom!==state.room){camera=tx;cameraY=ty;cameraRoom=state.room;}
  else if(!paused&&state.hitStop<=0){camera+=(tx-camera)*(1-Math.exp(-10*dt));cameraY+=(ty-cameraY)*(1-Math.exp(-9*dt));}
  const shake=!reducedMotion&&state.shake>0?state.shake*31:0,shakeX=Math.sin(time*170)*shake,shakeY=Math.cos(time*143)*shake*.65;
  renderedScale=scale;cameraOffsetX=offsetX+shakeX;cameraOffsetY=offsetY+shakeY;
  ctx.save();ctx.translate(cameraOffsetX-camera*scale,cameraOffsetY-cameraY*scale);ctx.scale(scale,scale);
  const sceneTime=state.time;background(sceneTime);environment(sceneTime);pickups(sceneTime);characters(sceneTime);effects(sceneTime);ctx.restore();
  if(state.flash>0&&!reducedMotion){ctx.fillStyle=`rgba(255,220,233,${Math.min(.13,state.flash*.55)})`;ctx.fillRect(0,0,canvas.width,canvas.height);}
}
function frame(now){
  const dt=Math.min(.035,(now-lastTime)/1000||1/60);lastTime=now;
  if(started&&!paused&&state.mode==='playing')step(state,readInput(),dt);
  else if(started&&!paused)step(state,{},dt);
  for(const event of state.events.splice(0))sound(event);
  music(now/1000);render(now/1000,dt);
  if(now-uiAt>90){uiAt=now;updateHUD(now);}
  requestAnimationFrame(frame);
}
legacy();resize();requestAnimationFrame(frame);
await Promise.all([
  ...Object.entries(assetPaths).map(([key,path])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>resolve();im.src=path+'?v=2';})),
  fetch('assets/animations.json?v=2').then(r=>{if(!r.ok)throw new Error('manifest');return r.json();}).then(data=>{animations=data;}).catch(()=>{})
]);
$('start').disabled=!images.player||!animations.player;$('start-label').textContent=$('start').disabled?'새로고침하여 다시 불러오기':'여정 시작하기';
if($('start').disabled)toast('캐릭터 모션을 불러오지 못했습니다. 페이지를 새로고침하세요.');

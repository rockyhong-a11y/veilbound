import { W, H, FLOOR, ROOM_DEFS, createRun, step, attack, jump, dash, heal, interact, chooseBoon, roomFor } from './engine.js';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha:false });
const stage = $('stage'), menu = $('menu'), modal = $('modal');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let meta = {}, storageOK = true;
try { const saved = JSON.parse(localStorage.getItem('veilbound-v1') || '{}'); meta = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { storageOK = false; }
let state = createRun(meta), started = false, paused = false, camera = 0, cameraY = 180, viewW = W, viewH = 720, lastRoom = -1;
let lastTime = 0, uiAt = 0, bannerUntil = 0, lastMode = '', lastMessage = '', soundOn = false, audio, musicAt = 0, musicStep = 0;
const keys = new Set(), pointers = new Map();
const input = { move:0, attack:false }, images = {};
const ambience = Array.from({ length:52 }, (_, i) => ({ x:(i * 431 + 73) % W, y:(i * 227 + 91) % H, size:i % 3 + .5, speed:9 + i % 23, phase:i * 1.71 }));
const assetPaths = { prison:'assets/bg-prison.png', cathedral:'assets/bg-cathedral.png', cover:'assets/cover.png', player:'assets/player.png', duelist:'assets/duelist.png', archer:'assets/archer.png', warden:'assets/warden.png', boss:'assets/boss.png' };

function save() {
  meta = { ...state.meta };
  try { localStorage.setItem('veilbound-v1', JSON.stringify(meta)); } catch { storageOK = false; }
}
function resize() {
  const rect = stage.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  viewH = Math.min(720, 1280 * rect.height / rect.width); viewW = viewH * rect.width / rect.height;
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
  state = createRun(meta); started = true; paused = false; lastMode = ''; lastRoom = -1; lastMessage = ''; camera = 0; cameraY = 180;
  menu.classList.add('hidden'); modal.classList.add('hidden'); $('hud').classList.remove('hidden'); $('map').classList.remove('hidden');
  $('heal').classList.remove('hidden'); keys.clear(); pointers.clear(); input.move = 0; input.attack = false;
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
  $('modal-eyebrow').textContent = eyebrow; $('modal-title').textContent = title; $('modal-description').textContent = description;
  $('modal-options').replaceChildren(); $('modal-options').className = '';
  $('modal-action').classList.remove('hidden'); $('modal-action').querySelector('span').textContent = action;
  $('modal-action').onclick = callback; modal.classList.remove('hidden'); $('modal-action').focus({ preventScroll:true });
}
function pauseGame() {
  if (!started || state.mode !== 'playing') return;
  paused = !paused; keys.clear(); input.move = 0; input.attack = false; pointers.clear();
  if (paused) openModal('A MOMENT BETWEEN LIVES','잠시, 숨을 고르세요','왼쪽 화면을 드래그해 이동하세요.\n오른쪽 터치: 검격 · 위로 쓸기: 점프 · 옆으로 쓸기: 회피\n공중에서 손을 떼고 다시 위로 쓸면 이중 점프합니다.\n문 가까이에서 이동 버튼을 누르면 다음 구역으로 이어집니다.','여정 계속하기', pauseGame);
  else { modal.classList.add('hidden'); canvas.focus({ preventScroll:true }); }
}
$('pause').onclick = pauseGame;
$('context').onclick = () => { if (!paused) interact(state); };
$('heal').onclick = () => { if (!paused) { if (!heal(state)) toast(state.player.flask ? '체력이 가득 찼습니다.' : '회복 물약이 없습니다.'); } };
function returnToMenu() {
  save(); started = false; paused = false; modal.classList.add('hidden'); menu.classList.remove('hidden');
  for (const id of ['hud','map','boss-hud','context','heal']) $(id).classList.add('hidden');
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
  const def=roomFor(state);const right=p.x>W-175&&def.doors.right!==undefined,left=p.x<135&&def.doors.left!==undefined;
  $('context').classList.toggle('hidden',paused||state.mode!=='playing'||(!right&&!left));
  if(right||left){$('context').firstChild.textContent=right?(state.rooms[state.room].cleared?'다음 구역으로 ':'봉인된 문 '):'이전 구역으로 ';$('context').style.right=right?'4%':'auto';$('context').style.left=left?'4%':'auto';}
  $('heal').style.opacity=p.flask&&p.hp<p.maxHp?'1':'.45';
  if(state.message!==lastMessage&&state.messageTimer>0){lastMessage=state.message;toast(state.message);}
  updateMode();
}

window.addEventListener('keydown',e=>{
  if(e.code==='Tab'&&!modal.classList.contains('hidden')){const buttons=[...modal.querySelectorAll('button:not(.hidden)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyJ','KeyK','KeyQ','KeyE'].includes(e.code)&&started)e.preventDefault();
  if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)pauseGame();return;}
  if(!started||paused||state.mode!=='playing')return;
  keys.add(e.code);
  if(!e.repeat){if(['Space','ArrowUp','KeyW'].includes(e.code))jump(state);if(['KeyK','ShiftLeft','ShiftRight'].includes(e.code))dash(state);if(e.code==='KeyQ')heal(state);if(e.code==='KeyE')interact(state);}
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
  if(left){$('touch-ring').style.left=`${e.clientX-r.left}px`;$('touch-ring').style.top=`${e.clientY-r.top}px`;$('touch-ring').classList.remove('hidden');}
  else attack(state);
});
canvas.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;
  const dx=p.x-p.startX,dy=p.y-p.startY;
  if(!p.used&&dy<-32&&Math.abs(dy)>Math.abs(dx)*.8){jump(state);p.used=true;}
  else if(!p.left&&!p.used&&Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)){state.player.facing=dx>0?1:-1;dash(state);p.used=true;}
});
function release(e){pointers.delete(e.pointerId);if(![...pointers.values()].some(p=>p.left))$('touch-ring').classList.add('hidden');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
function readInput(){
  let move=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),firing=keys.has('KeyJ')||keys.has('KeyF');
  for(const p of pointers.values()){if(p.left){const dx=p.x-p.startX;if(Math.abs(dx)>8)move=Math.max(-1,Math.min(1,dx/35));}else if(!p.used)firing=true;}
  input.move=move;input.attack=firing;return input;
}

function glow(x,y,r,color,alpha=1){ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
function path(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function background(time,hero=false){
  const room=hero?0:state.room,im=room===5?images.cathedral:images.prison;
  ctx.fillStyle='#101e25';ctx.fillRect(0,0,W,H);
  if(im){ctx.drawImage(im,0,0,W,H);ctx.fillStyle=room===5?'#29102036':'#06192325';ctx.fillRect(0,0,W,H);}
  else{
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b1a25');g.addColorStop(.6,'#214049');g.addColorStop(1,'#091518');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<7;i++){const x=90+i*250;ctx.fillStyle='#11242cca';ctx.fillRect(x,110,36,620);ctx.beginPath();ctx.moveTo(x+30,680);ctx.lineTo(x+30,280);ctx.quadraticCurveTo(x+125,30,x+215,280);ctx.lineTo(x+215,680);ctx.strokeStyle='#3d595d80';ctx.lineWidth=13;ctx.stroke();glow(x+135,330,180,'#51848925');}
  }
  if(!hero&&room!==5){ctx.globalCompositeOperation='color';ctx.fillStyle=ROOM_DEFS[room].color;ctx.globalAlpha=.17;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
  for(let i=0;i<5;i++){const x=200+i*320;const sway=Math.sin(time*.7+i)*20;const g=ctx.createLinearGradient(x,0,x+230,650);g.addColorStop(0,'#b5d8df0a');g.addColorStop(1,'#b5d8df00');path([[x,0],[x+46,0],[x+250+sway,650],[x+75+sway,650]],g);}
  ctx.save();ctx.globalAlpha=.28;
  for(let i=0;i<4;i++){const x=(time*12+i*470)%2100-300;const g=ctx.createRadialGradient(x,675-i*34,0,x,675-i*34,390);g.addColorStop(0,'#94b2b81c');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-390,430,780,460);}
  ctx.restore();
}
function masonry(x,y,w,h,floating=false){
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#3c4b50');g.addColorStop(.12,'#24333a');g.addColorStop(1,'#0c181f');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  for(let row=0;row<Math.min(5,Math.ceil(h/28));row++){const yy=y+row*28;ctx.fillStyle=row%2?'#213138':'#2a3a40';ctx.fillRect(x,yy,w,2);for(let bx=x-40+(row%2)*38;bx<x+w;bx+=78){ctx.fillStyle='#08161a88';ctx.fillRect(bx,yy,2,28);ctx.fillStyle='#55666b22';ctx.fillRect(bx+5,yy+6,62,1);}}
  ctx.fillStyle='#94aaa56b';ctx.fillRect(x,y,w,2);ctx.fillStyle='#16282a';ctx.fillRect(x,y+5,w,4);
  for(let i=0;i<w/20;i++){const xx=x+i*20;ctx.fillStyle=i%3===0?'#5e716450':'#344d4550';ctx.fillRect(xx,y-3,12+i%8,6);}
  ctx.restore();
  if(floating){path([[x+8,y+h],[x+28,y+h+17],[x+36,y+h],[x+w*.36,y+h+26],[x+w*.49,y+h+5],[x+w-23,y+h+12],[x+w-9,y+h]],'#17282f');for(let i=0;i<3;i++){ctx.strokeStyle='#536a4444';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w*.2+i*65,y);ctx.bezierCurveTo(x+w*.2+i*65+12,y+25,x+w*.2+i*65-8,y+34,x+w*.2+i*65+15,y+47+i*6);ctx.stroke();}}
}
function candle(x,y,t){glow(x,y-13,90,'#eab87722');ctx.fillStyle='#727064';ctx.fillRect(x-3,y-14,6,18);ctx.fillStyle='#eac786';ctx.beginPath();ctx.ellipse(x,y-21,3+Math.sin(t*7+x)*.7,8,0,0,7);ctx.fill();ctx.fillStyle='#fff0c0';ctx.fillRect(x-1,y-25,2,7);}
function environment(time){
  const def=roomFor(state);
  for(const p of def.platforms)masonry(p.x,p.y,p.w,25,true);
  for(const p of def.platforms){candle(p.x+22,p.y-3,time);if(p.w>220)candle(p.x+p.w-18,p.y-3,time);}
  for(const side of ['left','right']){if(def.doors[side]===undefined)continue;const x=side==='left'?20:W-74;const sealed=side==='right'&&!state.rooms[state.room].cleared;glow(x+25,FLOOR-85,140,sealed?'#a8555a17':'#d1b57924');ctx.fillStyle='#071014';ctx.fillRect(x,FLOOR-170,54,170);ctx.strokeStyle=sealed?'#755061':'#b49460';ctx.lineWidth=3;ctx.strokeRect(x,FLOOR-170,54,170);if(sealed){ctx.strokeStyle='#886873';ctx.lineWidth=4;for(let bx=x+10;bx<x+54;bx+=13){ctx.beginPath();ctx.moveTo(bx,FLOOR-167);ctx.lineTo(bx,FLOOR);ctx.stroke();}}else{ctx.fillStyle='#cfaf6d';ctx.globalAlpha=.25+Math.sin(time*2)*.1;ctx.fillRect(x+5,FLOOR-165,44,165);ctx.globalAlpha=1;}ctx.font='12px Georgia';ctx.textAlign='center';ctx.fillStyle=sealed?'#b48995':'#ddc294';ctx.fillText(sealed?'봉인':'이동',x+27,FLOOR-188);}
  masonry(0,FLOOR,W,H-FLOOR);
  for(let i=0;i<21;i++){const x=i*83;path([[x,FLOOR+6],[x+23,FLOOR],[x+29,FLOOR+13],[x+67,FLOOR+9],[x+78,FLOOR+23],[x,FLOOR+31]],'#1c3035');}
  if(state.room===1){ctx.fillStyle='#4e9da623';ctx.fillRect(0,FLOOR+45,W,50);for(let i=0;i<22;i++){ctx.fillStyle='#78bac32a';ctx.fillRect((i*91+time*17)%W,FLOOR+49+i%5*8,45+i%30,1);}}
  if(state.room===3){for(let i=0;i<10;i++){const x=i*151+25;ctx.strokeStyle='#48604a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,FLOOR);ctx.bezierCurveTo(x-30,670,x+20,630,x-13,555);ctx.stroke();for(let j=0;j<5;j++){ctx.fillStyle='#9cbd7e55';ctx.beginPath();ctx.ellipse(x-12+j%2*13,600+j*27,14,5,j*.8,0,7);ctx.fill();}}}
  if(state.room===4){glow(770,FLOOR+65,290,'#da66374a');for(let i=0;i<12;i++){ctx.fillStyle='#d4945655';ctx.fillRect(580+i*39,FLOOR+29+(i%3)*5,22,4);}}
  const g=ctx.createLinearGradient(0,FLOOR+20,0,H);g.addColorStop(0,'transparent');g.addColorStop(1,'#060e14e6');ctx.fillStyle=g;ctx.fillRect(0,FLOOR,W,H-FLOOR);
}
function sprite(kind,e,time,scale=1){
  const im=images[kind];if(!im)return;
  const boss=kind==='boss',fw=boss?256:192,fh=boss?320:256;
  const moving=Math.abs(e.vx||0)>15||(e.phase==='idle'&&kind!=='player'&&kind!=='archer');
  const frame=kind==='player'?(e.attackTimer>state.attackCooldown*.5?6:e.dashTimer>0?7:!e.onGround?4:moving?Math.floor(time*12)%6:0):(e.phase==='attack'?6:e.phase==='windup'?7:moving?Math.floor(time*8)%6:0);
  const height=(boss?210:kind==='warden'?137:122)*scale,width=height*fw/fh;
  const feet=e.y+e.h, x=e.x+e.w/2;
  ctx.save();ctx.translate(x,feet+(boss?21:10)*scale);ctx.scale(e.facing||1,1);
  if(e.invulnerable>0&&Math.floor(time*18)%2===0)ctx.globalAlpha=.6;
  if(e.hurt>0)ctx.filter='brightness(2.4)';
  ctx.drawImage(im,frame*fw,0,fw,fh,-width*.5,-height,width,height);
  ctx.restore();
}
function shadow(e){ctx.fillStyle='#030b13a6';ctx.beginPath();ctx.ellipse(e.x+e.w/2,e.y+e.h+3,e.w*.9,5,0,0,7);ctx.fill();}
function characters(time){
  const p=state.player;
  for(const e of state.rooms[state.room].enemies){if(e.dead)continue;shadow(e);
    if(e.phase==='windup'){
      glow(e.x+e.w/2,e.y+e.h/2,65,'#ec697340');ctx.fillStyle='#e5b39a';ctx.font='bold 21px Georgia';ctx.textAlign='center';ctx.fillText('!',e.x+e.w/2,e.y-37);
      if(e.intent==='daggers')for(const x of e.targets||[]){ctx.fillStyle='#c784bb22';ctx.fillRect(x-17,120,34,FLOOR-120);ctx.fillStyle='#e9a4d3';ctx.fillRect(x-22,FLOOR-3,44,3);}
      else if(e.intent==='arrow'){ctx.strokeStyle='#df9c9d66';ctx.setLineDash([8,12]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x+e.w/2,e.y+25);ctx.lineTo(e.targetX,e.targetY);ctx.stroke();ctx.setLineDash([]);}
      else {const reach=e.intent==='sweep'?315:e.kind==='warden'?180:e.intent==='lunge'?460:110;ctx.fillStyle='#ec69731b';ctx.fillRect(e.facing>0?e.x+e.w/2:e.x+e.w/2-reach,e.y+e.h-20,reach,20);ctx.fillStyle='#dc727380';ctx.fillRect(e.facing>0?e.x+e.w/2:e.x+e.w/2-reach,e.y+e.h-2,reach,2);}
    }
    sprite(e.kind,e,time);
    if(e.phase==='attack'&&['melee','sweep'].includes(e.intent)){ctx.save();ctx.translate(e.x+e.w/2,e.y+e.h*.4);ctx.scale(e.facing,1);ctx.strokeStyle='#dc719ac0';ctx.lineWidth=e.kind==='boss'?9:4;ctx.beginPath();ctx.arc(0,0,e.kind==='boss'?240:80,-1.3,1.4);ctx.stroke();ctx.restore();}
    if(e.hp<e.maxHp&&e.kind!=='boss'){ctx.fillStyle='#040e16';ctx.fillRect(e.x-10,e.y-24,e.w+20,3);ctx.fillStyle='#b17383';ctx.fillRect(e.x-10,e.y-24,(e.w+20)*e.hp/e.maxHp,3);}
  }
  shadow(p);
  if(p.dashTimer>0){for(let i=1;i<5;i++){ctx.save();ctx.globalAlpha=.18-i*.025;sprite('player',{...p,x:p.x-p.facing*i*25,invulnerable:0},time);ctx.restore();}}
  sprite('player',p,time);
  for(const slash of state.slashes){ctx.save();ctx.translate(slash.x,slash.y);ctx.scale(slash.facing,1);const age=1-slash.life/slash.maxLife;ctx.globalAlpha=slash.life/slash.maxLife;ctx.rotate(-.3+age*.3);ctx.strokeStyle='#eaf9f0';ctx.shadowColor='#b9eadf';ctx.shadowBlur=17;ctx.lineWidth=9*(1-age)+2;ctx.beginPath();ctx.arc(0,0,98,-1.3,1.1);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#8adbd0';ctx.beginPath();ctx.arc(0,0,116,-1.2,.9);ctx.stroke();ctx.restore();}
}
function pickups(time){for(const item of state.rooms[state.room].items){if(item.collected)continue;const yy=item.y+Math.sin(time*3+item.x)*4,col=item.kind==='ember'?'#b9a4e7':item.kind==='gold'?'#d7b879':'#acc99e';glow(item.x,yy,30,col+'25');ctx.fillStyle=col;if(item.kind==='gold'){ctx.beginPath();ctx.ellipse(item.x,yy,4,6,0,0,7);ctx.fill();}else if(item.kind==='ember'){path([[item.x,yy-9],[item.x+6,yy],[item.x,yy+7],[item.x-6,yy]],col);}else{ctx.fillRect(item.x-5,yy-5,10,12);ctx.fillRect(item.x-2,yy-9,4,4);ctx.fillStyle='#f5ddab';ctx.fillRect(item.x-1,yy-2,2,7);}}}
function effects(time){
  for(const shot of state.projectiles){ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.vy,shot.vx));ctx.strokeStyle=shot.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(18,0);ctx.stroke();path([[20,0],[9,-5],[9,5]],'#eed6dd');ctx.restore();}
  for(const p of state.particles){ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}
  ctx.globalAlpha=1;
  for(const a of ambience){const x=(a.x+Math.sin(time*.12+a.phase)*35)%W,y=(a.y-time*a.speed*.25+H*100)%H;ctx.fillStyle=a.size>2?'#d4b98844':'#ceddd528';ctx.fillRect(x,y,a.size,a.size);}
}
function menuScene(time){
  ctx.save();const scale=Math.max(canvas.width/W,canvas.height/H);ctx.translate((canvas.width-W*scale)*.8,(canvas.height-H*scale)/2);ctx.scale(scale,scale);background(time,true);
  if(images.cover){ctx.drawImage(images.cover,0,0,W,H);ctx.fillStyle='#07111522';ctx.fillRect(0,0,W,H);}
  else{masonry(0,785,W,115);glow(1140,450,430,'#58777725');if(images.player){const hero={x:1050,y:125,w:200,h:660,facing:-1,onGround:true,vx:0,attackTimer:0,dashTimer:0,invulnerable:0};sprite('player',hero,time,5.4);}candle(870,782,time);candle(1365,782,time);}
  effects(time);ctx.restore();
}
function render(time){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#061014';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(!started){menuScene(time);return;}
  const scale=Math.min(canvas.width/viewW,canvas.height/viewH),offsetY=(canvas.height-viewH*scale)/2;
  const target=Math.max(0,Math.min(W-viewW,state.player.x+state.player.w/2-viewW*.42));camera+=(target-camera)*.12;cameraY+=(Math.max(0,Math.min(H-viewH,state.player.y+state.player.h-viewH*.8))-cameraY)*.08;
  const shake=!reducedMotion&&state.shake>0?state.shake*35:0;
  ctx.save();ctx.translate((canvas.width-viewW*scale)/2-camera*scale+Math.sin(time*170)*shake,offsetY-cameraY*scale+Math.cos(time*143)*shake*.5);ctx.scale(scale,scale);
  background(time);environment(time);pickups(time);characters(time);effects(time);ctx.restore();
}
function frame(now){
  const dt=Math.min(.035,(now-lastTime)/1000||1/60);lastTime=now;
  if(started&&!paused&&state.mode==='playing')step(state,readInput(),dt);
  else if(started&&!paused)step(state,{},dt);
  for(const event of state.events.splice(0))sound(event);
  music(now/1000);render(now/1000);
  if(now-uiAt>90){uiAt=now;updateHUD(now);}
  requestAnimationFrame(frame);
}
legacy();resize();requestAnimationFrame(frame);
await Promise.all(Object.entries(assetPaths).map(([key,path])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>resolve();im.src=path;})));
$('start').disabled=false;$('start-label').textContent='여정 시작하기';
if(!images.player)toast('캐릭터 이미지를 불러오지 못했습니다. 페이지를 새로고침하세요.');

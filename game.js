import { W, H, FLOOR, ROOM_DEFS, SKILLS, WEAPONS, RARITIES, weaponFor, skillFor, switchWeapon, equipDrop, nearbyDrop, createRun, step, attack, jump, dash, heal, interact, chooseBoon, roomFor, skill, groundSlam, shatterAt, shrineFor, buyShrine, vaultReady } from './engine.js?v=5';
import { createScenery } from './scenery.js?v=5';
import { createSprites } from './sprites.js?v=5';

const $ = id => document.getElementById(id);
const canvas = $('game'), screen = canvas.getContext('2d', { alpha:false });
const worldCanvas = document.createElement('canvas'), ctx = worldCanvas.getContext('2d', { alpha:false });
let scenery = null, spriteArt = null;
let prefs = { view:'close', smooth:false, shake:true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('veilbound-prefs') || '{}')); } catch {}
const stage = $('stage'), menu = $('menu'), modal = $('modal');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let meta = {}, storageOK = true;
try { const saved = JSON.parse(localStorage.getItem('veilbound-v1') || '{}'); meta = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { storageOK = false; }
let state = createRun(meta), started = false, paused = false, camera = 0, cameraY = 180, viewW = 1100, viewH = 650, lastRoom = -1, mapOpen = false, cameraRoom = -1;
let endSceneTime = 0;
let lastTime = 0, uiAt = 0, bannerUntil = 0, lastMode = '', lastMessage = '', soundOn = false, audio, musicAt = 0, musicStep = 0;
const keys = new Set(), pointers = new Map();
const input = { move:0, attack:false, down:false }, images = {};
let objectAnimations = {}, objectTimes = new WeakMap(), gearOpen = null, gearSession = 0, lootBusy = false, lastTap = { at:0, x:0, y:0 }, renderedScale = 1, cameraOffsetX = 0, cameraOffsetY = 0;
const ambience = Array.from({ length:52 }, (_, i) => ({ x:(i * 431 + 73) % W, y:(i * 227 + 91) % H, size:i % 3 + .5, speed:9 + i % 23, phase:i * 1.71 }));
const assetPaths = { chest:'assets/reliquary-chest.png', portal:'assets/reliquary-portal.png' };
for(const spec of WEAPONS)assetPaths['icon_'+spec.id]=`assets/arsenal-icon-${spec.id}.png`;

function save() {
  meta = { ...state.meta };
  try { localStorage.setItem('veilbound-v1', JSON.stringify(meta)); } catch { storageOK = false; }
}
function resize() {
  const rect = stage.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  worldCanvas.height = rect.width < rect.height ? 432 : 360;
  worldCanvas.width = Math.round(worldCanvas.height * rect.width / rect.height);
  viewH = prefs.view === 'wide' ? 760 : 650; viewW = viewH * rect.width / rect.height;
  cameraRoom = -1;
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
  const tones = { attack:[170,.1,'sawtooth',.022,.3], hit:[90,.1,'triangle',.09,.4], hurt:[150,.18,'sawtooth',.035,.4], dash:[260,.17,'triangle',.03,.3], jump:[220,.1,'sine',.03,1.5], pickup:[660,.14,'sine',.025,1.5], heal:[440,.6,'sine',.04,1.5], kill:[120,.28,'triangle',.05,.4], clear:[330,.4,'sine',.05,2], choose:[440,.4,'sine',.04,2], dead:[110,1.2,'triangle',.055,.35], win:[440,1.5,'sine',.05,2], boss:[65,1.2,'sawtooth',.024,.7], gun:[115,.075,'square',.035,.2], bow:[720,.13,'triangle',.025,.35], switch:[330,.08,'triangle',.022,1.5], equip:[520,.32,'sine',.04,2], ice:[1150,.4,'sine',.027,.6], thunder:[90,.22,'sawtooth',.04,2], meteor:[240,.5,'triangle',.027,.3], meteorHit:[48,.45,'triangle',.09,.4], fan:[950,.18,'triangle',.025,.3], grapnel:[360,.24,'square',.016,.45], ward:[480,.7,'sine',.03,1.5], block:[750,.14,'triangle',.04,.6], perfect:[880,.2,'sine',.045,1.5], riposte:[160,.12,'triangle',.07,.3], shrine:[440,.7,'sine',.045,2], chest:[660,.5,'sine',.04,1.5], rally:[560,.08,'sine',.015,1.2] };
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
  state.meta = { ...meta }; save(); legacy(); sound('choose'); toast(`영구 무기 강화 +${meta.power * 2} · 다음 여정에 적용됩니다.`);
};
async function startRun() {
  if(!await loadWeaponArt('gun')){toast('무기 모션을 불러오지 못했습니다. 다시 시작해 주세요.');return;}
  gearOpen=null;gearSession++;lootBusy=false;endSceneTime=0;state = createRun(meta); trimWeaponArt(); started = true; paused = false; mapOpen = false; lastMode = ''; lastRoom = -1; lastMessage = ''; cameraRoom = -1; objectTimes = new WeakMap();
  document.body.classList.add('playing');$('gesture-hint').classList.remove('hidden');
  menu.classList.add('hidden'); modal.classList.add('hidden'); $('hud').classList.remove('hidden'); $('map').classList.remove('hidden');
  for(const id of ['heal','skills','weapons','minimap-button','objective'])$(id).classList.remove('hidden');
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
  $('toast').classList.remove('show');
  $('modal').querySelector('.modal-body').classList.remove('map-modal','gear-modal','settings-modal');
  $('modal-eyebrow').textContent = eyebrow; $('modal-title').textContent = title; $('modal-description').textContent = description;
  $('modal-options').replaceChildren(); $('modal-options').className = '';
  $('modal-action').classList.remove('hidden'); $('modal-action').querySelector('span').textContent = action;
  $('modal-action').onclick = callback; modal.classList.remove('hidden'); $('modal-action').focus({ preventScroll:true });
}
function pauseGame() {
  if (!started || state.mode !== 'playing') return;
  if(gearOpen){closeGear();return;}
  paused = !paused; keys.clear(); input.move = 0; input.attack = false; pointers.clear();
  if (paused) openModal('A MOMENT BETWEEN LIVES','칼날 사이의 숨','왼쪽 드래그: 이동 · 오른쪽 터치/누르기: 장착 무기로 공격\n위로 쓸기: 이중 점프 · 옆으로 쓸기: 회피 · 아래로 쓸기: 낙하 공격\n오른쪽 두 번 터치: 첫 번째 스킬 · 아이콘으로 무기/스킬 사용\n상자와 균열 벽을 터치해 부수고, 열쇠와 숨겨진 보물을 찾으세요.\n1/2 무기 선택 · X 교체 · R/T 스킬 · ↓ 낙하 · E 장비/상호작용 · M 탐험 지도 · Q 회복','여정 계속하기', pauseGame);
  else { modal.classList.add('hidden'); canvas.focus({ preventScroll:true }); }
}
function closePanel(){modal.classList.add('hidden');if(started){paused=false;canvas.focus({preventScroll:true});}else $('start').focus({preventScroll:true});}
function freezeForPanel(){if(started)paused=true;keys.clear();pointers.clear();input.move=0;input.attack=false;}
$('help').onclick=()=>{
  freezeForPanel();openModal('TOUCH THE KINGDOM','칼날을 다루는 법','모든 조작은 화면 터치와 키보드를 지원합니다.','돌아가기',closePanel);
  const rows=[['이동 · 이중 점프','왼쪽 드래그 · 위로 쓸기','A / D · SPACE'],['공격 · 회피','오른쪽 터치/누르기 · 옆으로 쓸기','J · K'],['무기 · 스킬','하단 아이콘 · 오른쪽 두 번 터치','1 / 2 / X · R / T'],['탐험 · 회복','상자/균열 터치 · 지도/물약 아이콘','E · M · Q'],['완벽 회피','실제 공격을 회피하면 다음 근접 반격 +35%','스킬도 빠르게 충전됩니다'],['잃어버린 체력','피격 후 3초 안에 적을 때려 일부 회복','금화로 제단에서 회복·강화']];
  const grid=document.createElement('div');grid.className='help-grid';for(const [title,a,b] of rows){const item=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=title;small.textContent=a+' · '+b;item.append(strong,small);grid.append(item);}$('modal-options').append(grid);
};
function showSettings(){
  freezeForPanel();openModal('MAKE THE NIGHT YOURS','화면 설정','설정은 이 브라우저에 저장됩니다.','적용하고 돌아가기',closePanel);
  const options=$('modal-options');options.className='settings-options';
  for(const [key,label,values] of [['view','화면 보기',[['close','가까이'],['wide','넓게']]],['smooth','화면 표현',[[false,'선명한 픽셀'],[true,'부드럽게']]],['shake','타격 시 화면 흔들림',[[true,'켜기'],[false,'끄기']]]]){
    const row=document.createElement('label');row.className='setting-row';row.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [value,text] of values){const o=document.createElement('option');o.value=String(value);o.textContent=text;o.selected=String(prefs[key])===String(value);select.append(o);}select.onchange=()=>{prefs[key]=key==='view'?select.value:select.value==='true';try{localStorage.setItem('veilbound-prefs',JSON.stringify(prefs));}catch{}resize();};row.append(select);options.append(row);
  }
}
$('settings').onclick=showSettings;
$('pause').onclick = pauseGame;
$('context').onclick = contextAction;
for(let i=0;i<2;i++)$('weapon-'+i).onclick=()=>{if(started&&!paused)switchWeapon(state,i);};
$('heal').onclick = () => { if (!paused) { if (!heal(state)) toast(state.player.flask ? '체력이 가득 찼습니다.' : '회복 물약이 없습니다.'); } };
for(let i=0;i<2;i++)$('skill-'+i).onclick=()=>{if(!paused&&started)skill(state,i);};
$('minimap-button').onclick=toggleMap;
function toggleMap(){
  if(!started||state.mode!=='playing'||gearOpen)return;
  if(mapOpen){mapOpen=false;paused=false;modal.classList.add('hidden');canvas.focus({preventScroll:true});return;}
  paused=true;mapOpen=true;keys.clear();pointers.clear();input.move=0;input.attack=false;input.down=false;
  openModal('THE PATH YOU HAVE WALKED',roomFor(state).name,'','지도로부터 돌아가기',toggleMap);
  modal.querySelector('.modal-body').classList.add('map-modal');
  const mapCanvas=document.createElement('canvas');mapCanvas.className='full-map';mapCanvas.width=960;
  const tools=document.createElement('div');tools.className='map-tools';
  for(const [wide,label] of [[false,'주변 지도'],[true,'전체 구역']]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-pressed',String(!wide));b.onclick=()=>{for(const button of tools.children)button.setAttribute('aria-pressed',String(button===b));drawMap(mapCanvas,true,wide);};tools.append(b);}
  const legend=document.createElement('p');legend.className='map-legend';legend.textContent='흰 점: 아리아 · 금: 문양/유물 · 붉은 점: 감시관 · 청록: 출구/제단 · 빗금: 균열 · 보라: 장비';
  $('modal-options').append(tools,mapCanvas,legend);drawMap(mapCanvas,true);

}
function returnToMenu() {
  save(); started = false; paused = false; modal.classList.add('hidden'); menu.classList.remove('hidden');document.body.classList.remove('playing');$('gesture-hint').classList.add('hidden');$('combat-status').classList.add('hidden');
  for (const id of ['hud','map','boss-hud','context','heal','skills','weapons','objective','minimap-button','arena-hud','kill-chain']) $(id).classList.add('hidden');
  $('room-banner').classList.remove('show'); $('start-label').textContent = '다시, 운명을 쓰기'; legacy(); $('start').focus({ preventScroll:true });
}
function updateMode() {
  if(state.mode==='won'&&endSceneTime<3.1)return;
  if (state.mode === lastMode) return; lastMode = state.mode;
  if (state.mode === 'boon') {
    openModal('A GIFT FROM THE VEIL','재의 축복','한 가지 힘을 선택하세요. 이 여정이 끝날 때까지 함께합니다.','선택하기',()=>{});
    $('modal-action').classList.add('hidden'); const options = $('modal-options'); options.className = 'boon-options';
    state.boonChoices.forEach((boon,index) => { const b = document.createElement('button'); b.className = 'boon'; const icon = document.createElement('span'); icon.textContent = ['blade','vitality','tempo','flask'].includes(boon.id) ? { blade:'†',vitality:'♡',tempo:'ϟ',flask:'✧' }[boon.id] : '◆'; icon.style.color = boon.color; const title=document.createElement('strong'); title.textContent=boon.name; const desc=document.createElement('small'); desc.textContent=boon.description; b.append(icon,title,desc); b.onclick=()=>{ chooseBoon(state,index); modal.classList.add('hidden'); canvas.focus({preventScroll:true}); }; options.append(b); });
    options.querySelector('button')?.focus({ preventScroll:true });
  } else if (state.mode === 'dead' || state.mode === 'won') {
    save(); const won=state.mode==='won';
    openModal(won?'THE DAWN IS YOURS':'DEATH IS ONLY THE BEGINNING',won?'마침내, 새벽':'불씨는 남는다',`${won?'공허의 여왕이 쓰러졌습니다. 왕국의 밤이 끝났습니다.':'육신은 쓰러졌지만, 여정은 끝나지 않았습니다.'}\n${state.kills}명 처치 · ${state.room + 1}/6 구역 · ${formatTime(state.time)}\n남겨진 불씨 ${meta.embers} — 다음 생의 무기를 강화하세요.${storageOK?'':'\n브라우저 저장을 사용할 수 없어 성장 기록은 이번 접속에만 유지됩니다.'}`,won?'다시 시작되는 전설':'다음 생으로',returnToMenu);
  }
}
function formatTime(t) { return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`; }
function updateHUD(now) {
  if (!started) return;
  const p=state.player;
  $('hp-value').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`; $('health-fill').style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;$('rally-fill').style.width=`${Math.min(100,(p.hp+(p.rallyHP||0))/p.maxHp*100)}%`;
  const status=p.riposteReady?'완벽 회피 · 다음 근접 반격 +35%':p.rallyHP>0?'잃은 체력 · 지금 공격해서 회복하세요':'';$('combat-status').textContent=status;$('combat-status').classList.toggle('hidden',!status);$('gesture-hint').classList.toggle('hidden',state.time>6||paused);
  $('flasks').textContent=`회복 ${p.flask} / ${p.maxFlask}`; $('gold').textContent=`${state.gold} 금화`; $('boon-count').textContent=`축복 ${state.boons.length}`;
  $('room-label').textContent=roomFor(state).name; $('timer').textContent=formatTime(state.time);
  if (lastRoom!==state.room) { lastRoom=state.room; banner(); $('map').replaceChildren(...state.rooms.map((r,i)=>{const el=document.createElement('span');el.className=`${r.visited?'visited ':''}${i===state.room?'current ':''}${i===5?'boss':''}`;el.title=ROOM_DEFS[i].name;return el;})); }
  if(now>bannerUntil)$('room-banner').classList.remove('show');
  const boss=state.rooms[state.room].enemies.find(e=>e.kind==='boss'&&!e.dead);
  $('boss-hud').classList.toggle('hidden',!boss||!state.bossActive);
  if(boss){$('boss-fill').style.width=`${boss.hp/boss.maxHp*100}%`;$('boss-phase').textContent=`공허의 여왕 · ${boss.stage}단계`;}
  const def=roomFor(state),room=state.rooms[state.room];
  const nearby=nearbyExit(),activeGate=nearby&&(!nearby.locked||room.cleared);
  const drop=nearbyDrop(state);
  const chest=nearbyChest(),shrine=shrineFor(state),chestReady=chest&&(!chest.vault||vaultReady(state,chest));
  $('context').classList.toggle('hidden',paused||state.mode!=='playing'||(!nearby&&!chest&&!drop&&!shrine));
  if(nearby||chest||drop||shrine){$('context').firstChild.textContent=chest?chestReady?'유물 보관함 열기 ':`봉인 · 회랑 ${chest.required}명 격파 `:activeGate?'포탈 이동 ':shrine?`불씨 제단 · ${shrine.cost} 금화 `:drop?`${drop.kind==='weapon'?'무기':'스킬'} 살펴보기 `:'봉인된 문 ';}
  const guards=room.enemies.filter(e=>e.guardian&&!e.dead).length;
  $('objective-label').textContent=state.room===5?state.mode==='won'?'왕국의 밤이 끝났습니다':'공허의 여왕을 쓰러뜨리세요':!room.keyCollected?'봉인 열쇠를 찾으세요':guards?`열쇠 획득 · 감시관 ${guards}명 남음`:'봉인 해제 · 열린 출구로 향하세요';
  updateHordeHUD(def,room,p);
  updateLoadoutHUD();
  drawMap($('minimap'));
  $('heal').style.opacity=p.flask&&p.hp<p.maxHp?'1':'.45';
  if(state.message!==lastMessage&&state.messageTimer>0&&modal.classList.contains('hidden')){lastMessage=state.message;toast(state.message);}
  updateMode();
}
function updateHordeHUD(def,room,p){
  const zone=(def.hordeZones||[]).find(z=>p.x+p.w/2>=z.x&&p.x+p.w/2<z.x+z.w&&p.y+p.h>z.y&&p.y<z.y+z.h);
  $('arena-hud').classList.toggle('hidden',!zone||state.mode!=='playing');
  if(zone){const group=room.enemies.filter(e=>e.horde&&e.hordeZone===zone.id),vault=room.vaults?.find(v=>v.zone===zone.id),kills=group.filter(e=>e.dead).length;$('arena-name').textContent=zone.name;$('arena-count').textContent=`${group.length-kills} / ${group.length}`;$('arena-hud').querySelector('strong>span').textContent=vault&&!vault.opened?` 남음 · ${Math.min(kills,vault.required)}/${vault.required} 유물 봉인`:' 남음';}
  const flow=state.flow||{kills:0,timer:0,tier:0};$('kill-chain').classList.toggle('hidden',flow.kills<3||flow.timer<=0||state.mode!=='playing');$('chain-count').textContent=flow.kills;$('chain-label').textContent=flow.tier?'연속 격파 · 스킬 충전':'연속 격파';
}

window.addEventListener('keydown',e=>{
  if(e.code==='Tab'&&!modal.classList.contains('hidden')){const buttons=[...modal.querySelectorAll('button:not(.hidden):not(:disabled),select:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length);const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyJ','KeyK','KeyQ','KeyE','KeyR','KeyT','KeyM','Digit1','Digit2','KeyX'].includes(e.code)&&started)e.preventDefault();
  if(e.code==='KeyM'){if(!e.repeat)toggleMap();return;}
  if(e.code==='Escape'&&!started&&!modal.classList.contains('hidden')){closePanel();return;}
  if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat){if(gearOpen)closeGear();else if(mapOpen)toggleMap();else pauseGame();}return;}
  if(!started||paused||state.mode!=='playing')return;
  keys.add(e.code);
  if(!e.repeat){if(['Space','ArrowUp','KeyW'].includes(e.code))requestJump();if(['KeyK','ShiftLeft','ShiftRight'].includes(e.code))dash(state);if(e.code==='KeyQ')heal(state);if(e.code==='KeyE')contextAction();if(e.code==='Digit1')switchWeapon(state,0);if(e.code==='Digit2')switchWeapon(state,1);if(e.code==='KeyX')switchWeapon(state);if(e.code==='KeyR')skill(state,0);if(e.code==='KeyT')skill(state,1);if(['ArrowDown','KeyS'].includes(e.code))groundSlam(state);}
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
  const point=screenToWorld(e.clientX,e.clientY),player=state.player;
  const shrine=shrineFor(state);if(shrine&&Math.abs(point.x-shrine.x)<58&&point.y>shrine.y-135&&point.y<shrine.y+15){pointers.delete(e.pointerId);buyShrine(state);return;}
  const drop=state.rooms[state.room].gearDrops.find(d=>!d.collected&&Math.hypot(d.x+d.w/2-player.x-player.w/2,d.y+d.h/2-player.y-player.h/2)<110&&point.x>=d.x-18&&point.x<=d.x+d.w+18&&point.y>=d.y-30&&point.y<=d.y+d.h+18);
  if(drop){pointers.delete(e.pointerId);openGear(drop);return;}
  shatterAt(state,point.x,point.y);
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

const skillPaths={crimson:'M6 23C28 21 30 4 15 3C24 9 25 15 6 23Z M5 26L28 3',storm:'M17 2L6 18H14L11 30L26 12H18Z',meteor:'M3 4L17 18M11 2L24 15M2 12L14 24M22 17A7 7 0 1 0 22 31A7 7 0 1 0 22 17',ice:'M16 2V30M4 9L28 23M4 23L28 9M12 5L16 9L20 5M12 27L16 23L20 27M5 14L10 13L10 8M22 24L22 19L27 18',thunder:'M19 2L9 13H17L12 29L25 12H18M3 7L6 9M28 25L31 27',fan:'M16 27L4 6L8 4L16 27L16 3L20 4L16 27L27 6L30 8L16 27M12 27H20',grapnel:'M3 29L22 10M20 3L29 4L29 13M22 10L30 2M8 19L14 25M5 24L9 28',ward:'M16 2L28 8V18C28 25 16 31 16 31C16 31 4 25 4 18V8Z M10 17L15 22L23 12'};
function skillIcon(id){return `<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${skillPaths[id]||skillPaths.crimson}"/></svg>`;}
const canvasSkillPaths=Object.fromEntries(Object.entries(skillPaths).map(([id,d])=>[id,new Path2D(d)]));
async function loadWeaponArt(type){try{return await spriteArt?.loadWeapon(type);}catch{return null;}}
function trimWeaponArt(){const kept=new Set(state.player.weapons.map(w=>w.type));if(gearOpen?.kind==='weapon')kept.add(gearOpen.type);spriteArt?.trim(kept);}
function updateLoadoutHUD(){
  const p=state.player;
  for(let i=0;i<2;i++){
    const w=weaponFor(state,i),button=$('weapon-'+i),rarity=RARITIES[w.rarity]||RARITIES.common;
    button.classList.toggle('selected',p.activeWeapon===i);button.classList.toggle('pending',p.pendingWeapon===i);button.setAttribute('aria-pressed',String(p.activeWeapon===i));button.style.setProperty('--loot-color',rarity.color);
    button.querySelector('small').textContent=w.short;button.querySelector('b').textContent=`${w.level}`;
    if(button.dataset.type!==w.type){button.querySelector('img').src=`assets/arsenal-icon-${w.type}.png?v=3`;button.dataset.type=w.type;}
    button.setAttribute('aria-label',`${i+1}번 무기 ${w.name} ${rarity.name} ${w.level}레벨 ${p.pendingWeapon===i?'공격 후 전환':p.activeWeapon===i?'장착 중':'선택'}`);button.title=`${w.name} · ${rarity.name} Lv.${w.level}\n${w.description}\n기본 위력 ${Math.round(state.damage*w.damageMultiplier)} · ${i+1} / X`;
    const spec=skillFor(state,i),skillButton=$('skill-'+i),cooldown=p.skillCooldowns?.[i]||0;
    skillButton.classList.toggle('ready',cooldown<=0);skillButton.querySelector('b').textContent=cooldown>0?Math.ceil(cooldown):'';skillButton.querySelector('small').textContent=spec.short;
    if(skillButton.dataset.type!==spec.id){skillButton.querySelector('span').innerHTML=skillIcon(spec.id);skillButton.dataset.type=spec.id;}
    const skillRarity=RARITIES[spec.rarity]||RARITIES.common;
    skillButton.style.setProperty('--skill-color',spec.color);skillButton.setAttribute('aria-label',`${spec.name} ${skillRarity.name} ${spec.level}레벨 ${cooldown>0?`${Math.ceil(cooldown)}초 후 사용 가능`:'사용'}`);skillButton.title=`${spec.name} · ${skillRarity.name} Lv.${spec.level} · ${spec.cooldown}초\n${spec.description}\n위력 ${Math.round(spec.multiplier*100)}%`;
  }
}
function nearbyExit(){const p=state.player;return roomFor(state).exits.find(e=>p.x-65<e.x+e.w&&p.x+p.w+65>e.x&&p.y-30<e.y+e.h&&p.y+p.h+35>e.y);}
function nearbyChest(){const p=state.player;return state.rooms[state.room].chests.find(c=>!c.opened&&Math.hypot(c.x+c.w/2-p.x-p.w/2,c.y+c.h/2-p.y-p.h/2)<105);}
function contextAction(){
  if(!started||paused||state.mode!=='playing')return;
  if(nearbyChest()){interact(state);return;}
  const exit=nearbyExit();if(exit&&(!exit.locked||state.rooms[state.room].cleared)){interact(state);return;}
  if(shrineFor(state)){buyShrine(state);return;}
  const drop=nearbyDrop(state);if(drop){openGear(drop);return;}
  interact(state);
}
function closeGear(){gearOpen=null;gearSession++;lootBusy=false;trimWeaponArt();paused=false;modal.classList.add('hidden');canvas.focus({preventScroll:true});}
function openGear(drop){
  if(!started||state.mode!=='playing'||drop.collected)return;
  gearOpen=drop;gearSession++;lootBusy=false;const session=gearSession;paused=true;mapOpen=false;keys.clear();pointers.clear();input.move=0;input.attack=false;input.down=false;$('touch-ring').classList.add('hidden');
  const spec=(drop.kind==='weapon'?WEAPONS:SKILLS).find(s=>s.id===drop.type),rarity=RARITIES[drop.rarity]||RARITIES.common;
  const strength=rarity.multiplier*(1+(Math.max(1,drop.level)-1)*.065),power=drop.kind==='weapon'?`기본 위력 ${Math.round(state.damage*spec.damage*strength)}`:`위력 ${Math.round(strength*100)}%`;
  openModal(drop.kind==='weapon'?'A NEW EDGE TO YOUR STORY':'A NEW POWER AWAKENS',spec.name,'각각 두 개까지 장착합니다. 교체한 장비는 바닥에 남습니다.','그대로 두기',closeGear);
  modal.querySelector('.modal-body').classList.add('gear-modal');const options=$('modal-options');options.className='gear-options';
  const offer=document.createElement('div');offer.className='gear-offer';offer.style.setProperty('--loot-color',rarity.color);
  const icon=document.createElement('div');icon.className='gear-offer-icon';
  if(drop.kind==='weapon'){const img=document.createElement('img');img.src=`assets/arsenal-icon-${drop.type}.png?v=3`;img.alt='';icon.append(img);}else icon.innerHTML=skillIcon(drop.type);
  const info=document.createElement('div'),eyebrow=document.createElement('small'),description=document.createElement('p');eyebrow.textContent=`${rarity.name} · Lv.${drop.level} · ${power}`;description.textContent=spec.description+(drop.kind==='skill'?` · 재사용 ${spec.cooldown}초`:'');info.append(eyebrow,description);offer.append(icon,info);options.append(offer);
  const slots=document.createElement('div');slots.className='gear-slots';options.append(slots);
  for(let i=0;i<2;i++){
    const old=drop.kind==='weapon'?weaponFor(state,i):skillFor(state,i),b=document.createElement('button');b.className='gear-slot';b.setAttribute('aria-label',`${i+1}번 슬롯 ${old.name} 대신 ${spec.name} 장착`);
    const duplicate=drop.kind==='skill'&&state.player.skills[1-i]===drop.type;
    b.dataset.blocked=String(duplicate);b.disabled=duplicate;
    const number=document.createElement('small'),title=document.createElement('strong'),detail=document.createElement('span'),action=document.createElement('em');number.textContent=`SLOT 0${i+1} · ${(RARITIES[old.rarity]||RARITIES.common).name} Lv.${old.level}`;title.textContent=old.name;detail.textContent=old.description;action.textContent=duplicate?'다른 슬롯에 장착 중':`${i+1}번에 장착 →`;b.append(number,title,detail,action);
    b.onclick=async()=>{
      if(lootBusy)return;lootBusy=true;const run=state,id=drop.id;for(const option of slots.children)option.disabled=true;action.textContent='장착하는 중…';
      const art=drop.kind!=='weapon'||await loadWeaponArt(drop.type);
      if(gearSession!==session||!gearOpen||gearOpen.id!==id||state!==run){trimWeaponArt();return;}
      if(!art){lootBusy=false;for(const option of slots.children)option.disabled=option.dataset.blocked==='true';action.textContent=`${i+1}번에 장착 →`;toast('무기 이미지를 불러오지 못했습니다. 다시 선택해 주세요.');return;}
      if(equipDrop(state,id,i)){if(drop.kind==='weapon')switchWeapon(state,i);trimWeaponArt();closeGear();updateLoadoutHUD();}
      else{lootBusy=false;for(const option of slots.children)option.disabled=option.dataset.blocked==='true';action.textContent=`${i+1}번에 장착 →`;toast('이 장비를 장착할 수 없습니다.');}
    };
    slots.append(b);
  }
  slots.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}

function requestJump(){if(!jump(state))state.player.jumpBuffer=.13;}
function readInput(){
  let move=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),firing=keys.has('KeyJ')||keys.has('KeyF');
  for(const p of pointers.values()){if(p.left){const dx=p.x-p.startX;if(Math.abs(dx)>8)move=Math.max(-1,Math.min(1,dx/35));}else if(!p.used)firing=true;}
  input.move=move;input.attack=firing;input.down=keys.has('ArrowDown')||keys.has('KeyS')||[...pointers.values()].some(p=>p.used&&p.y-p.startY>36);return input;
}
function screenToWorld(x,y){const r=canvas.getBoundingClientRect(),rx=worldCanvas.width/r.width,ry=worldCanvas.height/r.height;return{x:camera+(x-r.left)*rx/renderedScale-cameraOffsetX/renderedScale,y:cameraY+(y-r.top)*ry/renderedScale-cameraOffsetY/renderedScale};}

function glow(x,y,r,color,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function path(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function visible(r,pad=100){return r.x+r.w>=camera-pad&&r.x<=camera+viewW+pad&&r.y+r.h>=cameraY-pad&&r.y<=cameraY+viewH+pad;}
function sceneView(time){return{state,camera,cameraY,viewW,viewH,time};}
function masonry(x,y,w,h,floating=false,cracked=false){scenery?.drawBlock(ctx,{x,y,w,h},sceneView(state.time),{floating,cracked});}
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
  if(!b.broken&&Math.hypot(b.x-state.player.x,b.y-state.player.y)<240){ctx.fillStyle='#edce9277';ctx.font='10px Galmuri';ctx.textAlign='center';ctx.fillText(b.secret?'균열 · 터치':'터치로 파괴',x+w/2,y-12);}
}
function objectSprite(key,frame,x,foot,height,defaultConfig){
  const im=images[key];if(!im)return false;
  const config=objectAnimations[key]||defaultConfig,fw=config.frameW,fh=config.frameH,columns=config.columns,anchor=config.anchor,size=height/fh;
  ctx.drawImage(im,(frame%columns)*fw,Math.floor(frame/columns)*fh,fw,fh,x-anchor.x*size,foot-anchor.y*size,fw*size,fh*size);return true;
}
function chest(c,time){
  if(!visible(c,100))return;const cx=c.x+c.w/2,foot=c.y+c.h;
  if(!objectTimes.has(c))objectTimes.set(c,{opened:c.opened?time:null});
  const animation=objectTimes.get(c);if(c.opened&&animation.opened===null)animation.opened=time;
  const frame=c.opened?Math.min(7,1+Math.floor((time-animation.opened)*14)):0;
  glow(cx,foot-35,c.opened?112:80,c.opened?'#f3d29230':'#b7975f23');
  if(c.opened){
    ctx.save();ctx.globalAlpha=.3+Math.sin(time*2)*.06;const g=ctx.createLinearGradient(cx,foot-12,cx,foot-140);g.addColorStop(0,'#f3d4939a');g.addColorStop(1,'#f3d49300');path([[cx-24,foot-23],[cx-54,foot-146],[cx+50,foot-146],[cx+25,foot-23]],g);ctx.restore();
  }
  if(!objectSprite('chest',frame,cx,foot,84,{frameW:256,frameH:192,columns:8,anchor:{x:128,y:174}})){
    ctx.fillStyle='#3b3431';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.strokeStyle='#a79165';ctx.strokeRect(c.x,c.y,c.w,c.h);
  }
  if(!c.opened){const locked=c.vault&&!vaultReady(state,c);ctx.font='12px Galmuri';ctx.textAlign='center';ctx.fillStyle=locked?'#b4a2b1':'#f0ce87';ctx.fillText(locked?`봉인 ${state.rooms[state.room].enemies.filter(e=>e.dead&&e.hordeZone===c.zone).length}/${c.required}`:'유물 보관함',cx,c.y-32);if(locked){ctx.strokeStyle='#b4a1b5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-27,foot-55);ctx.lineTo(cx+26,foot-12);ctx.moveTo(cx+27,foot-55);ctx.lineTo(cx-26,foot-12);ctx.stroke();path([[cx,foot-45],[cx+10,foot-33],[cx,foot-21],[cx-10,foot-33]],'#e5b888');}}
}
function portal(gate,time){
  if(!visible(gate,180))return;
  const {x,y,w,h}=gate,sealed=gate.locked&&!state.rooms[state.room].cleared,cx=x+w/2,foot=y+h;
  const col=sealed?'#e875a5':'#9be9df';
  glow(cx,foot-88,145,sealed?'#c6538323':'#64dcd331');
  if(!objectSprite('portal',(sealed?0:8)+Math.floor(time*12)%8,cx,foot,197,{frameW:256,frameH:384,columns:8,anchor:{x:128,y:366}})){
    ctx.strokeStyle=col;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(cx,foot-80,46,82,0,0,7);ctx.stroke();
  }
  ctx.save();ctx.translate(cx,foot-86);ctx.globalAlpha=sealed?.5:.75;
  for(let i=0;i<9;i++){
    const angle=time*(sealed?.25:.6)+i*Math.PI*2/9,xx=Math.cos(angle)*(sealed?44:54),yy=Math.sin(angle)*72;
    ctx.fillStyle=col;ctx.fillRect(xx-1,yy-1,i%3===0?3:1.5,3);
  }
  if(!sealed){const g=ctx.createRadialGradient(0,0,9,0,0,76);g.addColorStop(0,'#e4fff50a');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-76,-76,152,152);}
  ctx.restore();
  ctx.font='10px Galmuri';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(sealed?'문양과 감시관의 봉인':gate.label||'다음 구역',cx,y-34);
}
function environment(time){
  const def=roomFor(state),room=state.rooms[state.room];
  scenery?.drawTerrain(ctx,sceneView(time));
  for(const shrine of room.shrines||[])drawShrine(shrine,time);
  for(const b of room.breakables)breakable(b,time);
  for(const c of room.chests)chest(c,time);
  for(const gate of def.exits||[])portal(gate,time);
  for(const zone of def.hordeZones||[])hordeEntrance(zone,time);
}
function drawShrine(shrine,time){
  const {x,y,used}=shrine;if(!visible({x:x-60,y:y-140,w:120,h:145},80))return;
  const color=used?'#5b6d77':'#8be4cf';ctx.save();ctx.translate(x,y);ctx.fillStyle='#253c4a';ctx.fillRect(-39,-12,78,12);ctx.fillStyle='#718b91';ctx.fillRect(-34,-18,68,7);ctx.fillStyle='#314b59';path([[-29,-18],[-23,-72],[23,-72],[29,-18]],'#3c5664');ctx.fillStyle='#738893';ctx.fillRect(-36,-81,72,10);ctx.fillStyle='#172734';ctx.fillRect(-28,-89,56,8);
  if(!used){glow(0,-107,100,'#7cdcc72c');for(let i=0;i<4;i++){const h=15+Math.sin(time*8+i)*6;path([[-12+i*7,-88],[-9+i*7,-109-h],[-3+i*7,-89]],i%2?'#dcf5bd':'#79d8ce');}ctx.strokeStyle='#a8edcd';ctx.lineWidth=2;ctx.strokeRect(-7,-56,14,14);}
  ctx.textAlign='center';ctx.fillStyle=color;ctx.font='12px Galmuri';ctx.fillText(used?'불씨를 받아들인 제단':'불씨 제단',0,-140);ctx.font='10px Galmuri';ctx.fillText(used?'회복 · 강화 완료':`${shrine.cost} 금화 · 회복과 강화`,0,-124);ctx.restore();
}
function hordeEntrance(zone,time){
  const x=zone.entryX,y=zone.entryY??FLOOR,west=zone.x<x;
  if(!visible({x:x-85,y:y-245,w:170,h:245},60))return;
  ctx.save();ctx.translate(x,y);ctx.strokeStyle='#958164';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-235);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-48,-213);ctx.lineTo(48,-213);ctx.stroke();
  const sway=Math.sin(time*1.7+x)*3;path([[-38,-211],[38,-211],[35+sway,-150],[sway,-163],[-35+sway,-150]],'#692c39e0');ctx.strokeStyle='#d2b084aa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-28,-205);ctx.lineTo(-26+sway,-164);ctx.moveTo(28,-205);ctx.lineTo(26+sway,-164);ctx.stroke();
  path([[0,-199],[7,-185],[0,-171],[-7,-185]],'#dfbc88');glow(0,-188,55,'#e4ab661b');
  ctx.fillStyle='#09151ddb';ctx.fillRect(-88,-134,176,42);ctx.strokeStyle='#c49b6466';ctx.strokeRect(-88,-134,176,42);ctx.textAlign='center';ctx.fillStyle='#e9c99e';ctx.font='12px Galmuri';ctx.fillText(`${west?'← ':''}${zone.name}${west?'':' →'}`,0,-116);ctx.fillStyle='#a69888';ctx.font='9px Galmuri';ctx.fillText(`${state.rooms[state.room].vaults.find(v=>v.zone===zone.id)?.required||24}명 격파 · 끝의 유물 해방`,0,-101);ctx.restore();
}
function sprite(kind,e,time,opacity=1){if(visible(e,230))spriteArt?.draw(ctx,kind,e,state,time,opacity);}
function shadow(e){
  const foot=e.y+e.h,cx=e.x+e.w/2;let ground=FLOOR;
  for(const r of [...roomFor(state).platforms,...roomFor(state).solids])if(cx>=r.x&&cx<=r.x+r.w&&r.y>=foot-3)ground=Math.min(ground,r.y);
  const distance=Math.max(0,ground-foot);if(distance>430)return;
  ctx.save();ctx.globalAlpha=.5*Math.max(.15,1-distance/430);ctx.fillStyle='#020811';ctx.beginPath();ctx.ellipse(cx,ground+3,e.w*(.9+distance*.002),5,0,0,7);ctx.fill();ctx.restore();
}
function slashEffect(s){
  const age=1-s.life/s.maxLife,r=s.radius||112,type=s.weaponType||'sword';
  ctx.save();ctx.translate(s.x,s.y);ctx.scale(s.facing, s.combo===2?-1:1);ctx.globalAlpha=(1-age)**.65;ctx.strokeStyle=s.color;ctx.fillStyle=s.color+'45';
  if(type==='spear'){
    const tip=r*1.7,spread=11*(1-age)+3;glow(tip*.7,0,55,s.color+'25');
    path([[-25,-spread],[tip,0],[-25,spread],[20,0]],s.color+'55');ctx.lineWidth=4*(1-age)+1;ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(tip,0);ctx.stroke();
    ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(22,0);ctx.lineTo(tip,0);ctx.stroke();
    for(let i=0;i<3;i++){ctx.strokeStyle=s.color+'88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(20+i*20,(i-1)*13);ctx.lineTo(tip-20,(i-1)*5);ctx.stroke();}ctx.restore();return;
  }
  if(type==='gauntlet'){
    const punch=r*(.5+age*.45);glow(punch,0,r*.65,s.color+'45');
    path([[-22,-15],[punch,-8],[punch+24,0],[punch,8],[-22,15]],s.color+'65');ctx.lineWidth=5*(1-age)+1;
    ctx.beginPath();ctx.ellipse(punch,0,9+age*22,16+age*14,0,-1.8,1.8);ctx.stroke();ctx.strokeStyle='#fff7dc';ctx.lineWidth=3;
    for(let i=0;i<4;i++){const yy=(i-1.5)*10;ctx.beginPath();ctx.moveTo(punch-65,yy);ctx.lineTo(punch+8,yy*.45);ctx.stroke();}ctx.restore();return;
  }
  const start=type==='scythe'?-2.8:-1.5+age*.2,end=type==='scythe'?2.6:1.12+age*.55;
  ctx.rotate(s.combo===3?-.45:-.18);
  ctx.fillStyle=s.color+'45';ctx.beginPath();ctx.arc(0,0,r,start,end);ctx.arc(0,0,r*(.54+age*.3),end,start,true);ctx.closePath();ctx.fill();
  ctx.shadowBlur=reducedMotion?0:15;ctx.shadowColor=s.color;ctx.strokeStyle=s.color;ctx.lineWidth=(type==='greatsword'?25:s.combo===3?16:11)*(1-age)+2;ctx.beginPath();ctx.arc(0,0,r,start,end);ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='#ffffef';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r+1,start+.15,end-.15);ctx.stroke();ctx.strokeStyle=s.color+'88';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r+15,start+.2,end-.35);ctx.stroke();ctx.restore();
}
function characters(time){
  const room=state.rooms[state.room],p=state.player;
  for(const trail of state.trails){sprite('player',trail,time,.18*trail.life/trail.maxLife);}
  for(const e of room.enemies){
    if(!visible(e,230))continue;if(e.dead){sprite(e.kind,e,time);continue;}shadow(e);
    if(e.phase==='windup'){
      glow(e.x+e.w/2,e.y+e.h*.5,75,'#fa6b9931');ctx.font='bold 25px Galmuri';ctx.textAlign='center';ctx.fillStyle='#fff1c7';ctx.fillText('!',e.x+e.w/2,e.y-27);
      if(e.intent==='daggers')for(const x of e.targets||[]){ctx.fillStyle='#d775b329';ctx.fillRect(x-17,cameraY,34,FLOOR-cameraY);ctx.strokeStyle='#f2a2db';ctx.lineWidth=2;ctx.strokeRect(x-20,FLOOR-5,40,5);}
      else if(e.intent==='arrow'){ctx.strokeStyle='#ed8b9c77';ctx.setLineDash([9,10]);ctx.beginPath();ctx.moveTo(e.x+e.w/2,e.y+25);ctx.lineTo(e.targetX,e.targetY);ctx.stroke();ctx.setLineDash([]);}
      else{const r=e.intent==='sweep'?330:e.intent==='lunge'?470:e.kind==='warden'?180:120,x=e.facing>0?e.x+e.w/2:e.x+e.w/2-r;ctx.fillStyle='#fa70992b';ctx.fillRect(x,e.y+e.h-16,r,16);ctx.fillStyle='#f2a6ac99';ctx.fillRect(x,e.y+e.h-2,r,2);}
    }
    sprite(e.kind,e,time);
    if(e.freeze>0){glow(e.x+e.w/2,e.y+e.h/2,66,'#8de5ff26');ctx.strokeStyle='#b2f3ff99';ctx.lineWidth=2;path([[e.x-7,e.y+e.h],[e.x-12,e.y+17],[e.x+e.w/2,e.y-8],[e.x+e.w+10,e.y+21],[e.x+e.w+6,e.y+e.h]],'#99dff322');ctx.stroke();}
    if(e.bleed>0){ctx.fillStyle='#ed789a';ctx.beginPath();ctx.ellipse(e.x+e.w/2,e.y-9,3,5,.2,0,7);ctx.fill();}
    if(e.phase==='attack'&&['melee','sweep'].includes(e.intent))slashEffect({x:e.x+e.w/2,y:e.y+e.h*.4,facing:e.facing,combo:1,radius:e.kind==='boss'?270:e.kind==='warden'?150:105,color:'#ed7aa5',life:.11,maxLife:.2});
    if(e.hp<e.maxHp&&e.kind!=='boss'){ctx.fillStyle='#061017';ctx.fillRect(e.x-12,e.y-18,e.w+24,4);ctx.fillStyle=e.guardian?'#d2ac73':'#dc8aa1';ctx.fillRect(e.x-12,e.y-18,(e.w+24)*e.hp/e.maxHp,4);}
    if(e.guardian){ctx.font='10px Galmuri';ctx.textAlign='center';ctx.fillStyle='#e3c599';ctx.fillText('◆ 감시관',e.x+e.w/2,e.y-30);}
  }
  shadow(p);
  if(p.castTimer>0){const col=SKILLS.find(s=>s.id===p.castSkill)?.color||'#df80aa';glow(p.x+p.w/2,p.y+p.h*.5,110,col+'2e');ctx.save();ctx.strokeStyle=col+'77';ctx.lineWidth=2;ctx.translate(p.x+p.w/2,p.y+p.h*.4);ctx.rotate(time*6);ctx.beginPath();ctx.ellipse(0,0,76,34,.5,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(p.wardTimer>0){ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h*.45);ctx.strokeStyle='#f6dc9caa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,49,67,0,0,Math.PI*2);ctx.stroke();glow(0,0,85,'#f9d99218');ctx.rotate(time*.7);for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.fillStyle='#f7e1aa';ctx.fillRect(47,-3,3,6);}ctx.restore();}
  if(p.slam){ctx.strokeStyle='#ffd09caa';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y-75);ctx.lineTo(p.x+p.w/2,p.y+25);ctx.stroke();glow(p.x+p.w/2,p.y+p.h,65,'#ffb57455');}
  sprite('player',p,time);
  for(const s of state.slashes)slashEffect(s);
}

function gearDrops(time){
  for(const drop of state.rooms[state.room].gearDrops||[]){
    if(drop.collected||!visible(drop,180))continue;
    const spec=(drop.kind==='weapon'?WEAPONS:SKILLS).find(s=>s.id===drop.type),rarity=RARITIES[drop.rarity]||RARITIES.common,col=drop.kind==='skill'?spec.color:rarity.color;
    const x=drop.x+drop.w/2,y=drop.y+drop.h/2+Math.sin(time*3+drop.x)*3,foot=drop.y+drop.h;
    ctx.save();const beam=ctx.createLinearGradient(x,foot,x,foot-125);beam.addColorStop(0,col+'55');beam.addColorStop(1,col+'00');ctx.fillStyle=beam;ctx.fillRect(x-13,foot-125,26,125);
    glow(x,y,55,col+'30');ctx.strokeStyle=col+'99';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,foot+2,22,5,0,0,7);ctx.stroke();
    if(drop.kind==='weapon'&&images['icon_'+drop.type])ctx.drawImage(images['icon_'+drop.type],x-30,y-32,60,60);
    else{ctx.save();ctx.translate(x-17,y-17);ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(canvasSkillPaths[drop.type]);ctx.restore();}
    ctx.font='10px Galmuri';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(spec.name,x,foot+20);
    if(Math.hypot(x-state.player.x-state.player.w/2,y-state.player.y-state.player.h/2)<110){ctx.fillStyle='#fff3db';ctx.font='9px Galmuri';ctx.fillText('터치 / E · 두 슬롯 중 선택',x,foot+35);}
    ctx.restore();
  }
}

function pickups(time){
  gearDrops(time);
  for(const item of state.rooms[state.room].items){
    if(item.collected||!visible({x:item.x-10,y:item.y-10,w:20,h:20},60))continue;
    const yy=item.y+Math.sin(time*3+item.x)*4,col=item.kind==='ember'?'#c6a1ff':item.kind==='gold'?'#dfbf7e':item.kind==='sigil'?'#eddb9d':'#afe7ae';glow(item.x,yy,item.kind==='sigil'?75:28,col+'35');
    ctx.fillStyle=col;
    if(item.kind==='gold'){ctx.beginPath();ctx.ellipse(item.x,yy,4,6,0,0,7);ctx.fill();ctx.fillStyle='#fff1c2';ctx.fillRect(item.x-1,yy-3,1,6);}
    else if(item.kind==='sigil'){
      ctx.save();ctx.translate(item.x,yy);ctx.rotate(Math.sin(time)*.12);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.strokeRect(-12,-12,24,24);ctx.rotate(Math.PI/4);ctx.strokeRect(-9,-9,18,18);path([[0,-7],[5,0],[0,7],[-5,0]],'#fff3c4');ctx.restore();ctx.font='12px Galmuri';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText('봉인 문양',item.x,yy-33);
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
  }else if(effect.kind==='thunder'){
    const dx=(effect.fromX??effect.x-100)-effect.x,dy=(effect.fromY??effect.y-150)-effect.y;
    ctx.lineWidth=5*(1-t)+1;ctx.beginPath();ctx.moveTo(dx,dy);for(let i=1;i<9;i++){const v=i/8,jitter=i===8?0:Math.sin(i*17+effect.x)*22*(1-t);ctx.lineTo(dx*(1-v)+jitter,dy*(1-v)-jitter);}ctx.stroke();ctx.strokeStyle='#ffffe9';ctx.lineWidth=1.5;ctx.stroke();glow(0,0,60,effect.color+'55');
  }else if(effect.kind==='freeze'){
    glow(0,0,r*(.45+t*.6),effect.color+'25');
    for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4+t*.2);const at=r*(.2+t*.75),size=20*(1-t)+4;path([[at-size,0],[at,-size*.45],[at+size,0],[at,size*.45]],effect.color+'70');ctx.stroke();ctx.restore();}
    ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*(.25+t*.75),0,7);ctx.stroke();
  }else if(effect.kind==='meteor'){
    glow(0,0,r*(.6+t*.5),effect.color+'50');const tail=330*(1-t);ctx.lineWidth=25*(1-t)+1;ctx.beginPath();ctx.moveTo(-tail*.55,-tail);ctx.lineTo(0,0);ctx.stroke();ctx.strokeStyle='#fff3c5';ctx.lineWidth=7*(1-t)+1;ctx.stroke();
    ctx.scale(1,.3);ctx.strokeStyle=effect.color;ctx.lineWidth=11*(1-t)+1;ctx.beginPath();ctx.arc(0,0,r*(.2+t*.8),0,7);ctx.stroke();
  }else if(effect.kind==='ward'){
    const size=r*(.3+t*.45);glow(0,0,size,effect.color+'24');ctx.lineWidth=4*(1-t)+1;ctx.beginPath();for(let i=0;i<=6;i++){const a=i*Math.PI/3-Math.PI/2;ctx.lineTo(Math.cos(a)*size*.75,Math.sin(a)*size);}ctx.closePath();ctx.stroke();ctx.rotate(Math.PI/6);ctx.lineWidth=1;ctx.stroke();
  }else if(effect.kind==='fan'){
    for(let i=0;i<6;i++){ctx.save();ctx.rotate((i-2.5)*.2);const at=r*(.2+t*.8);path([[at+22,0],[at-18,-5],[at-8,0],[at-18,5]],effect.color+'aa');ctx.restore();}
  }else if(effect.kind==='grapnel'){
    ctx.rotate(t*2);for(let i=0;i<9;i++){ctx.save();ctx.rotate(i*Math.PI*2/9);ctx.beginPath();ctx.ellipse(r*(.2+t*.6),0,12,5,.5,0,7);ctx.stroke();ctx.restore();}
  }else if(effect.kind==='gun'||effect.kind==='shoot'){
    glow(0,0,r*.8,effect.color+'65');ctx.rotate(effect.x);for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);path([[0,-4],[r*(1-t),0],[0,4]],i%2?'#fff6d6':effect.color+'a0');}
  }else if(effect.kind==='gear'||effect.kind==='chest'){
    ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,r*(.3+t*.7),r*(.16+t*.25),0,0,7);ctx.stroke();for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4);const at=r*(.2+t*.7);path([[at,-6],[at+5,0],[at,6],[at-5,0]],effect.color+'aa');ctx.restore();}
  }else if(['key','heal','jump','cast','touch','shatter','perfect'].includes(effect.kind)){
    ctx.beginPath();ctx.arc(0,0,r*(.25+t*.75),0,7);ctx.stroke();if(effect.kind==='key'||effect.kind==='shatter')for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*t*.7,Math.sin(a)*r*t*.7);ctx.lineTo(Math.cos(a)*r*(t*.8+.2),Math.sin(a)*r*(t*.8+.2));ctx.stroke();}
  }else{
    ctx.rotate(effect.x*.17);for(let i=0;i<9;i++){const a=i*Math.PI*2/9,len=(i%2?.6:1)*r;ctx.beginPath();ctx.moveTo(Math.cos(a)*len*t*.6,Math.sin(a)*len*t*.6);ctx.lineTo(Math.cos(a)*len*(.15+t*.85),Math.sin(a)*len*(.15+t*.85));ctx.stroke();}glow(0,0,36*(1-t)+8,'#fff3d559');
  }
  ctx.restore();
}
function effects(time){
  for(const mark of state.skillEffects||[]){
    const progress=1-mark.life/mark.maxLife;
    ctx.save();ctx.translate(mark.x,mark.y);ctx.strokeStyle=mark.color+'bb';ctx.fillStyle=mark.color+'18';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,mark.radius,mark.radius*.26,0,0,7);ctx.fill();ctx.stroke();
    ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(-180,-360);ctx.lineTo(0,0);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,mark.radius*.75,mark.radius*.19,0,-Math.PI/2,progress*Math.PI*2-Math.PI/2);ctx.stroke();
    const remaining=(1-progress)*350;glow(-remaining*.5,-remaining,38,mark.color+'55');path([[-remaining*.5-10,-remaining-12],[-remaining*.5+11,-remaining-4],[-remaining*.5+8,-remaining+10],[-remaining*.5-7,-remaining+12]],mark.color+'cc');ctx.restore();
  }
  for(const shot of state.projectiles){
    if(!visible(shot,130))continue;
    if(['harpoon','chainHook'].includes(shot.kind)){
      const fromX=state.player.x+state.player.w/2,fromY=state.player.y+34,toX=shot.x+shot.w/2,toY=shot.y+shot.h/2,dx=toX-fromX,dy=toY-fromY,length=Math.hypot(dx,dy);
      ctx.save();ctx.translate(fromX,fromY);ctx.rotate(Math.atan2(dy,dx));ctx.strokeStyle=shot.color+'88';ctx.lineWidth=1.4;const links=Math.min(45,Math.ceil(length/15));for(let i=0;i<links;i++){ctx.beginPath();ctx.ellipse(i*length/links,0,7,3,i%2?.15:0,0,7);ctx.stroke();}ctx.restore();
    }
    ctx.save();ctx.translate(shot.x+shot.w/2,shot.y+shot.h/2);
    if(shot.kind==='wave'){
      ctx.scale(shot.facing||1,1);glow(0,0,95,'#ff5d962e');ctx.strokeStyle='#ff789b';ctx.lineWidth=13;ctx.shadowColor='#ff5685';ctx.shadowBlur=reducedMotion?0:18;ctx.beginPath();ctx.arc(-30,0,65,-1.25,1.25);ctx.stroke();ctx.strokeStyle='#fff3dc';ctx.lineWidth=3;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ff91c580';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-42,0,75,-1.2,1.2);ctx.stroke();for(let i=0;i<4;i++){ctx.globalAlpha=.3-i*.05;ctx.fillStyle='#e96393';ctx.fillRect(-45-i*18,-45+i*26,36,2);}
    }else if(shot.kind==='frost'){
      glow(0,0,60,shot.color+'45');ctx.rotate(time*4);ctx.strokeStyle=shot.color;ctx.lineWidth=3;
      for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(30,0);ctx.moveTo(18,0);ctx.lineTo(24,-7);ctx.moveTo(18,0);ctx.lineTo(24,7);ctx.stroke();}ctx.strokeStyle='#f2fcff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,17,0,7);ctx.stroke();
    }else if(shot.kind==='bullet'){
      ctx.rotate(Math.atan2(shot.vy,shot.vx));glow(0,0,25,shot.color+'55');const trail=ctx.createLinearGradient(-75,0,12,0);trail.addColorStop(0,shot.color+'00');trail.addColorStop(1,shot.color);ctx.fillStyle=trail;ctx.fillRect(-75,-2,87,4);ctx.fillStyle='#fff8d7';ctx.fillRect(-4,-1,20,2);
    }else if(shot.kind==='playerArrow'){
      ctx.rotate(Math.atan2(shot.vy,shot.vx));ctx.strokeStyle=shot.color+'66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-60,0);ctx.lineTo(18,0);ctx.stroke();ctx.strokeStyle='#c8b79b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-23,0);ctx.lineTo(17,0);ctx.stroke();path([[24,0],[12,-5],[12,5]],'#ecf7d7');path([[-23,0],[-32,-6],[-17,-4]],shot.color);path([[-23,0],[-32,6],[-17,4]],shot.color);
    }else if(['harpoon','chainHook'].includes(shot.kind)){
      ctx.rotate(Math.atan2(shot.vy,shot.vx));glow(0,0,34,shot.color+'25');ctx.strokeStyle='#dbe9de';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(22,0);ctx.stroke();path([[30,0],[14,-8],[17,0],[14,8]],shot.color);ctx.strokeStyle=shot.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(12,-7);ctx.lineTo(8,-13);ctx.lineTo(24,-9);ctx.moveTo(12,7);ctx.lineTo(8,13);ctx.lineTo(24,9);ctx.stroke();
    }else if(shot.kind==='bladeFan'){
      ctx.rotate(Math.atan2(shot.vy,shot.vx));glow(0,0,22,shot.color+'22');path([[22,0],[-10,-4],[-5,0],[-10,4]],'#e9fffa');ctx.strokeStyle=shot.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,-6);ctx.lineTo(-10,6);ctx.moveTo(-11,0);ctx.lineTo(-22,0);ctx.stroke();ctx.strokeStyle=shot.color+'66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-70,0);ctx.lineTo(-24,0);ctx.stroke();
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
    ctx.save();ctx.globalAlpha=Math.min(1,text.life/text.maxLife*2);ctx.font=`${text.critical?'bold 23':'bold 16'}px Galmuri`;ctx.textAlign='center';ctx.strokeStyle='#061018';ctx.lineWidth=3;ctx.strokeText(text.text,text.x,text.y-12);ctx.fillStyle=text.color;ctx.fillText(text.text,text.x,text.y-12);ctx.restore();
  }
}
function drawMap(target,full=false,wide=false){
  const room=state.rooms[state.room],def=roomFor(state),width=def.width||W,mapWidth=full&&!wide?Math.min(3072,width):width,mapX=full&&!wide?Math.max(0,Math.min(width-mapWidth,state.player.x+state.player.w/2-mapWidth/2)):0,mapHeight=Math.round(target.width*H/mapWidth);if(target.height!==mapHeight)target.height=mapHeight;
  const g=target.getContext('2d'),sx=target.width/mapWidth,sy=target.height/H,known=(x,y)=>room.explored[Math.floor(y/128)*room.exploreCols+Math.floor(x/128)];
  g.clearRect(0,0,target.width,target.height);g.fillStyle='#0c1a24';g.fillRect(0,0,target.width,target.height);g.save();g.scale(sx,sy);g.translate(-mapX,0);
  g.beginPath();for(let i=0;i<room.explored.length;i++)if(room.explored[i])g.rect((i%room.exploreCols)*128,Math.floor(i/room.exploreCols)*128,128,128);g.clip();
  g.fillStyle='#233d48';g.fillRect(0,0,width,H);
  g.fillStyle='#713d4959';for(const zone of def.hordeZones||[])g.fillRect(zone.x,zone.y,zone.w,zone.h);
  g.fillStyle='#789a9c';for(const r of [...def.solids,{x:0,y:FLOOR,w:width,h:H-FLOOR}])g.fillRect(r.x,r.y,r.w,r.h);
  g.fillStyle='#a9c6b5';for(const r of def.platforms)g.fillRect(r.x,r.y,r.w,full?r.h:18);
  for(const b of room.breakables)if(!b.broken&&(b.kind==='wall'||b.kind==='rune')){g.fillStyle='#d9ae8a';g.fillRect(b.x,b.y,b.w,b.h);g.strokeStyle='#263d44';g.lineWidth=8;for(let yy=b.y;yy<b.y+b.h;yy+=45){g.beginPath();g.moveTo(b.x,yy);g.lineTo(b.x+b.w,yy+36);g.stroke();}}
  for(const exit of def.exits){g.fillStyle=exit.locked&&!room.cleared?'#9d6179':'#a1e5e1';g.fillRect(exit.x,exit.y,exit.w,exit.h);}
  for(const item of room.items)if(!item.collected&&item.kind==='sigil'){g.fillStyle='#ffdf87';g.beginPath();g.arc(item.x,item.y,full?22:28,0,7);g.fill();}
  for(const chest of room.chests)if(!chest.opened){g.fillStyle='#d8b790';g.fillRect(chest.x,chest.y,chest.w,chest.h);}
  for(const shrine of room.shrines||[])if(!shrine.used){g.fillStyle='#80e6cb';g.fillRect(shrine.x-25,shrine.y-90,50,90);}
  for(const drop of room.gearDrops||[])if(!drop.collected){g.fillStyle='#d6acff';g.beginPath();g.arc(drop.x+drop.w/2,drop.y+drop.h/2,23,0,7);g.fill();}
  for(const e of room.enemies)if(!e.dead){g.fillStyle=e.guardian?'#fc869c':'#b5677f';g.beginPath();g.arc(e.x+e.w/2,e.y+e.h/2,e.guardian?25:14,0,7);g.fill();}
  if(full){g.font='46px Galmuri';g.textAlign='center';g.fillStyle='#d0e0d0';for(const z of def.zones||[])if(known(z.x+z.w/2,z.y+z.h/2))g.fillText(z.label,z.x+z.w/2,z.y+z.h/2);}
  g.restore();
  g.save();g.scale(sx,sy);g.translate(-mapX,0);g.strokeStyle='#c4eee43e';g.lineWidth=full?5:10;g.strokeRect(camera,cameraY,viewW,viewH);g.fillStyle='#fff7dd';g.beginPath();g.arc(state.player.x+state.player.w/2,state.player.y+state.player.h/2,full?22:31,0,7);g.fill();g.strokeStyle='#ffffffaa';g.lineWidth=7;g.beginPath();g.moveTo(state.player.x+state.player.w/2,state.player.y+state.player.h/2);g.lineTo(state.player.x+state.player.w/2+state.player.facing*63,state.player.y+state.player.h/2);g.stroke();g.restore();
}
function menuScene(time){
  if(scenery){ctx.save();const scale=worldCanvas.height/650;ctx.scale(scale,scale);const v={state:{...state,room:0},camera:2390+Math.sin(time*.04)*45,cameraY:1230,viewW:worldCanvas.width/scale,viewH:650,time};ctx.translate(-v.camera,-v.cameraY);scenery.drawBackground(ctx,v);scenery.drawTerrain(ctx,v);ctx.restore();}
  spriteArt?.drawTitle(ctx,worldCanvas.width,worldCanvas.height,time);
  for(let i=0;i<25;i++){const x=(i*61+Math.sin(time*.2+i)*15)%worldCanvas.width,y=worldCanvas.height-(time*6+i*43)%worldCanvas.height;ctx.fillStyle=i%3?'#a3dfd766':'#ead1a999';ctx.fillRect(x,y,1,1);}
}
function present(){screen.setTransform(1,0,0,1,0,0);screen.imageSmoothingEnabled=prefs.smooth;screen.drawImage(worldCanvas,0,0,canvas.width,canvas.height);}
function render(time,dt){
  ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#080d18';ctx.fillRect(0,0,worldCanvas.width,worldCanvas.height);
  if(!started){menuScene(time);present();return;}
  const p=state.player,scale=Math.min(worldCanvas.width/viewW,worldCanvas.height/viewH),offsetX=(worldCanvas.width-viewW*scale)/2,offsetY=(worldCanvas.height-viewH*scale)/2;
  const tx=Math.max(0,Math.min((roomFor(state).width||W)-viewW,p.x+p.w/2-viewW*.42+p.facing*Math.min(80,Math.abs(p.vx)*.13))),ty=Math.max(0,Math.min(FLOOR-viewH*.76,p.y+p.h-viewH*.76+Math.max(-65,Math.min(55,p.vy*.04))));
  if(cameraRoom!==state.room){camera=tx;cameraY=ty;cameraRoom=state.room;}
  else if(!paused&&state.hitStop<=0){camera+=(tx-camera)*(1-Math.exp(-10*dt));cameraY+=(ty-cameraY)*(1-Math.exp(-9*dt));}
  const shake=prefs.shake&&!reducedMotion&&state.shake>0?state.shake*16:0,shakeX=Math.sin(time*170)*shake,shakeY=Math.cos(time*143)*shake*.65;
  renderedScale=scale;cameraOffsetX=offsetX+shakeX;cameraOffsetY=offsetY+shakeY;
  ctx.save();ctx.translate(cameraOffsetX-camera*scale,cameraOffsetY-cameraY*scale);ctx.scale(scale,scale);
  if(state.mode==='won'&&!paused)endSceneTime+=dt;
  const sceneTime=state.time+endSceneTime,v=sceneView(sceneTime);scenery?.drawBackground(ctx,v);environment(sceneTime);pickups(sceneTime);characters(sceneTime);effects(sceneTime);scenery?.drawForeground(ctx,v);ctx.restore();
  if(state.flash>0&&!reducedMotion){ctx.fillStyle=`rgba(255,220,233,${Math.min(.1,state.flash*.45)})`;ctx.fillRect(0,0,worldCanvas.width,worldCanvas.height);}
  present();
}
function frame(now){
  const dt=Math.min(.035,(now-lastTime)/1000||1/60);lastTime=now;
  if(started&&!paused&&state.mode==='playing')step(state,readInput(),dt);
  else if(started&&!paused)step(state,{},dt);
  for(const event of new Set(state.events.splice(0)))sound(event);
  music(now/1000);render(now/1000,dt);
  if(now-uiAt>90){uiAt=now;updateHUD(now);}
  requestAnimationFrame(frame);
}
legacy();resize();requestAnimationFrame(frame);
try{
  await Promise.all([
    createScenery().then(art=>{scenery=art;}),createSprites().then(art=>{spriteArt=art;}),
    ...Object.entries(assetPaths).map(([key,path])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>resolve();im.src=path+'?v=5';})),
    fetch('assets/reliquary-animations.json?v=5').then(r=>r.ok?r.json():{}).then(data=>{objectAnimations=data;}).catch(()=>{})
  ]);
}catch(error){console.error('Asset loading failed',error);}
$('start').disabled=!spriteArt||!scenery;$('start-label').textContent=$('start').disabled?'새로고침하여 다시 불러오기':'여정 시작하기';
if($('start').disabled)toast('왕국을 불러오지 못했습니다. 페이지를 새로고침하세요.');

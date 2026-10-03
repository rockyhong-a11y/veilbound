// Combat catalogs shared by simulation and presentation. Distinct attacks are implemented in engine.js.
export const RARITIES = {
  common: { name: '일반', color: '#c4d9db', multiplier: 1 },
  rare: { name: '희귀', color: '#79d8ff', multiplier: 1.14 },
  epic: { name: '영웅', color: '#d2a0ff', multiplier: 1.3 },
};
export const WEAPONS = [
  { id: 'sword', name: '월광검', short: '검', glyph: '⚔', color: '#a7ffde', family: 'melee', description: '빠른 3단 검격 · 마지막 베기의 넓은 사거리', damage: 1, range: 208, tempo: 1 },
  { id: 'gauntlet', name: '파쇄 건틀릿', short: '건틀릿', glyph: '✊', color: '#ffb181', family: 'melee', description: '근접 연타 · 빠른 철권과 강한 마무리', damage: .8, range: 120, tempo: .58 },
  { id: 'spear', name: '백야의 창', short: '창', glyph: '♜', color: '#ffe5a7', family: 'melee', description: '긴 직선 찌르기 · 좁은 높이의 정밀 타격', damage: 1.12, range: 328, tempo: 1.08 },
  { id: 'gun', name: '잿빛 권총', short: '총', glyph: '⌁', color: '#ffcf91', family: 'ranged', description: '빠른 탄환 · 세 번째 사격은 3연발', damage: .92, range: 1100, tempo: .86 },
  { id: 'bow', name: '가시 활', short: '활', glyph: '➶', color: '#bce2a2', family: 'ranged', description: '관통 화살 · 콤보를 이어갈수록 강해지는 화살', damage: 1.25, range: 1200, tempo: 1.3 },
  { id: 'harpoon', name: '심해 작살', short: '작살', glyph: '⤙', color: '#8ae8e9', family: 'ranged', description: '적을 끌어오는 갈고리 · 무거운 관통 타격', damage: 1.45, range: 960, tempo: 1.55 },
  { id: 'greatsword', name: '황혼 대검', short: '대검', glyph: '✦', color: '#f9a1ba', family: 'melee', description: '느리지만 강한 광역 베기 · 큰 경직', damage: 1.65, range: 315, tempo: 1.75 },
  { id: 'scythe', name: '공허의 낫', short: '낫', glyph: '☽', color: '#c1a4ff', family: 'melee', description: '등 뒤까지 회전 베기 · 출혈 지속 피해', damage: 1.12, range: 240, tempo: 1.18 },
];
export const SKILLS = [
  { id: 'crimson', name: '혈월의 검기', short: '검기', glyph: '⟐', key: 'R', cooldown: 4.5, color: '#ff799a', description: '넓은 검기가 적과 파괴물을 관통합니다.' },
  { id: 'storm', name: '공허의 폭풍', short: '폭풍', glyph: 'ϟ', key: 'T', cooldown: 9, color: '#b7a0ff', description: '주변의 적을 밀치고 적의 투사체를 소멸시킵니다.' },
  { id: 'meteor', name: '낙성의 심판', short: '낙성', glyph: '☄', cooldown: 10, color: '#ffb177', description: '적의 위치에 낙성을 예고한 뒤 폭발합니다.' },
  { id: 'ice', name: '서리의 숨결', short: '서리', glyph: '❄', cooldown: 7, color: '#91e6ff', description: '서리 구체가 적을 관통하고 잠시 얼립니다.' },
  { id: 'thunder', name: '연쇄 번개', short: '번개', glyph: '↯', cooldown: 8, color: '#fff29a', description: '최대 네 적 사이로 번개가 이어집니다.' },
  { id: 'fan', name: '천개의 칼날', short: '칼날', glyph: '✳', cooldown: 5.5, color: '#bceacf', description: '부채꼴로 여섯 단검을 날립니다.' },
  { id: 'grapnel', name: '심연의 사슬', short: '사슬', glyph: '⛓', cooldown: 6, color: '#8ee7df', description: '사슬 작살이 적을 끌어와 다음 공격을 준비합니다.' },
  { id: 'ward', name: '여명의 방벽', short: '방벽', glyph: '◇', cooldown: 12, color: '#f4da9c', description: '4초 동안 피해를 흡수하고 근접 투사체를 차단합니다.' },
];
export const weaponSpec = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
export const skillSpec = id => SKILLS.find(s => s.id === id);

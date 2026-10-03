export const CORE_X = 2048, CORE_W = 4096;
export const W = CORE_X * 2 + CORE_W, H = 2048, FLOOR = 1880;

// Platforms are one-way ledges. Masonry in solids collides on every side.
const p = (x, y, w, h = 26) => ({ x, y, w, h, oneWay: true });
const s = (x, y, w, h) => ({ x, y, w, h });
const e = (kind, x, y, min, max, guardian = false, name) => ({ kind, x, y, patrolMin: min, patrolMax: max, guardian, ...(name ? { name } : {}) });
const item = (kind, x, surface, amount = 1) => ({ kind, x, y: surface - 28, amount });
const prop = (kind, x, surface, loot = 'gold') => ({ kind, x, y: surface - (kind === 'urn' ? 64 : 74), w: kind === 'urn' ? 40 : 62, h: kind === 'urn' ? 64 : 74, hp: kind === 'urn' ? 1 : 28, loot, solid: false });
const crack = (x, y, h) => ({ kind: 'wall', x, y, w: 42, h, hp: 58, loot: 'ember', secret: true, solid: true });
const chest = (x, surface, reward, secret = false) => ({ kind: 'relic', x, y: surface - 52, w: 68, h: 52, opened: false, secret, reward });
const zone = (x, y, w, h, label) => ({ x, y, w, h, label });
const decoration = (kind, x, y, scale = 1) => ({ kind, x, y, scale });
const route = points => points.map(([x, y], n) => ({ x, y, action: n === 0 ? 'start' : y < points[n - 1][1] ? 'jump' : y > points[n - 1][1] ? 'drop' : 'walk' }));
const gates = (index, surface, previousSurface) => [
  ...(index ? [{ x: 60, y: FLOOR - 148, w: 100, h: 148, target: index - 1, locked: false, label: '이전 구역', destination: { x: 3770, y: previousSurface } }] : []),
  { x: 3850, y: surface - 148, w: 130, h: 148, target: index + 1, locked: true, label: '봉인의 문', destination: { x: index === 4 ? 1040 : 180, y: FLOOR } },
];

const CORE_ROOMS = [
  {
    name: '잿빛 감옥', subtitle: 'THE ASHEN CELLS', color: '#496983', decor: 'prison', spawn: { x: 180, y: FLOOR },
    platforms: [
      p(350, 1690, 230), p(590, 1500, 240), p(750, 1310, 200), p(1020, 1280, 230),
      p(1270, 1690, 230), p(1530, 1500, 230), p(1730, 1310, 250), p(2080, 1120, 230),
      p(2440, 1690, 230), p(2640, 1500, 230), p(2790, 1310, 250), p(3140, 1120, 230),
      p(3390, 1260, 220), p(3590, 1060, 506), p(3350, 1690, 260), p(3590, 1500, 230), p(3370, 1310, 230),
      p(360, 1310, 180), p(470, 1120, 180), p(740, 970, 170), p(1200, 1500, 180), p(2470, 1120, 180),
    ],
    solids: [
      s(920, 1280, 105, 600), s(1030, 1030, 830, 100), s(1980, 1120, 105, 760),
      s(2130, 870, 700, 100), s(3060, 1120, 110, 760), s(710, 1580, 210, 60),
    ],
    exits: gates(0, 1060),
    enemies: [
      e('duelist', 550, FLOOR, 330, 680), e('archer', 685, 1500, 615, 770), e('duelist', 1090, 1280, 1030, 1190),
      e('warden', 1440, FLOOR, 1150, 1710), e('archer', 1610, 1500, 1560, 1680),
      e('duelist', 2380, FLOOR, 2220, 2580), e('archer', 2710, 1500, 2670, 2800),
      e('warden', 3200, 1120, 3170, 3310, true, '봉인을 지키는 여감시관'), e('duelist', 3750, 1060, 3640, 3840),
    ],
    breakables: [crack(710, 1640, 240), prop('crate', 425, FLOOR), prop('urn', 1160, 1280, 'ember'), prop('crate', 1530, FLOOR, 'flask'), prop('urn', 2600, FLOOR), prop('crate', 3440, 1260)],
    items: [item('gold', 445, 1690, 12), item('gold', 680, 1500, 12), item('ember', 550, 1120, 2), item('flask', 1280, FLOOR), item('gold', 2500, 1690, 18), item('sigil', 3235, 1120)],
    chests: [chest(790, FLOOR, 'blade', true), chest(785, 970, 'vitality'), chest(2490, 1120, 'tempo')],
    zones: [zone(0, 1280, 1025, 600, '쇠사슬의 수직 감방'), zone(1040, 1210, 850, 670, '감시관의 회랑'), zone(2130, 1050, 920, 830, '무너진 징벌실'), zone(711, 1640, 210, 240, '벽 뒤의 밀실'), zone(3060, 880, 1036, 460, '봉인의 망루')],
    routeHints: ['발판을 두 번 뛰어 감방 위로 올라가세요.', '낮은 천장 아래로 내려간 뒤 반대편 망루를 오르세요.', '갈라진 벽 뒤에는 유물이 있습니다.', '위쪽 봉인과 여감시관을 찾아 문을 여세요.'],
    decorations: [decoration('torch', 320, 1740), decoration('chain', 870, 880, 1.4), decoration('banner', 940, 1160), decoration('torch', 1390, 1800), decoration('chain', 1780, 1140), decoration('torch', 2200, 1000), decoration('banner', 3140, 910), decoration('torch', 3710, 990)],
    waypoints: route([[180, FLOOR], [310, FLOOR], [430, 1690], [655, 1500], [840, 1310], [951, 1280], [1190, 1280], [1430, FLOOR], [1330, 1690], [1620, 1500], [1820, 1310], [1935, 1310], [2010, 1120], [2240, 1120], [2540, FLOOR], [2510, 1690], [2720, 1500], [2860, 1310], [2975, 1310], [3090, 1120], [3230, 1120], [3300, 1120], [3490, 1260], [3680, 1060], [3890, 1060]]),
  },
  {
    name: '가라앉은 수로', subtitle: 'THE DROWNED AQUEDUCT', color: '#398c98', decor: 'aqueduct', spawn: { x: 180, y: FLOOR },
    platforms: [
      p(280, 1690, 235), p(510, 1500, 230), p(750, 1490, 250),
      p(1320, 1690, 260), p(1580, 1500, 240), p(1790, 1310, 240), p(1600, 1120, 235), p(1860, 930, 260), p(2210, 930, 280),
      p(2550, 1690, 240), p(2780, 1500, 260), p(2990, 1310, 300), p(3190, 1120, 310), p(3590, 930, 506), p(3640, 1690, 230), p(3830, 1500, 240), p(3640, 1310, 230), p(3830, 1120, 240),
      p(990, 1690, 190), p(1110, 1500, 190), p(1510, 1310, 160), p(2660, 1120, 160), p(2880, 930, 185), p(3750, 740, 180),
    ],
    solids: [s(680, 1490, 85, 390), s(820, 1220, 710, 120), s(2110, 930, 110, 950), s(2270, 680, 870, 100), s(3490, 930, 110, 950), s(1160, 1660, 160, 55), s(1285, 1715, 35, 165)],
    exits: gates(1, 930, 1060),
    enemies: [
      e('duelist', 455, FLOOR, 250, 630), e('archer', 810, 1490, 780, 940), e('duelist', 1060, FLOOR, 910, 1250),
      e('warden', 1690, FLOOR, 1430, 1910), e('archer', 1900, 1310, 1840, 1980),
      e('duelist', 2300, 930, 2230, 2420), e('warden', 2760, FLOOR, 2470, 3020),
      e('archer', 3270, 1120, 3220, 3430), e('warden', 3660, 930, 3605, 3770, true, '심연의 수문장'),
    ],
    breakables: [prop('urn', 550, 1500), prop('crate', 1000, FLOOR, 'flask'), crack(1120, 1715, 165), prop('urn', 1740, 1120, 'ember'), prop('crate', 2480, FLOOR), prop('urn', 2910, 1500), prop('crate', 3700, 930)],
    items: [item('gold', 380, 1690, 14), item('gold', 1230, 1500, 22), item('ember', 1690, 1120, 2), item('gold', 2910, 930, 24), item('flask', 2640, FLOOR), item('sigil', 3720, 930)],
    chests: [chest(1200, FLOOR, 'vitality', true), chest(2700, 1120, 'blade'), chest(3790, 740, 'tempo')],
    zones: [zone(0, 1490, 770, 390, '파손된 수문'), zone(820, 1420, 730, 460, '침수된 배수로'), zone(1570, 800, 650, 1080, '물레방아의 수직 통로'), zone(2270, 860, 870, 1020, '아래로 흐르는 강'), zone(3490, 630, 606, 510, '심연의 봉인')],
    routeHints: ['수문을 넘으면 아래 배수로로 길이 이어집니다.', '상부 통로는 지그재그로 오르세요.', '푸른 폭포 뒤쪽의 갈라진 벽을 찾아보세요.', '마지막 수문 위에서 봉인이 기다립니다.'],
    decorations: [decoration('waterfall', 1035, 1420, 1.8), decoration('pipe', 820, 1370, 2), decoration('torch', 1580, 1710), decoration('waterfall', 2085, 1020, 2.4), decoration('pipe', 2430, 840, 2), decoration('waterfall', 3090, 1320, 1.7), decoration('torch', 3530, 840), decoration('waterfall', 4060, 820, 2.2)],
    waypoints: route([[180, FLOOR], [330, 1690], [550, 1500], [700, 1490], [925, 1490], [1220, 1660], [1380, FLOOR], [1390, 1690], [1670, 1500], [1870, 1310], [1690, 1120], [1960, 930], [2140, 930], [2420, 930], [2720, FLOOR], [2630, 1690], [2860, 1500], [3090, 1310], [3300, 1120], [3435, 1120], [3520, 930], [3710, 930], [3890, 930]]),
  },
  {
    name: '금서의 서고', subtitle: 'THE FORBIDDEN ARCHIVE', color: '#8872b5', decor: 'library', spawn: { x: 180, y: FLOOR },
    platforms: [
      p(320, 1690, 90), p(675, 1690, 190), p(560, 1500, 250), p(790, 1310, 240), p(1030, 1310, 220),
      p(1320, 1690, 230), p(1580, 1500, 240), p(1390, 1310, 240), p(1620, 1120, 250), p(1790, 930, 260), p(1580, 740, 240), p(1850, 550, 245), p(2200, 550, 260),
      p(2600, 1690, 240), p(2790, 1500, 250), p(3000, 1310, 240), p(2800, 1120, 250), p(3050, 930, 250), p(3400, 930, 250), p(3640, 930, 456), p(3460, 1690, 230), p(3710, 1500, 240), p(3470, 1310, 240), p(3710, 1120, 240),
      p(490, 1310, 155), p(650, 1120, 155), p(480, 930, 180), p(1670, 360, 200), p(2350, 740, 150), p(3170, 740, 180),
    ],
    solids: [s(970, 1310, 80, 570), s(1070, 1060, 410, 100), s(2090, 550, 110, 1330), s(2210, 300, 750, 100), s(3290, 930, 110, 950), s(420, 1580, 245, 60), s(645, 1640, 20, 240)],
    exits: gates(2, 930, 930),
    enemies: [
      e('duelist', 600, FLOOR, 300, 820), e('archer', 865, 1310, 820, 940), e('warden', 1450, FLOOR, 1230, 1770),
      e('archer', 1690, 1120, 1650, 1790), e('duelist', 1680, 740, 1610, 1740),
      e('warden', 2280, 550, 2210, 2390, true, '금서의 여사서'), e('duelist', 2710, FLOOR, 2490, 2980),
      e('archer', 2870, 1120, 2830, 2990), e('duelist', 3740, 930, 3670, 3870),
    ],
    breakables: [crack(420, 1640, 240), prop('crate', 720, FLOOR), prop('urn', 1160, 1310), prop('crate', 1740, 1500), prop('urn', 1660, 360, 'ember'), prop('crate', 2670, FLOOR, 'flask'), prop('urn', 3120, 930)],
    items: [item('gold', 450, 1690, 15), item('gold', 1520, 1310, 15), item('ember', 1730, 360, 3), item('sigil', 2340, 550), item('gold', 2370, 740, 28), item('flask', 2640, FLOOR), item('ember', 3210, 740, 2)],
    chests: [chest(515, FLOOR, 'tempo', true), chest(525, 930, 'blade'), chest(1740, 360, 'vitality'), chest(3220, 740, 'blade')],
    zones: [zone(0, 1310, 1050, 570, '금서의 열람실'), zone(1070, 1240, 810, 640, '아래쪽 서가'), zone(1550, 280, 910, 1240, '나선형 기록탑'), zone(2210, 480, 750, 1400, '버려진 원고의 구덩이'), zone(3290, 740, 806, 430, '서고의 북쪽 문'), zone(420, 1640, 245, 240, '잊힌 필사실')],
    routeHints: ['기록탑은 좌우로 번갈아 뛰어 올라갑니다.', '가장 높은 서가에서 여사서가 봉인을 지킵니다.', '봉인 이후에는 아래 원고 구덩이로 내려가세요.', '서가의 갈라진 벽에 오래된 유물이 숨었습니다.'],
    decorations: [decoration('banner', 760, 1240), decoration('torch', 1090, 1410), decoration('books', 1510, 1810, 1.5), decoration('banner', 2110, 340, 1.6), decoration('torch', 2330, 500), decoration('books', 2670, 1850, 1.5), decoration('books', 2880, 1420), decoration('torch', 3760, 860)],
    waypoints: route([[180, FLOOR], [350, 1690], [660, 1500], [885, 1310], [1000, 1310], [1180, 1310], [1400, FLOOR], [1390, 1690], [1660, 1500], [1505, 1310], [1710, 1120], [1880, 930], [1690, 740], [1950, 550], [2120, 550], [2330, 550], [2400, 550], [2760, FLOOR], [2670, 1690], [2880, 1500], [3070, 1310], [2910, 1120], [3150, 930], [3320, 930], [3500, 930], [3770, 930], [3890, 930]]),
  },
  {
    name: '유리 정원', subtitle: 'THE GLASS GARDEN', color: '#78af86', decor: 'garden', spawn: { x: 180, y: FLOOR },
    platforms: [
      p(320, 1690, 270), p(600, 1500, 270), p(940, 1500, 260),
      p(1320, 1690, 240), p(1550, 1500, 260), p(1780, 1310, 250), p(2120, 1120, 240),
      p(2440, 1690, 240), p(2640, 1500, 250), p(2850, 1310, 280), p(3050, 1120, 220), p(3360, 930, 280), p(3640, 930, 456), p(3410, 1690, 240), p(3680, 1500, 240), p(3440, 1310, 240), p(3680, 1120, 240),
      p(500, 1310, 195), p(700, 1120, 180), p(1840, 930, 170), p(2040, 740, 230), p(2280, 550, 240), p(2520, 740, 240), p(2780, 930, 250),
      p(1150, 1690, 150), p(2780, 1690, 140),
    ],
    solids: [s(850, 1500, 90, 380), s(970, 1250, 330, 100), s(2000, 1120, 125, 760), s(2160, 870, 650, 100), s(3260, 930, 105, 950), s(1010, 1670, 135, 60), s(1140, 1730, 35, 150)],
    exits: gates(3, 930, 930),
    enemies: [
      e('duelist', 575, FLOOR, 330, 800), e('archer', 1030, 1500, 980, 1130), e('warden', 1560, FLOOR, 1330, 1840),
      e('archer', 1880, 1310, 1810, 1940), e('warden', 2200, 1120, 2130, 2290, true, '유리꽃의 여수호자'),
      e('archer', 2380, 550, 2310, 2450), e('duelist', 2630, FLOOR, 2310, 2940),
      e('archer', 3130, 1120, 3080, 3210), e('duelist', 3750, 930, 3680, 3870),
    ],
    breakables: [prop('urn', 450, 1690), crack(970, 1730, 150), prop('crate', 1350, FLOOR, 'flask'), prop('urn', 2140, 740, 'ember'), prop('crate', 2510, FLOOR), prop('urn', 2950, 1310), prop('crate', 3420, 930)],
    items: [item('gold', 415, 1690, 15), item('ember', 770, 1120, 2), item('gold', 1480, 1690, 16), item('sigil', 2270, 1120), item('gold', 2480, 550, 32), item('ember', 2630, 740, 3), item('flask', 2580, FLOOR)],
    chests: [chest(1050, FLOOR, 'vitality', true), chest(2390, 550, 'tempo'), chest(2830, 1690, 'blade')],
    zones: [zone(0, 1120, 940, 760, '가시가 자란 온실'), zone(970, 1430, 890, 450, '뿌리 아래의 길'), zone(1780, 550, 1100, 840, '유리꽃의 수관'), zone(2160, 1050, 1100, 830, '온실의 지하정원'), zone(3260, 740, 836, 450, '새벽의 전망대')],
    routeHints: ['온실 아래로 내려가 뿌리 사이의 발판을 찾으세요.', '봉인을 얻은 뒤 아래 정원과 높은 수관 중 길을 고르세요.', '수관의 보물길은 더 높고 더 위험합니다.', '벽 뒤 작은 뿌리방에 생명의 유물이 있습니다.'],
    decorations: [decoration('vines', 850, 1230, 1.4), decoration('vines', 1190, 1390, 1.5), decoration('flowers', 1530, 1870, 1.7), decoration('vines', 2060, 810, 1.8), decoration('flowers', 2440, 540), decoration('vines', 2770, 1000, 1.5), decoration('flowers', 2970, 1870, 1.8), decoration('banner', 3710, 790)],
    waypoints: route([[180, FLOOR], [430, 1690], [710, 1500], [880, 1500], [1110, 1500], [1410, FLOOR], [1390, 1690], [1640, 1500], [1870, 1310], [2030, 1120], [2250, 1120], [2320, 1120], [2540, FLOOR], [2510, 1690], [2730, 1500], [2940, 1310], [3150, 1120], [3290, 930], [3460, 930], [3780, 930], [3890, 930]]),
  },
  {
    name: '붉은 대장간', subtitle: 'THE CRIMSON FORGE', color: '#ca765d', decor: 'forge', spawn: { x: 180, y: FLOOR },
    platforms: [
      p(270, 1690, 240), p(500, 1500, 245), p(700, 1310, 210), p(920, 1310, 240),
      p(1320, 1690, 235), p(1570, 1500, 235), p(1380, 1310, 240), p(1660, 1120, 245), p(2010, 1120, 250),
      p(2470, 1690, 240), p(2730, 1500, 250), p(2480, 1310, 270), p(2740, 1120, 280), p(2510, 930, 255), p(2780, 740, 230), p(3120, 740, 220),
      p(3380, 930, 270), p(3640, 930, 456), p(3210, 1690, 260), p(3490, 1500, 270), p(3220, 1310, 260), p(3480, 1120, 270), p(340, 1310, 170), p(530, 1120, 180), p(710, 930, 160), p(2230, 1500, 150), p(3250, 550, 160),
    ],
    solids: [s(820, 1310, 100, 570), s(960, 1060, 390, 100), s(1900, 1120, 110, 760), s(2060, 870, 310, 100), s(3010, 740, 110, 1140), s(1130, 1670, 150, 60), s(1270, 1730, 30, 150)],
    exits: gates(4, 930, 930),
    enemies: [
      e('warden', 470, FLOOR, 260, 730), e('archer', 765, 1310, 715, 800), e('duelist', 1030, 1310, 950, 1100),
      e('warden', 1510, FLOOR, 1300, 1740), e('archer', 1700, 1120, 1670, 1810),
      e('warden', 2430, FLOOR, 2260, 2800), e('archer', 2820, 1120, 2780, 2920),
      e('warden', 3190, 740, 3130, 3260, true, '붉은 망치의 여대장장이'), e('duelist', 3800, 930, 3670, 3890),
    ],
    breakables: [prop('crate', 385, FLOOR), prop('urn', 770, 930, 'ember'), crack(1090, 1730, 150), prop('crate', 1660, FLOOR, 'flask'), prop('crate', 2410, FLOOR), prop('urn', 2620, 930, 'ember'), prop('crate', 3230, 740), prop('urn', 3690, 930)],
    items: [item('gold', 365, 1690, 18), item('gold', 600, 1120, 24), item('ember', 760, 930, 3), item('flask', 2340, 1500), item('gold', 2630, 1310, 22), item('sigil', 3240, 740), item('ember', 3310, 550, 3)],
    chests: [chest(1170, FLOOR, 'blade', true), chest(760, 930, 'tempo'), chest(3300, 550, 'vitality')],
    zones: [zone(0, 930, 920, 950, '용광로의 계단'), zone(960, 1240, 810, 640, '뒤집힌 운반로'), zone(1900, 950, 460, 930, '쇳물 위의 회랑'), zone(2470, 550, 870, 1330, '여대장장이의 수직 공방'), zone(3380, 740, 716, 450, '여왕의 문턱')],
    routeHints: ['운반로 아래로 내려간 뒤 왼쪽 발판부터 다시 오르세요.', '공방은 좌우로 번갈아 오르는 긴 수직 통로입니다.', '여대장장이의 봉인을 얻으면 대성당이 열립니다.', '검게 그을린 벽 너머에는 칼날 유물이 있습니다.'],
    decorations: [decoration('torch', 280, 1740, 1.4), decoration('chain', 870, 930, 1.6), decoration('pipe', 1220, 1210, 1.4), decoration('torch', 1730, 1700, 1.5), decoration('banner', 1940, 950), decoration('chain', 2560, 560, 2), decoration('torch', 3070, 670, 1.7), decoration('banner', 3720, 790, 1.5)],
    waypoints: route([[180, FLOOR], [340, 1690], [580, 1500], [760, 1310], [850, 1310], [1090, 1310], [1430, FLOOR], [1390, 1690], [1650, 1500], [1510, 1310], [1760, 1120], [1930, 1120], [2180, 1120], [2520, FLOOR], [2540, 1690], [2820, 1500], [2640, 1310], [2850, 1120], [2680, 930], [2900, 740], [3040, 740], [3240, 740], [3310, 740], [3490, 930], [3760, 930], [3890, 930]]),
  },
  {
    name: '공허의 대성당', subtitle: 'THE HOLLOW CATHEDRAL', color: '#b28ac7', decor: 'cathedral', spawn: { x: 1040, y: FLOOR },
    platforms: [p(1040, 1680, 265), p(1290, 1490, 225), p(1120, 1300, 230), p(2530, 1680, 270), p(2310, 1490, 225), p(2500, 1300, 240), p(1710, 1650, 240), p(2030, 1650, 240)],
    solids: [s(790, 1080, 125, 800), s(3050, 1080, 125, 800), s(950, 1060, 420, 100), s(2520, 1060, 480, 100)],
    exits: [{ x: 920, y: FLOOR - 148, w: 100, h: 148, target: 4, locked: false, label: '대장간으로', destination: { x: 3770, y: 930 } }],
    enemies: [e('boss', 2250, FLOOR, 1070, 2920, true, '공허의 여왕 · 세라')],
    breakables: [prop('urn', 1150, FLOOR, 'flask'), prop('urn', 2920, FLOOR, 'flask'), prop('crate', 1190, 1300), prop('crate', 2580, 1300)],
    items: [item('flask', 1200, 1490), item('flask', 2400, 1490), item('ember', 1230, 1300, 3), item('ember', 2620, 1300, 3)],
    chests: [], zones: [zone(915, 1190, 2135, 690, '여왕의 원형 성당'), zone(1040, 1240, 500, 510, '서쪽 회피 발코니'), zone(2290, 1240, 510, 510, '동쪽 회피 발코니')],
    routeHints: ['공허의 여왕의 예고 동작을 보고 구르세요.', '양쪽 발코니의 물약은 전투 중에도 얻을 수 있습니다.', '중앙 발판을 이용해 바닥 충격파를 피하세요.'],
    decorations: [decoration('banner', 960, 1170, 2), decoration('banner', 3010, 1170, 2), decoration('torch', 1500, 1780, 1.5), decoration('torch', 2420, 1780, 1.5), decoration('chain', 1880, 650, 2.8), decoration('chain', 2130, 650, 2.8)],
    waypoints: route([[1040, FLOOR], [1380, FLOOR], [1830, FLOOR], [2250, FLOOR]]),
  },
];

// The original vertical maze remains in the middle. Its two open flanks are
// optional battles, so finding the sigil and defeating the guardian still opens
// the next gate without requiring hundreds of cleanup kills.
const translate = value => ({ ...value, x: value.x + CORE_X });
const RIGHT_WING_X = CORE_X + CORE_W;
const HORDE_STATS = {
  duelist: { hp: 46, damage: 4, speed: 118 },
  archer: { hp: 40, damage: 4, speed: 0 },
  warden: { hp: 72, damage: 6, speed: 90 },
};
function hordeEnemy(kind, x, surface, min, max, wing, index) {
  return {
    ...e(kind, x, surface, min, max), ...HORDE_STATS[kind],
    horde: true, hordeZone: wing, group: wing,
    timer: .45 + index % 7 * .17,
    name: kind === 'warden' ? '전열의 여감시관' : kind === 'archer' ? '무리의 여궁수' : '공허의 여검무사',
  };
}
function wingEnemies(side, roomIndex) {
  const east = side === 'east', offset = east ? RIGHT_WING_X : 0;
  const result = [];
  // A full line of foot soldiers, with enough separation for readable attacks.
  // The western line ends before the spawn corridor and cannot pursue into it.
  for (let i = 0; i < 24; i++) {
    const kind = (i + roomIndex) % 8 === 3 ? 'warden' : 'duelist';
    result.push(hordeEnemy(kind, offset + (east ? 420 : 180) + i * 65, FLOOR, offset + (east ? 340 : 100), offset + (east ? 1990 : 1830), side, i));
  }
  // Two raised formations can be reached by double jumps or the side stairs.
  // Archers in the western formation stay far enough from the initial spawn.
  for (let ledge = 0; ledge < 2; ledge++) {
    const start = offset + (east ? ledge ? 1230 : 300 : ledge ? 990 : 140);
    for (let i = 0; i < 6; i++) {
      const kind = east || !ledge || !i ? 'archer' : i === 3 ? 'warden' : 'duelist';
      result.push(hordeEnemy(kind, start + 30 + i * 100, 1500, start + 16, start + 640, side, 24 + ledge * 6 + i));
    }
  }
  return result;
}
function floorPockets(def) {
  const walls = [...def.solids, ...def.breakables.filter(b => b.solid)]
    .filter(r => r.y < FLOOR && r.y + r.h >= FLOOR)
    .map(r => ({ min: r.x, max: r.x + r.w })).sort((a, b) => a.min - b.min);
  let cursor = 0;
  const pockets = [];
  for (const wall of walls) {
    if (wall.min > cursor) pockets.push({ min: cursor, max: wall.min });
    cursor = Math.max(cursor, wall.max);
  }
  if (cursor < CORE_W) pockets.push({ min: cursor, max: CORE_W });
  return pockets.filter(r => r.max - r.min >= 350 && !(def.spawn.x >= r.min && def.spawn.x < r.max))
    .sort((a, b) => b.max - b.min - (a.max - a.min)).slice(0, 3).sort((a, b) => a.min - b.min);
}
function coreReinforcements(def) {
  const pockets = floorPockets(def), result = [];
  for (let i = 0; i < 9; i++) {
    const pocket = pockets[i % pockets.length], rank = Math.floor(i / pockets.length);
    let x = pocket.min + (pocket.max - pocket.min - 40) * (rank + 1) / 4;
    // Do not place a new body on top of an authored enemy or another soldier.
    const occupied = [...def.enemies.filter(enemy => enemy.y === FLOOR), ...result.map(enemy => ({ ...enemy, x: enemy.x - CORE_X }))];
    for (let n = 0; n < 8 && occupied.some(enemy => Math.abs(enemy.x - x) < 55); n++) x = Math.min(pocket.max - 58, Math.max(pocket.min + 18, x + (n % 2 ? -1 : 1) * (n + 1) * 58));
    const kind = i % 3 === 2 ? 'warden' : 'duelist';
    result.push(hordeEnemy(kind, CORE_X + Math.round(x), FLOOR, CORE_X + pocket.min + 12, CORE_X + pocket.max - 12, 'core', i));
  }
  return result;
}
function wingPlatforms() {
  return [
    p(140, 1500, 660), p(990, 1500, 700),
    p(320, 1690, 250), p(760, 1690, 230), p(1780, 1690, 250),
    p(1510, 1310, 250), p(1260, 1120, 250),
    p(RIGHT_WING_X + 300, 1500, 660), p(RIGHT_WING_X + 1230, 1500, 660),
    p(RIGHT_WING_X + 240, 1690, 250), p(RIGHT_WING_X, 1500, 250),
    p(RIGHT_WING_X + 240, 1310, 250), p(RIGHT_WING_X, 1120, 250),
    p(RIGHT_WING_X + 240, 930, 250), p(RIGHT_WING_X + 1220, 1690, 250),
  ];
}
function expandRoom(def, index) {
  const bossRoom = index === 5;
  const result = {
    ...def, width: W, core: { x: CORE_X, w: CORE_W },
    spawn: translate(def.spawn),
    platforms: [...def.platforms.map(translate), ...wingPlatforms()],
    // Cathedral side pillars become arches, leaving a clear passage underneath.
    solids: def.solids.map(rect => translate(bossRoom && rect.h === 800 ? { ...rect, h: 460 } : rect)),
    exits: def.exits.map(exit => ({ ...translate(exit), destination: translate(exit.destination) })),
    enemies: def.enemies.map(enemy => ({ ...translate(enemy), patrolMin: enemy.patrolMin + CORE_X, patrolMax: enemy.patrolMax + CORE_X })),
    breakables: def.breakables.map(translate), items: def.items.map(translate), chests: def.chests.map(translate),
    zones: def.zones.map(translate), decorations: def.decorations.map(translate), waypoints: def.waypoints.map(translate),
    hordeZones: [
      { id: 'west', name: '서쪽 소탕로', x: 0, y: 940, w: CORE_X, h: FLOOR - 940, entryX: CORE_X, entryY: FLOOR },
      { id: 'east', name: '동쪽 혈전 회랑', x: RIGHT_WING_X, y: 940, w: CORE_X, h: FLOOR - 940, entryX: RIGHT_WING_X, entryY: FLOOR },
    ],
    routeHints: [...def.routeHints, '중앙 미로의 양옆에는 넓은 소탕 구역이 있습니다. 여러 적을 한 번에 베어내세요.'],
  };
  const west = wingEnemies('west', index), east = wingEnemies('east', index);
  if (bossRoom) {
    // Optional cathedral sentries remain outside the original queen encounter.
    result.enemies.push(...west.filter((_, n) => [3, 9, 15, 24, 27].includes(n)), ...east.filter((_, n) => [3, 9, 24, 27].includes(n)));
  } else {
    result.enemies.push(...coreReinforcements(def), ...west, ...east);
  }
  result.hordeCount = result.enemies.filter(enemy => enemy.horde).length;
  for (const side of ['west', 'east']) {
    const offset = side === 'west' ? 0 : RIGHT_WING_X;
    result.zones.push(zone(offset, 940, CORE_X, FLOOR - 940, side === 'west' ? '서쪽 소탕로' : '동쪽 혈전 회랑'));
    result.breakables.push(prop('urn', offset + 380, FLOOR), prop('crate', offset + 1180, FLOOR), prop('urn', offset + 1480, 1500), prop('crate', offset + 560, 1500));
    result.decorations.push(decoration('banner', offset + 120, 1320, 1.4), decoration('torch', offset + 890, 1780, 1.3), decoration('torch', offset + 1760, 1780, 1.3), decoration('chain', offset + 700, 1010, 1.7));
  }
  const spawn = [result.spawn.x, result.spawn.y];
  const westRoute = [spawn, [CORE_X, FLOOR], [1600, FLOOR], [1000, FLOOR], [400, FLOOR], [100, FLOOR], [400, FLOOR], [1000, FLOOR], [1600, FLOOR], [CORE_X, FLOOR], spawn];
  const eastFloorRoute = [[RIGHT_WING_X + 700, FLOOR], [RIGHT_WING_X + 1360, FLOOR], [W - 110, FLOOR], [RIGHT_WING_X + 1360, FLOOR], [RIGHT_WING_X + 700, FLOOR]];
  let eastRoute;
  if (bossRoom) {
    eastRoute = [spawn, [3500, FLOOR], [4200, FLOOR], [5000, FLOOR], [RIGHT_WING_X, FLOOR], ...eastFloorRoute, [RIGHT_WING_X, FLOOR], [5000, FLOOR], [4200, FLOOR], [3500, FLOOR], spawn];
  } else {
    const gate = result.exits.find(exit => exit.locked), surface = gate.y + gate.h;
    eastRoute = [spawn, ...result.waypoints.slice(1).map(point => [point.x, point.y]),
      [RIGHT_WING_X + 90, 1120], ...eastFloorRoute,
      [RIGHT_WING_X + 256, 1690], [RIGHT_WING_X + 90, 1500],
      [RIGHT_WING_X + 256, 1310], [RIGHT_WING_X + 90, 1120], [gate.x + 40, surface],
    ];
  }
  result.hordeRoutes = { left: route(westRoute), right: route(eastRoute) };
  return result;
}

export const ROOM_DEFS = CORE_ROOMS.map(expandRoom);

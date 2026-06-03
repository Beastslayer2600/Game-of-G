export const WORLD_SIZE = 512;
export const TERRAIN_SEGMENTS = 200;
export const TERRAIN_MAX_HEIGHT = 55;

// ── Ages ──────────────────────────────────────────────────────────────────────
export const AGES = [
  { name: 'Tribal Age',    icon: '🪨', color: '#a0885a' },
  { name: 'Iron Age',      icon: '⚔️', color: '#a0a8b8' },
  { name: 'Medieval Age',  icon: '🏰', color: '#c8a96e' },
  { name: 'Renaissance',   icon: '🎨', color: '#d4af37' },
];

export const AGE_ADVANCE_COSTS = [
  null,
  { wood: 350, stone: 200, food: 150 },
  { stone: 400, iron: 150, gold: 150, wood: 150 },
  { stone: 600, gold: 400, iron: 300 },
];

// Min age required to construct a building
export const BUILDING_AGE = {
  // Tribal (0)
  farm: 0, house: 0, lumbermill: 0, quarry: 0, well: 0, palisade: 0, castle: 0, tower: 0,
  // Iron (1)
  barracks: 1, wall: 1, blacksmith: 1, granary: 1, stables: 1,
  // Medieval (2)
  market: 2, marketplace: 2, manor: 2, tavern: 2, windmill: 2,
  fortress_wall: 2, gatehouse: 2, ballista_tower: 2,
  // Renaissance (3)
  cathedral: 3, townhall: 3,
};

export const UNIT_AGE = { villager: 0, soldier: 1, archer: 1, knight: 2 };

// Building required to train a unit type (null = just need enough food)
export const UNIT_BUILDING_REQ = {
  soldier:  'barracks',
  archer:   'barracks',
  knight:   'stables',
  catapult: 'barracks',
};

// Population capacity from buildings
export const BUILDING_POP = { castle: 10, house: 10, manor: 6 };

// Research technologies
export const TECHS = {
  iron_weapons:  { building:'blacksmith', cost:{ iron:80,  gold:50  }, time:40, name:'Iron Weapons',   icon:'⚔️',  effect:{ attackBonus:5   }, age:1 },
  iron_armor:    { building:'blacksmith', cost:{ iron:120, stone:50 }, time:50, name:'Iron Armor',     icon:'🛡',  effect:{ armorBonus:3    }, age:1 },
  steel_weapons: { building:'blacksmith', cost:{ iron:220, gold:120 }, time:70, name:'Steel Weapons',  icon:'🗡',  effect:{ attackBonus:10  }, age:2, req:'iron_weapons' },
  military_drill:{ building:'barracks',   cost:{ food:150, gold:75  }, time:45, name:'Military Drill', icon:'🏃',  effect:{ speedBonus:1    }, age:1 },
  husbandry:     { building:'stables',    cost:{ food:100, gold:60  }, time:35, name:'Husbandry',      icon:'🐎',  effect:{ speedBonus:1.5  }, age:2 },
  double_bit_axe:{ building:'lumbermill', cost:{ food:100           }, time:30, name:'Double Bit Axe', icon:'🪵',  effect:{ gatherBonus:0.25}, age:0 },
  crop_rotation: { building:'farm',       cost:{ food:100, wood:50  }, time:35, name:'Crop Rotation',  icon:'🌾',  effect:{ gatherBonus:0.25}, age:1 },
  siege_mastery: { building:'barracks',   cost:{ stone:150,iron:100 }, time:60, name:'Siege Mastery',  icon:'💣',  effect:{ unlocks:'catapult'}, age:2 },
};

// Unit counter bonuses (attacker type → defender type → bonus multiplier)
export const UNIT_COUNTER = {
  archer:  { knight: 1.5 },
  soldier: { archer: 1.5 },
  knight:  { soldier: 1.5 },
};

// ── Buildings ─────────────────────────────────────────────────────────────────
export const BUILDING_COSTS = {
  // Core
  castle:     { wood: 500, stone: 500 },
  farm:       { wood: 50 },
  lumbermill: { wood: 100, stone: 25 },
  quarry:     { wood: 75,  stone: 50 },
  barracks:   { wood: 150, stone: 100 },
  tower:      { wood: 100, stone: 200 },
  wall:       { stone: 50 },
  house:      { wood: 75 },
  market:     { wood: 200, stone: 100 },
  // Defense
  palisade:       { wood: 30 },
  gatehouse:      { wood: 80,  stone: 120 },
  ballista_tower: { wood: 60,  stone: 150, iron: 30 },
  fortress_wall:  { stone: 120 },
  // City
  cathedral:   { wood: 100, stone: 300, gold: 200 },
  blacksmith:  { wood: 80,  stone: 60,  iron: 20 },
  tavern:      { wood: 100, gold: 50 },
  windmill:    { wood: 80,  stone: 20 },
  granary:     { wood: 60,  stone: 80 },
  stables:     { wood: 120, stone: 40 },
  marketplace: { wood: 150, stone: 50,  gold: 100 },
  townhall:    { wood: 100, stone: 200, gold: 150 },
  well:        { stone: 40 },
  manor:       { wood: 150, stone: 100, gold: 100 },
};

export const BUILDING_SIZES = {
  castle: 10, farm: 8, lumbermill: 5, quarry: 5,
  barracks: 7, tower: 4, wall: 4, house: 4, market: 6,
  palisade: 4, gatehouse: 6, ballista_tower: 5, fortress_wall: 5,
  cathedral: 12, blacksmith: 5, tavern: 6, windmill: 4,
  granary: 5, stables: 8, marketplace: 9, townhall: 9, well: 3, manor: 8,
};

// ── Units ─────────────────────────────────────────────────────────────────────
export const UNIT_COSTS = {
  villager: { food: 50 },
  soldier:  { food: 75,  gold: 25 },
  archer:   { food: 60,  wood: 25, gold: 20 },
  knight:   { food: 100, gold: 75, iron: 50 },
  catapult: { food: 180, gold: 100, iron: 60 },
};

export const UNIT_STATS = {
  villager: { hp: 50,  attack: 5,  speed: 5, range: 2  },
  soldier:  { hp: 100, attack: 20, speed: 4, range: 3  },
  archer:   { hp: 70,  attack: 15, speed: 5, range: 18 },
  knight:   { hp: 200, attack: 40, speed: 6, range: 3  },
  catapult: { hp: 90,  attack: 85, speed: 2.2, range: 24 },
};

export const CAMERA_MODES = { FPS: 'fps', RTS: 'rts' };
export const GAME_STATES   = { MENU: 'menu', PLAYING: 'playing', OVER: 'over' };

export const KINGDOM_COLORS = [0x4488ff, 0xff3333, 0x33cc33, 0xffaa00];
export const KINGDOM_NAMES  = ['Blue Kingdom', 'Red Kingdom', 'Green Kingdom', 'Orange Kingdom'];

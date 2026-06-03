export const WORLD_SIZE = 512;
export const TERRAIN_SEGMENTS = 200;
export const TERRAIN_MAX_HEIGHT = 55;

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

export const UNIT_COSTS = {
  villager: { food: 50 },
  soldier:  { food: 75,  gold: 25 },
  archer:   { food: 60,  wood: 25, gold: 20 },
  knight:   { food: 100, gold: 75, iron: 50 },
};

export const UNIT_STATS = {
  villager: { hp: 50,  attack: 5,  speed: 5, range: 2  },
  soldier:  { hp: 100, attack: 20, speed: 4, range: 3  },
  archer:   { hp: 70,  attack: 15, speed: 5, range: 18 },
  knight:   { hp: 200, attack: 40, speed: 6, range: 3  },
};

export const CAMERA_MODES = { FPS: 'fps', RTS: 'rts' };
export const GAME_STATES   = { MENU: 'menu', PLAYING: 'playing', OVER: 'over' };

export const KINGDOM_COLORS = [0x4488ff, 0xff3333, 0x33cc33, 0xffaa00];
export const KINGDOM_NAMES  = ['Blue Kingdom', 'Red Kingdom', 'Green Kingdom', 'Orange Kingdom'];

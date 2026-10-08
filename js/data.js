'use strict';
/* ==========================================================
   data.js  -  all game content as data: weapons, upgrades,
   enemies, bosses, themes. Balance the game by editing numbers here.
   ========================================================== */

const THEMES = [
  { name: 'THE FOUNDRY', sub: 'Floor 1', bg: '#07111d', grid: '#10304a', wall: '#0c1829', edge: '#38e1ff', bpm: 122, prog: [38, 38, 41, 36], boss: 'warden' },
  { name: 'THE OVERGROWTH', sub: 'Floor 2', bg: '#07150d', grid: '#12402b', wall: '#0a1c12', edge: '#5dff8a', bpm: 132, prog: [40, 43, 38, 41], boss: 'hive' },
  { name: 'THE VOID', sub: 'Floor 3', bg: '#10061b', grid: '#34115a', wall: '#170a26', edge: '#d65bff', bpm: 142, prog: [36, 39, 34, 41], boss: 'core' }
];

const WEAPONS = {
  pistol:   { name: 'Pulse Pistol',   desc: 'Reliable and accurate.',        dmg: 11, rate: 5.0, speed: 640, spread: 0.03, pellets: 1, fan: 0.12, size: 4,   life: 1.2,  color: '#7df9ff', sfx: 'pistol',   shake: 0.4, kick: 20 },
  smg:      { name: 'Storm SMG',      desc: 'Hail of fast, weak bullets.',   dmg: 5.5, rate: 13, speed: 700, spread: 0.13, pellets: 1, fan: 0.1,  size: 3.2, life: 1.0,  color: '#a5ff7d', sfx: 'smg',      shake: 0.3, kick: 12 },
  shotgun:  { name: 'Scatter Cannon', desc: 'Devastating at close range.',   dmg: 7,  rate: 1.7, speed: 600, spread: 0.1,  pellets: 6, fan: 0.17, size: 3.8, life: 0.5,  color: '#ffb347', sfx: 'shotgun',  shake: 3.5, kick: 130 },
  rail:     { name: 'Rail Lance',     desc: 'Piercing beam. Hits everything in a line.', dmg: 46, rate: 1.15, speed: 1600, spread: 0, pellets: 1, fan: 0.1, size: 4.5, life: 0.9, color: '#fff27d', sfx: 'rail', shake: 4, kick: 160, pierce: 99 },
  launcher: { name: 'Nova Launcher',  desc: 'Explosive rockets. Big boom.',  dmg: 22, rate: 1.5, speed: 390, spread: 0.02, pellets: 1, fan: 0.2,  size: 7,   life: 2.0,  color: '#ff7a3d', sfx: 'launcher', shake: 3,   kick: 90, explode: 78 }
};

/* rarity: weight when rolling cards (rare cards appear less often) */
const UPGRADES = [
  { id: 'dmg',      icon: '⚔️', name: 'Overcharge',      desc: '+20% damage',                         max: 6, w: 1,    apply: p => { p.dmgMul *= 1.2; } },
  { id: 'rate',     icon: '⚡', name: 'Hair Trigger',    desc: '+18% fire rate',                      max: 6, w: 1,    apply: p => { p.rateMul *= 1.18; } },
  { id: 'hp',       icon: '❤️', name: 'Reinforced Core', desc: '+25 max HP and heal 25',              max: 6, w: 1,    apply: p => { p.maxHp += 25; p.heal(25); } },
  { id: 'speed',    icon: '👟', name: 'Ion Boots',       desc: '+12% movement speed',                 max: 4, w: 0.9,  apply: p => { p.speed *= 1.12; } },
  { id: 'multi',    icon: '✴️', name: 'Twin Fire',       desc: '+1 projectile per shot',              max: 3, w: 0.55, rare: 1, apply: p => { p.multi++; } },
  { id: 'pierce',   icon: '➶',  name: 'Phase Rounds',    desc: 'Bullets pierce +1 enemy',             max: 3, w: 0.8,  apply: p => { p.pierce++; } },
  { id: 'bounce',   icon: '↩️', name: 'Ricochet',        desc: 'Bullets bounce off walls +1 time',    max: 3, w: 0.8,  apply: p => { p.bounce++; } },
  { id: 'explode',  icon: '💥', name: 'Volatile Rounds', desc: 'Bullets explode on impact',           max: 3, w: 0.55, rare: 1, apply: p => { p.explode++; } },
  { id: 'crit',     icon: '🎯', name: 'Eagle Eye',       desc: '+12% crit chance (crits deal 2.5x)',  max: 5, w: 0.9,  apply: p => { p.crit += 0.12; } },
  { id: 'dashcd',   icon: '🌀', name: 'Phase Engine',    desc: 'Dash recharges 25% faster',           max: 3, w: 0.8,  apply: p => { p.dashCdMul *= 0.75; } },
  { id: 'magnet',   icon: '🧲', name: 'Magnet',          desc: 'Pickups fly toward you',              max: 3, w: 0.7,  apply: p => { p.magnet++; } },
  { id: 'orbit',    icon: '🌀', name: 'Orbital Blades',  desc: 'A blade circles you, shredding enemies', max: 4, w: 0.6, rare: 1, apply: p => { p.orbit++; } },
  { id: 'homing',   icon: '🧭', name: 'Seeker Rounds',   desc: 'Bullets curve toward enemies',        max: 3, w: 0.6,  apply: p => { p.homing++; } },
  { id: 'shield',   icon: '🛡️', name: 'Aegis',           desc: 'A shield blocks one hit, recharges every 12s', max: 2, w: 0.6, rare: 1, apply: p => { p.shieldLvl++; p.shield = 1; } },
  { id: 'dashblast',icon: '🌟', name: 'Shock Dash',      desc: 'Dashing blasts nearby enemies away',  max: 3, w: 0.6,  apply: p => { p.dashBlast++; } },
  { id: 'slow',     icon: '❄️', name: 'Cryo Rounds',     desc: '30% chance to slow enemies',          max: 3, w: 0.7,  apply: p => { p.slow += 0.3; } }
];

/* ai: behaviour key used in enemy.js | cost: spawn budget | group: spawned together */
const ENEMIES = {
  grunt:   { name: 'Grunt',   hp: 32,  r: 12, speed: 100, dmg: 10, color: '#ff5d6c', score: 10, cost: 1,   minFloor: 1, ai: 'chase',   sides: 3 },
  swarmer: { name: 'Swarmer', hp: 11,  r: 7,  speed: 175, dmg: 6,  color: '#ffb347', score: 5,  cost: 2,   minFloor: 1, ai: 'swarm',   sides: 4, group: 4 },
  shooter: { name: 'Shooter', hp: 34,  r: 12, speed: 85,  dmg: 8,  color: '#ff7bd5', score: 15, cost: 2,   minFloor: 1, ai: 'shoot',   sides: 5, fireRate: 1.9 },
  dasher:  { name: 'Dasher',  hp: 42,  r: 12, speed: 75,  dmg: 16, color: '#ffe14d', score: 20, cost: 2,   minFloor: 1, ai: 'dash',    sides: 3 },
  bomber:  { name: 'Bomber',  hp: 36,  r: 13, speed: 115, dmg: 0,  color: '#ff8a3d', score: 20, cost: 2,   minFloor: 2, ai: 'bomber',  sides: 8 },
  tank:    { name: 'Tank',    hp: 140, r: 20, speed: 52,  dmg: 18, color: '#8aa0ff', score: 35, cost: 4,   minFloor: 2, ai: 'tank',    sides: 6 },
  turret:  { name: 'Turret',  hp: 70,  r: 14, speed: 0,   dmg: 0,  color: '#c77dff', score: 25, cost: 3,   minFloor: 2, ai: 'turret',  sides: 8 },
  spawner: { name: 'Hive',    hp: 120, r: 18, speed: 28,  dmg: 8,  color: '#6dff9e', score: 40, cost: 4,   minFloor: 3, ai: 'spawner', sides: 6 }
};

const BOSSES = {
  warden: {
    name: 'THE WARDEN', sub: 'Guardian of the Foundry', hp: 780, r: 34, color: '#ff5d6c', sides: 6, score: 600, dmg: 20,
    attacks: [['ring', 1], ['aimed', 1], ['charge', 1], ['summon', 2]], summon: ['grunt', 'shooter', 'grunt']
  },
  hive: {
    name: 'HIVE MOTHER', sub: 'Queen of the Overgrowth', hp: 1100, r: 38, color: '#6dff9e', sides: 8, score: 900, dmg: 22,
    attacks: [['spiral', 1], ['bombs', 1], ['aimed', 1], ['summon', 1], ['ring', 2]], summon: ['swarmer', 'bomber', 'swarmer']
  },
  core: {
    name: 'THE VOID CORE', sub: 'Heart of the Abyss', hp: 1600, r: 40, color: '#d65bff', sides: 5, score: 1500, dmg: 25,
    attacks: [['beams', 1], ['teleport', 1], ['bombs', 1], ['summon', 2], ['charge', 2], ['spiral', 3]], summon: ['dasher', 'shooter', 'tank']
  }
};

/* Room layouts: lists of rectangles. Door lanes (x=480, y=300) are always kept free. */
const ROOM_TEMPLATES = [
  [],
  [[240, 160, 56, 56], [664, 160, 56, 56], [240, 384, 56, 56], [664, 384, 56, 56]],
  [[440, 260, 80, 80]],
  [[190, 190, 170, 28], [600, 190, 170, 28], [190, 382, 170, 28], [600, 382, 170, 28]],
  [[300, 120, 28, 110], [632, 120, 28, 110], [300, 370, 28, 110], [632, 370, 28, 110]],
  [[200, 250, 60, 100], [700, 250, 60, 100], [420, 130, 120, 28], [420, 442, 120, 28]],
  [[130, 130, 60, 60], [770, 130, 60, 60], [130, 410, 60, 60], [770, 410, 60, 60], [450, 285, 60, 30]]
];

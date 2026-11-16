// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const SHIP = {
  radius: 14,
  accel: 1500,
  maxSpeed: 430,
  damping: 2.2,
  fireInterval: 0.16,
  rapidInterval: 0.08,
  invulnerable: 2,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1,
};

export const LIVES = 3;

export const BULLET = { speed: 760, life: 1.1, radius: 4 };

export const ASTEROID = {
  // radius, hit points, base speed range, score, split target (null = none)
  large: { radius: 44, hp: 3, speedMin: 42, speedMax: 78, score: 150, split: 'medium', splitCount: 2 },
  medium: { radius: 27, hp: 2, speedMin: 70, speedMax: 120, score: 100, split: 'small', splitCount: 2 },
  small: { radius: 15, hp: 1, speedMin: 105, speedMax: 165, score: 50, split: null, splitCount: 0 },
  orbDrop: 0.45,
  powerDrop: 0.06,
  spawnInterval: 1.1,
};

export const DRONE = {
  radius: 17,
  hp: 2,
  accel: 300,
  maxSpeed: 165,
  score: 200,
  fireInterval: 2.6,
  plasmaSpeed: 205,
  plasmaRadius: 6,
  firstWave: 3,
};

export const ORB = {
  radius: 8,
  score: 25,
  energy: 12,
  magnetRadius: 130,
  magnetSpeed: 420,
  life: 8,
  comboWindow: 3,
  comboMax: 8,
};

export const POWER = {
  radius: 13,
  life: 9,
  spreadSeconds: 12,
  rapidSeconds: 10,
};

export const ENERGY = { max: 100, overdriveSeconds: 5 };

export const WAVE = {
  max: 10,
  quotaBase: 6,
  quotaPerWave: 2,
  bannerSeconds: 2.6,
  droneBase: 0,
  dronePerWave: 1,
  droneMax: 4,
};

export const POOL = { bullets: 48, asteroids: 40, drones: 8, orbs: 48, powers: 8, plasma: 24, particles: 320 };

export const PALETTE = {
  backdrop: '#040109',
  deep: '#0d0221',
  nebulaPink: '#ff2e88',
  nebulaPurple: '#7b2ff7',
  nebulaBlue: '#1f6fff',
  sunTop: '#ffd319',
  sunBottom: '#ff2975',
  grid: '#ff2e88',
  ship: '#00f0ff',
  shipCore: '#e8feff',
  bullet: '#7df9ff',
  asteroid: '#ff9f43',
  asteroidDark: '#3a1c07',
  drone: '#ff2e63',
  plasma: '#ff5ce1',
  orb: '#ffd319',
  powerSpread: '#00f0ff',
  powerShield: '#7CFC00',
  powerRapid: '#ff9f43',
  text: '#eef1f5',
  muted: '#9aa3c0',
  danger: '#ff2e63',
  panel: '#0d0221',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';

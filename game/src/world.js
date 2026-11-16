// The game's rules and state, with no drawing and no browser in it: the ship, bullets,
// asteroids in three sizes, hunter drones, energy orbs, power-ups, particles, waves, score,
// combo, energy and lives. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react without the world knowing about screens or sound. Pools are
// allocated once, at boot; nothing here allocates while the game runs.
import {
  ASTEROID, BULLET, DRONE, ENERGY, FIELD, LIVES, ORB, POOL, POWER, SHIP, WAVE,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_ORB = 2;
export const EVENT_POWER = 4;
export const EVENT_WAVE = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_DRIVE = 64;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const ship = {
    x: FIELD.width / 2, y: FIELD.height / 2 + 80, vx: 0, vy: 0, angle: -Math.PI / 2,
    invulnerable: 0, fireTimer: 0, dashTimer: 0, dashCooldown: 0,
    spreadTimer: 0, rapidTimer: 0, shield: false, overdriveTimer: 0, thrusting: false,
  };
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const asteroids = [];
  for (let i = 0; i < POOL.asteroids; i += 1) {
    asteroids.push({
      active: false, size: 'large', x: 0, y: 0, vx: 0, vy: 0, radius: 0, hp: 0,
      rot: 0, rotSpeed: 0, counted: false, verts: new Float32Array(9),
    });
  }
  const drones = [];
  for (let i = 0; i < POOL.drones; i += 1) {
    drones.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, hp: 0, fireTimer: 0, angle: 0 });
  }
  const orbs = [];
  for (let i = 0; i < POOL.orbs; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const powers = [];
  for (let i = 0; i < POOL.powers; i += 1) {
    powers.push({ active: false, kind: 'spread', x: 0, y: 0, vy: 0, life: 0, phase: 0 });
  }
  const plasma = [];
  for (let i = 0; i < POOL.plasma; i += 1) plasma.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', drag: 1 });
  }
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      x: random() * FIELD.width, y: random() * FIELD.height,
      layer: 0.25 + random() * 0.75, size: 0.6 + random() * 1.8, phase: random() * TAU,
    });
  }
  const nebulae = [];
  for (let i = 0; i < 5; i += 1) {
    nebulae.push({
      x: random() * FIELD.width, y: random() * FIELD.height,
      r: 180 + random() * 260, color: ['#ff2e88', '#7b2ff7', '#1f6fff'][i % 3],
    });
  }

  const state = {
    ship, bullets, asteroids, drones, orbs, powers, plasma, particles, stars, nebulae,
    score: 0, combo: 0, comboTimer: 0, energy: 0, lives: LIVES, wave: 1,
    waveKills: 0, waveQuota: WAVE.quotaBase + WAVE.quotaPerWave, elapsed: 0,
    spawned: 0, dronesSpawned: 0, spawnTimer: 1, droneTimer: 3,
    banner: '', bannerSub: '', bannerTimer: 0, shake: 0, over: false, won: false,
  };

  function reset() {
    ship.x = FIELD.width / 2;
    ship.y = FIELD.height / 2 + 80;
    ship.vx = 0; ship.vy = 0; ship.angle = -Math.PI / 2;
    ship.invulnerable = 0; ship.fireTimer = 0; ship.dashTimer = 0; ship.dashCooldown = 0;
    ship.spreadTimer = 0; ship.rapidTimer = 0; ship.shield = false; ship.overdriveTimer = 0;
    ship.thrusting = false;
    for (const b of bullets) b.active = false;
    for (const a of asteroids) a.active = false;
    for (const d of drones) d.active = false;
    for (const o of orbs) o.active = false;
    for (const p of powers) p.active = false;
    for (const p of plasma) p.active = false;
    for (const p of particles) p.active = false;
    state.score = 0; state.combo = 0; state.comboTimer = 0; state.energy = 0;
    state.lives = LIVES; state.wave = 1; state.waveKills = 0;
    state.waveQuota = WAVE.quotaBase + WAVE.quotaPerWave;
    state.elapsed = 0; state.spawned = 0; state.dronesSpawned = 0;
    state.spawnTimer = 0.8; state.droneTimer = 3;
    state.banner = ''; state.bannerSub = ''; state.bannerTimer = 0; state.shake = 0;
    state.over = false; state.won = false;
    // Opening field: a few large rocks already drifting so the first seconds read well.
    for (let i = 0; i < 3; i += 1) spawnAsteroid('large', true);
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function countActive(pool) {
    let n = 0;
    for (let i = 0; i < pool.length; i += 1) if (pool[i].active) n += 1;
    return n;
  }

  function spawnParticle(x, y, vx, vy, life, size, color, drag) {
    const p = free(particles);
    if (p === null) return;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.color = color; p.drag = drag;
  }

  function explosion(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * TAU;
      const s = speed * (0.3 + random() * 0.7);
      spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + random() * 0.5, 1.5 + random() * 2.5, color, 2.2);
    }
  }

  function waveQuotaFor(wave) {
    return WAVE.quotaBase + WAVE.quotaPerWave * wave;
  }

  function dronesFor(wave) {
    if (wave < DRONE.firstWave) return 0;
    return Math.min(WAVE.droneMax, WAVE.droneBase + WAVE.dronePerWave * (wave - DRONE.firstWave + 1));
  }

  function spawnAsteroid(size, anywhere, counted) {
    const a = free(asteroids);
    if (a === null) return;
    const def = ASTEROID[size];
    a.active = true; a.size = size; a.radius = def.radius; a.hp = def.hp;
    a.counted = counted === true;
    a.rot = random() * TAU; a.rotSpeed = (random() - 0.5) * 2.4;
    for (let i = 0; i < 9; i += 1) a.verts[i] = 0.72 + random() * 0.42;
    const edge = Math.floor(random() * 4);
    if (anywhere) {
      a.x = 80 + random() * (FIELD.width - 160);
      a.y = 80 + random() * (FIELD.height - 220);
    } else if (edge === 0) { a.x = random() * FIELD.width; a.y = -a.radius; }
    else if (edge === 1) { a.x = FIELD.width + a.radius; a.y = random() * FIELD.height; }
    else if (edge === 2) { a.x = random() * FIELD.width; a.y = FIELD.height + a.radius; }
    else { a.x = -a.radius; a.y = random() * FIELD.height; }
    const tx = 200 + random() * (FIELD.width - 400);
    const ty = 120 + random() * (FIELD.height - 280);
    const dx = tx - a.x;
    const dy = ty - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = def.speedMin + random() * (def.speedMax - def.speedMin);
    a.vx = (dx / len) * speed;
    a.vy = (dy / len) * speed;
  }

  function spawnDrone() {
    const d = free(drones);
    if (d === null) return;
    d.active = true; d.hp = DRONE.hp; d.fireTimer = 1.5 + random();
    const edge = Math.floor(random() * 4);
    if (edge === 0) { d.x = random() * FIELD.width; d.y = -30; }
    else if (edge === 1) { d.x = FIELD.width + 30; d.y = random() * FIELD.height; }
    else if (edge === 2) { d.x = random() * FIELD.width; d.y = FIELD.height + 30; }
    else { d.x = -30; d.y = random() * FIELD.height; }
    d.vx = 0; d.vy = 0; d.angle = 0;
  }

  function spawnOrb(x, y) {
    const o = free(orbs);
    if (o === null) return;
    o.active = true; o.x = x; o.y = y;
    const a = random() * TAU;
    o.vx = Math.cos(a) * 40; o.vy = Math.sin(a) * 40;
    o.life = ORB.life;
  }

  function spawnPower(x, y) {
    const p = free(powers);
    if (p === null) return;
    const kinds = ['spread', 'shield', 'rapid'];
    p.active = true; p.kind = kinds[Math.floor(random() * kinds.length)];
    p.x = x; p.y = y; p.vy = 34; p.life = POWER.life; p.phase = random() * TAU;
  }

  function fireBullet(angle) {
    const b = free(bullets);
    if (b === null) return;
    b.active = true;
    b.x = ship.x + Math.cos(angle) * (SHIP.radius + 8);
    b.y = ship.y + Math.sin(angle) * (SHIP.radius + 8);
    b.vx = Math.cos(angle) * BULLET.speed + ship.vx * 0.4;
    b.vy = Math.sin(angle) * BULLET.speed + ship.vy * 0.4;
    b.life = BULLET.life;
  }

  function destroyAsteroid(a, award) {
    const def = ASTEROID[a.size];
    a.active = false;
    if (award) {
      state.score += def.score * scoreMult();
      if (a.counted) state.waveKills += 1;
      if (random() < ASTEROID.orbDrop) spawnOrb(a.x, a.y);
      if (random() < ASTEROID.powerDrop) spawnPower(a.x, a.y);
    }
    explosion(a.x, a.y, '#ff9f43', a.size === 'large' ? 18 : a.size === 'medium' ? 12 : 8, 260);
    if (def.split !== null) {
      for (let i = 0; i < def.splitCount; i += 1) {
        const child = free(asteroids);
        if (child === null) break;
        const cdef = ASTEROID[def.split];
        child.active = true; child.size = def.split; child.radius = cdef.radius; child.hp = cdef.hp;
        child.counted = false; // Split children never count toward the wave quota.
        child.rot = random() * TAU; child.rotSpeed = (random() - 0.5) * 3;
        for (let v = 0; v < 9; v += 1) child.verts[v] = 0.72 + random() * 0.42;
        child.x = a.x; child.y = a.y;
        const ang = random() * TAU;
        const sp = cdef.speedMin + random() * (cdef.speedMax - cdef.speedMin);
        child.vx = Math.cos(ang) * sp;
        child.vy = Math.sin(ang) * sp;
      }
    }
  }

  function scoreMult() {
    return ship.overdriveTimer > 0 ? 2 : 1;
  }

  function collectOrb(o) {
    o.active = false;
    state.combo = Math.min(state.combo + 1, ORB.comboMax);
    state.comboTimer = ORB.comboWindow;
    state.score += ORB.score * Math.max(1, state.combo) * scoreMult();
    state.energy += ORB.energy;
    explosion(o.x, o.y, '#ffd319', 6, 120);
    if (state.energy >= ENERGY.max) {
      state.energy = 0;
      ship.overdriveTimer = ENERGY.overdriveSeconds;
      state.banner = 'OVERDRIVE';
      state.bannerSub = 'Double score, rapid fire';
      state.bannerTimer = 1.6;
      return EVENT_ORB | EVENT_DRIVE;
    }
    return EVENT_ORB;
  }

  function hitShip() {
    if (ship.shield) {
      ship.shield = false;
      ship.invulnerable = Math.max(ship.invulnerable, 1);
      explosion(ship.x, ship.y, '#7CFC00', 14, 240);
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    ship.invulnerable = SHIP.invulnerable;
    state.shake = 14;
    explosion(ship.x, ship.y, '#00f0ff', 26, 340);
    explosion(ship.x, ship.y, '#ff2e63', 14, 220);
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  /**
   * One fixed step. `input` is { thrust: {x, y}, aim: {x, y, seen}, firing, dash }.
   * With `harmless` set (the title screen's backdrop) rocks drift but nothing touches the
   * ship, nothing scores and no waves run.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 40 * dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (ship.invulnerable > 0) ship.invulnerable = Math.max(0, ship.invulnerable - dt);
    if (ship.dashCooldown > 0) ship.dashCooldown -= dt;
    if (ship.spreadTimer > 0) ship.spreadTimer -= dt;
    if (ship.rapidTimer > 0) ship.rapidTimer -= dt;
    if (ship.overdriveTimer > 0) ship.overdriveTimer -= dt;

    // Stars drift slowly downward, wrapping; the backdrop never stops moving.
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      s.y += 12 * s.layer * dt;
      if (s.y > FIELD.height + 2) { s.y = -2; s.x = random() * FIELD.width; }
    }

    // Ship: aim, thrust, dash, fire.
    const aim = input.aim;
    if (aim.seen) ship.angle = Math.atan2(aim.y - ship.y, aim.x - ship.x);
    else if (input.thrust.x !== 0 || input.thrust.y !== 0) {
      ship.angle = Math.atan2(input.thrust.y, input.thrust.x);
    }
    ship.thrusting = input.thrust.x !== 0 || input.thrust.y !== 0;
    if (input.dash && ship.dashCooldown <= 0 && ship.dashTimer <= 0) {
      // Dash where the ship is going (thrust direction); with no thrust, where it aims.
      const dx = (input.thrust.x !== 0 || input.thrust.y !== 0) ? input.thrust.x : (aim.seen ? aim.x - ship.x : 0);
      const dy = (input.thrust.x !== 0 || input.thrust.y !== 0) ? input.thrust.y : (aim.seen ? aim.y - ship.y : -1);
      const len = Math.hypot(dx, dy) || 1;
      ship.vx = (dx / len) * SHIP.dashSpeed;
      ship.vy = (dy / len) * SHIP.dashSpeed;
      ship.dashTimer = SHIP.dashTime;
      ship.dashCooldown = SHIP.dashCooldown;
      ship.invulnerable = Math.max(ship.invulnerable, SHIP.dashTime + 0.05);
      explosion(ship.x, ship.y, '#00f0ff', 8, 160);
    }
    if (ship.dashTimer > 0) {
      ship.dashTimer -= dt;
    } else if (ship.thrusting) {
      const len = Math.hypot(input.thrust.x, input.thrust.y) || 1;
      ship.vx += (input.thrust.x / len) * SHIP.accel * dt;
      ship.vy += (input.thrust.y / len) * SHIP.accel * dt;
    }
    const damp = Math.exp(-SHIP.damping * dt);
    ship.vx *= damp;
    ship.vy *= damp;
    const speed = Math.hypot(ship.vx, ship.vy);
    const cap = ship.dashTimer > 0 ? SHIP.dashSpeed : SHIP.maxSpeed;
    if (speed > cap) {
      ship.vx = (ship.vx / speed) * cap;
      ship.vy = (ship.vy / speed) * cap;
    }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    if (ship.x < SHIP.radius) { ship.x = SHIP.radius; ship.vx = Math.abs(ship.vx) * 0.4; }
    if (ship.x > FIELD.width - SHIP.radius) { ship.x = FIELD.width - SHIP.radius; ship.vx = -Math.abs(ship.vx) * 0.4; }
    if (ship.y < SHIP.radius) { ship.y = SHIP.radius; ship.vy = Math.abs(ship.vy) * 0.4; }
    if (ship.y > FIELD.height - SHIP.radius) { ship.y = FIELD.height - SHIP.radius; ship.vy = -Math.abs(ship.vy) * 0.4; }
    if (ship.thrusting) {
      const bx = ship.x - Math.cos(ship.angle) * SHIP.radius;
      const by = ship.y - Math.sin(ship.angle) * SHIP.radius;
      spawnParticle(bx, by, -Math.cos(ship.angle) * 120 + (random() - 0.5) * 60, -Math.sin(ship.angle) * 120 + (random() - 0.5) * 60, 0.25 + random() * 0.2, 2 + random() * 2, '#ff9f43', 1);
    }

    if (!harmless) {
      ship.fireTimer -= dt;
      if (input.firing && ship.fireTimer <= 0) {
        const interval = ship.overdriveTimer > 0 || ship.rapidTimer > 0 ? SHIP.rapidInterval : SHIP.fireInterval;
        ship.fireTimer = interval;
        if (ship.spreadTimer > 0) {
          fireBullet(ship.angle - 0.18);
          fireBullet(ship.angle);
          fireBullet(ship.angle + 0.18);
        } else {
          fireBullet(ship.angle);
        }
        spawnParticle(
          ship.x + Math.cos(ship.angle) * (SHIP.radius + 10),
          ship.y + Math.sin(ship.angle) * (SHIP.radius + 10),
          Math.cos(ship.angle) * 60, Math.sin(ship.angle) * 60, 0.12, 3, '#7df9ff', 1,
        );
      }
    }

    // Spawning (not on the title backdrop: reset() already seeded the field).
    if (!harmless) {
      state.spawnTimer -= dt;
      const want = state.waveQuota - state.spawned;
      const live = countActive(asteroids);
      if (state.spawnTimer <= 0 && want > 0 && live < 6 + state.wave) {
        spawnAsteroid(random() < 0.55 ? 'large' : 'medium', false, true);
        state.spawned += 1;
        state.spawnTimer = Math.max(0.55, ASTEROID.spawnInterval - state.wave * 0.05);
      }
      const wantDrones = dronesFor(state.wave);
      if (state.dronesSpawned < wantDrones) {
        state.droneTimer -= dt;
        if (state.droneTimer <= 0) {
          spawnDrone();
          state.dronesSpawned += 1;
          state.droneTimer = 4;
        }
      }
    }

    // Bullets.
    for (let i = 0; i < bullets.length; i += 1) {
      const b = bullets[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.active = false;
    }

    // Asteroids drift and wrap around the edges.
    for (let i = 0; i < asteroids.length; i += 1) {
      const a = asteroids[i];
      if (!a.active) continue;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.rotSpeed * dt;
      if (a.x < -a.radius - 20) a.x = FIELD.width + a.radius + 20;
      else if (a.x > FIELD.width + a.radius + 20) a.x = -a.radius - 20;
      if (a.y < -a.radius - 20) a.y = FIELD.height + a.radius + 20;
      else if (a.y > FIELD.height + a.radius + 20) a.y = -a.radius - 20;
    }

    // Drones chase and shoot.
    for (let i = 0; i < drones.length; i += 1) {
      const d = drones[i];
      if (!d.active) continue;
      const dx = ship.x - d.x;
      const dy = ship.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      d.angle = Math.atan2(dy, dx);
      if (len > 190) {
        d.vx += (dx / len) * DRONE.accel * dt;
        d.vy += (dy / len) * DRONE.accel * dt;
      } else {
        d.vx += (-dy / len) * DRONE.accel * 0.5 * dt;
        d.vy += (dx / len) * DRONE.accel * 0.5 * dt;
      }
      const ds = Math.hypot(d.vx, d.vy);
      if (ds > DRONE.maxSpeed) { d.vx = (d.vx / ds) * DRONE.maxSpeed; d.vy = (d.vy / ds) * DRONE.maxSpeed; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < -40) d.x = FIELD.width + 40;
      else if (d.x > FIELD.width + 40) d.x = -40;
      if (d.y < -40) d.y = FIELD.height + 40;
      else if (d.y > FIELD.height + 40) d.y = -40;
      if (!harmless) {
        d.fireTimer -= dt;
        if (d.fireTimer <= 0 && len < 560) {
          d.fireTimer = DRONE.fireInterval;
          const p = free(plasma);
          if (p !== null) {
            p.active = true;
            p.x = d.x + Math.cos(d.angle) * (DRONE.radius + 8);
            p.y = d.y + Math.sin(d.angle) * (DRONE.radius + 8);
            p.vx = Math.cos(d.angle) * DRONE.plasmaSpeed;
            p.vy = Math.sin(d.angle) * DRONE.plasmaSpeed;
            p.life = 4;
          }
        }
      }
    }

    // Plasma orbs drift and fade.
    for (let i = 0; i < plasma.length; i += 1) {
      const p = plasma[i];
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < -20 || p.x > FIELD.width + 20 || p.y < -20 || p.y > FIELD.height + 20) p.active = false;
    }

    // Orbs drift, magnet in, fade out.
    for (let i = 0; i < orbs.length; i += 1) {
      const o = orbs[i];
      if (!o.active) continue;
      o.life -= dt;
      if (o.life <= 0) { o.active = false; continue; }
      const d2 = dist2(o.x, o.y, ship.x, ship.y);
      if (d2 < ORB.magnetRadius * ORB.magnetRadius) {
        const len = Math.sqrt(d2) || 1;
        o.vx += ((ship.x - o.x) / len) * 2600 * dt;
        o.vy += ((ship.y - o.y) / len) * 2600 * dt;
        const os = Math.hypot(o.vx, o.vy);
        if (os > ORB.magnetSpeed) { o.vx = (o.vx / os) * ORB.magnetSpeed; o.vy = (o.vy / os) * ORB.magnetSpeed; }
      } else {
        o.vx *= Math.exp(-1.5 * dt);
        o.vy *= Math.exp(-1.5 * dt);
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
    }

    // Power-ups drift down and sway.
    for (let i = 0; i < powers.length; i += 1) {
      const p = powers[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.phase += dt * 2;
      p.y += p.vy * dt;
      p.x += Math.sin(p.phase) * 24 * dt;
      if (p.y > FIELD.height + 20) p.active = false;
    }

    // Particles fade and slow.
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (harmless) return 0;

    // Bullets vs asteroids and drones.
    for (let i = 0; i < bullets.length; i += 1) {
      const b = bullets[i];
      if (!b.active) continue;
      for (let j = 0; j < asteroids.length; j += 1) {
        const a = asteroids[j];
        if (!a.active) continue;
        const rr = a.radius + BULLET.radius;
        if (dist2(b.x, b.y, a.x, a.y) < rr * rr) {
          b.active = false;
          a.hp -= 1;
          spawnParticle(b.x, b.y, 0, 0, 0.15, 3, '#ffd319', 1);
          if (a.hp <= 0) destroyAsteroid(a, true);
          break;
        }
      }
      if (!b.active) continue;
      for (let j = 0; j < drones.length; j += 1) {
        const d = drones[j];
        if (!d.active) continue;
        const rr = DRONE.radius + BULLET.radius;
        if (dist2(b.x, b.y, d.x, d.y) < rr * rr) {
          b.active = false;
          d.hp -= 1;
          spawnParticle(b.x, b.y, 0, 0, 0.15, 3, '#ffd319', 1);
          if (d.hp <= 0) {
            d.active = false;
            state.score += DRONE.score * scoreMult();
            explosion(d.x, d.y, '#ff2e63', 16, 260);
            if (random() < 0.5) spawnOrb(d.x, d.y);
          }
          break;
        }
      }
    }

    // Ship vs orbs and power-ups.
    for (let i = 0; i < orbs.length; i += 1) {
      const o = orbs[i];
      if (!o.active) continue;
      const rr = SHIP.radius + ORB.radius + 4;
      if (dist2(o.x, o.y, ship.x, ship.y) < rr * rr) events |= collectOrb(o);
    }
    for (let i = 0; i < powers.length; i += 1) {
      const p = powers[i];
      if (!p.active) continue;
      const rr = SHIP.radius + POWER.radius + 4;
      if (dist2(p.x, p.y, ship.x, ship.y) < rr * rr) {
        p.active = false;
        if (p.kind === 'spread') ship.spreadTimer = POWER.spreadSeconds;
        else if (p.kind === 'shield') ship.shield = true;
        else ship.rapidTimer = POWER.rapidSeconds;
        events |= EVENT_POWER;
        explosion(p.x, p.y, '#7df9ff', 8, 140);
      }
    }

    // Ship vs asteroids, drones and plasma.
    if (ship.invulnerable <= 0) {
      let hit = false;
      for (let i = 0; i < asteroids.length && !hit; i += 1) {
        const a = asteroids[i];
        if (!a.active) continue;
        const rr = a.radius + SHIP.radius - 4;
        if (dist2(a.x, a.y, ship.x, ship.y) < rr * rr) {
          destroyAsteroid(a, false);
          hit = true;
        }
      }
      if (!hit) {
        for (let i = 0; i < drones.length && !hit; i += 1) {
          const d = drones[i];
          if (!d.active) continue;
          const rr = DRONE.radius + SHIP.radius - 2;
          if (dist2(d.x, d.y, ship.x, ship.y) < rr * rr) {
            d.active = false;
            explosion(d.x, d.y, '#ff2e63', 16, 260);
            hit = true;
          }
        }
      }
      if (!hit) {
        for (let i = 0; i < plasma.length && !hit; i += 1) {
          const p = plasma[i];
          if (!p.active) continue;
          const rr = DRONE.plasmaRadius + SHIP.radius - 2;
          if (dist2(p.x, p.y, ship.x, ship.y) < rr * rr) {
            p.active = false;
            hit = true;
          }
        }
      }
      if (hit) {
        events |= hitShip();
        if (events & EVENT_OVER) return events;
      }
    }

    // Wave cleared: quota destroyed and the field empty of rocks and drones.
    if (!state.over && state.waveKills >= state.waveQuota && countActive(asteroids) === 0 && countActive(drones) === 0) {
      const bonus = 500 + 100 * state.wave;
      state.score += bonus;
      if (state.wave >= WAVE.max) {
        state.won = true;
        state.banner = 'VOID CLEARED';
        state.bannerSub = `Final score ${state.score}`;
        state.bannerTimer = 3;
        return events | EVENT_WIN;
      }
      state.wave += 1;
      state.waveKills = 0;
      state.spawned = 0;
      state.dronesSpawned = 0;
      state.spawnTimer = 1.2;
      state.droneTimer = 3;
      state.waveQuota = waveQuotaFor(state.wave);
      state.banner = `WAVE ${state.wave}`;
      state.bannerSub = `Clear ${state.waveQuota} rocks  ·  +${bonus} bonus`;
      state.bannerTimer = WAVE.bannerSeconds;
      events |= EVENT_WAVE;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}

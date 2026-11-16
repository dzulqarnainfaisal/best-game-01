// The screenshot scenes behind ?shot=start|play|wave|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so
// the frame is what a real game looks like and the same seed always gives the same frame.
// The autopilot thrusts toward the nearest orb, keeps clear of close rocks, and fires at the
// nearest rock inside its aim cone. The end scene's pilot is deliberately worse (it never
// fires and reacts late), so it loses all three lives, as a hurried player does.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const WAVE_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer input for one step: thrust, aim and firing, from the autopilot's read of the state.
 * It keeps a standoff from the nearest rock (approach when far, back off when close, strafe
 * between), fires when the rock is inside its aim cone, chases orbs only when nothing is
 * close, and dashes away when a rock gets on top of it. */
function autopilot(state, skillful) {
  const ship = state.ship;
  let tx = FIELD.width / 2;
  let ty = FIELD.height / 2;
  let danger = null;
  let dangerD2 = Infinity;
  for (let i = 0; i < state.asteroids.length; i += 1) {
    const a = state.asteroids[i];
    if (!a.active) continue;
    const dx = a.x - ship.x;
    const dy = a.y - ship.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < dangerD2) { dangerD2 = d2; danger = a; }
  }
  for (let i = 0; i < state.drones.length; i += 1) {
    const d = state.drones[i];
    if (!d.active) continue;
    const dx = d.x - ship.x;
    const dy = d.y - ship.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < dangerD2) { dangerD2 = d2; danger = d; }
  }
  let orb = null;
  let orbD2 = Infinity;
  for (let i = 0; i < state.orbs.length; i += 1) {
    const o = state.orbs[i];
    if (!o.active) continue;
    const dx = o.x - ship.x;
    const dy = o.y - ship.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < orbD2) { orbD2 = d2; orb = o; }
  }
  const dangerDist = Math.sqrt(dangerD2);
  let dash = false;
  if (orb !== null && (danger === null || orbD2 < dangerD2) && dangerDist > 300) {
    tx = orb.x;
    ty = orb.y;
  } else if (danger !== null) {
    const dx = danger.x - ship.x;
    const dy = danger.y - ship.y;
    const len = dangerDist || 1;
    if (dangerDist > 320) {
      tx = ship.x + dx;
      ty = ship.y + dy;
    } else if (dangerDist < 230) {
      tx = ship.x - dx;
      ty = ship.y - dy;
      if (dangerDist < 120) dash = true;
    } else {
      // Strafe: circle the rock instead of sitting in its path.
      tx = ship.x - (dy / len) * 200;
      ty = ship.y + (dx / len) * 200;
    }
  }
  const thrust = { x: 0, y: 0 };
  if (tx > ship.x + 24) thrust.x = 1;
  else if (tx < ship.x - 24) thrust.x = -1;
  if (ty > ship.y + 24) thrust.y = 1;
  else if (ty < ship.y - 24) thrust.y = -1;
  let aim = { x: ship.x + Math.cos(ship.angle) * 200, y: ship.y + Math.sin(ship.angle) * 200, seen: true };
  let firing = false;
  if (skillful && danger !== null) {
    aim = { x: danger.x, y: danger.y, seen: true };
    const dx = danger.x - ship.x;
    const dy = danger.y - ship.y;
    const want = Math.atan2(dy, dx);
    let diff = want - ship.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    firing = Math.abs(diff) < 0.5;
  }
  return { thrust, aim, firing, dash: skillful && dash };
}

function idleInput() {
  return {
    thrust: { x: 0, y: 0 },
    aim: { x: FIELD.width / 2, y: FIELD.height / 2 - 160, seen: false },
    firing: false,
    dash: false,
  };
}

/**
 * Set `world` to the named scene (start, play, wave or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'wave' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, idleInput(), true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    // Play well for a while so the final score is real, then fall apart: the weak pilot
    // never fires and reacts late, so it loses all three lives, as a hurried player does.
    for (let index = 0; index < 20 / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, true), false);
      if (events & EVENT_OVER) break;
    }
    if (world.state.lives > 0) {
      for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
        const events = world.step(STEP, autopilot(world.state, false), false);
        if (events & EVENT_OVER) break;
      }
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  const limit = name === 'wave' ? WAVE_LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state, true), false);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (name === 'wave' && (events & EVENT_WAVE)) {
      // One more short push so the banner is up and the field reads cleared.
      for (let j = 0; j < 30; j += 1) world.step(STEP, idleInput(), false);
      return { screen: SCREEN_PLAY, best: world.state.score };
    }
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

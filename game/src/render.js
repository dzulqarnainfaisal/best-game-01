// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Neon
// shapes are drawn in two passes (a wide translucent stroke, then a bright core) instead of
// shadowBlur, so the frame stays fast even on a software renderer. Text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.
import { FIELD, FONT, LIVES, PALETTE } from './config.js';
import { DRONE, WAVE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;
const PANEL = { width: 640, top: 120, line: 34, bottom: 64 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const comboLabel = cachedLabel('COMBO x');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function glowCircle(x, y, radius, color, alpha) {
    const grad = context.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = grad;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawBackground(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, '#05010f');
    grad.addColorStop(0.6, PALETTE.deep);
    grad.addColorStop(1, '#160329');
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    for (let i = 0; i < state.nebulae.length; i += 1) {
      const n = state.nebulae[i];
      glowCircle(n.x, n.y, n.r, n.color, 0.08);
    }

    // Synthwave sun, top right, behind everything.
    const sunX = 1060;
    const sunY = 150;
    const sunR = 86;
    const sunGrad = context.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    sunGrad.addColorStop(0, PALETTE.sunTop);
    sunGrad.addColorStop(1, PALETTE.sunBottom);
    context.globalAlpha = 0.85;
    context.fillStyle = sunGrad;
    context.beginPath();
    context.arc(sunX, sunY, sunR, 0, TAU);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.deep;
    for (let i = 0; i < 4; i += 1) {
      const y = sunY + 6 + i * 16;
      const half = Math.sqrt(Math.max(0, sunR * sunR - (y - sunY) * (y - sunY)));
      context.fillRect(sunX - half, y, half * 2, 3 + i * 1.5);
    }

    // Perspective grid along the bottom.
    context.save();
    context.globalAlpha = 0.14;
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    const horizon = 618;
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      const y = horizon + (FIELD.height - horizon) * t * t;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    for (let i = -8; i <= 8; i += 1) {
      context.beginPath();
      context.moveTo(FIELD.width / 2 + i * 46, horizon);
      context.lineTo(FIELD.width / 2 + i * 190, FIELD.height);
      context.stroke();
    }
    context.restore();

    // Stars: three parallax layers, twinkling.
    for (let i = 0; i < state.stars.length; i += 1) {
      const s = state.stars[i];
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(state.elapsed * 1.5 + s.phase));
      context.globalAlpha = tw * s.layer;
      context.fillStyle = '#cfe8ff';
      context.fillRect(s.x, s.y, s.size, s.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(ship, elapsed) {
    if (ship.invulnerable > 0 && Math.floor(ship.invulnerable * 10) % 2 === 0) return;
    context.save();
    context.translate(ship.x, ship.y);
    context.rotate(ship.angle);
    const over = ship.overdriveTimer > 0;
    const body = over ? '#ffd319' : PALETTE.ship;
    if (ship.thrusting) {
      const flick = 14 + Math.random() * 10;
      context.fillStyle = '#ff9f43';
      context.beginPath();
      context.moveTo(-12, -5);
      context.lineTo(-12 - flick, 0);
      context.lineTo(-12, 5);
      context.closePath();
      context.fill();
    }
    context.strokeStyle = body;
    context.lineWidth = 2.5;
    context.lineJoin = 'round';
    context.fillStyle = 'rgba(0,240,255,0.16)';
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-12, -11);
    context.lineTo(-6, 0);
    context.lineTo(-12, 11);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = PALETTE.shipCore;
    context.beginPath();
    context.arc(4, 0, 3.4, 0, TAU);
    context.fill();
    context.restore();
    if (ship.shield) {
      context.strokeStyle = PALETTE.powerShield;
      context.globalAlpha = 0.75 + 0.25 * Math.sin(elapsed * 6);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ship.x, ship.y, 26, 0, TAU);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawAsteroid(a) {
    context.save();
    context.translate(a.x, a.y);
    context.rotate(a.rot);
    context.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const ang = (i / 9) * TAU;
      const r = a.radius * a.verts[i];
      if (i === 0) context.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else context.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    context.closePath();
    context.fillStyle = PALETTE.asteroidDark;
    context.fill();
    context.globalAlpha = 0.35;
    context.strokeStyle = PALETTE.asteroid;
    context.lineWidth = 5;
    context.stroke();
    context.globalAlpha = 1;
    context.strokeStyle = '#ffd9a0';
    context.lineWidth = 1.6;
    context.stroke();
    context.restore();
  }

  function drawDrone(d) {
    context.save();
    context.translate(d.x, d.y);
    context.rotate(d.angle);
    context.strokeStyle = PALETTE.drone;
    context.lineWidth = 2.5;
    context.fillStyle = 'rgba(255,46,99,0.2)';
    context.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * TAU;
      if (i === 0) context.moveTo(Math.cos(ang) * 17, Math.sin(ang) * 17);
      else context.lineTo(Math.cos(ang) * 17, Math.sin(ang) * 17);
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#ff5c7a';
    context.beginPath();
    context.arc(4, 0, 4.5, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawOrb(o, elapsed) {
    const pulse = 1 + 0.25 * Math.sin(elapsed * 6 + o.x);
    glowCircle(o.x, o.y, 22 * pulse, PALETTE.orb, 0.5);
    context.fillStyle = PALETTE.orb;
    context.beginPath();
    context.arc(o.x, o.y, ORB_RADIUS, 0, TAU);
    context.fill();
    context.fillStyle = '#fff6c9';
    context.beginPath();
    context.arc(o.x - 2, o.y - 2, 3, 0, TAU);
    context.fill();
  }

  function drawPower(p) {
    const colors = { spread: PALETTE.powerSpread, shield: PALETTE.powerShield, rapid: PALETTE.powerRapid };
    const color = colors[p.kind] || '#fff';
    glowCircle(p.x, p.y, 26, color, 0.45);
    context.save();
    context.translate(p.x, p.y);
    context.rotate(Math.sin(p.phase) * 0.3);
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.fillStyle = 'rgba(4,1,9,0.85)';
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(13, 0);
    context.lineTo(0, 13);
    context.lineTo(-13, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.font = `bold 13px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(p.kind === 'spread' ? 'S' : p.kind === 'shield' ? 'H' : 'R', 0, 1);
    context.restore();
  }

  function drawBullets(state) {
    for (let i = 0; i < state.bullets.length; i += 1) {
      const b = state.bullets[i];
      if (!b.active) continue;
      const len = Math.hypot(b.vx, b.vy) || 1;
      const nx = (b.vx / len) * 12;
      const ny = (b.vy / len) * 12;
      context.strokeStyle = 'rgba(125,249,255,0.4)';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(b.x - nx, b.y - ny);
      context.lineTo(b.x + nx, b.y + ny);
      context.stroke();
      context.strokeStyle = '#e8feff';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(b.x - nx, b.y - ny);
      context.lineTo(b.x + nx, b.y + ny);
      context.stroke();
    }
    for (let i = 0; i < state.plasma.length; i += 1) {
      const p = state.plasma[i];
      if (!p.active) continue;
      glowCircle(p.x, p.y, 16, PALETTE.plasma, 0.6);
      context.fillStyle = '#ffd7f5';
      context.beginPath();
      context.arc(p.x, p.y, 4, 0, TAU);
      context.fill();
    }
  }

  function drawParticles(state) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    if (state.combo >= 2) {
      const hue = state.combo >= 6 ? '#ff9f43' : PALETTE.orb;
      text(comboLabel(state.combo), 24, 54, 22, hue, 'left');
    }
    text(waveLabel(state.wave), FIELD.width / 2, 18, 26, PALETTE.text, 'center');
    text(`${state.waveKills}/${state.waveQuota} rocks`, FIELD.width / 2, 50, 18, PALETTE.muted, 'center');
    const ship = state.ship;
    const firstLife = FIELD.width - 24 - LIVES * 30;
    text('LIVES', firstLife - 12, 22, 20, PALETTE.muted, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      const x = firstLife + life * 30 + 12;
      const y = 34;
      context.save();
      context.translate(x, y);
      context.rotate(-Math.PI / 2);
      context.fillStyle = life < state.lives ? PALETTE.ship : 'rgba(255,255,255,0.14)';
      context.beginPath();
      context.moveTo(9, 0);
      context.lineTo(-7, -6);
      context.lineTo(-3, 0);
      context.lineTo(-7, 6);
      context.closePath();
      context.fill();
      context.restore();
    }
    // Energy bar, bottom centre.
    const barW = 280;
    const barH = 11;
    const barX = (FIELD.width - barW) / 2;
    const barY = FIELD.height - 30;
    const over = ship.overdriveTimer > 0;
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(barX, barY, barW, barH);
    const fill = over ? 1 : state.energy / 100;
    context.fillStyle = over ? '#ffd319' : '#ffb400';
    if (over && Math.floor(state.elapsed * 6) % 2 === 0) context.fillStyle = '#fff6c9';
    context.fillRect(barX, barY, barW * fill, barH);
    context.strokeStyle = 'rgba(255,211,25,0.6)';
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barW, barH);
    text(over ? 'OVERDRIVE' : 'ENERGY', FIELD.width / 2, barY - 22, 15, over ? '#ffd319' : PALETTE.muted, 'center');
    // Power-up timers, bottom left.
    let chipY = FIELD.height - 52;
    if (ship.spreadTimer > 0) {
      text(`SPREAD ${Math.ceil(ship.spreadTimer)}s`, 24, chipY, 17, PALETTE.powerSpread, 'left');
      chipY -= 24;
    }
    if (ship.rapidTimer > 0) {
      text(`RAPID ${Math.ceil(ship.rapidTimer)}s`, 24, chipY, 17, PALETTE.powerRapid, 'left');
      chipY -= 24;
    }
    if (ship.shield) text('SHIELD READY', 24, chipY, 17, PALETTE.powerShield, 'left');
    // Dash cooldown, bottom right.
    if (ship.dashCooldown > 0) {
      text('DASH ...', FIELD.width - 24, FIELD.height - 52, 17, PALETTE.muted, 'right');
    } else {
      text('DASH READY', FIELD.width - 24, FIELD.height - 52, 17, PALETTE.ship, 'right');
    }
    // Wave banner.
    if (state.bannerTimer > 0 && state.banner !== '') {
      const alpha = Math.min(1, state.bannerTimer);
      context.globalAlpha = alpha;
      text(state.banner, FIELD.width / 2, 190, 52, '#ffd319', 'center');
      if (state.bannerSub !== '') text(state.bannerSub, FIELD.width / 2, 252, 22, PALETTE.text, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(6,2,18,0.88)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.ship;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.orb, 'center');
  }

  const TITLE_LINES = [
    'Dodge the rocks. Shoot them apart. Catch the gold orbs.',
    'Chain orbs into a combo, fill ENERGY for OVERDRIVE.',
    'Clear all 10 waves to win. 3 lives. Good luck, pilot.',
    '',
    'Move: WASD or arrows   ·   Aim: mouse',
    'Fire: hold click or Space   ·   Dash: Shift',
    'Pause: P   ·   Restart: R',
  ];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state);
    for (let i = 0; i < state.asteroids.length; i += 1) {
      if (state.asteroids[i].active) drawAsteroid(state.asteroids[i]);
    }
    for (let i = 0; i < state.drones.length; i += 1) {
      if (state.drones[i].active) drawDrone(state.drones[i]);
    }
    for (let i = 0; i < state.orbs.length; i += 1) {
      if (state.orbs[i].active) drawOrb(state.orbs[i], state.elapsed);
    }
    for (let i = 0; i < state.powers.length; i += 1) {
      if (state.powers[i].active) drawPower(state.powers[i]);
    }
    drawBullets(state);
    drawShip(state.ship, state.elapsed);
    drawParticles(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON VOID', TITLE_LINES, 'Press SPACE or click to launch', PALETTE.ship);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The void will wait for you.'], 'Press P or click to resume', PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      drawPanel('GAME OVER', ['', finalLabel(state.score), bestLabel(best), `Reached wave ${state.wave}`], 'Press R or click to fly again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('VOID CLEARED', ['', finalLabel(state.score), bestLabel(best), 'All 10 waves cleared. The void is yours.'], 'Press R or click to fly again', PALETTE.orb);
    }
  }

  return { draw };
}

// Orb draw radius (kept outside createRenderer so drawOrb stays small).
const ORB_RADIUS = 8;

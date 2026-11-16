// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and victory.
//
// ?seed=N fixes the asteroid pattern. ?shot=start|play|wave|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, LIVES, STEP, WAVE } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_DRIVE, EVENT_HIT, EVENT_ORB, EVENT_OVER, EVENT_POWER, EVENT_WAVE, EVENT_WIN, createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // The screenshot harness reads the staged state through this; it changes nothing.
  window.__shotState = {
    screen: scene.screen,
    score: world.state.score,
    lives: world.state.lives,
    wave: world.state.wave,
    best: scene.best,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashQueued = false;

  // The play-test harness reads the live state through this; it changes nothing.
  window.__game = {
    state: world.state,
    screen() { return screen; },
    best() { return best; },
  };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    dashQueued = false;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. ${LIVES} lives. Clear ${WAVE.max} waves to win.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_DASH) dashQueued = true;
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
  }

  function countBullets() {
    let n = 0;
    for (let i = 0; i < world.state.bullets.length; i += 1) if (world.state.bullets[i].active) n += 1;
    return n;
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, {
        thrust: { x: 0, y: 0 },
        aim: { x: FIELD.width / 2, y: FIELD.height / 2 - 160, seen: false },
        firing: false,
        dash: false,
      }, true);
      return;
    }
    const before = countBullets();
    const dash = dashQueued;
    dashQueued = false;
    const events = world.step(STEP, {
      thrust: input.thrust(),
      aim: input.aim(),
      firing: input.firing(),
      dash,
    }, false);
    if (dash) audio.dash();
    if (countBullets() > before) audio.shoot();
    if (events & EVENT_HIT) audio.explosion();
    if (events & EVENT_ORB) audio.pickup(world.state.combo);
    if (events & EVENT_POWER) audio.power();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_DRIVE) audio.overdrive();
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      audio.over();
      endGame(false);
    } else if (events & EVENT_HIT) {
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting rocks fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('NEON VOID. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

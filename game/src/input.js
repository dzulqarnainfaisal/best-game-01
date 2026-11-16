// Keyboard and pointer input. Held keys give a thrust vector; one-shot presses (start or
// restart, pause, dash) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. The mouse aims the ship and fires while
// held; the aim point is reported in playfield coordinates.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_DASH = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let fireKey = false;
  let fireMouse = false;
  let mouseX = FIELD.width / 2;
  let mouseY = FIELD.height / 2 - 160;
  let mouseSeen = false;
  let actions = 0;

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    mouseX = (event.clientX - rect.left - ox) / scale;
    mouseY = (event.clientY - rect.top - oy) / scale;
    mouseSeen = true;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (FIRE.has(event.code)) {
      fireKey = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (FIRE.has(event.code)) fireKey = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    fireKey = false;
    fireMouse = false;
  });
  canvas.addEventListener('pointermove', toField);
  canvas.addEventListener('pointerdown', (event) => {
    toField(event);
    fireMouse = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    fireMouse = false;
  });

  return {
    /** Thrust vector, each component -1, 0 or 1. */
    thrust() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    firing() {
      return fireKey || fireMouse;
    },
    /** Aim point in playfield coordinates; whether the mouse has moved yet. */
    aim() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

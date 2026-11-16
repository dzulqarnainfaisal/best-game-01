# NEON VOID — best-game-01 entry

A 2D neon arcade space shooter. Pilot a small ship through an asteroid
field, dodge the rocks, shoot them apart, collect the energy orbs they
drop, and chain pickups into a combo. Ten waves; clear wave 10 to win.

## Goal and rules

- **Goal:** survive all 10 waves and clear the void. Score as much as
  you can along the way.
- **Lose:** 3 lives. A rock, a drone, or a plasma orb that hits the ship
  costs one life. At 0 lives the run ends.
- **Win:** destroy the wave quota (6 + 2 per wave asteroids) and clear
  wave 10. A VICTORY screen shows the final score.
- **Score:** small asteroid 50, medium 100, large 150, drone 200,
  energy orb 25 x combo, wave-clear bonus 500 + 100 x wave.
- **Combo:** each orb raises the combo (x1 to x8). It ticks down after
  3 s without a pickup. Orb score multiplies by the combo.
- **Energy:** orbs fill the energy bar. At 100 the ship goes OVERDRIVE
  for 5 s: fire rate doubles and all score doubles.
- **Power-ups** (rare drops from asteroids): SPREAD (triple shot, 12 s),
  SHIELD (blocks one hit), RAPID (fire rate x2, 10 s).
- **Controls:** WASD or arrows to thrust, mouse to aim, hold click or
  Space to fire, Shift to dash (1 s cooldown), P or Esc to pause,
  R to restart, Enter/Space/click to start.

## Systems

- Fixed 1/60 s simulation, seeded RNG (mulberry32): the same seed plays
  the same game, which is what makes the screenshot scenes repeatable.
- Ship physics: thrust acceleration with exponential damping, so the
  ship drifts and slides instead of stopping dead.
- Asteroids in three sizes. Large splits into two medium, medium into
  two small. Irregular polygon shapes, slow rotation.
- Hunter drones from wave 3: they chase the ship and fire slow plasma
  orbs every 2.5 s.
- Orbs magnet toward the ship inside 120 px and fade after 8 s.
- Particles: thrust flame, explosion debris, orb sparkle, muzzle flash.
  Screen shake on hits. All pools are allocated once at boot; the
  simulation allocates nothing per frame.
- Procedural WebAudio only: shoot blip, explosion noise, pickup chime
  that rises in pitch with the combo, wave horn, game-over sting,
  victory arpeggio, quiet bass pulse. No audio files.
- Screens: title, play, paused, game over, victory. HUD: score, combo,
  lives as ship icons, wave and wave progress, energy bar, power-up
  timers, wave banners. Best score kept in localStorage.

## Files

- `game/index.html` — canvas + status line, loads `src/main.js`.
- `game/src/config.js` — every tuning number and colour.
- `game/src/random.js` — seeded RNG.
- `game/src/input.js` — keyboard + mouse, one-shot action flags.
- `game/src/world.js` — rules and state, no drawing, no browser.
- `game/src/render.js` — drawing only: field, HUD, panels.
- `game/src/audio.js` — procedural WebAudio, guarded.
- `game/src/shots.js` — deterministic `?shot=` scenes with autopilot.
- `game/src/main.js` — boot, loop, screens, `window.__shotReady`.
- `main.ts` — copies `game/` + `screenshots/` to `/output`, writes
  `dossier.json` with `vendor/makefun-game.ts`.
- `serve.ts` — static server for local play-testing.

## Screenshots (all real renders, `?shot=` + `&seed=1`)

- `1-start.jpg` — title screen over the live drifting field.
- `2-play.jpg` — mid-combat: asteroids, a drone, orbs, bullets, HUD.
- `3-wave.jpg` — wave-clear banner with OVERDRIVE lit.
- `4-end.jpg` — game-over screen after the autopilot loses all lives.

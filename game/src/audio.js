// Procedural WebAudio only: every sound is synthesized, no audio files. Everything is
// guarded: if the browser has no audio (headless, muted tab) the game still runs silently.
export function createAudio() {
  let context = null;
  let master = null;
  let bassTimer = null;

  function ensure() {
    if (context !== null) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, freqEnd, seconds, type, gain) {
    if (!ensure()) return;
    try {
      if (context.state === 'suspended') void context.resume();
      const osc = context.createOscillator();
      const g = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), context.currentTime + seconds);
      g.gain.setValueAtTime(gain, context.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(context.currentTime + seconds + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(seconds, gain, cutoff) {
    if (!ensure()) return;
    try {
      if (context.state === 'suspended') void context.resume();
      const len = Math.max(1, Math.floor(context.sampleRate * seconds));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const g = context.createGain();
      g.gain.setValueAtTime(gain, context.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call on the first user gesture; starts the quiet bass pulse. */
    unlock() {
      if (!ensure()) return;
      try {
        if (context.state === 'suspended') void context.resume();
        if (bassTimer !== null) return;
        let step = 0;
        const notes = [55, 55, 65.41, 49];
        bassTimer = window.setInterval(() => {
          if (document.hidden) return;
          tone(notes[step % notes.length], notes[step % notes.length], 0.5, 'triangle', 0.05);
          step += 1;
        }, 420);
      } catch {
        // Sound is garnish: never let it break the game.
      }
    },
    shoot() {
      tone(920, 420, 0.07, 'square', 0.08);
    },
    explosion() {
      noise(0.32, 0.5, 900);
      tone(160, 40, 0.3, 'sawtooth', 0.18);
    },
    pickup(combo) {
      const base = 520 + Math.min(combo, 8) * 60;
      tone(base, base * 1.5, 0.12, 'sine', 0.16);
    },
    power() {
      tone(440, 880, 0.16, 'sine', 0.18);
      tone(660, 1320, 0.16, 'sine', 0.1);
    },
    wave() {
      tone(220, 440, 0.4, 'sawtooth', 0.12);
      tone(330, 660, 0.4, 'sawtooth', 0.08);
    },
    overdrive() {
      tone(392, 784, 0.25, 'sine', 0.16);
      tone(523, 1046, 0.25, 'sine', 0.12);
    },
    over() {
      tone(330, 55, 0.8, 'sawtooth', 0.2);
      noise(0.6, 0.3, 500);
    },
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => window.setTimeout(() => tone(n, n, 0.3, 'sine', 0.16), i * 130));
    },
    dash() {
      noise(0.14, 0.2, 2400);
    },
  };
}

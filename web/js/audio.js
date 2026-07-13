/**
 * Firmas sonoras y vibración. WebAudio sintetiza todo (cero assets):
 * power chords con distorsión para el arranque de trabajo y el final
 * (estética rock), tonos suaves para el descanso y ticks percusivos para
 * el countdown. Diseñadas para distinguirse entre sí incluso con música
 * de fondo. Todo es opcional y falla en silencio si la plataforma no lo
 * soporta.
 */

let ctx = null;
let distortionCurve = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

export function isSoundEnabled() {
  return enabled;
}

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Curva de saturación para el WaveShaper (distorsión tipo overdrive). */
function getDistortionCurve() {
  if (!distortionCurve) {
    const n = 256;
    const k = 30;
    distortionCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      distortionCurve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
  }
  return distortionCurve;
}

/**
 * Power chord: fundamental + quinta + octava en sawtooth desafinados,
 * pasados por distorsión y lowpass. `rootHz` grave = más pesado.
 */
function powerChord(rootHz, { startAt = 0, durationMs = 350, volume = 0.5 } = {}) {
  const audio = ensureContext();
  if (!audio) return;
  const t0 = audio.currentTime + startAt;
  const t1 = t0 + durationMs / 1000;

  const shaper = audio.createWaveShaper();
  shaper.curve = getDistortionCurve();
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015); // ataque de púa
  gain.gain.exponentialRampToValueAtTime(0.001, t1);
  shaper.connect(filter).connect(gain).connect(audio.destination);

  for (const [ratio, detune] of [[1, -4], [1.5, 3], [2, -2]]) {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = rootHz * ratio;
    osc.detune.value = detune;
    osc.connect(shaper);
    osc.start(t0);
    osc.stop(t1);
  }
}

/** Tono simple (para señales suaves y ticks). */
function tone(frequency, { startAt = 0, durationMs = 150, volume = 0.4, type = 'sine' } = {}) {
  const audio = ensureContext();
  if (!audio) return;
  const t0 = audio.currentTime + startAt;
  const t1 = t0 + durationMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t1);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export const cues = {
  /** Llamar desde un gesto del usuario (click en Iniciar) para desbloquear audio en móvil. */
  unlock() {
    ensureContext();
  },
  /** Tick percusivo 3-2-1: corto y punzante, se oye sobre música. */
  countdown() {
    vibrate(60);
    if (!enabled) return;
    tone(1200, { durationMs: 80, volume: 0.5, type: 'square' });
  },
  /** A entrenar: doble golpe de power chord grave (Mi2), agresivo. */
  workStart() {
    vibrate([120, 60, 120]);
    if (!enabled) return;
    powerChord(82.41, { durationMs: 180, volume: 0.55 });
    powerChord(82.41, { startAt: 0.2, durationMs: 420, volume: 0.6 });
  },
  /** Descanso: dos tonos descendentes suaves, inconfundibles con el work. */
  restStart() {
    vibrate(200);
    if (!enabled) return;
    tone(660, { durationMs: 180, volume: 0.45 });
    tone(440, { startAt: 0.2, durationMs: 320, volume: 0.45 });
  },
  /** Fin de sesión: riff ascendente de power chords (victoria). */
  complete() {
    vibrate([200, 100, 200, 100, 400]);
    if (!enabled) return;
    powerChord(82.41, { durationMs: 200, volume: 0.5 });          // E2
    powerChord(98.0, { startAt: 0.22, durationMs: 200, volume: 0.5 });  // G2
    powerChord(110.0, { startAt: 0.44, durationMs: 200, volume: 0.5 }); // A2
    powerChord(164.81, { startAt: 0.66, durationMs: 700, volume: 0.6 }); // E3 sostenido
  },
};

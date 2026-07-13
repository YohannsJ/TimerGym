/**
 * Señales de audio y vibración. WebAudio genera los beeps (sin assets),
 * navigator.vibrate cubre móviles. Todo es opcional y falla en silencio
 * si la plataforma no lo soporta.
 */

let ctx = null;

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(frequency, durationMs, volume = 0.4) {
  const audio = ensureContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + durationMs / 1000);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + durationMs / 1000);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export const cues = {
  /** Llamar desde un gesto del usuario (click en Iniciar) para desbloquear audio en móvil. */
  unlock() {
    ensureContext();
  },
  countdown() {
    beep(880, 120);
    vibrate(60);
  },
  workStart() {
    beep(1320, 250, 0.5);
    vibrate([120, 60, 120]);
  },
  restStart() {
    beep(660, 250, 0.5);
    vibrate(200);
  },
  complete() {
    beep(880, 150);
    setTimeout(() => beep(1100, 150), 180);
    setTimeout(() => beep(1320, 350), 360);
    vibrate([200, 100, 200, 100, 400]);
  },
};

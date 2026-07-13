/**
 * TimerEngine: motor puro del timer de entrenamiento.
 *
 * Sin dependencias de DOM ni de plataforma: el reloj se inyecta (testeable)
 * y el avance se calcula contra timestamps absolutos, no con decrementos
 * por tick, para que no acumule drift aunque los ticks lleguen tarde.
 *
 * Fases: IDLE -> PREPARE -> (WORK -> REST) x sets -> DONE
 * (el REST del último set se omite).
 */

export const Phase = Object.freeze({
  IDLE: 'idle',
  PREPARE: 'prepare',
  WORK: 'work',
  REST: 'rest',
  DONE: 'done',
});

export const DEFAULT_CONFIG = Object.freeze({
  workSeconds: 45,
  restSeconds: 90,
  sets: 5,
  prepareSeconds: 5,
});

export const LIMITS = Object.freeze({
  workSeconds: { min: 5, max: 3600 },
  restSeconds: { min: 0, max: 3600 },
  sets: { min: 1, max: 100 },
  prepareSeconds: { min: 0, max: 60 },
});

export function clampConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const clamp = (value, { min, max }) => {
    const n = Number.isFinite(value) ? Math.round(value) : min;
    return Math.min(max, Math.max(min, n));
  };
  return {
    workSeconds: clamp(merged.workSeconds, LIMITS.workSeconds),
    restSeconds: clamp(merged.restSeconds, LIMITS.restSeconds),
    sets: clamp(merged.sets, LIMITS.sets),
    prepareSeconds: clamp(merged.prepareSeconds, LIMITS.prepareSeconds),
  };
}

export class TimerEngine {
  /**
   * @param {object} config - { workSeconds, restSeconds, sets, prepareSeconds }
   * @param {object} [deps]
   * @param {() => number} [deps.now] - reloj en ms (inyectable para tests)
   * @param {(event: object) => void} [deps.onEvent] - eventos: phaseChange, countdown, complete
   */
  constructor(config = {}, { now = () => Date.now(), onEvent = () => {} } = {}) {
    this._now = now;
    this._onEvent = onEvent;
    this.configure(config);
  }

  configure(config) {
    this.config = clampConfig(config);
    this._reset();
  }

  _reset() {
    this.phase = Phase.IDLE;
    this.currentSet = 1;
    this.running = false;
    this._phaseDurationMs = this.config.workSeconds * 1000;
    this._remainingMs = this._phaseDurationMs;
    this._endsAt = 0;
    this._lastWholeSecond = null;
  }

  reset() {
    this._reset();
  }

  start() {
    if (this.phase === Phase.DONE) this._reset();
    if (this.phase === Phase.IDLE) {
      const prepare = this.config.prepareSeconds;
      if (prepare > 0) {
        this._enterPhase(Phase.PREPARE, prepare * 1000);
      } else {
        this._enterPhase(Phase.WORK, this.config.workSeconds * 1000);
      }
    }
    this.running = true;
    this._endsAt = this._now() + this._remainingMs;
  }

  pause() {
    if (!this.running) return;
    this._remainingMs = Math.max(0, this._endsAt - this._now());
    this.running = false;
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  /**
   * Ajusta la fase actual: positivo = más tiempo (descansar más),
   * negativo = adelantar. No baja de 1s para no saltar fase implícitamente
   * (para eso está skipPhase).
   */
  addSeconds(delta) {
    if (this.phase !== Phase.WORK && this.phase !== Phase.REST && this.phase !== Phase.PREPARE) return;
    const remaining = this.running ? this._endsAt - this._now() : this._remainingMs;
    const adjusted = Math.min(7200_000, Math.max(1000, remaining + delta * 1000));
    this._phaseDurationMs = Math.max(this._phaseDurationMs, adjusted);
    if (this.running) {
      this._endsAt = this._now() + adjusted;
    } else {
      this._remainingMs = adjusted;
    }
  }

  /** Corta la fase actual y pasa a la siguiente de inmediato. */
  skipPhase() {
    if (this.phase === Phase.WORK || this.phase === Phase.REST || this.phase === Phase.PREPARE) {
      this._advance(0);
    }
  }

  /**
   * Debe llamarse periódicamente (p.ej. cada 100ms) mientras corre.
   * Calcula el restante contra el reloj real; si la fase terminó, el
   * sobrante (overflow) se descuenta de la siguiente para mantener exactitud.
   */
  tick() {
    if (!this.running) return this.getState();

    let remaining = this._endsAt - this._now();
    // Puede encadenar varias fases si el proceso estuvo suspendido mucho tiempo.
    while (remaining <= 0 && this.running) {
      this._advance(-remaining);
      remaining = this.running ? this._endsAt - this._now() : 0;
    }

    if (this.running) {
      const whole = Math.ceil(remaining / 1000);
      if (whole !== this._lastWholeSecond) {
        this._lastWholeSecond = whole;
        if (whole <= 3 && whole >= 1) {
          this._onEvent({ type: 'countdown', secondsLeft: whole, phase: this.phase });
        }
      }
    }
    return this.getState();
  }

  _enterPhase(phase, durationMs) {
    this.phase = phase;
    this._phaseDurationMs = durationMs;
    this._remainingMs = durationMs;
    this._lastWholeSecond = null;
    this._onEvent({ type: 'phaseChange', phase, currentSet: this.currentSet, totalSets: this.config.sets });
  }

  _advance(overflowMs) {
    const { workSeconds, restSeconds, sets } = this.config;
    switch (this.phase) {
      case Phase.PREPARE:
        this._enterPhase(Phase.WORK, workSeconds * 1000);
        break;
      case Phase.WORK:
        if (this.currentSet >= sets || restSeconds === 0) {
          if (this.currentSet >= sets) {
            this._complete();
            return;
          }
          this.currentSet += 1;
          this._enterPhase(Phase.WORK, workSeconds * 1000);
        } else {
          this._enterPhase(Phase.REST, restSeconds * 1000);
        }
        break;
      case Phase.REST:
        this.currentSet += 1;
        this._enterPhase(Phase.WORK, workSeconds * 1000);
        break;
      default:
        return;
    }
    // El sobrante se descuenta; si supera la fase entera, el loop de tick()
    // verá restante negativo y volverá a avanzar con el overflow correcto.
    this._remainingMs -= overflowMs;
    if (this.running) {
      this._endsAt = this._now() + this._remainingMs;
    }
  }

  _complete() {
    this.phase = Phase.DONE;
    this.running = false;
    this._remainingMs = 0;
    this._phaseDurationMs = 1;
    this._onEvent({ type: 'complete', totalSets: this.config.sets });
  }

  getState() {
    const remainingMs = this.running
      ? Math.max(0, this._endsAt - this._now())
      : this._remainingMs;
    return {
      phase: this.phase,
      running: this.running,
      currentSet: this.currentSet,
      totalSets: this.config.sets,
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      progress: this._phaseDurationMs > 0 ? Math.min(1, Math.max(0, remainingMs / this._phaseDurationMs)) : 0,
      config: { ...this.config },
    };
  }
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * TimerEngine: motor puro del timer de entrenamiento.
 *
 * Sin dependencias de DOM ni de plataforma: el reloj se inyecta (testeable)
 * y el avance se calcula contra timestamps absolutos, no con decrementos
 * por tick, para que no acumule drift aunque los ticks lleguen tarde.
 *
 * v2 — Sesiones multi-bloque: una sesión es una preparación inicial más una
 * lista de bloques { name, workSeconds, restSeconds, sets }. El motor compila
 * la sesión a una secuencia plana de intervalos y la recorre. La config
 * simple work/rest×sets (v1) se trata como sesión de un solo bloque, así que
 * la API original sigue funcionando igual.
 *
 * Fases: IDLE -> PREPARE -> (WORK -> REST) x sets x bloques -> DONE
 * (el REST tras el último set del último bloque se omite).
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
  blocks: { min: 1, max: 20 },
  nameLength: 40,
});

function clampNumber(value, { min, max }) {
  const n = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, n));
}

function clampName(value) {
  return typeof value === 'string' ? value.trim().slice(0, LIMITS.nameLength) : '';
}

export function clampConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  return {
    workSeconds: clampNumber(merged.workSeconds, LIMITS.workSeconds),
    restSeconds: clampNumber(merged.restSeconds, LIMITS.restSeconds),
    sets: clampNumber(merged.sets, LIMITS.sets),
    prepareSeconds: clampNumber(merged.prepareSeconds, LIMITS.prepareSeconds),
  };
}

function clampBlock(block) {
  const c = clampConfig(block);
  return {
    name: clampName(block?.name),
    workSeconds: c.workSeconds,
    restSeconds: c.restSeconds,
    sets: c.sets,
  };
}

/** Normaliza una sesión: nombre, preparación y 1..20 bloques válidos. */
export function clampSession(session) {
  const rawBlocks = Array.isArray(session?.blocks) ? session.blocks : [];
  const blocks = rawBlocks.slice(0, LIMITS.blocks.max).map(clampBlock);
  if (blocks.length === 0) blocks.push(clampBlock({}));
  return {
    name: clampName(session?.name),
    prepareSeconds: clampNumber(session?.prepareSeconds ?? DEFAULT_CONFIG.prepareSeconds, LIMITS.prepareSeconds),
    blocks,
  };
}

/** Config simple v1 -> sesión de un bloque. */
export function sessionFromConfig(config) {
  const c = clampConfig(config);
  return {
    name: '',
    prepareSeconds: c.prepareSeconds,
    blocks: [{ name: '', workSeconds: c.workSeconds, restSeconds: c.restSeconds, sets: c.sets }],
  };
}

/**
 * Compila la sesión a la secuencia plana de intervalos que recorre el motor.
 * El REST tras el último set del último bloque se omite; descanso 0 encadena
 * sets sin fase REST (estilo EMOM).
 */
export function compileSession(session) {
  const s = clampSession(session);
  const intervals = [];
  if (s.prepareSeconds > 0) {
    intervals.push({
      phase: Phase.PREPARE,
      label: '',
      durationMs: s.prepareSeconds * 1000,
      set: 1,
      totalSets: s.blocks[0].sets,
      blockIndex: 0,
      blockCount: s.blocks.length,
    });
  }
  s.blocks.forEach((block, blockIndex) => {
    const isLastBlock = blockIndex === s.blocks.length - 1;
    for (let set = 1; set <= block.sets; set++) {
      const base = { label: block.name, set, totalSets: block.sets, blockIndex, blockCount: s.blocks.length };
      intervals.push({ ...base, phase: Phase.WORK, durationMs: block.workSeconds * 1000 });
      const isLastSet = set === block.sets;
      if (block.restSeconds > 0 && !(isLastBlock && isLastSet)) {
        intervals.push({ ...base, phase: Phase.REST, durationMs: block.restSeconds * 1000 });
      }
    }
  });
  return intervals;
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

  /** API v1: config simple work/rest×sets (sesión de un bloque). */
  configure(config) {
    this.configureSession(sessionFromConfig(config));
  }

  /** API v2: sesión multi-bloque. */
  configureSession(session) {
    this.session = clampSession(session);
    const first = this.session.blocks[0];
    // Config legada derivada del primer bloque (compatibilidad de getState).
    this.config = {
      workSeconds: first.workSeconds,
      restSeconds: first.restSeconds,
      sets: first.sets,
      prepareSeconds: this.session.prepareSeconds,
    };
    this._sequence = compileSession(this.session);
    this._totalMs = this._sequence.reduce((sum, i) => sum + i.durationMs, 0);
    this._reset();
  }

  _reset() {
    this.phase = Phase.IDLE;
    this.running = false;
    this._index = -1;
    const firstWork = this._sequence.find((i) => i.phase === Phase.WORK);
    this._phaseDurationMs = firstWork.durationMs;
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
      this._enterInterval(0);
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
    // Puede encadenar varios intervalos si el proceso estuvo suspendido mucho tiempo.
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

  _current() {
    return this._index >= 0 && this._index < this._sequence.length ? this._sequence[this._index] : null;
  }

  /** Próximo intervalo WORK después de la posición actual (para "SIGUIENTE:"). */
  _nextWork() {
    for (let i = this._index + 1; i < this._sequence.length; i++) {
      if (this._sequence[i].phase === Phase.WORK) return this._sequence[i];
    }
    return null;
  }

  _enterInterval(index) {
    this._index = index;
    const interval = this._sequence[index];
    this.phase = interval.phase;
    this._phaseDurationMs = interval.durationMs;
    this._remainingMs = interval.durationMs;
    this._lastWholeSecond = null;
    const next = this._nextWork();
    this._onEvent({
      type: 'phaseChange',
      phase: interval.phase,
      label: interval.label,
      nextUp: next ? next.label : null,
      currentSet: interval.set,
      totalSets: interval.totalSets,
      blockIndex: interval.blockIndex,
      blockCount: interval.blockCount,
    });
  }

  _advance(overflowMs) {
    if (this._index + 1 >= this._sequence.length) {
      this._complete();
      return;
    }
    this._enterInterval(this._index + 1);
    // El sobrante se descuenta; si supera el intervalo entero, el loop de
    // tick() verá restante negativo y volverá a avanzar con el overflow correcto.
    this._remainingMs -= overflowMs;
    if (this.running) {
      this._endsAt = this._now() + this._remainingMs;
    }
  }

  _complete() {
    this.phase = Phase.DONE;
    this.running = false;
    this._index = this._sequence.length;
    this._remainingMs = 0;
    this._phaseDurationMs = 1;
    this._onEvent({ type: 'complete', totalSets: this.config.sets });
  }

  getState() {
    const remainingMs = this.running
      ? Math.max(0, this._endsAt - this._now())
      : this._remainingMs;
    const current = this._current();
    const next = this._nextWork();
    const firstBlock = this.session.blocks[0];
    const lastBlock = this.session.blocks[this.session.blocks.length - 1];
    // Progreso total de la sesión: intervalos ya recorridos + avance del actual.
    let elapsedMs = 0;
    if (this.phase === Phase.DONE) {
      elapsedMs = this._totalMs;
    } else if (this._index >= 0) {
      for (let i = 0; i < this._index; i++) elapsedMs += this._sequence[i].durationMs;
      elapsedMs += Math.max(0, this._phaseDurationMs - remainingMs);
    }
    return {
      phase: this.phase,
      running: this.running,
      label: current ? current.label : (this.phase === Phase.DONE ? lastBlock.name : firstBlock.name),
      nextUp: next ? next.label : null,
      currentSet: current ? current.set : (this.phase === Phase.DONE ? lastBlock.sets : 1),
      totalSets: current ? current.totalSets : (this.phase === Phase.DONE ? lastBlock.sets : firstBlock.sets),
      blockIndex: current ? current.blockIndex : (this.phase === Phase.DONE ? this.session.blocks.length - 1 : 0),
      blockCount: this.session.blocks.length,
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      progress: this._phaseDurationMs > 0 ? Math.min(1, Math.max(0, remainingMs / this._phaseDurationMs)) : 0,
      sessionProgress: this._totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / this._totalMs)) : 0,
      config: { ...this.config },
      session: this.session,
    };
  }
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

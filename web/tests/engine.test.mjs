import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TimerEngine, Phase, clampConfig, formatTime } from '../js/engine.js';

/** Reloj falso controlable para simular paso del tiempo. */
function fakeClock(startMs = 0) {
  let now = startMs;
  return {
    now: () => now,
    advance(ms) { now += ms; },
  };
}

function makeEngine(config = {}, events = []) {
  const clock = fakeClock();
  const engine = new TimerEngine(config, {
    now: clock.now,
    onEvent: (e) => events.push(e),
  });
  return { engine, clock, events };
}

describe('clampConfig', () => {
  test('aplica valores por defecto', () => {
    const c = clampConfig({});
    assert.equal(c.workSeconds, 45);
    assert.equal(c.restSeconds, 90);
    assert.equal(c.sets, 5);
  });

  test('limita valores fuera de rango', () => {
    const c = clampConfig({ workSeconds: 99999, restSeconds: -10, sets: 0, prepareSeconds: 500 });
    assert.equal(c.workSeconds, 3600);
    assert.equal(c.restSeconds, 0);
    assert.equal(c.sets, 1);
    assert.equal(c.prepareSeconds, 60);
  });

  test('valores no numéricos caen al mínimo', () => {
    const c = clampConfig({ workSeconds: NaN, sets: 'abc' });
    assert.equal(c.workSeconds, 5);
    assert.equal(c.sets, 1);
  });
});

describe('formatTime', () => {
  test('formatea mm:ss', () => {
    assert.equal(formatTime(0), '00:00');
    assert.equal(formatTime(65), '01:05');
    assert.equal(formatTime(3600), '60:00');
  });

  test('negativos se muestran como 00:00', () => {
    assert.equal(formatTime(-5), '00:00');
  });
});

describe('ciclo de fases', () => {
  test('inicia en IDLE con duración de trabajo', () => {
    const { engine } = makeEngine({ workSeconds: 30, restSeconds: 10, sets: 3 });
    const s = engine.getState();
    assert.equal(s.phase, Phase.IDLE);
    assert.equal(s.remainingSeconds, 30);
    assert.equal(s.running, false);
  });

  test('start con preparación entra en PREPARE', () => {
    const { engine } = makeEngine({ prepareSeconds: 5 });
    engine.start();
    assert.equal(engine.getState().phase, Phase.PREPARE);
    assert.equal(engine.getState().remainingSeconds, 5);
  });

  test('start sin preparación entra directo en WORK', () => {
    const { engine } = makeEngine({ prepareSeconds: 0 });
    engine.start();
    assert.equal(engine.getState().phase, Phase.WORK);
  });

  test('secuencia completa: prepare -> work -> rest -> work ... -> done', () => {
    const { engine, clock } = makeEngine({ workSeconds: 10, restSeconds: 5, sets: 2, prepareSeconds: 3 });
    engine.start();

    clock.advance(3000); engine.tick();
    assert.equal(engine.getState().phase, Phase.WORK);
    assert.equal(engine.getState().currentSet, 1);

    clock.advance(10000); engine.tick();
    assert.equal(engine.getState().phase, Phase.REST);

    clock.advance(5000); engine.tick();
    assert.equal(engine.getState().phase, Phase.WORK);
    assert.equal(engine.getState().currentSet, 2);

    // Último set: termina sin descanso final
    clock.advance(10000); engine.tick();
    const s = engine.getState();
    assert.equal(s.phase, Phase.DONE);
    assert.equal(s.running, false);
  });

  test('descanso 0 encadena sets sin fase REST (estilo EMOM)', () => {
    const { engine, clock } = makeEngine({ workSeconds: 60, restSeconds: 0, sets: 3, prepareSeconds: 0 });
    engine.start();
    clock.advance(60000); engine.tick();
    assert.equal(engine.getState().phase, Phase.WORK);
    assert.equal(engine.getState().currentSet, 2);
    clock.advance(120000); engine.tick();
    assert.equal(engine.getState().phase, Phase.DONE);
  });
});

describe('exactitud sin drift', () => {
  test('ticks tardíos no atrasan el timer', () => {
    const { engine, clock } = makeEngine({ workSeconds: 10, restSeconds: 5, sets: 1, prepareSeconds: 0 });
    engine.start();
    // Ticks irregulares: 3.7s tarde acumulado
    clock.advance(1300); engine.tick();
    clock.advance(2400); engine.tick();
    clock.advance(6300); engine.tick();
    // Pasaron exactamente 10s de reloj real -> fase terminada
    assert.equal(engine.getState().phase, Phase.DONE);
  });

  test('overflow se descuenta de la fase siguiente', () => {
    const { engine, clock } = makeEngine({ workSeconds: 10, restSeconds: 20, sets: 2, prepareSeconds: 0 });
    engine.start();
    // El tick llega 4s después de terminar work: rest debe arrancar con 16s
    clock.advance(14000); engine.tick();
    const s = engine.getState();
    assert.equal(s.phase, Phase.REST);
    assert.equal(s.remainingSeconds, 16);
  });

  test('suspensión larga avanza múltiples fases', () => {
    const { engine, clock } = makeEngine({ workSeconds: 10, restSeconds: 10, sets: 3, prepareSeconds: 0 });
    engine.start();
    // 35s sin ticks (pestaña en segundo plano): work(10)+rest(10)+work(10)+5 de rest
    clock.advance(35000); engine.tick();
    const s = engine.getState();
    assert.equal(s.phase, Phase.REST);
    assert.equal(s.currentSet, 2);
    assert.equal(s.remainingSeconds, 5);
  });
});

describe('pausa y reanudación', () => {
  test('pause congela el tiempo restante', () => {
    const { engine, clock } = makeEngine({ workSeconds: 30, prepareSeconds: 0 });
    engine.start();
    clock.advance(10000); engine.tick();
    engine.pause();
    clock.advance(60000); engine.tick();
    assert.equal(engine.getState().remainingSeconds, 20);
    assert.equal(engine.getState().running, false);
  });

  test('resume continúa donde quedó', () => {
    const { engine, clock } = makeEngine({ workSeconds: 30, restSeconds: 5, sets: 1, prepareSeconds: 0 });
    engine.start();
    clock.advance(10000); engine.tick();
    engine.pause();
    clock.advance(99000);
    engine.start();
    clock.advance(20000); engine.tick();
    assert.equal(engine.getState().phase, Phase.DONE);
  });

  test('toggle alterna entre correr y pausa', () => {
    const { engine } = makeEngine({});
    engine.toggle();
    assert.equal(engine.getState().running, true);
    engine.toggle();
    assert.equal(engine.getState().running, false);
  });
});

describe('ajustes en vivo', () => {
  test('addSeconds positivo extiende la fase (descansar más)', () => {
    const { engine, clock } = makeEngine({ workSeconds: 10, restSeconds: 30, sets: 2, prepareSeconds: 0 });
    engine.start();
    clock.advance(10000); engine.tick(); // entra en REST con 30s
    engine.addSeconds(15);
    assert.equal(engine.getState().remainingSeconds, 45);
  });

  test('addSeconds negativo adelanta', () => {
    const { engine, clock } = makeEngine({ workSeconds: 60, prepareSeconds: 0 });
    engine.start();
    clock.advance(5000); engine.tick();
    engine.addSeconds(-20);
    assert.equal(engine.getState().remainingSeconds, 35);
  });

  test('addSeconds no baja de 1s (no salta fase implícitamente)', () => {
    const { engine } = makeEngine({ workSeconds: 10, prepareSeconds: 0 });
    engine.start();
    engine.addSeconds(-999);
    assert.equal(engine.getState().remainingSeconds, 1);
    assert.equal(engine.getState().phase, Phase.WORK);
  });

  test('addSeconds funciona en pausa', () => {
    const { engine, clock } = makeEngine({ workSeconds: 30, prepareSeconds: 0 });
    engine.start();
    clock.advance(10000); engine.tick();
    engine.pause();
    engine.addSeconds(10);
    assert.equal(engine.getState().remainingSeconds, 30);
  });

  test('addSeconds en IDLE o DONE no hace nada', () => {
    const { engine } = makeEngine({ workSeconds: 30 });
    engine.addSeconds(10);
    assert.equal(engine.getState().remainingSeconds, 30);
  });

  test('skipPhase corta WORK y pasa a REST', () => {
    const { engine, clock } = makeEngine({ workSeconds: 60, restSeconds: 20, sets: 2, prepareSeconds: 0 });
    engine.start();
    clock.advance(5000); engine.tick();
    engine.skipPhase();
    const s = engine.getState();
    assert.equal(s.phase, Phase.REST);
    assert.equal(s.remainingSeconds, 20);
  });

  test('skipPhase en el último REST avanza al siguiente set', () => {
    const { engine, clock } = makeEngine({ workSeconds: 10, restSeconds: 30, sets: 2, prepareSeconds: 0 });
    engine.start();
    clock.advance(10000); engine.tick();
    engine.skipPhase();
    assert.equal(engine.getState().phase, Phase.WORK);
    assert.equal(engine.getState().currentSet, 2);
  });
});

describe('reset y reinicio', () => {
  test('reset vuelve a IDLE conservando config', () => {
    const { engine, clock } = makeEngine({ workSeconds: 25, restSeconds: 10, sets: 4, prepareSeconds: 0 });
    engine.start();
    clock.advance(40000); engine.tick();
    engine.reset();
    const s = engine.getState();
    assert.equal(s.phase, Phase.IDLE);
    assert.equal(s.currentSet, 1);
    assert.equal(s.remainingSeconds, 25);
    assert.equal(s.config.sets, 4);
  });

  test('start tras DONE reinicia automáticamente', () => {
    const { engine, clock } = makeEngine({ workSeconds: 5, restSeconds: 5, sets: 1, prepareSeconds: 0 });
    engine.start();
    clock.advance(5000); engine.tick();
    assert.equal(engine.getState().phase, Phase.DONE);
    engine.start();
    assert.equal(engine.getState().phase, Phase.WORK);
    assert.equal(engine.getState().running, true);
  });
});

describe('eventos', () => {
  test('emite phaseChange, countdown y complete', () => {
    const events = [];
    const { engine, clock } = (() => {
      const clock = fakeClock();
      const engine = new TimerEngine(
        { workSeconds: 5, restSeconds: 5, sets: 1, prepareSeconds: 0 },
        { now: clock.now, onEvent: (e) => events.push(e) }
      );
      return { engine, clock };
    })();

    engine.start();
    // tick segundo a segundo para capturar countdown 3,2,1
    for (let i = 0; i < 5; i++) {
      clock.advance(1000);
      engine.tick();
    }

    const types = events.map((e) => e.type);
    assert.ok(types.includes('phaseChange'));
    assert.ok(types.includes('complete'));
    const countdowns = events.filter((e) => e.type === 'countdown').map((e) => e.secondsLeft);
    assert.deepEqual(countdowns, [3, 2, 1]);
  });
});

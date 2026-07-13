/**
 * Capa de UI: conecta TimerEngine con el DOM, storage y audio.
 * Render loop con setInterval(100ms); el engine calcula contra el reloj
 * real, así que un tick tardío no atrasa el timer.
 */

import { TimerEngine, Phase, formatTime, clampConfig, LIMITS } from './engine.js';
import { BUILTIN_PRESETS, loadRoutines, saveRoutine, deleteRoutine, loadLastConfig, saveLastConfig } from './storage.js';
import { cues } from './audio.js';

const $ = (id) => document.getElementById(id);

const els = {
  time: $('time-display'),
  phase: $('phase-display'),
  sets: $('set-display'),
  dial: $('dial-progress'),
  presetLabel: $('preset-label'),
  toggle: $('btn-toggle'),
  reset: $('btn-reset'),
  minus: $('btn-minus'),
  plus: $('btn-plus'),
  skip: $('btn-skip'),
  work: $('input-work'),
  rest: $('input-rest'),
  sets_: $('input-sets'),
  prepare: $('input-prepare'),
  routineName: $('input-routine-name'),
  save: $('btn-save'),
  presetList: $('preset-list'),
};

const DASH = 2 * Math.PI * 88;

const PHASE_TEXT = {
  [Phase.IDLE]: 'PREPARADO',
  [Phase.PREPARE]: 'PREPÁRATE',
  [Phase.WORK]: 'ENTRENAR',
  [Phase.REST]: 'DESCANSO',
  [Phase.DONE]: 'COMPLETADO',
};

const PHASE_CLASS = {
  [Phase.IDLE]: 'phase-idle',
  [Phase.PREPARE]: 'phase-prepare',
  [Phase.WORK]: 'phase-work',
  [Phase.REST]: 'phase-rest',
  [Phase.DONE]: 'phase-done',
};

const PHASE_COLOR = {
  [Phase.IDLE]: '#9aa6b2',
  [Phase.PREPARE]: '#4f9cf0',
  [Phase.WORK]: '#ef8354',
  [Phase.REST]: '#2a9d8f',
  [Phase.DONE]: '#ffd166',
};

let selectedPresetName = 'Personalizado';
let wakeLock = null;

const engine = new TimerEngine(loadLastConfig() ?? {}, {
  onEvent(event) {
    if (event.type === 'countdown') cues.countdown();
    if (event.type === 'phaseChange') {
      if (event.phase === Phase.WORK) cues.workStart();
      if (event.phase === Phase.REST) cues.restStart();
    }
    if (event.type === 'complete') {
      cues.complete();
      releaseWakeLock();
    }
  },
});

// ---- Wake lock: evita que se apague la pantalla en móvil durante la sesión ----

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* no soportado o denegado */ }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && engine.getState().running) requestWakeLock();
});

// ---- Render ----

function render() {
  const state = engine.getState();
  els.time.textContent = formatTime(state.remainingSeconds);
  els.phase.textContent = PHASE_TEXT[state.phase];
  els.phase.className = `phase ${PHASE_CLASS[state.phase]}`;
  els.sets.textContent = `Set ${state.currentSet} / ${state.totalSets}`;
  els.dial.style.strokeDashoffset = String(DASH * (1 - state.progress));
  els.dial.style.stroke = PHASE_COLOR[state.phase];
  els.toggle.textContent = state.phase === Phase.DONE ? 'Otra vez' : state.running ? 'Pausar' : 'Iniciar';
  els.toggle.classList.toggle('running', state.running);
  els.presetLabel.textContent = `Preset: ${selectedPresetName}`;
  document.title = state.running
    ? `${formatTime(state.remainingSeconds)} ${PHASE_TEXT[state.phase]} · TimerGym`
    : 'TimerGym';
}

setInterval(() => {
  engine.tick();
  render();
}, 100);

// ---- Configuración ----

function readConfigFromInputs() {
  return clampConfig({
    workSeconds: Number(els.work.value),
    restSeconds: Number(els.rest.value),
    sets: Number(els.sets_.value),
    prepareSeconds: Number(els.prepare.value),
  });
}

function writeConfigToInputs(config) {
  els.work.value = config.workSeconds;
  els.rest.value = config.restSeconds;
  els.sets_.value = config.sets;
  els.prepare.value = config.prepareSeconds;
}

function applyConfig(config, presetName = 'Personalizado') {
  const clamped = clampConfig(config);
  engine.configure(clamped);
  writeConfigToInputs(clamped);
  saveLastConfig(clamped);
  selectedPresetName = presetName;
  renderPresets();
  render();
}

for (const input of [els.work, els.rest, els.sets_, els.prepare]) {
  input.addEventListener('change', () => applyConfig(readConfigFromInputs()));
}

// ---- Rutinas / presets ----

function allRoutines() {
  return [...BUILTIN_PRESETS, ...loadRoutines()];
}

function renderPresets() {
  els.presetList.innerHTML = '';
  for (const routine of allRoutines()) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip' + (routine.name === selectedPresetName ? ' active' : '');
    chip.textContent = `${routine.name} · ${routine.workSeconds}/${routine.restSeconds}×${routine.sets}`;
    chip.addEventListener('click', () => applyConfig(routine, routine.name));

    if (!routine.builtin) {
      const del = document.createElement('span');
      del.className = 'delete';
      del.textContent = '✕';
      del.title = `Borrar ${routine.name}`;
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRoutine(routine.name);
        if (selectedPresetName === routine.name) selectedPresetName = 'Personalizado';
        renderPresets();
      });
      chip.appendChild(del);
    }
    els.presetList.appendChild(chip);
  }
}

els.save.addEventListener('click', () => {
  const name = els.routineName.value.trim();
  if (!name) {
    els.routineName.focus();
    return;
  }
  if (BUILTIN_PRESETS.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    els.routineName.value = '';
    els.routineName.placeholder = 'Ese nombre está reservado';
    return;
  }
  saveRoutine({ name, ...readConfigFromInputs() });
  selectedPresetName = name;
  els.routineName.value = '';
  renderPresets();
  render();
});

// ---- Controles ----

els.toggle.addEventListener('click', () => {
  cues.unlock();
  engine.toggle();
  if (engine.getState().running) requestWakeLock();
  else releaseWakeLock();
  render();
});

els.reset.addEventListener('click', () => {
  engine.reset();
  releaseWakeLock();
  render();
});

els.minus.addEventListener('click', () => { engine.addSeconds(-10); render(); });
els.plus.addEventListener('click', () => { engine.addSeconds(10); render(); });
els.skip.addEventListener('click', () => { engine.skipPhase(); render(); });

// Atajos de teclado (versión web de escritorio)
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Space') { e.preventDefault(); els.toggle.click(); }
  if (e.key === 'r') els.reset.click();
  if (e.key === 's') els.skip.click();
  if (e.key === '+' || e.key === 'ArrowUp') els.plus.click();
  if (e.key === '-' || e.key === 'ArrowDown') els.minus.click();
});

// ---- Init ----

writeConfigToInputs(engine.getState().config);
els.work.min = LIMITS.workSeconds.min;
renderPresets();
render();

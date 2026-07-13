/**
 * Capa de UI: conecta TimerEngine con el DOM, storage y audio.
 * Render loop con setInterval(100ms); el engine calcula contra el reloj
 * real, así que un tick tardío no atrasa el timer.
 *
 * v2: builder de sesiones multi-bloque (ejercicios con nombre, work/rest/sets
 * por bloque), display de siguiente ejercicio y toggle de sonido.
 */

import { TimerEngine, Phase, formatTime, clampSession, compileSession, LIMITS } from './engine.js';
import {
  BUILTIN_SESSIONS, loadSessions, saveSession, deleteSession,
  loadLastSession, saveLastSession, loadPrefs, savePrefs,
} from './storage.js';
import { cues, setSoundEnabled, isSoundEnabled } from './audio.js';

const $ = (id) => document.getElementById(id);

const els = {
  time: $('time-display'),
  phase: $('phase-display'),
  label: $('label-display'),
  sets: $('set-display'),
  dial: $('dial-progress'),
  sessionBar: $('session-bar'),
  nextUp: $('next-up'),
  nextUpLabel: $('next-up-label'),
  presetLabel: $('preset-label'),
  sound: $('btn-sound'),
  toggle: $('btn-toggle'),
  reset: $('btn-reset'),
  minus: $('btn-minus'),
  plus: $('btn-plus'),
  skip: $('btn-skip'),
  prepare: $('input-prepare'),
  blockList: $('block-list'),
  addBlock: $('btn-add-block'),
  sessionName: $('input-session-name'),
  save: $('btn-save'),
  sessionList: $('session-list'),
  blockTemplate: $('block-row-template'),
};

const DASH = 2 * Math.PI * 88;

const PHASE_TEXT = {
  [Phase.IDLE]: 'PREPARADO',
  [Phase.PREPARE]: 'PREPÁRATE',
  [Phase.WORK]: 'ENTRENAR',
  [Phase.REST]: 'DESCANSO',
  [Phase.DONE]: 'COMPLETADO',
};

let selectedName = 'Personalizado';
let draft = null; // sesión editable (fuente de verdad del builder)
let wakeLock = null;

const engine = new TimerEngine({}, {
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
  els.label.textContent = state.phase === Phase.WORK || state.phase === Phase.REST ? state.label : '';
  const setText = `SET ${state.currentSet}/${state.totalSets}`;
  els.sets.textContent = state.blockCount > 1
    ? `${setText} · BLOQUE ${state.blockIndex + 1}/${state.blockCount}`
    : setText;
  els.dial.style.strokeDashoffset = String(DASH * (1 - state.progress));
  els.sessionBar.style.width = `${(state.sessionProgress * 100).toFixed(1)}%`;

  document.body.className = `phase-${state.phase}`;

  const showNext = state.running && state.phase !== Phase.DONE;
  els.nextUp.hidden = !showNext;
  if (showNext) {
    els.nextUpLabel.textContent = state.nextUp !== null
      ? (state.nextUp || 'Siguiente set')
      : 'FIN DE SESIÓN';
  }

  els.toggle.textContent = state.phase === Phase.DONE ? 'OTRA VEZ' : state.running ? 'PAUSAR' : 'INICIAR';
  els.toggle.classList.toggle('running', state.running);
  els.presetLabel.textContent = selectedName;
  document.title = state.running
    ? `${formatTime(state.remainingSeconds)} ${PHASE_TEXT[state.phase]} · TimerGym`
    : 'TimerGym';
}

setInterval(() => {
  engine.tick();
  render();
}, 100);

// ---- Builder de sesión ----

/**
 * Normaliza el draft, reconfigura el motor y re-renderiza todo.
 * clampSession crea objetos nuevos, así que las filas del builder deben
 * reconstruirse siempre: si no, sus listeners quedan apuntando a bloques
 * huérfanos y las ediciones siguientes se pierden.
 */
function applyDraft({ rename = true } = {}) {
  draft = clampSession(draft);
  engine.configureSession(draft);
  saveLastSession(draft);
  if (rename) selectedName = 'Personalizado';
  renderBuilder();
  renderSessions();
  render();
}

function loadIntoBuilder(session, name) {
  draft = clampSession(structuredClone(session));
  selectedName = name;
  engine.configureSession(draft);
  saveLastSession(draft);
  renderBuilder();
  renderSessions();
  render();
}

function renderBuilder() {
  els.prepare.value = draft.prepareSeconds;
  els.blockList.innerHTML = '';
  draft.blocks.forEach((block, index) => {
    const row = els.blockTemplate.content.cloneNode(true);
    const root = row.querySelector('.block-row');
    const name = row.querySelector('.block-name');
    const work = row.querySelector('.block-work');
    const rest = row.querySelector('.block-rest');
    const sets = row.querySelector('.block-sets');

    name.value = block.name;
    work.value = block.workSeconds;
    rest.value = block.restSeconds;
    sets.value = block.sets;

    name.addEventListener('change', () => { block.name = name.value; applyDraft(); });
    work.addEventListener('change', () => { block.workSeconds = Number(work.value); applyDraft(); });
    rest.addEventListener('change', () => { block.restSeconds = Number(rest.value); applyDraft(); });
    sets.addEventListener('change', () => { block.sets = Number(sets.value); applyDraft(); });

    row.querySelector('.block-up').addEventListener('click', () => moveBlock(index, -1));
    row.querySelector('.block-down').addEventListener('click', () => moveBlock(index, 1));
    const del = row.querySelector('.block-delete');
    del.disabled = draft.blocks.length <= 1;
    del.addEventListener('click', () => {
      draft.blocks.splice(index, 1);
      applyDraft();
    });

    root.dataset.index = String(index);
    els.blockList.appendChild(row);
  });
}

function moveBlock(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= draft.blocks.length) return;
  const [block] = draft.blocks.splice(index, 1);
  draft.blocks.splice(target, 0, block);
  applyDraft();
}

els.prepare.addEventListener('change', () => {
  draft.prepareSeconds = Number(els.prepare.value);
  applyDraft();
});

els.addBlock.addEventListener('click', () => {
  if (draft.blocks.length >= LIMITS.blocks.max) return;
  const last = draft.blocks[draft.blocks.length - 1];
  draft.blocks.push({ ...last, name: '' });
  applyDraft();
});

// ---- Sesiones guardadas ----

function allSessions() {
  return [...BUILTIN_SESSIONS, ...loadSessions()];
}

function sessionDetail(session) {
  if (session.blocks.length === 1) {
    const b = session.blocks[0];
    return `${b.workSeconds}/${b.restSeconds}×${b.sets}`;
  }
  const totalMs = compileSession(session).reduce((sum, i) => sum + i.durationMs, 0);
  return `${session.blocks.length} bloques · ${Math.round(totalMs / 60000)} min`;
}

function renderSessions() {
  els.sessionList.innerHTML = '';
  for (const session of allSessions()) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip' + (session.name === selectedName ? ' active' : '');

    const title = document.createElement('span');
    title.textContent = session.name;
    const detail = document.createElement('span');
    detail.className = 'chip-detail';
    detail.textContent = sessionDetail(session);
    chip.append(title, detail);
    chip.addEventListener('click', () => loadIntoBuilder(session, session.name));

    if (!session.builtin) {
      const del = document.createElement('span');
      del.className = 'delete';
      del.textContent = '✕';
      del.title = `Borrar ${session.name}`;
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSession(session.name);
        if (selectedName === session.name) selectedName = 'Personalizado';
        renderSessions();
      });
      chip.appendChild(del);
    }
    els.sessionList.appendChild(chip);
  }
}

els.save.addEventListener('click', () => {
  const name = els.sessionName.value.trim();
  if (!name) {
    els.sessionName.focus();
    return;
  }
  if (BUILTIN_SESSIONS.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    els.sessionName.value = '';
    els.sessionName.placeholder = 'Ese nombre está reservado';
    return;
  }
  draft.name = name;
  saveSession(draft);
  selectedName = name;
  els.sessionName.value = '';
  renderSessions();
  render();
});

// ---- Sonido ----

function renderSound() {
  const on = isSoundEnabled();
  els.sound.textContent = on ? '🔊' : '🔇';
  els.sound.classList.toggle('muted', !on);
}

els.sound.addEventListener('click', () => {
  setSoundEnabled(!isSoundEnabled());
  savePrefs({ sound: isSoundEnabled() });
  renderSound();
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

setSoundEnabled(loadPrefs().sound);
draft = clampSession(loadLastSession() ?? structuredClone(BUILTIN_SESSIONS[0]));
engine.configureSession(draft);
renderSound();
renderBuilder();
renderSessions();
render();

/**
 * Persistencia en localStorage: sesiones guardadas, última sesión usada y
 * preferencias. Tolerante a storage no disponible (modo incógnito estricto).
 *
 * v2: las "rutinas" v1 (work/rest×sets planos) migran automáticamente a
 * sesiones de un bloque la primera vez que se carga.
 */

import { clampSession } from './engine.js';

const SESSIONS_KEY = 'timergym.sessions.v2';
const LAST_SESSION_KEY = 'timergym.lastSession.v2';
const PREFS_KEY = 'timergym.prefs.v1';

// Claves v1 (solo para migración)
const ROUTINES_KEY_V1 = 'timergym.routines.v1';
const LAST_CONFIG_KEY_V1 = 'timergym.lastConfig.v1';

export const BUILTIN_SESSIONS = Object.freeze([
  {
    name: 'Fuerza',
    prepareSeconds: 5,
    blocks: [{ name: '', workSeconds: 45, restSeconds: 90, sets: 5 }],
    builtin: true,
  },
  {
    name: 'HIIT',
    prepareSeconds: 5,
    blocks: [{ name: '', workSeconds: 30, restSeconds: 30, sets: 10 }],
    builtin: true,
  },
  {
    name: 'Tabata',
    prepareSeconds: 5,
    blocks: [{ name: '', workSeconds: 20, restSeconds: 10, sets: 8 }],
    builtin: true,
  },
  {
    name: 'EMOM 10',
    prepareSeconds: 5,
    blocks: [{ name: '', workSeconds: 60, restSeconds: 0, sets: 10 }],
    builtin: true,
  },
  {
    name: 'Full Body',
    prepareSeconds: 10,
    blocks: [
      { name: 'Sentadillas', workSeconds: 40, restSeconds: 20, sets: 3 },
      { name: 'Flexiones', workSeconds: 30, restSeconds: 20, sets: 3 },
      { name: 'Plancha', workSeconds: 45, restSeconds: 30, sets: 3 },
      { name: 'Burpees', workSeconds: 30, restSeconds: 30, sets: 3 },
    ],
    builtin: true,
  },
]);

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage lleno o bloqueado: la app sigue funcionando sin persistir
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ídem */ }
}

/** Rutina v1 { name, workSeconds, restSeconds, sets, prepareSeconds } -> sesión. */
function sessionFromRoutineV1(routine) {
  return clampSession({
    name: routine?.name,
    prepareSeconds: routine?.prepareSeconds,
    blocks: [{
      name: '',
      workSeconds: routine?.workSeconds,
      restSeconds: routine?.restSeconds,
      sets: routine?.sets,
    }],
  });
}

function migrateV1() {
  const routines = read(ROUTINES_KEY_V1, null);
  if (Array.isArray(routines) && routines.length > 0) {
    const existing = read(SESSIONS_KEY, []);
    const migrated = routines.map(sessionFromRoutineV1);
    const names = new Set(existing.map((s) => s.name));
    write(SESSIONS_KEY, [...existing, ...migrated.filter((s) => !names.has(s.name))]);
  }
  remove(ROUTINES_KEY_V1);

  const lastConfig = read(LAST_CONFIG_KEY_V1, null);
  if (lastConfig && !read(LAST_SESSION_KEY, null)) {
    write(LAST_SESSION_KEY, sessionFromRoutineV1({ name: '', ...lastConfig }));
  }
  remove(LAST_CONFIG_KEY_V1);
}

export function loadSessions() {
  migrateV1();
  const saved = read(SESSIONS_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.map((s) => ({ ...clampSession(s), builtin: false }));
}

export function saveSession(session) {
  const clean = clampSession(session);
  const sessions = loadSessions().filter((s) => s.name !== clean.name);
  sessions.push({ ...clean, builtin: false });
  write(SESSIONS_KEY, sessions);
  return sessions;
}

export function deleteSession(name) {
  const sessions = loadSessions().filter((s) => s.name !== name);
  write(SESSIONS_KEY, sessions);
  return sessions;
}

export function loadLastSession() {
  migrateV1();
  const saved = read(LAST_SESSION_KEY, null);
  return saved ? clampSession(saved) : null;
}

export function saveLastSession(session) {
  write(LAST_SESSION_KEY, clampSession(session));
}

export function loadPrefs() {
  const prefs = read(PREFS_KEY, {});
  return { sound: prefs?.sound !== false }; // sonido activado por defecto
}

export function savePrefs(prefs) {
  write(PREFS_KEY, prefs);
}

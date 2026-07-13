/**
 * Persistencia en localStorage: rutinas guardadas y última configuración usada.
 * Tolerante a storage no disponible (modo incógnito estricto, etc.).
 */

const ROUTINES_KEY = 'timergym.routines.v1';
const LAST_CONFIG_KEY = 'timergym.lastConfig.v1';

export const BUILTIN_PRESETS = Object.freeze([
  { name: 'Fuerza', workSeconds: 45, restSeconds: 90, sets: 5, prepareSeconds: 5, builtin: true },
  { name: 'HIIT', workSeconds: 30, restSeconds: 30, sets: 10, prepareSeconds: 5, builtin: true },
  { name: 'Tabata', workSeconds: 20, restSeconds: 10, sets: 8, prepareSeconds: 5, builtin: true },
  { name: 'EMOM 10', workSeconds: 60, restSeconds: 0, sets: 10, prepareSeconds: 5, builtin: true },
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

export function loadRoutines() {
  const saved = read(ROUTINES_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

export function saveRoutine(routine) {
  const routines = loadRoutines().filter((r) => r.name !== routine.name);
  routines.push({ ...routine, builtin: false });
  write(ROUTINES_KEY, routines);
  return routines;
}

export function deleteRoutine(name) {
  const routines = loadRoutines().filter((r) => r.name !== name);
  write(ROUTINES_KEY, routines);
  return routines;
}

export function loadLastConfig() {
  return read(LAST_CONFIG_KEY, null);
}

export function saveLastConfig(config) {
  write(LAST_CONFIG_KEY, config);
}

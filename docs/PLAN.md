# Plan de implementación — TimerGym v2

Objetivo: sistema total de sesiones de entrenamiento (bloques de ejercicios con
tiempos propios), estética agresiva gamer/rocker, firmas sonoras por evento,
deploy web automático y APK generable por CI. Basado en
[`INVESTIGACION.md`](INVESTIGACION.md).

## Fases (cada una = 1+ commits)

### 1. Motor de sesiones multi-bloque (`feat`)
Generalizar `engine.js`: una **sesión** = preparación + lista de **bloques**
`{ name, workSeconds, restSeconds, sets }`. El motor compila la sesión a una
secuencia plana de intervalos y la recorre con el mismo modelo sin drift
(timestamps absolutos, overflow encadenado). Compatibilidad: la config simple
work/rest×sets se trata como sesión de un bloque.
- Estado nuevo expuesto: `label` (ejercicio actual), `next` (qué viene),
  bloque actual/total, progreso total de la sesión.
- Tests nuevos + los 26 existentes deben seguir pasando (API legacy intacta).

### 2. Persistencia v2 (`feat`)
`timergym.sessions.v1` para sesiones multi-bloque; migración automática de
rutinas v1 (pasan a sesiones de un bloque). Presets integrados se mantienen y
se agrega un preset de sesión completa de ejemplo.

### 3. Firmas sonoras (`feat`)
WebAudio sintetizado, cero assets, pensado para oírse sobre música:
- **Inicio de trabajo**: power chord agresivo (sawtooth + distorsión, grave).
- **Inicio de descanso**: doble tono descendente suave.
- **Countdown 3-2-1**: ticks percusivos.
- **Final de sesión**: riff ascendente de power chords (victoria).
- Toggle de sonido persistente.

### 4. UI: builder de sesiones + display (`feat`)
- Editor de bloques: agregar/quitar/reordenar, nombre + trabajo/descanso/sets.
- Display: ejercicio actual gigante, `SIGUIENTE: <ejercicio>`, bloque X/Y.
- Guardar/cargar/borrar sesiones con nombre.

### 5. Estética gamer/rocker (`feat`)
Negro profundo + rojo sangre + verde ácido, tipografía display condensada
en mayúsculas, cards angulares (clip-path), glow neón, scanlines sutiles,
pulso en fase de trabajo. Ícono nuevo (rayo/púa). Sin fuentes externas
(offline-first, cero dependencias).

### 6. CI/CD (`ci`)
- **GitHub Pages**: deploy automático de `web/` en cada push a `main`.
- **APK**: workflow con JDK 17 + Gradle 8.7 + SDK del runner; `assembleDebug`
  y APK como artifact descargable (y release en tags `v*`).

### 7. Auditoría (`fix`)
Correr tests, revisar casos borde del motor nuevo (overflow entre bloques,
addSeconds/skip en sesiones, restauración de config corrupta), probar la app
servida. Corregir lo encontrado.

### 8. Documentación (`docs`)
Actualizar `SISTEMA.md` (arquitectura v2), `MEJORAS.md`, `README.md`, `CLAUDE.md`.

## Fuera de alcance (pendientes futuros)

- Android nativo con sesiones multi-bloque (la PWA es la plataforma principal;
  el APK de CI compila la app simple actual).
- Voz sintetizada (SpeechSynthesis), historial de sesiones, compartir por URL,
  notificaciones en background — quedan en `MEJORAS.md`.

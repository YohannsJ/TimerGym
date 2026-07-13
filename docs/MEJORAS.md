# Mejoras

## Implementadas en v2 (esta iteración)

Basadas en [`INVESTIGACION.md`](INVESTIGACION.md) (lo que usuarios piden en
foros/reviews de apps de timer de gym). Ver [`PLAN.md`](PLAN.md).

| Mejora | Dónde | Commit |
|---|---|---|
| Motor de sesiones multi-bloque (ejercicios nombrados, cadencias por bloque) | `web/js/engine.js` | `feat(web): motor de sesiones multi-bloque` |
| Persistencia v2 + migración automática de rutinas v1 | `web/js/storage.js` | `feat(web): persistencia v2...` |
| Firmas sonoras diferenciadas (power chords con distorsión, sintetizadas) | `web/js/audio.js` | `feat(web): firmas sonoras...` |
| Builder visual de sesiones + display de siguiente ejercicio | `web/index.html`, `web/js/app.js` | `feat(web): builder de sesiones...` |
| Estética gamer/rocker (negro/rojo/ácido, clip-paths, glow, scanlines) | `web/styles.css`, ícono | ídem |
| Toggle de sonido persistente | `audio.js`, `app.js`, `storage.js` | ídem |
| Barra de progreso total de sesión | engine (`sessionProgress`) + UI | ídem |
| Deploy automático a GitHub Pages | `.github/workflows/pages.yml` | `ci: deploy...` |
| APK debug por CI (artifact + release en tags `v*`) | `.github/workflows/android.yml` | `ci: deploy...` |
| Fix: listeners del builder apuntaban a bloques huérfanos tras clamping | `web/js/app.js` | `fix(web): listeners...` |
| Fix: plugin Compose Compiler requerido por Kotlin 2.0 | Gradle files | `fix(android): ...` |
| 36 tests del motor (10 nuevos de sesiones) | `web/tests/engine.test.mjs` | — |

## Implementadas en v1

| Mejora | Dónde |
|---|---|
| PWA instalable y offline | `web/` completo |
| Motor sin drift: timestamps absolutos, overflow encadenado | `web/js/engine.js` |
| Fix de drift en Android: ticks anclados a `elapsedRealtime` | `app/.../TimerViewModel.kt` |
| Fase de preparación + preset EMOM | engine + storage |
| Wake Lock, atajos de teclado, título con tiempo restante | `web/js/app.js` |

## Pendientes (orden sugerido)

1. **Síntesis de voz**: anunciar el nombre del siguiente ejercicio con
   SpeechSynthesis API (cero assets) — el `nextUp` ya está en el estado y en
   los eventos del motor; es solo un cue más en `app.js`/`audio.js`.
2. **Historial de sesiones**: registrar sesiones completadas (fecha, sesión,
   duración real) en localStorage; vista de racha/calendario.
3. **Notificaciones**: avisar cambio de fase con la app en segundo plano
   (Notification API + service worker).
4. **Compartir sesiones**: serializar la sesión en la URL (`?s=...`) para
   mandarla por chat.
5. **Halfway beep opcional** en intervalos largos (>60s).
6. **Rondas de circuito**: repetir la lista completa de bloques N veces
   (hoy se logra duplicando bloques; sería azúcar en `compileSession`).
7. **Android: adoptar el motor de sesiones** (portar el modelo de intervalos
   compilados y deadline absoluto de `engine.js` a `TimerViewModel`).
8. **Android: foreground service** para sobrevivir con pantalla bloqueada.
9. **Tests de UI web** (Playwright) si `app.js` sigue creciendo.

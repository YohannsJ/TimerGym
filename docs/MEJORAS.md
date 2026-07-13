# Mejoras

## Implementadas en esta iteración

| Mejora | Dónde |
|---|---|
| Versión web + móvil (PWA instalable, offline) | `web/` completo |
| Motor sin drift: timestamps absolutos, overflow encadenado entre fases | `web/js/engine.js` |
| Fix de drift en Android: ticks anclados a `elapsedRealtime` | `app/.../TimerViewModel.kt` |
| Persistencia: rutinas guardadas con nombre + última config restaurada | `web/js/storage.js` |
| Fase de preparación (countdown antes del primer set) | engine + UI |
| Preset EMOM (descanso 0 encadena sets) | `storage.js` |
| Beeps WebAudio (countdown 3-2-1, cambio de fase, final) + vibración | `web/js/audio.js` |
| Wake Lock: pantalla no se apaga durante la sesión | `web/js/app.js` |
| Atajos de teclado en escritorio | `web/js/app.js` |
| Tiempo restante en el título de la pestaña | `web/js/app.js` |
| 26 tests unitarios del motor (reloj falso, deterministas) | `web/tests/engine.test.mjs` |
| Documentación del sistema | `docs/SISTEMA.md` |

## Pendientes (orden sugerido)

1. **Rutinas por intervalos arbitrarios**: secuencias tipo "30s sentadillas, 20s plancha, 60s descanso, repetir" en vez de work/rest fijos. El motor ya aísla la transición de fases en `_advance`; generalizar a una lista de intervalos.
2. **Notificaciones**: avisar cambio de fase con la app en segundo plano (Notification API + service worker). Hoy el timer sigue exacto en background, pero no avisa hasta volver.
3. **Historial de sesiones**: registrar sesiones completadas (fecha, rutina, duración real) en localStorage; vista de calendario/racha.
4. **Síntesis de voz**: anunciar "descanso", "última serie" con SpeechSynthesis API (cero assets).
5. **Compartir rutinas**: serializar rutina en la URL (`?r=...`) para mandarla por chat.
6. **Android: foreground service** para que el timer nativo sobreviva con pantalla bloqueada, con notificación persistente de control.
7. **Android: adoptar el mismo modelo del motor web** (deadline absoluto en vez de ticks de 1s) si se sigue invirtiendo en la app nativa; hoy el fix de anclaje corrige el drift pero el modelo web es más robusto ante suspensión.
8. **Tests de UI web** (Playwright) si la capa `app.js` crece.

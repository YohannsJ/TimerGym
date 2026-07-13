# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```powershell
npm test                              # Tests del motor (node:test, Node >= 18, sin dependencias)
node --test web/tests/engine.test.mjs # Equivalente directo (es el único archivo de tests)
npm start                             # Servir la PWA (npx serve web)
```

Android (requiere JDK 17 + SDK 35; el repo no incluye Gradle wrapper):

```powershell
gradle wrapper
./gradlew assembleDebug
```

## Arquitectura

Dos plataformas independientes que implementan el mismo timer de entrenamiento por sets (preparación → trabajo → descanso × N sets; el descanso final se omite):

- **`web/` — PWA (plataforma principal)**: HTML/CSS/JS vanilla, **cero dependencias y sin build step** — no introducir frameworks ni `node_modules`. Es una decisión de diseño deliberada (ver `docs/SISTEMA.md` §5).
- **`app/` — Android nativo**: Kotlin + Jetpack Compose. `MainActivity.kt` (UI) + `TimerViewModel.kt` (lógica).

### Capas de la web

- `web/js/engine.js` — **núcleo**: máquina de estados pura, sin DOM. Toda la lógica del timer vive acá.
- `web/js/storage.js` — persistencia en `localStorage` con claves versionadas (`timergym.*.v1`); tolerante a storage bloqueado.
- `web/js/audio.js` — beeps WebAudio (sin archivos de audio) + vibración.
- `web/js/app.js` — capa UI: conecta engine + storage + audio + DOM. Render loop de `setInterval(100ms)`.
- `web/sw.js` — service worker cache-first para offline.

### Invariante clave: sin drift (ambas plataformas)

El timer **nunca decrementa contadores por tick**. El motor guarda el timestamp absoluto de fin de fase (`_endsAt`) y cada `tick()` calcula el restante contra el reloj real; si la pestaña estuvo suspendida, `tick()` encadena varias fases de golpe y queda donde corresponde. En Android, el loop está anclado a `SystemClock.elapsedRealtime()`. Cualquier cambio al timing debe preservar este enfoque (los navegadores throttlean `setInterval` en segundo plano).

### Testabilidad del motor

`engine.js` recibe el reloj (`now`) y el receptor de eventos (`onEvent`) por inyección en el constructor. Los tests (`web/tests/engine.test.mjs`) corren con reloj falso, deterministas y sin esperas reales — mantener este patrón: lógica nueva va en el motor con tests, no en `app.js`.

## Documentación

- `docs/SISTEMA.md` — documentación completa: API del motor, eventos, límites de configuración (`LIMITS`), checklist de prueba manual, decisiones de diseño.
- `docs/MEJORAS.md` — mejoras hechas y pendientes.

Docs y UI están en español; mantener el idioma.

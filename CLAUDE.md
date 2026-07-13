# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```powershell
npm test                              # Tests del motor (node:test, Node >= 18, sin dependencias)
node --test web/tests/engine.test.mjs # Equivalente directo (es el único archivo de tests)
npm start                             # Servir la PWA (npx serve web)
```

Android: no hay toolchain local (sin JDK/SDK/Gradle); el APK lo compila el
workflow **Android APK** (JDK 17 + Gradle 8.7, sin wrapper). Release en tags `v*`.

## Deploy

- Push a `main` → workflow **Deploy web** corre `npm test` y publica `web/` en
  GitHub Pages: https://yohannsj.github.io/TimerGym/
- Repo: https://github.com/YohannsJ/TimerGym

## Arquitectura

Dos plataformas que implementan un timer de entrenamiento:

- **`web/` — PWA (plataforma principal)**: HTML/CSS/JS vanilla, **cero
  dependencias y sin build step** — no introducir frameworks, `node_modules`,
  fuentes ni assets externos (offline-first). Decisión deliberada
  (`docs/SISTEMA.md` §6).
- **`app/` — Android nativo**: Kotlin + Jetpack Compose. Mantiene el modelo
  simple v1 (work/rest×sets); la PWA es la que tiene sesiones multi-bloque.

### Capas de la web

- `web/js/engine.js` — **núcleo**: máquina de estados pura, sin DOM. Una sesión
  `{ name, prepareSeconds, blocks[] }` se compila (`compileSession`) a una
  secuencia plana de intervalos que el motor recorre. API v1 (`configure`) y
  v2 (`configureSession`) conviven.
- `web/js/storage.js` — `localStorage` con claves versionadas
  (`timergym.sessions.v2`, `lastSession.v2`, `prefs.v1`) y migración v1→v2;
  tolerante a storage bloqueado.
- `web/js/audio.js` — firmas sonoras sintetizadas (power chords WebAudio con
  WaveShaper) + vibración. Sin archivos de audio.
- `web/js/app.js` — capa UI. El draft de sesión del builder es la fuente de
  verdad; toda edición pasa por `applyDraft()` que clampa, reconfigura el motor
  y **reconstruye las filas del builder** (clampSession crea objetos nuevos:
  sin rebuild, los listeners quedan apuntando a bloques huérfanos).
- `web/sw.js` — service worker cache-first; **bump del nombre de cache**
  (`timergym-vN`) al cambiar assets.

### Invariante clave: sin drift (ambas plataformas)

El timer **nunca decrementa contadores por tick**. El motor guarda el timestamp
absoluto de fin de intervalo (`_endsAt`) y cada `tick()` calcula el restante
contra el reloj real; si la pestaña estuvo suspendida, `tick()` encadena varios
intervalos de golpe (el overflow cruza límites de bloque). En Android el loop
está anclado a `SystemClock.elapsedRealtime()`. Cualquier cambio al timing debe
preservar este enfoque.

### Testabilidad del motor

`engine.js` recibe el reloj (`now`) y el receptor de eventos (`onEvent`) por
inyección en el constructor. Los tests corren con reloj falso, deterministas —
lógica nueva va en el motor con tests, no en `app.js`.

### Estética

Tema gamer/rocker definido en `styles.css`: el color de fase se propaga con
`--phase-color` vía clases `body.phase-*`; cards angulares con `clip-path`.
Mantener alto contraste y `prefers-reduced-motion`.

## Documentación

- `docs/SISTEMA.md` — doc completa: API del motor, storage, CI/CD, checklist manual.
- `docs/INVESTIGACION.md` — qué esperan los usuarios (foros/reviews) y qué cubre la app.
- `docs/PLAN.md` — plan de la iteración v2.
- `docs/MEJORAS.md` — hechas y pendientes.

Docs, UI y commits en español; mantener el idioma. Commits estilo
Conventional Commits (`feat(web):`, `fix(android):`, `ci:`, `docs:`).

# Bitácora de sesiones de desarrollo

## 2026-07-13 — v2: sesiones, estética, sonidos, deploy y APK

**Pedido**: inicializar repo, desplegar en remoto, implementar web + móvil con
APK generable, auditar errores, plan de mejora pensando en un sistema total de
sesiones de entrenamiento con distintos tiempos, estética agresiva
gamer/rocker, sonidos de inicio/descanso/final, investigar en foros qué
esperan los usuarios, documentar todo con commits por feature/fix/doc.

**Estado del toolchain**: git + gh autenticado (cuenta YohannsJ); sin
JDK/Gradle/Android SDK local → APK se compila solo por CI.

### Cronología (commit por commit)

| Commit | Qué se hizo |
|---|---|
| `eb800c6 chore` | Commit inicial: estado v1 (PWA + Android básico) + `.gitignore`. Repo creado en GitHub y pusheado. |
| `61dabab docs` | Investigación de foros/reviews (`INVESTIGACION.md`) + plan por fases (`PLAN.md`). |
| `f8b71a1 feat(web)` | Motor de sesiones multi-bloque: `compileSession` a intervalos planos, `nextUp`, `sessionProgress`; API v1 intacta; 36 tests. |
| `ccc1f6d feat(web)` | Storage v2 (`sessions.v2`, `lastSession.v2`, `prefs.v1`) + migración automática v1→v2 + preset Full Body. |
| `bf22322 feat(web)` | Firmas sonoras: power chords con WaveShaper (trabajo/final), tonos suaves (descanso), ticks (countdown), toggle. |
| `10fc864 feat(web)` | Builder de bloques, display `SIGUIENTE ▸`, barra de sesión, estética gamer/rocker (negro/rojo/ácido, clip-paths, glow, scanlines), ícono nuevo, cache SW v2. |
| `cd39142 ci` | Workflows: `pages.yml` (test + deploy de `web/`) y `android.yml` (APK con JDK 17 + Gradle 8.7, release en tags `v*`). |
| `363d12d fix(web)` | **Auditoría**: listeners del builder quedaban apuntando a bloques huérfanos tras `clampSession` (ediciones se perdían); `applyDraft` ahora reconstruye filas siempre. |
| `bd416d2 fix(android)` | CI falló: Kotlin 2.0 exige plugin Compose Compiler. Agregado en Gradle files. |
| `8e974ce docs` | SISTEMA/MEJORAS/README/CLAUDE.md actualizados a v2. |
| `5090565 fix(android)` | CI falló: `Theme.Material3.*` no existe sin Material Components XML; tema cambiado a `android:Theme.Material.NoActionBar`. Build verde. |
| tag `v1.0.0` | Release con `app-debug.apk` publicada. |

### Incidencias de deploy

- GitHub Pages: `configure-pages` no pudo crear el sitio con el token del
  workflow (`Resource not accessible by integration`); se habilitó una vez vía
  `gh api repos/YohannsJ/TimerGym/pages -X POST -f build_type=workflow` y los
  deploys siguientes funcionaron solos.

### Resultado

- Web: https://yohannsj.github.io/TimerGym/ (deploy automático con tests).
- APK: https://github.com/YohannsJ/TimerGym/releases/tag/v1.0.0
- Tests: 36/36. Auditoría: 3 bugs encontrados y corregidos (tabla arriba).
- Pendientes priorizados: `MEJORAS.md` (voz, historial, notificaciones,
  rondas de circuito, portar sesiones a Android).

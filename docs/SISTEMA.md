# TimerGym — Documentación del sistema

Timer de entrenamiento por **sesiones multi-bloque**: cada sesión encadena
bloques de ejercicios con nombre y cadencias propias (trabajo/descanso/sets),
con firmas sonoras por evento, ajustes en vivo y estética gamer/rocker.

| Plataforma | Carpeta | Tecnología | Estado |
|---|---|---|---|
| Web + móvil (PWA) | `web/` | HTML/CSS/JS vanilla, sin dependencias | **Principal** — funcional, 36 tests |
| Android nativo | `app/` | Kotlin + Jetpack Compose | Funcional (timer simple v1); APK por CI |

- **Web desplegada**: https://yohannsj.github.io/TimerGym/ (deploy automático).
- **APK**: artifact del workflow "Android APK"; release automática en tags `v*`.
- Investigación de mercado que guió el diseño: [`INVESTIGACION.md`](INVESTIGACION.md).
- Plan de la iteración v2: [`PLAN.md`](PLAN.md).

---

## 1. Funcionalidades

- **Sesiones multi-bloque**: preparación inicial + hasta 20 bloques
  `{ ejercicio, trabajo, descanso, sets }`. El descanso tras el último set del
  último bloque se omite; descanso 0 encadena sets sin pausa (estilo EMOM).
- **Builder visual**: agregar/reordenar/quitar bloques, nombrar ejercicios.
- **Siguiente ejercicio**: barra `SIGUIENTE ▸` durante la sesión (lo que los
  usuarios más piden en foros: saber qué viene mientras descansan).
- **Presets integrados**: Fuerza (45/90×5), HIIT (30/30×10), Tabata (20/10×8),
  EMOM 10 (60/0×10) y Full Body (4 ejercicios × 3 sets, multi-bloque).
- **Sesiones guardadas**: persisten en `localStorage` sin límite; la última
  configuración se restaura al abrir.
- **Ajustes en vivo**: `-10s` (adelantar), `+10s` (extender), `Cortar` (saltar fase).
- **Firmas sonoras** (WebAudio sintetizado, cero assets, toggle persistente):
  - Inicio de trabajo: doble golpe de power chord grave (E2) con distorsión.
  - Descanso: dos tonos descendentes suaves (660→440 Hz).
  - Countdown 3-2-1: tick percusivo square 1.2 kHz.
  - Final: riff ascendente E2-G2-A2-E3.
  - Vibración en móvil (siempre, independiente del toggle de sonido).
- **Pantalla activa**: Wake Lock API durante la sesión.
- **Atajos** (escritorio): `Espacio` iniciar/pausar, `R` reiniciar, `S` cortar,
  `↑/+` extender, `↓/-` adelantar.
- **Offline**: service worker cache-first (`timergym-v2`).

## 2. Arquitectura web (`web/`)

```
web/
├── index.html              Estructura de la UI + template de fila de bloque
├── styles.css              Estética gamer/rocker (negro/rojo/ácido, clip-paths, glow)
├── manifest.webmanifest    Metadatos PWA (instalable)
├── sw.js                   Service worker (offline)
├── icons/icon.svg          Ícono: rayo ácido sobre arco de timer
├── js/
│   ├── engine.js           Motor del timer (puro, sin DOM) ← núcleo
│   ├── storage.js          Persistencia localStorage (+ migración v1→v2)
│   ├── audio.js            Firmas sonoras WebAudio + vibración
│   └── app.js              Capa UI: engine + storage + audio + DOM
└── tests/
    └── engine.test.mjs     36 tests del motor (node:test, sin dependencias)
```

### 2.1 Motor (`engine.js`)

Una **sesión** se compila a una secuencia plana de intervalos que el motor
recorre:

```
sesión { name, prepareSeconds, blocks[] }
  └─ compileSession() → [PREPARE?, (WORK → REST?) × sets × bloques]
IDLE ──start──▶ intervalo 0 ──▶ 1 ──▶ ... ──▶ DONE
```

**Decisión clave — sin drift:** el motor no decrementa un contador por tick.
Guarda el timestamp absoluto en que termina el intervalo (`_endsAt`) y cada
`tick()` calcula el restante contra el reloj real. Consecuencias:

- Un tick que llega tarde no atrasa el timer.
- Si el intervalo terminó hace X ms, ese sobrante (overflow) se descuenta del
  siguiente — incluso cruzando límites de bloque.
- Si la pestaña estuvo suspendida mucho tiempo, `tick()` encadena varios
  intervalos de golpe y queda exactamente donde debería según el reloj real.

**Inyección de dependencias:** el reloj (`now`) y el receptor de eventos
(`onEvent`) se inyectan en el constructor → tests deterministas con reloj falso.

**Eventos:** `phaseChange` (fase, `label`, `nextUp`, set, bloque),
`countdown` (3-2-1), `complete`.

**API:**

| Método | Efecto |
|---|---|
| `configure(config)` | API v1: work/rest×sets → sesión de un bloque |
| `configureSession(session)` | API v2: sesión multi-bloque (con clamping) y reset |
| `start()` / `pause()` / `toggle()` | Control; `start` tras DONE reinicia |
| `tick()` | Avanza contra el reloj; llamar ~cada 100ms |
| `addSeconds(delta)` | ±tiempo al intervalo actual (mínimo 1s, no salta fase) |
| `skipPhase()` | Corta el intervalo actual |
| `reset()` | Vuelve a IDLE conservando la sesión |
| `getState()` | fase, restante, progreso de fase y de sesión, `label`, `nextUp`, set/bloque |

Helpers exportados: `clampConfig`, `clampSession`, `sessionFromConfig`,
`compileSession`, `formatTime`, `LIMITS` (trabajo 5–3600s, descanso 0–3600s,
sets 1–100, preparación 0–60s, bloques 1–20, nombres ≤40 chars).

### 2.2 Persistencia (`storage.js`)

- `timergym.sessions.v2`: sesiones guardadas por el usuario.
- `timergym.lastSession.v2`: última sesión aplicada (se restaura al abrir).
- `timergym.prefs.v1`: preferencias (sonido on/off).
- **Migración automática v1→v2**: las rutinas planas de
  `timergym.routines.v1` / `lastConfig.v1` se convierten en sesiones de un
  bloque la primera vez que se carga; las claves viejas se eliminan.
- Tolerante a `localStorage` bloqueado: la app funciona sin persistir.

### 2.3 UI (`app.js`)

Render loop de `setInterval(100ms)`: llama `engine.tick()` y pinta. El draft
de sesión del builder es la fuente de verdad; cada edición pasa por
`applyDraft()` que **normaliza, reconfigura el motor y reconstruye las filas**
(los listeners deben recablearse porque `clampSession` crea objetos nuevos).
El color de fase se propaga por CSS custom property (`--phase-color` en
`body.phase-*`): dial, glow de card, sombras y botón principal reaccionan solos.

### 2.4 Estética

Gamer + rockero gym, sin fuentes ni assets externos (offline-first):
negro profundo `#050507`, rojo sangre `#ff2b2b`, verde ácido `#b6ff00`;
tipografía display condensada del sistema en mayúsculas; cards y botones
angulares con `clip-path`; scanlines sutiles; glow neón por fase; pulso del
reloj en WORK (respeta `prefers-reduced-motion`).

## 3. Arquitectura Android (`app/`)

- `MainActivity.kt`: UI Compose (dial Canvas, inputs, presets).
- `TimerViewModel.kt`: estado y lógica; ticks anclados a
  `SystemClock.elapsedRealtime()` para no acumular drift.
- Mantiene el modelo v1 (work/rest×sets). La PWA es la plataforma principal;
  llevar sesiones multi-bloque a Android está en `MEJORAS.md`.
- Compilación local: Android Studio o Gradle global (`gradle wrapper` +
  `./gradlew assembleDebug`). En CI compila sin wrapper (Gradle 8.7).

## 4. CI/CD (`.github/workflows/`)

| Workflow | Dispara | Hace |
|---|---|---|
| `pages.yml` | push a `main` | `npm test` → publica `web/` en GitHub Pages |
| `android.yml` | push que toque `app/**` o Gradle files; tags `v*` | `gradle assembleDebug` (JDK 17 + Gradle 8.7) → APK como artifact; release en tags |

## 5. Cómo ejecutar y probar

```powershell
# Tests del motor (36 tests, sin instalar nada, Node >= 18)
npm test

# Servir la versión web
npm start            # usa npx serve
# o: python -m http.server 8000 --directory web
```

Instalación en móvil: abrir https://yohannsj.github.io/TimerGym/ en el
navegador del teléfono → "Agregar a pantalla de inicio".

### Checklist de prueba manual

1. Preset Tabata → 5s preparación, alterna 20/10 ocho veces, termina sin descanso final.
2. Preset Full Body → recorre los 4 ejercicios en orden; el display muestra el
   ejercicio actual y `SIGUIENTE ▸` anuncia el próximo.
3. Builder: agregar bloque, renombrarlo, moverlo con ▲▼, quitarlo; cada cambio
   se refleja en el timer y persiste al recargar.
4. Pausar a mitad de fase → congelado exacto; reanudar continúa.
5. `+10s` / `-10s` → ajusta sin bajar de 1s; `Cortar` salta de fase.
6. Guardar sesión con nombre → chip con detalle; recargar → sigue; borrar (✕) → desaparece.
7. Sonidos: power chord al entrar a trabajo, tonos suaves al descanso, ticks
   3-2-1, riff al final; toggle 🔊/🔇 silencia todo menos la vibración.
8. Pestaña en segundo plano 1 min → al volver, el timer está donde corresponde.
9. Fase de trabajo → borde/glow rojo y pulso del reloj; descanso → verde.

## 6. Decisiones de diseño

- **PWA vanilla, cero dependencias**: sin build step, sin `node_modules`;
  el costo de un framework no se justifica para esta superficie.
- **Motor separado de la UI**: toda la lógica testeable sin navegador.
- **Sesión compilada a intervalos planos**: `_advance` no necesita conocer la
  estructura de bloques; overflow y skip funcionan igual en cualquier límite.
- **Timestamps en vez de contadores**: los navegadores throttlean `setInterval`
  en segundo plano; con contadores el timer quedaría inutilizable.
- **Sonido 100% sintetizado**: cero assets que cachear/cargar, y las firmas
  (grave distorsionado vs. agudo suave) se distinguen sobre música.
- **El descanso del último set se omite**: terminar el último ejercicio =
  sesión completada.

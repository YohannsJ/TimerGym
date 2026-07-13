# TimerGym — Documentación del sistema

Timer de entrenamiento por sets con fases de trabajo y descanso, cadencias
configurables, rutinas guardadas y ajustes en vivo. Dos plataformas:

| Plataforma | Carpeta | Tecnología | Estado |
|---|---|---|---|
| Web + móvil (PWA) | `web/` | HTML/CSS/JS vanilla, sin dependencias | Funcional, con tests |
| Android nativo | `app/` | Kotlin + Jetpack Compose | Funcional (requiere generar Gradle wrapper) |

La PWA es la versión recomendada para móvil: se instala desde el navegador
("Agregar a pantalla de inicio"), funciona offline y cubre Android e iOS.

---

## 1. Funcionalidades

- **Fases**: preparación (cuenta regresiva inicial) → trabajo → descanso, repetido por N sets. El descanso del último set se omite.
- **Cadencias**: trabajo, descanso, sets y preparación configurables por separado. Descanso = 0 encadena sets sin pausa (estilo EMOM).
- **Presets integrados**: Fuerza (45/90×5), HIIT (30/30×10), Tabata (20/10×8), EMOM 10 (60/0×10).
- **Rutinas guardadas**: nombre + configuración persisten en `localStorage`; se pueden borrar. La última configuración usada se restaura al abrir.
- **Ajustes en vivo**:
  - `-10s` adelanta la fase actual (terminar antes el descanso).
  - `+10s` extiende la fase actual (descansar más).
  - `Cortar fase` salta de inmediato a la siguiente fase.
- **Señales**: beeps (WebAudio, sin archivos de audio) y vibración en countdown 3-2-1, cambio de fase y final.
- **Pantalla activa**: Wake Lock API evita que el móvil se apague durante la sesión.
- **Atajos de teclado** (escritorio): `Espacio` iniciar/pausar, `R` reiniciar, `S` cortar fase, `↑/+` extender, `↓/-` adelantar.
- **Offline**: service worker con cache-first; la app funciona sin red tras la primera carga.

## 2. Arquitectura web (`web/`)

```
web/
├── index.html              Estructura de la UI
├── styles.css              Estilos (tema oscuro, responsive, safe-areas)
├── manifest.webmanifest    Metadatos PWA (instalable)
├── sw.js                   Service worker (offline)
├── icons/icon.svg          Ícono vectorial
├── js/
│   ├── engine.js           Motor del timer (puro, sin DOM) ← núcleo
│   ├── storage.js          Persistencia localStorage
│   ├── audio.js            Beeps WebAudio + vibración
│   └── app.js              Capa UI: conecta engine + storage + audio + DOM
└── tests/
    └── engine.test.mjs     26 tests del motor (node:test, sin dependencias)
```

### 2.1 Motor (`engine.js`)

Máquina de estados:

```
IDLE ──start──▶ PREPARE ──▶ WORK ──▶ REST ──▶ WORK ──▶ ... ──▶ DONE
                (si prepareSeconds=0, directo a WORK)
                (REST se omite tras el último set y si restSeconds=0)
```

**Decisión clave — sin drift:** el motor no decrementa un contador por tick.
Guarda el timestamp absoluto en que termina la fase (`_endsAt`) y cada
`tick()` calcula el restante contra el reloj real. Consecuencias:

- Un tick que llega tarde no atrasa el timer.
- Si la fase terminó hace X ms, ese sobrante (overflow) se descuenta de la fase siguiente.
- Si la pestaña estuvo suspendida mucho tiempo, `tick()` encadena varias fases de golpe y queda exactamente donde debería según el reloj real.

**Inyección de dependencias:** el reloj (`now`) y el receptor de eventos
(`onEvent`) se inyectan en el constructor. Por eso los tests corren con un
reloj falso, sin esperas reales y de forma determinista.

**Eventos emitidos:** `phaseChange` (con fase y set), `countdown`
(segundos 3, 2, 1 de cada fase), `complete`.

**API:**

| Método | Efecto |
|---|---|
| `configure(config)` | Aplica config (con clamping) y resetea |
| `start()` / `pause()` / `toggle()` | Control de ejecución; `start` tras DONE reinicia |
| `tick()` | Avanza estado contra el reloj; llamar ~cada 100ms |
| `addSeconds(delta)` | ±tiempo a la fase actual (mínimo 1s, no salta fase) |
| `skipPhase()` | Corta la fase actual |
| `reset()` | Vuelve a IDLE conservando config |
| `getState()` | Snapshot: fase, restante, progreso, set, config |

**Límites de configuración** (`LIMITS`): trabajo 5–3600s, descanso 0–3600s,
sets 1–100, preparación 0–60s. `clampConfig` corrige cualquier valor fuera
de rango o no numérico.

### 2.2 Persistencia (`storage.js`)

- `timergym.routines.v1`: array de rutinas guardadas por el usuario.
- `timergym.lastConfig.v1`: última configuración aplicada (se restaura al abrir).
- Claves versionadas (`.v1`) para poder migrar el esquema a futuro.
- Tolerante a `localStorage` bloqueado: la app funciona sin persistir.

### 2.3 UI (`app.js`)

Render loop de `setInterval(100ms)`: llama `engine.tick()` y pinta. Como el
motor calcula contra el reloj real, la precisión no depende del intervalo.
El dial circular es SVG con `stroke-dashoffset`. El título de la pestaña
muestra el tiempo restante cuando corre (útil en escritorio con la pestaña
en segundo plano).

## 3. Arquitectura Android (`app/`)

- `MainActivity.kt`: UI Compose (dial Canvas, inputs, presets).
- `TimerViewModel.kt`: estado y lógica. El loop de ticks está anclado a
  `SystemClock.elapsedRealtime()` para no acumular drift (antes usaba
  `delay(1000)` puro, que se atrasa).
- Compilación: requiere Android Studio o Gradle global (`gradle wrapper` y
  luego `./gradlew assembleDebug`). Ver README.

## 4. Cómo ejecutar y probar

```powershell
# Tests del motor (26 tests, sin instalar nada)
npm test
# o directamente:
node --test web/tests/engine.test.mjs

# Servir la versión web
npm start            # usa npx serve
# o cualquier servidor estático:
python -m http.server 8000 --directory web
```

Abrir `http://localhost:<puerto>`. Para instalar en móvil: abrir la URL en
el navegador del teléfono (misma red Wi-Fi, usar la IP de la PC) y elegir
"Agregar a pantalla de inicio". Nota: el service worker y la instalación
PWA requieren HTTPS o `localhost`; en red local se puede probar la app
igual, pero sin instalación/offline.

### Checklist de prueba manual

1. Iniciar con preset Tabata → cuenta 5s de preparación, luego alterna 20/10 ocho veces y termina sin descanso final.
2. Pausar a mitad de fase → el tiempo queda congelado; reanudar continúa exacto.
3. `+10s` durante descanso → suma 10s; `-10s` resta; nunca baja de 1s.
4. `Cortar fase` en trabajo → pasa a descanso; en el último descanso → siguiente set.
5. Guardar rutina con nombre → aparece como chip; recargar página → sigue ahí y la última config se restaura.
6. Borrar rutina (✕) → desaparece.
7. Beeps en 3-2-1 y al cambiar fase (en móvil, también vibración; requiere haber tocado Iniciar primero, por política de autoplay).
8. Dejar la pestaña en segundo plano 1 minuto → al volver, el timer está donde corresponde según el reloj real.

## 5. Decisiones de diseño

- **PWA vanilla, cero dependencias**: sin build step, sin `node_modules`, nada que actualizar; el costo de un framework no se justifica para esta superficie.
- **Motor separado de la UI**: permite testear toda la lógica sin navegador y reutilizarla si después se quiere envolver con Capacitor o un framework.
- **Timestamps en vez de contadores**: los navegadores throttlean `setInterval` en segundo plano (hasta 1 tick/minuto); con contadores el timer quedaría inutilizable en móvil con pantalla apagada momentánea.
- **El descanso del último set se omite**: terminar el último ejercicio = sesión completada; descansar al final no aporta.

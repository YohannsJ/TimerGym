# TimerGym ⚡

Timer de entrenamiento por **sesiones multi-bloque**: encadena ejercicios con
nombre y cadencias propias (trabajo/descanso/sets), con firmas sonoras rock,
ajustes en vivo y estética gamer/rocker.

**▶ App web: https://yohannsj.github.io/TimerGym/** (instalable como PWA:
"Agregar a pantalla de inicio" desde el navegador del teléfono).

Dos plataformas:

- **`web/` — Web + móvil (PWA)**: la versión principal. Offline, con sonido,
  vibración y pantalla siempre activa. Sin dependencias ni build.
- **`app/` — Android nativo** (Kotlin + Jetpack Compose, timer simple).
  APK debug: artifact del workflow **Android APK** (release automática en tags `v*`).

Documentación: [`docs/SISTEMA.md`](docs/SISTEMA.md) ·
Investigación de mercado: [`docs/INVESTIGACION.md`](docs/INVESTIGACION.md) ·
Plan v2: [`docs/PLAN.md`](docs/PLAN.md) ·
Mejoras: [`docs/MEJORAS.md`](docs/MEJORAS.md)

## Funcionalidades

- Sesiones: preparación → bloques de `ejercicio × (trabajo/descanso) × sets`
  (hasta 20 bloques; el descanso final se omite; descanso 0 = estilo EMOM).
- Builder visual: agregar/reordenar/quitar bloques, guardar sesiones con nombre.
- `SIGUIENTE ▸` anuncia el próximo ejercicio durante la sesión.
- Presets: Fuerza (45/90×5), HIIT (30/30×10), Tabata (20/10×8), EMOM 10,
  Full Body (4 ejercicios × 3 sets).
- En vivo: `-10s` (adelantar), `+10s` (descansar más), `Cortar` (saltar fase).
- Firmas sonoras sintetizadas (WebAudio, cero assets): power chord al entrenar,
  tonos suaves al descanso, ticks 3-2-1, riff final. Toggle 🔊 persistente.
- Sin drift: el timer se calcula contra el reloj real, no con contadores.

## Web: ejecutar y probar

```powershell
# Tests del motor (no requiere instalar nada, Node >= 18)
npm test

# Servir la app
npm start
# o: python -m http.server 8000 --directory web
```

Atajos de teclado: `Espacio` iniciar/pausar · `R` reiniciar · `S` cortar fase ·
`↑` extender · `↓` adelantar.

## Android: compilar

En CI se compila solo (workflow **Android APK**). Local: Android Studio
(SDK 35) y JDK 17; el repo no incluye Gradle wrapper:

```powershell
gradle wrapper
./gradlew assembleDebug
```

# TimerGym

Timer de entrenamiento por sets: fases de trabajo y descanso con cadencias
configurables, rutinas guardadas y ajustes en vivo.

Dos plataformas:

- **`web/` — Web + móvil (PWA)**: la versión principal. Se instala desde el
  navegador del teléfono ("Agregar a pantalla de inicio"), funciona offline,
  con sonido, vibración y pantalla siempre activa. Sin dependencias ni build.
- **`app/` — Android nativo** (Kotlin + Jetpack Compose).

Documentación completa: [`docs/SISTEMA.md`](docs/SISTEMA.md) ·
Mejoras hechas y pendientes: [`docs/MEJORAS.md`](docs/MEJORAS.md)

## Funcionalidades

- Preparación → trabajo → descanso × N sets (el descanso final se omite).
- Presets: Fuerza (45/90×5), HIIT (30/30×10), Tabata (20/10×8), EMOM 10 (60/0×10).
- Rutinas propias guardadas con nombre (persisten al cerrar).
- En vivo: `-10s` (adelantar), `+10s` (descansar más), `Cortar fase` (saltar).
- Beeps en countdown 3-2-1, cambio de fase y final; vibración en móvil.
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

Requiere Android Studio (SDK 35) y JDK 17. El repo no incluye Gradle wrapper:

```powershell
gradle wrapper
./gradlew assembleDebug
```

Estructura: `MainActivity.kt` (UI Compose) y `TimerViewModel.kt` (lógica,
ticks anclados a `elapsedRealtime` para no acumular drift).

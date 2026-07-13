# Investigación: qué esperan los usuarios de un timer de gym

Fuentes: reviews de App Store / Google Play de las apps líderes (Interval Timer,
Seconds Pro, Exercise Timer, Circuit Timer) y recomendaciones de comunidades
(Reddit vía Trusty Spotter). Julio 2026.

## Hallazgos (ordenados por frecuencia de mención)

1. **Intervalos con nombre y duración propia (circuitos)** — la queja #1 de las
   apps simples: "solo puedo poner UN tiempo de trabajo y UNO de descanso".
   Los usuarios arman circuitos: `30s sentadillas → 20s plancha → 60s descanso`,
   repetidos por rondas, y encadenan bloques distintos en una misma sesión
   (calentamiento → tabata → fuerza).
2. **Aviso del siguiente ejercicio** — saber *qué viene* antes de que empiece
   (visual o hablado) para prepararse durante el descanso.
3. **Sonidos distintos por evento, audibles sobre música** — distinguir inicio
   de trabajo / descanso / final sin mirar la pantalla y con Spotify a todo
   volumen. Reviews destacan actualizaciones que agregaron variedad de sonidos
   y countdown audible.
4. **Presets ilimitados guardados y sin paywall** — molestia recurrente:
   apps que cobran por guardar más de 2 rutinas.
5. **Color distinto por fase + display gigante** — leer el estado de un vistazo
   desde lejos (el teléfono queda en el piso o el banco).
6. **Pantalla siempre activa (wake lock)** — no tocar el teléfono a mitad de serie.
7. **Vibración** como canal alternativo al sonido.
8. **Countdown 3-2-1** al final de cada intervalo.

## Qué ya cubre TimerGym vs. qué falta

| Expectativa | Estado |
|---|---|
| Circuitos con ejercicios nombrados | ❌ → **motor de sesiones multi-bloque** |
| Aviso de siguiente ejercicio | ❌ → **"SIGUIENTE:" en display** |
| Sonidos distintos por evento | ⚠️ beeps sinusoidales poco distinguibles → **firmas sonoras (power chords sintetizados)** |
| Presets ilimitados gratis | ✅ localStorage sin límite |
| Color por fase + display grande | ⚠️ existe pero tenue → **estética agresiva de alto contraste** |
| Wake lock | ✅ |
| Vibración | ✅ |
| Countdown 3-2-1 | ✅ |

## Fuentes

- [Interval Timer HIIT — reviews App Store](https://apps.apple.com/us/app/interval-timer-hiit-timer/id1124297113?see-all=reviews)
- [Interval Timer ++ — App Store](https://apps.apple.com/us/app/interval-timer/id1327053127)
- [The 3 Best HIIT Workout Apps According to Reddit — Trusty Spotter](https://trustyspotter.com/blog/best-hiit-apps-reddit/)
- [Seconds Interval Timer](https://www.intervaltimer.com/app)
- [Circuit Timer](https://circuittimer.app/)
- [Exercise Timer: Interval Timer — App Store](https://apps.apple.com/gb/app/exercise-timer-interval-timer/id1501534442)
- [Hi Timer](https://www.hitimer.app/)

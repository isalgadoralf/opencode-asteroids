# AGENTS.md

## Descripción general

Clon de Asteroids en canvas HTML5 puro. Sin dependencias, bundler, paso de build ni tests; no hay `package.json`. No introduzcas herramientas ni librerías salvo que se pida.

## Ejecutar

Abre `index.html` directamente en el navegador, o `npx serve .` → `http://localhost:3000`. El juego arranca al cargar (no hay pantalla de inicio); Espacio reinicia tras game over.

## Arquitectura

- Toda la lógica está en `game.js` (~900 líneas), cargado como `<script>` normal desde `index.html` — NO es un módulo ES. No añadas `import`/`export` sin cambiar también la etiqueta script.
- `loop(ts)` ejecuta `update(dt)` y luego `draw()` vía `requestAnimationFrame`; todo el movimiento depende de delta-time y `dt` está limitado a 0.05s.
- `state` (global) es `'playing' | 'dead' | 'gameover'`. `update()` retorna antes en `dead` (2s hasta reaparecer) y `gameover`; allí solo siguen actualizándose las partículas, los asteroides y los OVNIs mientras `dead`.
- Las entidades son clases planas que comparten los globales `ctx`, `W`, `H`. Cada una marca `dead` y se filtra de su array cada frame.
- La entrada usa `e.code` (`ArrowLeft`, `Space`, …), no `e.key`. `keys` es el estado mantenido; `pressed(code)` consume el flag de flanco — llámalo una sola vez por frame y tecla.
- El espacio es toroidal: las posiciones se envuelven con `wrap(v, max)` (las partículas no).
- Arrays: `bullets` (jugador), `enemyBullets` (OVNI), `asteroids`, `particles`, `powerUps`, `ufos`. `asteroids` también contiene `ShootingStar` por duck typing (`size`, `radius`, `split()`).

## Trampas

- El tamaño del canvas (800x600) está hardcodeado en dos sitios: la etiqueta `<canvas>` de `index.html` y `W`/`H` en `game.js`. Cambia ambos.
- Los comentarios y textos de UI están en español — mantenlos en español.
- Puntuación/división basada en tablas: `RADII`/`SPEEDS`/`POINTS` se indexan por `size` del asteroide (1–3); el índice 0 no se usa. Puntos: tamaño 1 = 100, 2 = 50, 3 = 20; `split()` crea dos de `size - 1` y devuelve `[]` en tamaño 1.
- `ShootingStar` (dorada, TTL 6s, no se divide) comparte el array `asteroids` con `size = 2`, así que `POINTS[a.size]` y `a.split()` deben seguir funcionando para ella. Máximo 1 activa.
- El nivel avanza solo cuando `asteroids.length === 0`, así que una `ShootingStar` viva bloquea el siguiente nivel hasta que expira.
- `PowerUp` aparece ~10% al destruir un asteroide u OVNI (helper `maybeDropPowerUp`), tiene TTL de 8s y su `type` se elige al azar entre `'speed' | 'triple' | 'shield'`. Velocidad otorga `ship.speedTimer = 5` (doble rotación/empuje); triple shot otorga `ship.tripleTimer = 5` (abanico de 3 balas a ±10° en `Ship.tryShoot()`); escudo otorga 8s (`SHIELD_TIME`) y 3 impactos (`SHIELD_HITS`). Vive en el array separado `powerUps` — no lo mezcles con `asteroids`.
- El escudo (`ship.hasShield()`) absorbe balas enemigas, asteroides y OVNIs con `absorbHit()`: consume 1 impacto y da 0.4s de gracia (`shieldGrace`) para que los fragmentos no drenen las cargas. Se dibuja como hexágono azul alrededor de la nave y se indica en el HUD.
- El OVNI (`Ufo`) vive en `ufos`, máximo 1 activo, se controla con `ufoTimer` y dispara `EnemyBullet` hacia la nave usando `aimAt()` (distancia toroidal). Se destruye de un disparo (+150) y no bloquea el avance de nivel.
- `Ship.reset()` otorga 3s de invencibilidad; la colisión con asteroides, balas enemigas y OVNIs se ignora mientras `invincible > 0`.
- Las skins viven en `SKINS` y solo afectan al render: `Ship.draw()` y `drawLifeIcon()` usan `skinIndex`. No cambies `Ship.radius` ni `NOSE` por skin. La selección (`S`) se guarda en `localStorage['asteroids.skin']` y se procesa al inicio de `update()` para que funcione también en `dead`/`gameover`.
- No hay comandos de lint, typecheck ni tests. Verifica los cambios jugando en el navegador.

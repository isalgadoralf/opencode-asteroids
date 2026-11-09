'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// Ángulo hacia un objetivo teniendo en cuenta el espacio toroidal
function aimAt(from, to) {
  const dx = ((to.x - from.x + W * 1.5) % W) - W / 2;
  const dy = ((to.y - from.y + H * 1.5) % H) - H / 2;
  return Math.atan2(dy, dx);
}

// ── Constantes de juego ───────────────────────────────────────────────────────
const POWERUP_DROP = 0.1;   // probabilidad de drop al destruir una amenaza
const SHIELD_TIME  = 8;     // duración del escudo en segundos
const SHIELD_HITS  = 3;     // impactos que absorbe el escudo
const SHIELD_GRACE = 0.4;   // invulnerabilidad breve tras absorber un golpe

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Bala enemiga ──────────────────────────────────────────────────────────────
class EnemyBullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 240;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 3;
    this.radius = 3;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ────────────────────────────────────────────────────────────
const SHOOTING_STAR_SPEED = 300;
const SHOOTING_STAR_TTL   = 6;

class ShootingStar {
  constructor() {
    // Nace en un borde aleatorio, apuntando hacia el interior
    const side  = randInt(0, 3);
    const angle = rand(-Math.PI / 5, Math.PI / 5);
    if (side === 0) {        // arriba
      this.x = rand(0, W); this.y = 0;
      this.dir = Math.PI / 2 + angle;
    } else if (side === 1) { // abajo
      this.x = rand(0, W); this.y = H;
      this.dir = -Math.PI / 2 + angle;
    } else if (side === 2) { // izquierda
      this.x = 0; this.y = rand(0, H);
      this.dir = angle;
    } else {                 // derecha
      this.x = W; this.y = rand(0, H);
      this.dir = Math.PI + angle;
    }

    this.vx = Math.cos(this.dir) * SHOOTING_STAR_SPEED;
    this.vy = Math.sin(this.dir) * SHOOTING_STAR_SPEED;

    this.radius = RADII[2];
    this.size   = 2;   // para POINTS en el cálculo de puntaje
    this.ttl    = SHOOTING_STAR_TTL;
    this.dead   = false;

    this.rotSpeed = rand(-3, 3);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.dead = true;
      explode(this.x, this.y, 8);
    }
  }

  split() { return []; }   // se destruye de un disparo, no se divide

  draw() {
    // Parpadeo cuando está por desaparecer
    if (this.ttl < 1.5 && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Estela detrás de la dirección de movimiento
    const len = 40;
    const dx = -this.vx / SHOOTING_STAR_SPEED * len;
    const dy = -this.vy / SHOOTING_STAR_SPEED * len;
    ctx.strokeStyle = 'rgba(255, 210, 74, 0.5)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dx, dy);
    ctx.stroke();

    // Polígono dorado
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Skins de la nave ─────────────────────────────────────────────────────────
const SKINS = [
  {
    name: 'CLÁSICA',
    hull: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
    stroke: '#fff',
    lineWidth: 1.5,
    glow: 0,
    flame: 'rgba(255, 130, 0, 0.85)',
    flameBoost: 'rgba(0, 255, 255, 0.9)',
    flameOrigin: -8,
  },
  {
    name: 'NEÓN',
    hull: [[22, 0], [2, -5], [-5, -11], [-9, -3], [-14, 0], [-9, 3], [-5, 11], [2, 5]],
    stroke: '#39ff88',
    lineWidth: 2,
    glow: 12,
    flame: 'rgba(57, 255, 136, 0.85)',
    flameBoost: 'rgba(180, 255, 210, 0.95)',
    flameOrigin: -9,
  },
  {
    name: 'CARMESÍ',
    hull: [[21, 0], [-4, -11], [-2, -3], [-13, 0], [-2, 3], [-4, 11]],
    stroke: '#ff4d4d',
    lineWidth: 1.8,
    glow: 7,
    flame: 'rgba(255, 90, 40, 0.85)',
    flameBoost: 'rgba(255, 210, 120, 0.95)',
    flameOrigin: -8,
  },
  {
    name: 'DORADA',
    hull: [[21, 0], [1, -4], [-6, -10], [-8, 0], [-6, 10], [1, 4]],
    stroke: '#ffd24a',
    lineWidth: 1.8,
    glow: 10,
    flame: 'rgba(255, 200, 60, 0.85)',
    flameBoost: 'rgba(255, 255, 200, 0.95)',
    flameOrigin: -7,
  },
];

const SKIN_KEY = 'asteroids.skin';
let skinToast = 0;

function loadSkin() {
  try {
    const i = parseInt(localStorage.getItem(SKIN_KEY), 10);
    return Number.isInteger(i) && i >= 0 && i < SKINS.length ? i : 0;
  } catch {
    return 0;   // localStorage no disponible (p. ej. file:// en algunos navegadores)
  }
}

function saveSkin() {
  try { localStorage.setItem(SKIN_KEY, String(skinIndex)); } catch { /* ignorar */ }
}

let skinIndex = loadSkin();

// ── OVNI enemigo ──────────────────────────────────────────────────────────────
const UFO_SPEED  = 95;
const UFO_POINTS = 150;

class Ufo {
  constructor() {
    const fromLeft = Math.random() < 0.5;
    this.dir    = fromLeft ? 1 : -1;
    this.x      = fromLeft ? -40 : W + 40;
    this.baseY  = rand(80, H - 80);
    this.y      = this.baseY;
    this.t      = 0;
    this.radius = 18;
    this.vx     = UFO_SPEED * this.dir;
    this.ttl    = 14;
    this.shootTimer = rand(1, 2);
    this.dead   = false;
  }

  update(dt) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y  = this.baseY + Math.sin(this.t * 2.5) * 18;
    this.ttl -= dt;
    this.shootTimer -= dt;

    const onScreen = this.x > 0 && this.x < W;
    if (this.shootTimer <= 0 && onScreen && !ship.dead) {
      this.shootTimer = rand(1.4, 2.2);
      enemyBullets.push(new EnemyBullet(this.x, this.y, aimAt(this, ship)));
    }

    // Se retira al cruzar el campo o al expirar
    if (this.ttl <= 0 || this.x < -80 || this.x > W + 80) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Cúpula
    ctx.beginPath();
    ctx.arc(0, -3, 8, Math.PI, 0);
    ctx.stroke();

    // Cuerpo del platillo
    ctx.beginPath();
    ctx.moveTo(-18,  0);
    ctx.lineTo(-10, -7);
    ctx.lineTo( 10, -7);
    ctx.lineTo( 18,  0);
    ctx.lineTo( 10,  7);
    ctx.lineTo(-10,  7);
    ctx.closePath();
    ctx.stroke();

    // Luces intermitentes
    ctx.fillStyle = Math.floor(performance.now() / 200) % 2 === 0 ? '#ff5a5a' : '#ffd24a';
    for (const lx of [-10, 0, 10]) {
      ctx.beginPath();
      ctx.arc(lx, 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedTimer    = 0;
    this.tripleTimer   = 0;
    this.shieldTimer   = 0;
    this.shieldHits    = 0;
    this.shieldGrace   = 0;
    this.dead          = false;
  }

  hasShield() {
    return this.shieldTimer > 0 && this.shieldHits > 0;
  }

  absorbHit() {
    this.shieldHits--;
    this.shieldGrace = SHIELD_GRACE;
    if (this.shieldHits <= 0) {
      this.shieldHits  = 0;
      this.shieldTimer = 0;
      explode(this.x, this.y, 10);
    }
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedTimer    > 0) this.speedTimer    -= dt;
    if (this.tripleTimer   > 0) this.tripleTimer   -= dt;
    if (this.shieldGrace   > 0) this.shieldGrace   -= dt;
    if (this.shieldTimer   > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = 0;
        this.shieldHits  = 0;
      }
    }

    // Doble velocidad y rotación mientras dura el power-up
    const boosted  = this.speedTimer > 0;
    const ROT      = boosted ? 7 : 3.5;    // rad/s
    const THRUST   = boosted ? 520 : 260;  // px/s²
    const DRAG     = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;

    // Triple Shot: abanico de 3 balas (±10°)
    if (this.tripleTimer > 0) {
      const SPREAD = Math.PI / 18;
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }

    return [new Bullet(ox, oy, this.angle)];
  }

  drawShield() {
    const now    = performance.now();
    const pulse  = 1 + Math.sin(now / 160) * 0.06;
    const alpha  = this.shieldTimer < 2
      ? 0.35 + 0.35 * Math.sin(now / 80)
      : 0.75;
    const flash  = this.shieldGrace > 0;
    const r      = 28 * pulse;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(now / 1400);

    // Hexágono exterior
    ctx.strokeStyle = flash
      ? 'rgba(255,255,255,0.95)'
      : `rgba(77,166,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = flash ? 2.5 : 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a  = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Arcos interiores de refuerzo
    ctx.strokeStyle = `rgba(77,166,255,${(alpha * 0.45).toFixed(2)})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.restore();
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];
    if (this.hasShield()) this.drawShield();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.stroke;
    ctx.lineWidth   = skin.lineWidth;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    if (skin.glow > 0) {
      ctx.shadowColor = skin.stroke;
      ctx.shadowBlur  = skin.glow;
    }

    // Casco de la skin activa
    ctx.beginPath();
    ctx.moveTo(skin.hull[0][0], skin.hull[0][1]);
    for (let i = 1; i < skin.hull.length; i++)
      ctx.lineTo(skin.hull[i][0], skin.hull[i][1]);
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor (más grande con Velocidad activa)
    if (this.thrusting && Math.random() > 0.35) {
      const boosted = this.speedTimer > 0;
      const ox = skin.flameOrigin;
      ctx.beginPath();
      ctx.moveTo(ox, -4);
      ctx.lineTo(ox - rand(6, boosted ? 24 : 14), 0);
      ctx.lineTo(ox,  4);
      ctx.strokeStyle = boosted ? skin.flameBoost : skin.flame;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups (Velocidad / Triple Shot / Escudo) ─────────────────────────────
const POWERUP_TYPES = {
  speed:  { color: '#0ff',    label: 'V' },   // Velocidad: doble rotación/empuje
  triple: { color: '#0f0',    label: '3' },   // Triple Shot: abanico de 3 balas
  shield: { color: '#4da6ff', label: 'E' },   // Escudo: 8s o 3 impactos
};
const POWERUP_KEYS = Object.keys(POWERUP_TYPES);

class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x      = x;
    this.y      = y;
    this.type   = POWERUP_TYPES[type] ? type : 'speed';
    this.color  = POWERUP_TYPES[this.type].color;
    this.label  = POWERUP_TYPES[this.type].label;
    this.radius = 10;
    this.ttl    = 8;      // segundos antes de desaparecer
    this.dead   = false;
  }

  update(dt) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo cuando está por desaparecer
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const isShield = this.type === 'shield';
    const now      = performance.now();
    const pulse    = 1 + Math.sin(now / 150) * 0.15;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(now / 600);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    if (isShield) {
      // Hexágono de escudo
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a  = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * 10 * pulse;
        const py = Math.sin(a) * 10 * pulse;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      // Estrella de 4 puntas
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = (i % 2 === 0 ? 10 : 4) * pulse;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Letra identificadora: "V" velocidad, "3" triple shot, "E" escudo
    ctx.rotate(-now / 600);
    ctx.fillStyle = this.color;
    ctx.font      = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, 0, 0);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let enemyBullets, ufos;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer, ufoTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function maybeDropPowerUp(x, y) {
  if (Math.random() >= POWERUP_DROP) return;
  const type = POWERUP_KEYS[randInt(0, POWERUP_KEYS.length - 1)];
  powerUps.push(new PowerUp(x, y, type));
}

function initGame() {
  ship         = new Ship();
  bullets      = [];
  enemyBullets = [];
  asteroids    = [];
  particles    = [];
  powerUps     = [];
  ufos         = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  ufoTimer = rand(12, 20);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets      = [];
  enemyBullets = [];
  particles    = [];
  powerUps     = [];
  ufos         = [];
  ufoTimer     = rand(12, 20);
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  enemyBullets = [];
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Cambio de skin: disponible en cualquier estado (incluido game over)
  if (pressed('KeyS')) {
    skinIndex = (skinIndex + 1) % SKINS.length;
    skinToast = 1.2;
    saveSkin();
  }
  if (skinToast > 0) skinToast -= dt;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    ufos.forEach(u => u.update(dt));
    ufos = ufos.filter(u => !u.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  enemyBullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));
  ufos.forEach(u => u.update(dt));

  bullets      = bullets.filter(b => !b.dead);
  enemyBullets = enemyBullets.filter(b => !b.dead);
  particles    = particles.filter(p => !p.dead);
  powerUps     = powerUps.filter(p => !p.dead);
  ufos         = ufos.filter(u => !u.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        maybeDropPowerUp(a.x, a.y);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs OVNI
  for (const b of bullets) {
    for (const u of ufos) {
      if (!u.dead && !b.dead && dist(b, u) < u.radius) {
        b.dead = true;
        u.dead = true;
        score += UFO_POINTS;
        explode(u.x, u.y, 12);
        maybeDropPowerUp(u.x, u.y);
      }
    }
  }
  ufos    = ufos.filter(u => !u.dead);
  bullets = bullets.filter(b => !b.dead);

  // Nave vs power-up
  if (!ship.dead) {
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        if (p.type === 'shield') {
          ship.shieldTimer = SHIELD_TIME;
          ship.shieldHits  = SHIELD_HITS;
          ship.shieldGrace = 0;
        } else if (p.type === 'triple') {
          ship.tripleTimer = 5;
        } else {
          ship.speedTimer = 5;
        }
        explode(p.x, p.y, 6);
      }
    }
    powerUps = powerUps.filter(p => !p.dead);
  }

  // Nave vs bala enemiga
  if (!ship.dead && ship.invincible <= 0 && ship.shieldGrace <= 0) {
    for (const b of enemyBullets) {
      if (!b.dead && dist(ship, b) < ship.radius + b.radius) {
        b.dead = true;
        if (ship.hasShield()) {
          ship.absorbHit();
          explode(b.x, b.y, 5);
        } else {
          killShip();
          break;
        }
      }
    }
    enemyBullets = enemyBullets.filter(b => !b.dead);
  }

  // Nave vs asteroide / OVNI
  if (!ship.dead && ship.invincible <= 0 && ship.shieldGrace <= 0) {
    const shieldFragments = [];
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.hasShield()) {
          a.dead = true;
          explode(a.x, a.y, a.size * 5);
          shieldFragments.push(...a.split());
          ship.absorbHit();
        } else {
          killShip();
        }
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(shieldFragments);

    if (!ship.dead && ship.shieldGrace <= 0) {
      for (const u of ufos) {
        if (dist(ship, u) < ship.radius + u.radius) {
          u.dead = true;
          explode(u.x, u.y, 12);
          if (ship.hasShield()) {
            ship.absorbHit();
          } else {
            killShip();
          }
          break;
        }
      }
      ufos = ufos.filter(u => !u.dead);
    }
  }

  // Spawn de estrella fugaz (máx. 1 activa)
  if (!asteroids.some(a => a instanceof ShootingStar) && Math.random() < 0.008)
    asteroids.push(new ShootingStar());

  // Spawn de OVNI (máx. 1 activo)
  ufoTimer -= dt;
  if (ufoTimer <= 0) {
    if (!ship.dead && ufos.length === 0) ufos.push(new Ufo());
    ufoTimer = rand(15, 25);
  }

  // Nivel completado
  if (asteroids.length === 0 && !ship.dead) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[skinIndex];
  const s = 0.45;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = skin.stroke;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  if (skin.glow > 0) {
    ctx.shadowColor = skin.stroke;
    ctx.shadowBlur  = 4;
  }
  ctx.beginPath();
  ctx.moveTo(skin.hull[0][0] * s, skin.hull[0][1] * s);
  for (let i = 1; i < skin.hull.length; i++)
    ctx.lineTo(skin.hull[i][0] * s, skin.hull[i][1] * s);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  // Indicadores de power-ups activos
  let hudY = 46;

  if (ship.speedTimer > 0) {
    ctx.fillStyle = '#0ff';
    ctx.fillText(`VELOCIDAD  ${ship.speedTimer.toFixed(1)}s`, 14, hudY);
    hudY += 20;
  }

  if (ship.tripleTimer > 0) {
    ctx.fillStyle = '#0f0';
    ctx.fillText(`TRIPLE  ${ship.tripleTimer.toFixed(1)}s`, 14, hudY);
    hudY += 20;
  }

  if (ship.shieldTimer > 0) {
    ctx.fillStyle = '#4da6ff';
    ctx.fillText(`ESCUDO  ${ship.shieldTimer.toFixed(1)}s  [${ship.shieldHits}]`, 14, hudY);
    hudY += 20;
  }

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Skin actual y ayuda de teclado
  ctx.textAlign = 'left';
  ctx.font      = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`SKIN: ${SKINS[skinIndex].name}   [S] CAMBIAR`, 14, H - 16);

  // Aviso temporal al cambiar de skin
  if (skinToast > 0) {
    ctx.textAlign = 'center';
    ctx.font      = 'bold 16px monospace';
    ctx.fillStyle = SKINS[skinIndex].stroke;
    ctx.fillText(`SKIN: ${SKINS[skinIndex].name}`, W / 2, H - 44);
  }

  ctx.font      = '15px monospace';
  ctx.fillStyle = '#fff';
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  ufos.forEach(u => u.draw());
  bullets.forEach(b => b.draw());
  enemyBullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);

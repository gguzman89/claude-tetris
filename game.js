'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Skins: índice 1–8 = pieza (el 8 es la tuerca); cada skin define paleta, rejilla, alpha del ghost y su función de dibujo de bloque
const SKINS = {
  retro: {
    label: '🕹️ Retro',
    grid: '#22222e',
    ghostAlpha: 0.2,
    draw: drawBlockRetro,
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - azul pálido
      '#ffb74d', // L - orange
      '#b0bec5', // N - tuerca (gris acero)
    ],
  },
  neon: {
    label: '💡 Neon',
    grid: '#1c1c28',
    ghostAlpha: 0.25,
    draw: drawBlockNeon,
    colors: [
      null,
      '#00f0ff', // I
      '#ffee00', // O
      '#d500f9', // T
      '#39ff14', // S
      '#ff1744', // Z
      '#2979ff', // J
      '#ff9100', // L
      '#e0e0ff', // N - tuerca
    ],
  },
  pastel: {
    label: '🍬 Pastel',
    grid: '#d9cce6',
    ghostAlpha: 0.35,
    draw: drawBlockPastel,
    colors: [
      null,
      '#7fd3e0', // I
      '#f7d870', // O
      '#c79be6', // T
      '#8fdcb8', // S
      '#ff9aa5', // Z
      '#9db4f0', // J
      '#ffbd7a', // L
      '#aebcc4', // N - tuerca
    ],
  },
  pixel: {
    label: '👾 Pixel art',
    grid: '#262633',
    ghostAlpha: 0.25,
    draw: drawBlockPixel,
    colors: [
      null,
      '#29b6f6', // I
      '#fbc02d', // O
      '#8e44ad', // T
      '#43a047', // S
      '#e53935', // Z
      '#3f51b5', // J
      '#fb8c00', // L
      '#78909c', // N - tuerca
    ],
  },
};
const SKIN_ORDER = Object.keys(SKINS);
const SKIN_KEY = 'tetris-skin';

let skin = 'retro';
let COLORS = SKINS[skin].colors;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (challenge, hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// Funciones de dibujo por skin: (context, px, py, size, color); px/py en píxeles
function drawBlockRetro(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawBlockNeon(context, px, py, size, color) {
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillStyle = color;
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(px + 5, py + 5, size - 10, 2);
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function drawBlockPastel(context, px, py, size, color) {
  roundRectPath(context, px + 2, py + 2, size - 4, size - 4, 8);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(90,60,120,0.35)';
  context.lineWidth = 1.5;
  context.stroke();
  roundRectPath(context, px + 6, py + 5, size - 12, 4, 2);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

function drawBlockPixel(context, px, py, size, color) {
  const s = 4; // tamaño del sub-cuadro
  const x0 = px + 1, y0 = py + 1, n = size - 2;
  context.fillStyle = color;
  context.fillRect(x0, y0, n, n);
  // patrón de damero con sub-cuadros claros/oscuros
  for (let i = 0; i * s < n; i++) {
    for (let j = 0; j * s < n; j++) {
      if ((i + j) % 2) continue;
      context.fillStyle = (i + j) % 4 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
      context.fillRect(x0 + i * s, y0 + j * s, Math.min(s, n - i * s), Math.min(s, n - j * s));
    }
  }
  // borde duro estilo pixel
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fillRect(x0, y0, n, 2);
  context.fillRect(x0, y0, 2, n);
  context.fillStyle = 'rgba(0,0,0,0.45)';
  context.fillRect(x0, y0 + n - 2, n, 2);
  context.fillRect(x0 + n - 2, y0, 2, n);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].draw(context, x * size, y * size, size, COLORS[colorIndex]);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, SKINS[skin].ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() pudo ejecutarse dentro de este frame: su cancelAnimationFrame no afecta al frame actual
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  skin = name;
  COLORS = SKINS[name].colors;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  try { localStorage.setItem(SKIN_KEY, name); } catch (e) { /* almacenamiento no disponible */ }
  // con pausa o game over el rAF está cancelado: redibujar para ver el cambio
  if (current && next) {
    draw();
    drawNext();
  }
}

function cycleSkin() {
  applySkin(SKIN_ORDER[(SKIN_ORDER.indexOf(skin) + 1) % SKIN_ORDER.length]);
}

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    return SKINS[saved] ? saved : 'retro';
  } catch (e) {
    return 'retro';
  }
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // el select maneja sus propias teclas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { cycleSkin(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
for (const name of SKIN_ORDER) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = SKINS[name].label;
  skinSelect.appendChild(opt);
}
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que Space cambie la opción en vez de la caída
});

applySkin(loadSkin());
init();

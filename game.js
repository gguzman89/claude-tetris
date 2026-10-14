'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Índice 1–8 = pieza; cada tema tiene su paleta para mantener el contraste con el fondo
const THEMES = {
  dark: {
    label: '🌙 Oscuro',
    grid: '#22222e',
    highlight: 'rgba(255,255,255,0.12)',
    ghostAlpha: 0.2,
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
  light: {
    label: '☀️ Claro',
    grid: '#d9dbe6',
    highlight: 'rgba(255,255,255,0.35)',
    ghostAlpha: 0.3,
    colors: [
      null,
      '#00a5bd', // I - cyan
      '#f2a900', // O - yellow
      '#9c3fb5', // T - purple
      '#3d9a45', // S - green
      '#e0392f', // Z - red
      '#2a78d6', // J - azul
      '#ef7d00', // L - orange
      '#607d8b', // N - tuerca (gris azulado)
    ],
  },
};

let theme = 'dark';
let COLORS = THEMES[theme].colors;

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
const themeBtn = document.getElementById('theme-toggle');

// ---- Records (localStorage con fallback a memoria) ----
const RECORDS_KEY = 'tetris.records';
const TOP_N = 5;
const NAME_MAX = 12;
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startList = document.getElementById('records-list-start');
const startStats = document.getElementById('records-stats-start');
const startResetBtn = document.getElementById('records-reset-start');
const goBox = document.getElementById('records-gameover');
const goMsg = document.getElementById('record-msg');
const goForm = document.getElementById('record-form');
const goName = document.getElementById('record-name');
const goSaveBtn = document.getElementById('record-save');
const goList = document.getElementById('records-list-go');
const goStats = document.getElementById('records-stats-go');
const goResetBtn = document.getElementById('records-reset-go');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false;        // false mientras se muestra la pantalla de inicio
let combo = 0;              // locks consecutivos que limpian >=1 línea
let maxComboThisGame = 0;
let pendingRecord = null;   // { score, lines, level } si la partida entra al top y falta el nombre

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function sanitizeRecords(raw) {
  const rec = emptyRecords();
  if (!raw || typeof raw !== 'object') return rec;
  if (Array.isArray(raw.top)) {
    rec.top = raw.top
      .filter(t => t && typeof t === 'object' && Number.isFinite(t.score))
      .map(t => ({
        name: String(t.name ?? '').slice(0, NAME_MAX) || 'Anónimo',
        score: t.score,
        lines: Number.isFinite(t.lines) ? t.lines : 0,
        level: Number.isFinite(t.level) ? t.level : 1,
        date: String(t.date ?? ''),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);
  }
  if (Number.isFinite(raw.bestCombo)) rec.bestCombo = raw.bestCombo;
  if (Number.isFinite(raw.maxLines)) rec.maxLines = raw.maxLines;
  return rec;
}

function loadRecords() {
  try {
    return sanitizeRecords(JSON.parse(localStorage.getItem(RECORDS_KEY)));
  } catch (e) {
    return emptyRecords();
  }
}

// Copia en memoria: sigue funcionando si localStorage falla
let records = loadRecords();

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) { /* sin almacenamiento: se mantiene solo en memoria */ }
}

// Posición de inserción (0-based) para un score; TOP_N o más = no entra
function recordRank(sc) {
  if (sc <= 0) return TOP_N;
  const i = records.top.findIndex(t => sc > t.score);
  if (i !== -1) return i;
  return records.top.length;
}

function renderRecordList(listEl, top, highlight) {
  listEl.textContent = '';
  for (let i = 0; i < TOP_N; i++) {
    const t = top[i];
    const li = document.createElement('li');
    if (i === highlight) li.className = 'highlight';
    const rank = document.createElement('span');
    rank.className = 'rec-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'rec-name';
    name.textContent = t ? t.name : '—';
    const sc = document.createElement('span');
    sc.className = 'rec-score';
    sc.textContent = t ? t.score.toLocaleString() : '';
    const ln = document.createElement('span');
    ln.className = 'rec-lines';
    ln.textContent = t ? `${t.lines} L` : '';
    li.append(rank, name, sc, ln);
    listEl.appendChild(li);
  }
}

function renderStats(el) {
  el.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx: ${records.maxLines}`;
}

function renderStartScreen() {
  renderRecordList(startList, records.top, -1);
  renderStats(startStats);
}

function startGame() {
  if (started) return;
  started = true;
  startScreen.classList.add('hidden');
  init();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  records = emptyRecords();
  saveRecords();
  pendingRecord = null;
  goForm.classList.add('hidden');
  goMsg.textContent = '';
  renderRecordList(goList, records.top, -1);
  renderStats(goStats);
  renderStartScreen();
}

function showGameOverRecords() {
  // Combo y líneas máx se registran siempre, entre al top o no
  if (maxComboThisGame > records.bestCombo) records.bestCombo = maxComboThisGame;
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords();

  const rank = recordRank(score);
  if (rank < TOP_N) {
    pendingRecord = { score, lines, level };
    goMsg.textContent = '¡Nuevo récord!';
    goForm.classList.remove('hidden');
    goName.value = '';
    // vista previa con la fila nueva resaltada hasta guardar el nombre
    const preview = records.top.slice();
    preview.splice(rank, 0, { name: '(tú)', score, lines, level, date: '' });
    renderRecordList(goList, preview.slice(0, TOP_N), rank);
    setTimeout(() => goName.focus(), 0);
  } else {
    pendingRecord = null;
    goMsg.textContent = '';
    goForm.classList.add('hidden');
    renderRecordList(goList, records.top, -1);
  }
  renderStats(goStats);
  goBox.classList.remove('hidden');
}

function savePendingRecord() {
  if (!pendingRecord) return;
  const rank = recordRank(pendingRecord.score);
  records.top.splice(rank, 0, {
    name: goName.value.trim().slice(0, NAME_MAX) || 'Anónimo',
    score: pendingRecord.score,
    lines: pendingRecord.lines,
    level: pendingRecord.level,
    date: new Date().toISOString(),
  });
  records.top = records.top.slice(0, TOP_N);
  saveRecords();
  pendingRecord = null;
  goForm.classList.add('hidden');
  renderRecordList(goList, records.top, rank);
  renderStats(goStats);
  renderStartScreen();
}

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
  return cleared;
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
  if (clearLines() > 0) {
    combo++;
    if (combo > maxComboThisGame) maxComboThisGame = combo;
  } else {
    combo = 0;
  }
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEMES[theme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[theme].grid;
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
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, THEMES[theme].ghostAlpha);

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
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver || !started) return;
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

function applyTheme(name) {
  theme = name;
  COLORS = THEMES[name].colors;
  document.documentElement.dataset.theme = name;
  themeBtn.textContent = THEMES[name].label;
  themeBtn.setAttribute('aria-pressed', String(name === 'light'));
  // con pausa o game over el rAF está cancelado: redibujar para ver el cambio
  if (current && next) {
    draw();
    drawNext();
  }
}

function toggleTheme() {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
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
  combo = 0;
  maxComboThisGame = 0;
  pendingRecord = null;
  goBox.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // con un campo de texto enfocado el juego no debe reaccionar (nombre del récord)
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (!started) {
    if (tag === 'BUTTON' && e.target !== startBtn) return; // Enter sobre otro botón lo activa él
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); startGame(); }
    else if (e.code === 'KeyT') toggleTheme();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
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

restartBtn.addEventListener('click', () => {
  savePendingRecord(); // no perder un récord sin nombre guardado
  init();
  restartBtn.blur();
});
startBtn.addEventListener('click', () => {
  startGame();
  startBtn.blur();
});
goSaveBtn.addEventListener('click', () => {
  savePendingRecord();
  goSaveBtn.blur();
});
goName.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); savePendingRecord(); goName.blur(); }
});
startResetBtn.addEventListener('click', () => { resetRecords(); startResetBtn.blur(); });
goResetBtn.addEventListener('click', () => { resetRecords(); goResetBtn.blur(); });
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Space active el botón en vez de la caída
});

applyTheme('dark');
renderStartScreen(); // el juego arranca al pulsar Jugar (startGame → init)

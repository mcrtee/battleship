// ============================================================
// МОРСКОЙ БОЙ — логика игры
//   • ручная расстановка кораблей
//   • режим «против компьютера» и режим «на двоих» (по очереди)
// ============================================================

// ===== Константы =====
const SIZE = 8;                                   // поле 8x8
const SHIP_SIZES = [3, 2, 2, 1, 1];                // флот: 1 большой, 2 средних, 2 малых
const SHIP_NAMES = {
  3: 'большой корабль (3 клетки)',
  2: 'средний корабль (2 клетки)',
  1: 'малый корабль (1 клетка)'
};

// ===== Состояние игры (только переменные, без localStorage) =====
let mode = null;            // 'pc' | 'pvp'
let players = [];           // [{ name, board, ships }, { name, board, ships }]
let current = 0;            // индекс игрока, чей сейчас ход
let gameOver = false;
let locked = false;         // блокировка кликов (пауза перед передачей хода)
let soundOn = true;
let gameToken = 0;          // меняется при выходе в меню — отменяет отложенные таймеры
let placingIdx = 0;         // кто сейчас расставляет корабли
let orientation = 'horizontal';   // ориентация корабля при расстановке
let hoverPos = null;        // клетка под курсором при расстановке
let handoffCallback = null; // что сделать после нажатия «Я готов(а)»
let aiTargets = [];         // очередь целей для ИИ

const $ = id => document.getElementById(id);

// ============================================================
// ЗВУКИ (Web Audio API, морской стиль)
// ============================================================
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Попадание — пушечный выстрел: шумовой удар + низкий гул
function playHitSound() {
  if (!soundOn) return;
  const ctx = getAudioCtx();

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(700, ctx.currentTime);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + 0.35);

  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(90, ctx.currentTime);
  thud.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.6, ctx.currentTime);
  thudGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  thud.connect(thudGain).connect(ctx.destination);
  thud.start();
  thud.stop(ctx.currentTime + 0.3);
}

// Промах — всплеск воды
function playMissSound() {
  if (!soundOn) return;
  const ctx = getAudioCtx();

  const splashBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const data = splashBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const splash = ctx.createBufferSource();
  splash.buffer = splashBuffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1400, ctx.currentTime);
  bandpass.Q.value = 0.8;
  const splashGain = ctx.createGain();
  splashGain.gain.setValueAtTime(0.4, ctx.currentTime);
  splashGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  splash.connect(bandpass).connect(splashGain).connect(ctx.destination);
  splash.start();
  splash.stop(ctx.currentTime + 0.25);

  const drop = ctx.createOscillator();
  drop.type = 'sine';
  drop.frequency.setValueAtTime(700, ctx.currentTime);
  drop.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.2);
  const dropGain = ctx.createGain();
  dropGain.gain.setValueAtTime(0.25, ctx.currentTime);
  dropGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  drop.connect(dropGain).connect(ctx.destination);
  drop.start();
  drop.stop(ctx.currentTime + 0.2);
}

// Потопление — взрыв + низкий «стон» тонущего судна
function playSunkSound() {
  if (!soundOn) return;
  playHitSound();
  const ctx = getAudioCtx();
  const groan = ctx.createOscillator();
  groan.type = 'sawtooth';
  groan.frequency.setValueAtTime(160, ctx.currentTime);
  groan.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.8);
  const groanFilter = ctx.createBiquadFilter();
  groanFilter.type = 'lowpass';
  groanFilter.frequency.value = 400;
  const groanGain = ctx.createGain();
  groanGain.gain.setValueAtTime(0.001, ctx.currentTime);
  groanGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
  groanGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  groan.connect(groanFilter).connect(groanGain).connect(ctx.destination);
  groan.start();
  groan.stop(ctx.currentTime + 0.8);
}

// Постановка корабля — глухой «стук» по дереву
function playPlaceSound() {
  if (!soundOn) return;
  const ctx = getAudioCtx();
  const knock = ctx.createOscillator();
  knock.type = 'triangle';
  knock.frequency.setValueAtTime(200, ctx.currentTime);
  knock.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
  knock.connect(gain).connect(ctx.destination);
  knock.start();
  knock.stop(ctx.currentTime + 0.14);
}

// Конец игры — гудок корабля
function playHornSound(win) {
  if (!soundOn) return;
  const ctx = getAudioCtx();
  const horn = ctx.createOscillator();
  horn.type = 'sawtooth';
  horn.frequency.setValueAtTime(win ? 220 : 130, ctx.currentTime);
  const hornFilter = ctx.createBiquadFilter();
  hornFilter.type = 'lowpass';
  hornFilter.frequency.value = 500;
  const hornGain = ctx.createGain();
  hornGain.gain.setValueAtTime(0.001, ctx.currentTime);
  hornGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
  hornGain.gain.setValueAtTime(0.3, ctx.currentTime + 0.5);
  hornGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
  horn.connect(hornFilter).connect(hornGain).connect(ctx.destination);
  horn.start();
  horn.stop(ctx.currentTime + 0.9);
}

// ============================================================
// ПОЛЕ И КОРАБЛИ
// ============================================================
function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

// Не касается ли новый корабль уже стоящих (в т.ч. по диагонали)
function hasAdjacentShip(board, cells) {
  for (const [r, c] of cells) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === 'ship') {
          return true;
        }
      }
    }
  }
  return false;
}

// Можно ли поставить корабль в эти клетки
function canPlace(board, cells) {
  return cells.every(([r, c]) => board[r][c] === null) && !hasAdjacentShip(board, cells);
}

// Случайная расстановка всего флота
function placeShips(board) {
  const ships = [];
  for (const size of SHIP_SIZES) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * SIZE);
      const cells = [];
      let fits = true;
      for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (r >= SIZE || c >= SIZE) { fits = false; break; }
        cells.push([r, c]);
      }
      if (fits && canPlace(board, cells)) {
        cells.forEach(([r, c]) => board[r][c] = 'ship');
        ships.push(cells);
        placed = true;
      }
    }
  }
  return ships;
}

// Форма корабля для отрисовки
function getShipShape(cells) {
  const rows = cells.map(([r]) => r);
  const cols = cells.map(([, c]) => c);
  const rowStart = Math.min(...rows);
  const colStart = Math.min(...cols);
  const length = cells.length;
  let shipOrientation = 'single';
  if (length > 1) {
    shipOrientation = rows[0] === rows[1] ? 'horizontal' : 'vertical';
  }
  return { rowStart, colStart, length, orientation: shipOrientation };
}

// ============================================================
// ОТРИСОВКА ПОЛЯ: слои «клетки / корпуса / отметки»
// ============================================================
// Создаёт элемент корабля (обёртка на всю длину + сам корпус)
function createHull(cells, sunk, extraClass) {
  const { rowStart, colStart, length, orientation: o } = getShipShape(cells);
  const wrap = document.createElement('div');
  wrap.className = 'hull-wrap';
  if (o === 'horizontal') {
    wrap.style.gridRow = String(rowStart + 1);
    wrap.style.gridColumn = (colStart + 1) + ' / span ' + length;
  } else if (o === 'vertical') {
    wrap.style.gridColumn = String(colStart + 1);
    wrap.style.gridRow = (rowStart + 1) + ' / span ' + length;
  } else {
    wrap.style.gridRow = String(rowStart + 1);
    wrap.style.gridColumn = String(colStart + 1);
  }
  const hull = document.createElement('div');
  hull.className = ['hull', o, sunk ? 'sunk' : '', extraClass || ''].filter(Boolean).join(' ');
  wrap.appendChild(hull);
  return wrap;
}

// options:
//   interactive  — клетки кликабельны (onCellClick)
//   showAllShips — показывать все корабли (своё поле / конец игры)
//   justFired    — [r, c] для анимации взрыва
//   onCellEnter / onGridLeave / onContextMenu — для расстановки
function renderBoard(gridId, board, ships, options = {}) {
  const grid = $(gridId);
  grid.innerHTML = '';

  const cellsLayer = document.createElement('div');
  cellsLayer.className = 'layer cells-layer';
  const shipLayer = document.createElement('div');
  shipLayer.className = 'layer ship-layer';
  const marksLayer = document.createElement('div');
  marksLayer.className = 'layer marks-layer';

  // --- клетки воды ---
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      const val = board[r][c];
      const alreadyFired = (val === 'hit' || val === 'miss' || val === 'sunk');
      if (options.interactive && !alreadyFired) {
        cell.classList.add('clickable');
        cell.addEventListener('click', () => options.onCellClick(r, c));
      }
      if (options.onCellEnter) {
        cell.addEventListener('mouseenter', () => options.onCellEnter(r, c));
      }
      cellsLayer.appendChild(cell);
    }
  }
  grid.onmouseleave = options.onGridLeave || null;
  grid.oncontextmenu = options.onContextMenu || null;

  // --- силуэты кораблей ---
  ships.forEach(cells => {
    const allSunkShip = cells.every(([r, c]) => board[r][c] === 'sunk');
    if (!options.showAllShips && !allSunkShip) return;   // чужие корабли скрыты, пока не потоплены
    shipLayer.appendChild(createHull(cells, allSunkShip));
  });

  // --- отметки выстрелов ---
  let fireMarkEl = null;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = board[r][c];
      if (val !== 'hit' && val !== 'miss' && val !== 'sunk') continue;
      const mark = document.createElement('div');
      mark.className = 'mark ' + (val === 'miss' ? 'miss' : 'hit');
      mark.style.gridRow = String(r + 1);
      mark.style.gridColumn = String(c + 1);
      marksLayer.appendChild(mark);
      if (options.justFired && options.justFired[0] === r && options.justFired[1] === c) {
        fireMarkEl = mark;
      }
    }
  }

  grid.appendChild(cellsLayer);
  grid.appendChild(shipLayer);
  grid.appendChild(marksLayer);

  if (fireMarkEl) showExplosion(fireMarkEl);
}

// Анимация взрыва
function showExplosion(markEl) {
  const boom = document.createElement('div');
  boom.className = 'explosion';
  const core = document.createElement('div');
  core.className = 'core';
  boom.appendChild(core);
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    const angle = (Math.PI * 2 * i) / 8;
    const dist = 26 + Math.random() * 10;
    spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    boom.appendChild(spark);
  }
  markEl.appendChild(boom);
  setTimeout(() => boom.remove(), 550);
}

// ============================================================
// ЭКРАНЫ, МЕНЮ, ПЕРЕДАЧА ХОДА
// ============================================================
function setStatus(text) {
  $('status').textContent = text;
}

function showScreen(name) {
  $('menuScreen').hidden = name !== 'menu';
  $('placementScreen').hidden = name !== 'placement';
  $('battleScreen').hidden = name !== 'battle';
}

// setTimeout, который не сработает, если игрок вышел в меню
function later(fn, ms) {
  const token = gameToken;
  setTimeout(() => { if (token === gameToken) fn(); }, ms);
}

function goToMenu() {
  gameToken++;
  mode = null;
  players = [];
  gameOver = false;
  locked = false;
  aiTargets = [];
  handoffCallback = null;
  hoverPos = null;
  $('handoff').hidden = true;
  showScreen('menu');
  setStatus('Выберите режим игры');
}

// Непрозрачный экран «передайте устройство» — полностью закрывает поля
function showHandoff(title, text, btnLabel, callback) {
  $('handoffTitle').textContent = title;
  $('handoffText').textContent = text;
  $('handoffBtn').textContent = btnLabel;
  handoffCallback = callback;
  $('handoff').hidden = false;
  $('handoffBtn').focus();
}

function chooseMode(m) {
  gameToken++;
  mode = m;
  players = [
    { name: m === 'pc' ? 'Вы' : 'Игрок 1', board: null, ships: null },
    { name: m === 'pc' ? 'Компьютер' : 'Игрок 2', board: null, ships: null }
  ];
  startPlacement(0);
}

// ============================================================
// РУЧНАЯ РАССТАНОВКА КОРАБЛЕЙ
// ============================================================
function startPlacement(idx) {
  placingIdx = idx;
  players[idx].board = createEmptyBoard();
  players[idx].ships = [];
  orientation = 'horizontal';
  hoverPos = null;
  $('rotateBtn').textContent = '🔄 Повернуть (R): горизонтально';
  $('placementTitle').textContent = mode === 'pc'
    ? '⚓ Расставьте свои корабли'
    : `⚓ ${players[idx].name}: расставьте корабли`;
  showScreen('placement');
  renderPlacement();
}

// Состояние панели кораблей: какие уже стоят, какой сейчас ставим
function getTrayState(ships) {
  const pool = ships.map(s => s.length);
  let currentFound = false;
  return SHIP_SIZES.map(size => {
    const i = pool.indexOf(size);
    if (i !== -1) {
      pool.splice(i, 1);
      return { size, placed: true, current: false };
    }
    const isCurrent = !currentFound;
    currentFound = true;
    return { size, placed: false, current: isCurrent };
  });
}

function getCurrentSize(ships) {
  const t = getTrayState(ships).find(x => !x.placed);
  return t ? t.size : null;
}

// Клетки корабля, если курсор над (r, c); корабль «прижимается» к краю поля
function placementCells(r, c, size) {
  const horiz = orientation === 'horizontal';
  const rr = horiz ? r : Math.min(r, SIZE - size);
  const cc = horiz ? Math.min(c, SIZE - size) : c;
  const cells = [];
  for (let i = 0; i < size; i++) {
    cells.push(horiz ? [rr, cc + i] : [rr + i, cc]);
  }
  return cells;
}

function renderPlacement() {
  const p = players[placingIdx];
  renderBoard('placementGrid', p.board, p.ships, {
    interactive: true,
    showAllShips: true,
    onCellClick: onPlacementClick,
    onCellEnter: (r, c) => { hoverPos = [r, c]; updatePreview(); },
    onGridLeave: () => { hoverPos = null; updatePreview(); },
    onContextMenu: e => { e.preventDefault(); rotateShip(); }
  });
  renderTray();
  const size = getCurrentSize(p.ships);
  $('readyBtn').disabled = size !== null;
  setStatus(size
    ? `Поставьте ${SHIP_NAMES[size]}`
    : 'Все корабли расставлены — нажмите «Готово»');
  updatePreview();
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  getTrayState(players[placingIdx].ships).forEach(t => {
    const item = document.createElement('div');
    item.className = 'tray-item' + (t.placed ? ' placed' : '') + (t.current ? ' current' : '');
    const ship = document.createElement('div');
    ship.className = 'tray-ship s' + t.size;
    ship.style.width = (t.size === 1 ? 22 : t.size * 28) + 'px';
    item.appendChild(ship);
    tray.appendChild(item);
  });
}

// Полупрозрачный предпросмотр корабля под курсором (зелёный — можно, красный — нельзя)
function updatePreview() {
  const grid = $('placementGrid');
  const old = grid.querySelector('.preview-layer');
  if (old) old.remove();
  if (!hoverPos) return;

  const p = players[placingIdx];
  const [hr, hc] = hoverPos;
  if (p.board[hr][hc] === 'ship') return;           // клик по кораблю его уберёт — предпросмотр не нужен
  const size = getCurrentSize(p.ships);
  if (!size) return;

  const cells = placementCells(hr, hc, size);
  const valid = canPlace(p.board, cells);
  const layer = document.createElement('div');
  layer.className = 'layer preview-layer';
  layer.appendChild(createHull(cells, false, 'preview ' + (valid ? 'valid' : 'invalid')));
  grid.appendChild(layer);
}

function onPlacementClick(r, c) {
  const p = players[placingIdx];

  // клик по уже стоящему кораблю — «поднять» его обратно
  if (p.board[r][c] === 'ship') {
    const idx = p.ships.findIndex(cells => cells.some(([sr, sc]) => sr === r && sc === c));
    if (idx !== -1) {
      p.ships[idx].forEach(([sr, sc]) => p.board[sr][sc] = null);
      p.ships.splice(idx, 1);
    }
    renderPlacement();
    return;
  }

  const size = getCurrentSize(p.ships);
  if (!size) return;
  const cells = placementCells(r, c, size);
  if (!canPlace(p.board, cells)) {
    setStatus('Сюда нельзя: клетка занята или корабль касается другого корабля.');
    return;
  }
  cells.forEach(([rr, cc]) => p.board[rr][cc] = 'ship');
  p.ships.push(cells);
  playPlaceSound();
  renderPlacement();
}

function rotateShip() {
  orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
  $('rotateBtn').textContent = '🔄 Повернуть (R): ' + (orientation === 'horizontal' ? 'горизонтально' : 'вертикально');
  updatePreview();
}

function randomPlacement() {
  const p = players[placingIdx];
  p.board = createEmptyBoard();
  p.ships = placeShips(p.board);
  playPlaceSound();
  renderPlacement();
}

function clearPlacement() {
  const p = players[placingIdx];
  p.board = createEmptyBoard();
  p.ships = [];
  renderPlacement();
}

// Игрок нажал «Готово»
function finishPlacement() {
  if (getCurrentSize(players[placingIdx].ships) !== null) return;

  if (mode === 'pc') {
    players[1].board = createEmptyBoard();
    players[1].ships = placeShips(players[1].board);   // компьютер расставляет случайно
    startBattle();
  } else if (placingIdx === 0) {
    showHandoff(
      `Очередь: ${players[1].name}`,
      `${players[0].name}, ваши корабли спрятаны. Передайте устройство игроку «${players[1].name}» — ему нужно расставить свои корабли.`,
      'Я готов(а) расставлять',
      () => startPlacement(1)
    );
  } else {
    showHandoff(
      'Флоты готовы!',
      `Передайте устройство игроку «${players[0].name}» — он ходит первым.`,
      'Начать бой',
      startBattle
    );
  }
}

// ============================================================
// БОЙ
// ============================================================
function startBattle() {
  current = 0;
  gameOver = false;
  locked = false;
  aiTargets = [];
  showScreen('battle');
  renderBattle();
  setStatus(mode === 'pc'
    ? 'Стреляйте по полю противника — кликните по клетке справа'
    : `Ход: ${players[0].name}. Стреляйте по полю противника.`);
}

// firedOwner / firedPos — чьё поле только что обстреляли (для анимации взрыва)
function renderBattle(firedOwner, firedPos) {
  const viewIdx = mode === 'pc' ? 0 : current;          // чьими глазами смотрим на экран
  const me = players[viewIdx];
  const foe = players[1 - viewIdx];
  const canShoot = !gameOver && !locked && current === viewIdx;

  $('ownTitle').textContent = mode === 'pc' ? '🏴 Ваш флот' : `🏴 Флот: ${me.name}`;
  $('foeTitle').textContent = mode === 'pc' ? '🌊 Поле противника' : `🌊 Поле: ${foe.name}`;

  renderBoard('playerGrid', me.board, me.ships, {
    showAllShips: true,
    justFired: firedOwner === viewIdx ? firedPos : null
  });
  renderBoard('enemyGrid', foe.board, foe.ships, {
    interactive: canShoot,
    showAllShips: gameOver,                              // в конце игры показываем все корабли врага
    justFired: firedOwner === 1 - viewIdx ? firedPos : null,
    onCellClick: humanFire
  });
}

// Проверка, потоплен ли корабль, которому принадлежит клетка (r, c)
function checkSunk(board, ships, r, c) {
  const ship = ships.find(cells => cells.some(([sr, sc]) => sr === r && sc === c));
  if (!ship) return null;
  const allHit = ship.every(([sr, sc]) => board[sr][sc] === 'hit' || board[sr][sc] === 'sunk');
  if (allHit) {
    ship.forEach(([sr, sc]) => board[sr][sc] = 'sunk');
    return ship;
  }
  return null;
}

function allSunk(board, ships) {
  return ships.every(cells => cells.every(([r, c]) => board[r][c] === 'sunk'));
}

// Клик игрока по полю противника
function humanFire(r, c) {
  if (gameOver || locked) return;
  if (mode === 'pc' && current !== 0) return;
  shoot(current, r, c);
}

// Один выстрел (общий для человека, второго игрока и компьютера)
function shoot(attackerIdx, r, c) {
  const defIdx = 1 - attackerIdx;
  const att = players[attackerIdx];
  const def = players[defIdx];
  const isAi = mode === 'pc' && attackerIdx === 1;
  let result = 'miss';

  if (def.board[r][c] === 'ship') {
    def.board[r][c] = 'hit';
    result = checkSunk(def.board, def.ships, r, c) ? 'sunk' : 'hit';
  } else {
    def.board[r][c] = 'miss';
  }

  if (result === 'sunk') playSunkSound();
  else if (result === 'hit') playHitSound();
  else playMissSound();

  // память ИИ: после попадания — добиваем соседей, после потопления — забываем
  if (isAi) {
    if (result === 'hit') addAdjacentTargets(r, c);
    else if (result === 'sunk') aiTargets = [];
  }

  const won = result !== 'miss' && allSunk(def.board, def.ships);
  if (won) {
    gameOver = true;
  } else if (result === 'miss') {
    if (mode === 'pc') current = defIdx;                 // ход сразу переходит к другой стороне
    else locked = true;                                   // pvp: ждём экран передачи хода
  }

  renderBattle(defIdx, [r, c]);

  if (won) { finishGame(attackerIdx); return; }

  // --- попал: стреляет ещё раз ---
  if (result !== 'miss') {
    if (isAi) {
      setStatus(result === 'sunk'
        ? 'Компьютер потопил ваш корабль! Его ход продолжается...'
        : 'Компьютер попал! Его ход продолжается...');
      later(computerTurn, 700);
    } else if (mode === 'pc') {
      setStatus(result === 'sunk'
        ? 'Корабль противника потоплен! 💥 Стреляйте ещё раз.'
        : 'Попадание! Стреляйте ещё раз.');
    } else {
      setStatus(`${att.name}: ${result === 'sunk' ? 'корабль потоплен! 💥' : 'попадание!'} Стреляйте ещё раз.`);
    }
    return;
  }

  // --- промах: ход передаётся ---
  if (mode === 'pc') {
    if (isAi) {
      setStatus('Компьютер промахнулся. Ваш ход!');
    } else {
      setStatus('Промах! Ход компьютера...');
      later(computerTurn, 700);
    }
  } else {
    setStatus(`Промах! Ход переходит к игроку «${def.name}»...`);
    later(() => {
      showHandoff(
        `Ход: ${def.name}`,
        `${att.name}, отвернитесь от экрана! Передайте устройство игроку «${def.name}».`,
        'Я готов(а)',
        () => {
          current = defIdx;
          locked = false;
          renderBattle();
          setStatus(`Ход: ${def.name}. Стреляйте по полю противника.`);
        }
      );
    }, 1200);
  }
}

// ===== ИИ компьютера =====
function isFired(board, r, c) {
  return board[r][c] === 'hit' || board[r][c] === 'miss' || board[r][c] === 'sunk';
}

function addAdjacentTargets(r, c) {
  const board = players[0].board;
  [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !isFired(board, nr, nc)) {
      aiTargets.push([nr, nc]);
    }
  });
}

function pickAiTarget() {
  const board = players[0].board;
  while (aiTargets.length > 0) {
    const [r, c] = aiTargets.shift();
    if (!isFired(board, r, c)) return [r, c];            // пропускаем клетки, куда уже стреляли
  }
  let r, c;
  do {
    r = Math.floor(Math.random() * SIZE);
    c = Math.floor(Math.random() * SIZE);
  } while (isFired(board, r, c));
  return [r, c];
}

function computerTurn() {
  if (gameOver || mode !== 'pc' || current !== 1) return;
  const [r, c] = pickAiTarget();
  shoot(1, r, c);
}

// ===== Конец игры =====
function finishGame(winnerIdx) {
  let win = true;
  if (mode === 'pc') {
    win = winnerIdx === 0;
    setStatus(win
      ? '🎉 Вы победили! Весь флот противника потоплен.'
      : '💀 Поражение. Ваш флот уничтожен.');
  } else {
    setStatus(`🎉 ${players[winnerIdx].name} побеждает! Весь флот противника потоплен.`);
  }
  playHornSound(win);
}

// ============================================================
// ОБРАБОТЧИКИ
// ============================================================
$('modePcBtn').addEventListener('click', () => chooseMode('pc'));
$('modePvpBtn').addEventListener('click', () => chooseMode('pvp'));

$('rotateBtn').addEventListener('click', rotateShip);
$('randomBtn').addEventListener('click', randomPlacement);
$('clearBtn').addEventListener('click', clearPlacement);
$('readyBtn').addEventListener('click', finishPlacement);

$('handoffBtn').addEventListener('click', () => {
  $('handoff').hidden = true;
  const cb = handoffCallback;
  handoffCallback = null;
  if (cb) cb();
});

$('newGameBtn').addEventListener('click', goToMenu);

$('soundBtn').addEventListener('click', function () {
  soundOn = !soundOn;
  this.textContent = soundOn ? '🔊 Звук: вкл' : '🔇 Звук: выкл';
});

// Клавиша R поворачивает корабль (работает и на русской раскладке)
document.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && !$('placementScreen').hidden && $('handoff').hidden) {
    rotateShip();
  }
});

// ===== Старт: показываем меню =====
goToMenu();

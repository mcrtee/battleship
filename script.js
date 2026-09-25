// ============================================================
// МОРСКОЙ БОЙ — логика игры
// ============================================================

// ===== Константы игры =====

const SIZE = 8;

const SHIP_SIZES = [3, 2, 2, 1, 1];


// ===== Состояние игры =====

let playerBoard;
let enemyBoard;

let playerShips;
let enemyShips;

let gameOver = false;
let playerTurn = true;

let soundOn = true;


// ============================================================
// ЗВУКИ
// ============================================================

let audioCtx = null;


function getAudioCtx() {

  if (!audioCtx) {
    audioCtx =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();
  }

  return audioCtx;
}


// ===== Звук попадания =====

function playHitSound() {

  if (!soundOn) return;

  const ctx = getAudioCtx();


  // шумовой удар

  const noiseBuffer =
    ctx.createBuffer(
      1,
      ctx.sampleRate * 0.35,
      ctx.sampleRate
    );

  const data =
    noiseBuffer.getChannelData(0);


  for (let i = 0; i < data.length; i++) {

    data[i] =
      (Math.random() * 2 - 1) *
      (1 - i / data.length);

  }


  const noise =
    ctx.createBufferSource();

  noise.buffer = noiseBuffer;


  const noiseFilter =
    ctx.createBiquadFilter();

  noiseFilter.type = 'lowpass';

  noiseFilter.frequency.setValueAtTime(
    700,
    ctx.currentTime
  );


  const noiseGain =
    ctx.createGain();

  noiseGain.gain.setValueAtTime(
    0.5,
    ctx.currentTime
  );

  noiseGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.35
  );


  noise
    .connect(noiseFilter)
    .connect(noiseGain)
    .connect(ctx.destination);

  noise.start();

  noise.stop(
    ctx.currentTime + 0.35
  );


  // низкий пушечный гул

  const thud =
    ctx.createOscillator();

  thud.type = 'sine';

  thud.frequency.setValueAtTime(
    90,
    ctx.currentTime
  );

  thud.frequency.exponentialRampToValueAtTime(
    40,
    ctx.currentTime + 0.3
  );


  const thudGain =
    ctx.createGain();

  thudGain.gain.setValueAtTime(
    0.6,
    ctx.currentTime
  );

  thudGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.3
  );


  thud
    .connect(thudGain)
    .connect(ctx.destination);

  thud.start();

  thud.stop(
    ctx.currentTime + 0.3
  );
}


// ===== Звук промаха =====

function playMissSound() {

  if (!soundOn) return;

  const ctx = getAudioCtx();


  const splashBuffer =
    ctx.createBuffer(
      1,
      ctx.sampleRate * 0.25,
      ctx.sampleRate
    );

  const data =
    splashBuffer.getChannelData(0);


  for (let i = 0; i < data.length; i++) {

    data[i] =
      (Math.random() * 2 - 1) *
      (1 - i / data.length);

  }


  const splash =
    ctx.createBufferSource();

  splash.buffer = splashBuffer;


  const bandpass =
    ctx.createBiquadFilter();

  bandpass.type = 'bandpass';

  bandpass.frequency.setValueAtTime(
    1400,
    ctx.currentTime
  );

  bandpass.Q.value = 0.8;


  const splashGain =
    ctx.createGain();

  splashGain.gain.setValueAtTime(
    0.4,
    ctx.currentTime
  );

  splashGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.25
  );


  splash
    .connect(bandpass)
    .connect(splashGain)
    .connect(ctx.destination);

  splash.start();

  splash.stop(
    ctx.currentTime + 0.25
  );


  // капля

  const drop =
    ctx.createOscillator();

  drop.type = 'sine';

  drop.frequency.setValueAtTime(
    700,
    ctx.currentTime
  );

  drop.frequency.exponentialRampToValueAtTime(
    180,
    ctx.currentTime + 0.2
  );


  const dropGain =
    ctx.createGain();

  dropGain.gain.setValueAtTime(
    0.25,
    ctx.currentTime
  );

  dropGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.2
  );


  drop
    .connect(dropGain)
    .connect(ctx.destination);

  drop.start();

  drop.stop(
    ctx.currentTime + 0.2
  );
}


// ===== Звук потопления =====

function playSunkSound() {

  if (!soundOn) return;

  playHitSound();

  const ctx = getAudioCtx();


  const groan =
    ctx.createOscillator();

  groan.type = 'sawtooth';

  groan.frequency.setValueAtTime(
    160,
    ctx.currentTime
  );

  groan.frequency.exponentialRampToValueAtTime(
    50,
    ctx.currentTime + 0.8
  );


  const groanFilter =
    ctx.createBiquadFilter();

  groanFilter.type = 'lowpass';

  groanFilter.frequency.value = 400;


  const groanGain =
    ctx.createGain();

  groanGain.gain.setValueAtTime(
    0.001,
    ctx.currentTime
  );

  groanGain.gain.linearRampToValueAtTime(
    0.25,
    ctx.currentTime + 0.1
  );

  groanGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.8
  );


  groan
    .connect(groanFilter)
    .connect(groanGain)
    .connect(ctx.destination);

  groan.start();

  groan.stop(
    ctx.currentTime + 0.8
  );
}


// ===== Звук окончания игры =====

function playHornSound(win) {

  if (!soundOn) return;

  const ctx = getAudioCtx();


  const horn =
    ctx.createOscillator();

  horn.type = 'sawtooth';

  horn.frequency.setValueAtTime(
    win ? 220 : 130,
    ctx.currentTime
  );


  const hornFilter =
    ctx.createBiquadFilter();

  hornFilter.type = 'lowpass';

  hornFilter.frequency.value = 500;


  const hornGain =
    ctx.createGain();

  hornGain.gain.setValueAtTime(
    0.001,
    ctx.currentTime
  );

  hornGain.gain.linearRampToValueAtTime(
    0.3,
    ctx.currentTime + 0.05
  );

  hornGain.gain.setValueAtTime(
    0.3,
    ctx.currentTime + 0.5
  );

  hornGain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.9
  );


  horn
    .connect(hornFilter)
    .connect(hornGain)
    .connect(ctx.destination);

  horn.start();

  horn.stop(
    ctx.currentTime + 0.9
  );
}


// ============================================================
// СОЗДАНИЕ И РАССТАНОВКА КОРАБЛЕЙ
// ============================================================


// ===== Создание пустого поля =====

function createEmptyBoard() {

  return Array.from(
    { length: SIZE },
    () => Array(SIZE).fill(null)
  );

}


// ===== Случайная расстановка кораблей =====

function placeShips(board) {

  const ships = [];


  for (const size of SHIP_SIZES) {

    let placed = false;


    while (!placed) {

      const horizontal =
        Math.random() < 0.5;

      const row =
        Math.floor(Math.random() * SIZE);

      const col =
        Math.floor(Math.random() * SIZE);


      const cells = [];

      let fits = true;


      for (let i = 0; i < size; i++) {

        const r =
          horizontal
            ? row
            : row + i;

        const c =
          horizontal
            ? col + i
            : col;


        if (
          r >= SIZE ||
          c >= SIZE ||
          board[r][c] !== null
        ) {

          fits = false;

          break;
        }


        cells.push([r, c]);
      }


      if (
        fits &&
        !hasAdjacentShip(board, cells)
      ) {

        cells.forEach(([r, c]) => {

          board[r][c] = 'ship';

        });


        ships.push(cells);

        placed = true;
      }

    }
  }


  return ships;
}


// ===== Проверка соседних кораблей =====

function hasAdjacentShip(board, cells) {

  for (const [r, c] of cells) {

    for (let dr = -1; dr <= 1; dr++) {

      for (let dc = -1; dc <= 1; dc++) {

        const nr = r + dr;
        const nc = c + dc;


        if (
          nr >= 0 &&
          nr < SIZE &&
          nc >= 0 &&
          nc < SIZE &&
          board[nr][nc] === 'ship'
        ) {

          return true;
        }

      }
    }
  }


  return false;
}


// ============================================================
// ОПРЕДЕЛЕНИЕ ФОРМЫ КОРАБЛЯ
// ============================================================

function getShipShape(cells) {

  const rows =
    cells.map(([r]) => r);

  const cols =
    cells.map(([, c]) => c);


  const rowStart =
    Math.min(...rows);

  const colStart =
    Math.min(...cols);

  const length =
    cells.length;


  let orientation = 'single';


  if (length > 1) {

    orientation =
      rows[0] === rows[1]
        ? 'horizontal'
        : 'vertical';

  }


  return {
    rowStart,
    colStart,
    length,
    orientation
  };
}


// ============================================================
// ОТРИСОВКА ПОЛЯ
// ============================================================

function renderBoard(
  gridId,
  board,
  ships,
  options = {}
) {

  const grid =
    document.getElementById(gridId);

  grid.innerHTML = '';


  const cellsLayer =
    document.createElement('div');

  cellsLayer.className =
    'layer cells-layer';


  const shipLayer =
    document.createElement('div');

  shipLayer.className =
    'layer ship-layer';


  const marksLayer =
    document.createElement('div');

  marksLayer.className =
    'layer marks-layer';


  // ===== Клетки воды =====

  for (let r = 0; r < SIZE; r++) {

    for (let c = 0; c < SIZE; c++) {

      const cell =
        document.createElement('div');

      cell.className = 'cell';

      cell.dataset.r = r;
      cell.dataset.c = c;


      const val =
        board[r][c];


      const alreadyFired =
        val === 'hit' ||
        val === 'miss' ||
        val === 'sunk';


      if (
        options.interactive &&
        !gameOver &&
        !alreadyFired
      ) {

        cell.classList.add(
          'clickable'
        );


        cell.addEventListener(
          'click',
          () => options.onCellClick(r, c)
        );

      }


      cellsLayer.appendChild(cell);

    }
  }


  // ===== Корабли =====

  ships.forEach(cells => {

    const allSunk =
      cells.every(
        ([r, c]) =>
          board[r][c] === 'sunk'
      );


    if (
      !options.showAllShips &&
      !allSunk
    ) {

      return;
    }


    const {
      rowStart,
      colStart,
      length,
      orientation
    } = getShipShape(cells);


    const wrap =
      document.createElement('div');

    wrap.className =
      'hull-wrap';


    if (orientation === 'horizontal') {

      wrap.style.gridRow =
        String(rowStart + 1);

      wrap.style.gridColumn =
        (colStart + 1) +
        ' / span ' +
        length;

    }

    else if (orientation === 'vertical') {

      wrap.style.gridColumn =
        String(colStart + 1);

      wrap.style.gridRow =
        (rowStart + 1) +
        ' / span ' +
        length;

    }

    else {

      wrap.style.gridRow =
        String(rowStart + 1);

      wrap.style.gridColumn =
        String(colStart + 1);

    }


    const hull =
      document.createElement('div');

    hull.className =
      'hull ' +
      orientation +
      (allSunk ? ' sunk' : '');


    wrap.appendChild(hull);

    shipLayer.appendChild(wrap);

  });


  // ===== Отметки выстрелов =====

  let fireMarkEl = null;


  for (let r = 0; r < SIZE; r++) {

    for (let c = 0; c < SIZE; c++) {

      const val =
        board[r][c];


      if (
        val !== 'hit' &&
        val !== 'miss' &&
        val !== 'sunk'
      ) {

        continue;
      }


      const mark =
        document.createElement('div');


      mark.className =
        'mark ' +
        (val === 'miss'
          ? 'miss'
          : 'hit');


      mark.style.gridRow =
        String(r + 1);

      mark.style.gridColumn =
        String(c + 1);


      marksLayer.appendChild(mark);


      if (
        options.justFired &&
        options.justFired[0] === r &&
        options.justFired[1] === c
      ) {

        fireMarkEl = mark;

      }

    }
  }


  grid.appendChild(cellsLayer);
  grid.appendChild(shipLayer);
  grid.appendChild(marksLayer);


  if (fireMarkEl) {

    showExplosion(fireMarkEl);

  }
}


// ===== Поле игрока =====

function renderPlayerBoard(justFired) {

  renderBoard(
    'playerGrid',
    playerBoard,
    playerShips,
    {
      showAllShips: true,
      justFired
    }
  );

}


// ===== Поле противника =====

function renderEnemyBoard(justFired) {

  renderBoard(
    'enemyGrid',
    enemyBoard,
    enemyShips,
    {
      interactive: true,
      showAllShips: false,
      justFired,
      onCellClick: playerFire
    }
  );

}


// ============================================================
// АНИМАЦИЯ ВЗРЫВА
// ============================================================

function showExplosion(markEl) {

  const boom =
    document.createElement('div');

  boom.className =
    'explosion';


  const core =
    document.createElement('div');

  core.className = 'core';

  boom.appendChild(core);


  for (let i = 0; i < 8; i++) {

    const spark =
      document.createElement('div');

    spark.className =
      'spark';


    const angle =
      (Math.PI * 2 * i) / 8;


    const dist =
      26 + Math.random() * 10;


    spark.style.setProperty(
      '--dx',
      Math.cos(angle) * dist + 'px'
    );


    spark.style.setProperty(
      '--dy',
      Math.sin(angle) * dist + 'px'
    );


    boom.appendChild(spark);

  }


  markEl.appendChild(boom);


  setTimeout(
    () => boom.remove(),
    550
  );
}


// ============================================================
// ПРОВЕРКА ПОТОПЛЕНИЯ
// ============================================================

function checkSunk(
  board,
  ships,
  r,
  c
) {

  const ship =
    ships.find(
      cells =>
        cells.some(
          ([sr, sc]) =>
            sr === r &&
            sc === c
        )
    );


  if (!ship) {
    return null;
  }


  const allHit =
    ship.every(
      ([sr, sc]) =>
        board[sr][sc] === 'hit' ||
        board[sr][sc] === 'sunk'
    );


  if (allHit) {

    ship.forEach(
      ([sr, sc]) => {

        board[sr][sc] = 'sunk';

      }
    );


    return ship;
  }


  return null;
}


// ===== Проверка победы =====

function allSunk(board, ships) {

  return ships.every(
    cells =>
      cells.every(
        ([r, c]) =>
          board[r][c] === 'sunk'
      )
  );

}


// ============================================================
// ВЫСТРЕЛ ИГРОКА
// ============================================================

function playerFire(r, c) {

  if (
    gameOver ||
    !playerTurn
  ) {

    return;
  }


  if (
    enemyBoard[r][c] === 'ship'
  ) {

    enemyBoard[r][c] = 'hit';


    const sunkShip =
      checkSunk(
        enemyBoard,
        enemyShips,
        r,
        c
      );


    if (sunkShip) {

      playSunkSound();

    } else {

      playHitSound();

    }


    renderEnemyBoard([r, c]);


    if (
      allSunk(
        enemyBoard,
        enemyShips
      )
    ) {

      endGame(true);

      return;
    }


    setStatus(
      sunkShip
        ? 'Корабль противника потоплен! 💥 Стреляйте ещё раз.'
        : 'Попадание! Стреляйте ещё раз.'
    );

  }

  else {

    enemyBoard[r][c] = 'miss';

    playMissSound();

    playerTurn = false;

    renderEnemyBoard([r, c]);

    setStatus(
      'Промах! Ход компьютера...'
    );


    setTimeout(
      computerTurn,
      700
    );

  }
}


// ============================================================
// ИИ КОМПЬЮТЕРА
// ============================================================

let aiTargets = [];


function computerTurn() {

  if (gameOver) {
    return;
  }


  let r, c;


  if (aiTargets.length > 0) {

    [r, c] =
      aiTargets.shift();

  }

  else {

    do {

      r =
        Math.floor(
          Math.random() * SIZE
        );

      c =
        Math.floor(
          Math.random() * SIZE
        );

    }

    while (
      playerBoard[r][c] === 'hit' ||
      playerBoard[r][c] === 'miss' ||
      playerBoard[r][c] === 'sunk'
    );

  }


  if (
    playerBoard[r][c] === 'ship'
  ) {

    playerBoard[r][c] = 'hit';


    addAdjacentTargets(r, c);


    const sunkShip =
      checkSunk(
        playerBoard,
        playerShips,
        r,
        c
      );


    if (sunkShip) {

      playSunkSound();

    }

    else {

      playHitSound();

    }


    renderPlayerBoard([r, c]);


    if (
      allSunk(
        playerBoard,
        playerShips
      )
    ) {

      endGame(false);

      return;
    }


    setStatus(
      sunkShip
        ? 'Компьютер потопил ваш корабль! Его ход продолжается...'
        : 'Компьютер попал! Его ход продолжается...'
    );


    setTimeout(
      computerTurn,
      700
    );

  }

  else {

    playerBoard[r][c] = 'miss';

    playMissSound();

    renderPlayerBoard([r, c]);

    playerTurn = true;


    setStatus(
      'Компьютер промахнулся. Ваш ход!'
    );


    renderEnemyBoard();

  }
}


// ============================================================
// ЦЕЛИ ДЛЯ ИИ
// ============================================================

function addAdjacentTargets(r, c) {

  const candidates = [

    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1]

  ];


  for (const [nr, nc] of candidates) {

    if (
      nr >= 0 &&
      nr < SIZE &&
      nc >= 0 &&
      nc < SIZE &&

      playerBoard[nr][nc] !== 'hit' &&
      playerBoard[nr][nc] !== 'miss' &&
      playerBoard[nr][nc] !== 'sunk'
    ) {

      aiTargets.push([nr, nc]);

    }

  }

}


// ============================================================
// СТАТУС И ЗАВЕРШЕНИЕ
// ============================================================

function setStatus(text) {

  document.getElementById(
    'status'
  ).textContent = text;

}


function endGame(playerWon) {

  gameOver = true;

  playHornSound(playerWon);


  setStatus(
    playerWon
      ? '🎉 Вы победили! Весь флот противника потоплен.'
      : '💀 Поражение. Ваш флот уничтожен.'
  );


  renderEnemyBoard();

}


// ============================================================
// НОВАЯ ИГРА
// ============================================================

function newGame() {

  playerBoard =
    createEmptyBoard();

  enemyBoard =
    createEmptyBoard();


  playerShips =
    placeShips(playerBoard);

  enemyShips =
    placeShips(enemyBoard);


  gameOver = false;

  playerTurn = true;

  aiTargets = [];


  setStatus(
    'Стреляйте по полю противника — кликните по клетке справа'
  );


  renderPlayerBoard();

  renderEnemyBoard();

}


// ============================================================
// КНОПКИ
// ============================================================

document
  .getElementById('newGameBtn')
  .addEventListener(
    'click',
    newGame
  );


document
  .getElementById('soundBtn')
  .addEventListener(
    'click',
    function () {

      soundOn = !soundOn;


      this.textContent =
        soundOn
          ? '🔊 Звук: вкл'
          : '🔇 Звук: выкл';

    }
  );


// ============================================================
// ЗАПУСК ИГРЫ
// ============================================================

newGame();
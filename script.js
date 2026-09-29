(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMessage = document.getElementById('overlayMessage');
  const startButton = document.getElementById('startButton');
  const pauseButton = document.getElementById('pauseButton');
  const restartButton = document.getElementById('restartButton');
  const soundToggle = document.getElementById('soundToggle');
  const languageToggle = document.getElementById('languageToggle');
  const scoreValue = document.getElementById('scoreValue');
  const highScoreValue = document.getElementById('highScoreValue');
  const levelValue = document.getElementById('levelValue');
  const speedValue = document.getElementById('speedValue');
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');
  const stateLabel = document.getElementById('stateLabel');
  const roundLabel = document.getElementById('roundLabel');
  const obstacleCount = document.getElementById('obstacleCount');

  const GRID = 20;
  const CELL = canvas.width / GRID;
  const LEVEL_GOAL = 5;
  const COLORS = { bg: '#091021', grid: '#101b32', gridStrong: '#172645', snake: '#a9ff68', snakeDark: '#4d7e33', food: '#ff6f9f', gold: '#ffd35a', obstacle: '#62e7ff', obstacleDark: '#244f69' };
  const storedHighScore = Number(localStorage.getItem('pixelSnakeHighScore') || 0);

  let snake;
  let direction;
  let queuedDirection;
  let food;
  let obstacles;
  let score = 0;
  let highScore = storedHighScore;
  let level = 1;
  let foodsThisLevel = 0;
  let round = 1;
  let running = false;
  let paused = false;
  let gameOver = false;
  let boostTicks = 0;
  let recordThisRun = false;
  let timer = null;
  let soundOn = true;
  let englishFirst = false;
  let audioContext = null;

  const text = {
    ready: ['READY / 准备', '准备开始 / Ready to play'],
    playing: ['PLAYING / 游戏中', '正在游戏 / Keep moving'],
    paused: ['PAUSED / 已暂停', '游戏已暂停 / Press START or SPACE to continue'],
    over: ['GAME OVER / 游戏结束', '撞到了！再试一次 / Try another run'],
    win: ['NEW RECORD / 新纪录', '你刷新了最高分 / New high score unlocked'],
  };

  function setText(element, chinese, english) {
    element.textContent = englishFirst ? `${english} / ${chinese}` : `${chinese} / ${english}`;
  }

  function syncStaticLanguage() {
    const labels = document.querySelectorAll('[data-zh][data-en]');
    labels.forEach((element) => {
      element.textContent = englishFirst ? element.dataset.en : element.dataset.zh;
    });
  }

  function setState(key) {
    const [state, message] = text[key];
    setText(stateLabel, state.split(' / ')[0], state.split(' / ')[1]);
    if (key === 'ready' || key === 'over' || key === 'win') {
      setText(overlayMessage, message.split(' / ')[0], message.split(' / ')[1]);
    }
    stateLabel.classList.toggle('state-danger', key === 'over');
  }

  function formatNumber(number) { return String(number).padStart(4, '0'); }

  function updateHud() {
    scoreValue.textContent = formatNumber(score);
    highScoreValue.textContent = formatNumber(highScore);
    levelValue.textContent = String(level).padStart(2, '0');
    speedValue.textContent = String(Math.min(level + (boostTicks > 0 ? 2 : 0), 9)).padStart(2, '0');
    progressText.textContent = `${foodsThisLevel} / ${LEVEL_GOAL}`;
    progressBar.style.width = `${(foodsThisLevel / LEVEL_GOAL) * 100}%`;
    obstacleCount.textContent = `OBSTACLES ${String(obstacles.length).padStart(2, '0')}`;
    roundLabel.textContent = `ROUND ${String(round).padStart(2, '0')} / 回合 ${String(round).padStart(2, '0')}`;
  }

  function resetGame() {
    stopTimer();
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    direction = { x: 1, y: 0 };
    queuedDirection = { x: 1, y: 0 };
    score = 0;
    level = 1;
    foodsThisLevel = 0;
    boostTicks = 0;
    recordThisRun = false;
    paused = false;
    gameOver = false;
    running = false;
    obstacles = createObstacles(level);
    food = createFood();
    updateHud();
    setState('ready');
    overlayTitle.textContent = 'READY?';
    overlay.classList.remove('hidden');
    pauseButton.disabled = true;
    draw();
  }

  function createObstacles(currentLevel) {
    const count = Math.min(Math.max(0, currentLevel - 1) * 2, 14);
    const result = [];
    let attempts = 0;
    while (result.length < count && attempts < 400) {
      attempts += 1;
      const candidate = { x: 2 + Math.floor(Math.random() * (GRID - 4)), y: 2 + Math.floor(Math.random() * (GRID - 4)) };
      const nearStart = candidate.x >= 5 && candidate.x <= 11 && candidate.y >= 8 && candidate.y <= 12;
      const tooClose = result.some((item) => Math.abs(item.x - candidate.x) + Math.abs(item.y - candidate.y) < 3);
      if (!nearStart && !tooClose) result.push(candidate);
    }
    return result;
  }

  function isOccupied(point) {
    return snake.some((segment) => segment.x === point.x && segment.y === point.y)
      || obstacles.some((obstacle) => obstacle.x === point.x && obstacle.y === point.y);
  }

  function createFood() {
    let candidate;
    do {
      candidate = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID), boost: Math.random() < 0.14 };
    } while (isOccupied(candidate));
    return candidate;
  }

  function startGame() {
    if (gameOver) resetGame();
    running = true;
    paused = false;
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    setState('playing');
    startAudio();
    scheduleTick();
  }

  function stopTimer() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  function scheduleTick() {
    stopTimer();
    if (running && !paused && !gameOver) timer = window.setTimeout(tick, getTickRate());
  }

  function getTickRate() { return Math.max(62, 178 - (level - 1) * 13 - (boostTicks > 0 ? 42 : 0)); }

  function tick() {
    if (!running || paused || gameOver) return;
    direction = queuedDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const hitsWall = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID;
    const hitsObstacle = obstacles.some((obstacle) => obstacle.x === head.x && obstacle.y === head.y);
    const hitsSelf = snake.some((segment, index) => index > 0 && segment.x === head.x && segment.y === head.y);
    if (hitsWall || hitsObstacle || hitsSelf) {
      endGame();
      return;
    }

    snake.unshift(head);
    const ate = head.x === food.x && head.y === food.y;
    if (ate) {
      score += food.boost ? 30 : 10;
      if (score > highScore) {
        highScore = score;
        recordThisRun = true;
        localStorage.setItem('pixelSnakeHighScore', String(highScore));
      }
      foodsThisLevel += 1;
      boostTicks = food.boost ? 25 : 0;
      playTone(food.boost ? 880 : 620, .08, 'square');
      if (foodsThisLevel >= LEVEL_GOAL) advanceLevel();
      food = createFood();
    } else {
      snake.pop();
    }
    if (boostTicks > 0) boostTicks -= 1;
    updateHud();
    draw();
    scheduleTick();
  }

  function advanceLevel() {
    level += 1;
    foodsThisLevel = 0;
    obstacles = createObstacles(level);
    playTone(980, .1, 'square');
    window.setTimeout(() => playTone(1240, .12, 'square'), 90);
  }

  function endGame() {
    running = false;
    gameOver = true;
    stopTimer();
    pauseButton.disabled = true;
    const newRecord = score > 0 && recordThisRun;
    setState(newRecord ? 'win' : 'over');
    overlayTitle.textContent = newRecord ? 'NEW RECORD!' : 'GAME OVER';
    overlayMessage.innerHTML = `${newRecord ? '新纪录！' : '撞到了！'}<br />SCORE ${formatNumber(score)} · 按 START 再来一局`;
    overlay.classList.remove('hidden');
    playTone(newRecord ? 740 : 180, .14, newRecord ? 'square' : 'sawtooth');
    window.setTimeout(() => playTone(newRecord ? 990 : 120, .16, newRecord ? 'square' : 'sawtooth'), 130);
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (paused) {
      setState('paused');
      overlayTitle.textContent = 'PAUSED';
      overlayMessage.innerHTML = '游戏已暂停<br />Press SPACE or START to continue';
      overlay.classList.remove('hidden');
      stopTimer();
    } else {
      overlay.classList.add('hidden');
      setState('playing');
      scheduleTick();
    }
  }

  function setDirection(next) {
    if (!running || paused) return;
    if (next.x + direction.x === 0 && next.y + direction.y === 0) return;
    queuedDirection = next;
  }

  function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    obstacles.forEach(drawObstacle);
    drawFood();
    snake.slice().reverse().forEach((segment, reverseIndex) => drawSnakeSegment(segment, snake.length - reverseIndex - 1));
  }

  function drawGrid() {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i += 1) {
      const position = i * CELL + .5;
      ctx.beginPath(); ctx.moveTo(position, 0); ctx.lineTo(position, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, position); ctx.lineTo(canvas.width, position); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.gridStrong;
    for (let i = 0; i < GRID; i += 5) {
      const position = i * CELL + .5;
      ctx.beginPath(); ctx.moveTo(position, 0); ctx.lineTo(position, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, position); ctx.lineTo(canvas.width, position); ctx.stroke();
    }
  }

  function drawSnakeSegment(segment, index) {
    const inset = index === 0 ? 2 : 3;
    const x = segment.x * CELL + inset;
    const y = segment.y * CELL + inset;
    ctx.fillStyle = index === 0 ? COLORS.lime : COLORS.snake;
    ctx.fillRect(x, y, CELL - inset * 2, CELL - inset * 2);
    ctx.fillStyle = index === 0 ? '#d5ff9e' : COLORS.snakeDark;
    ctx.fillRect(x + 4, y + 4, 5, 5);
    if (index === 0) {
      ctx.fillStyle = '#0b0f20';
      const eyeX = direction.x < 0 ? x + 5 : direction.x > 0 ? x + CELL - 10 : x + 6;
      const eyeY = direction.y < 0 ? y + 5 : direction.y > 0 ? y + CELL - 10 : y + 6;
      ctx.fillRect(eyeX, eyeY, 4, 4);
      if (direction.y === 0) ctx.fillRect(eyeX, y + CELL - 10, 4, 4);
      if (direction.x === 0) ctx.fillRect(x + CELL - 10, eyeY, 4, 4);
    }
  }

  function drawObstacle(obstacle) {
    const x = obstacle.x * CELL + 3;
    const y = obstacle.y * CELL + 3;
    ctx.fillStyle = COLORS.obstacleDark;
    ctx.fillRect(x, y, CELL - 6, CELL - 6);
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(x + 4, y + 4, CELL - 14, 4);
    ctx.fillRect(x + 4, y + 11, 7, 4);
    ctx.fillRect(x + 14, y + 11, 4, 4);
  }

  function drawFood() {
    const x = food.x * CELL;
    const y = food.y * CELL;
    const color = food.boost ? COLORS.gold : COLORS.food;
    ctx.fillStyle = color;
    ctx.fillRect(x + 7, y + 7, CELL - 14, CELL - 14);
    ctx.fillRect(x + 11, y + 3, CELL - 22, CELL - 6);
    ctx.fillStyle = '#fff2b0';
    ctx.fillRect(x + 9, y + 8, 4, 4);
    if (food.boost) {
      ctx.fillStyle = '#fff7ce';
      ctx.fillRect(x + 14, y + 12, 4, 4);
    }
  }

  function startAudio() {
    if (!soundOn) return;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function playTone(frequency, duration, type) {
    if (!soundOn) return;
    try {
      startAudio();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch (error) { /* Audio is an enhancement; gameplay still works if unavailable. */ }
  }

  startButton.addEventListener('click', () => {
    if (paused) togglePause(); else startGame();
  });
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', () => { resetGame(); startGame(); });
  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    soundToggle.innerHTML = soundOn ? '♫ <span>音效 ON</span>' : '× <span>音效 OFF</span>';
    if (soundOn) playTone(600, .08, 'square');
  });
  languageToggle.addEventListener('click', () => {
    englishFirst = !englishFirst;
    languageToggle.setAttribute('aria-pressed', String(englishFirst));
    document.documentElement.lang = englishFirst ? 'en' : 'zh-CN';
    syncStaticLanguage();
  });
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const directions = { w: { x: 0, y: -1 }, arrowup: { x: 0, y: -1 }, s: { x: 0, y: 1 }, arrowdown: { x: 0, y: 1 }, a: { x: -1, y: 0 }, arrowleft: { x: -1, y: 0 }, d: { x: 1, y: 0 }, arrowright: { x: 1, y: 0 } };
    if (directions[key]) { event.preventDefault(); setDirection(directions[key]); return; }
    if (key === ' ' || key === 'p') { event.preventDefault(); if (!running && !gameOver) startGame(); else togglePause(); }
    if (key === 'r') { event.preventDefault(); resetGame(); startGame(); }
  });

  resetGame();
})();

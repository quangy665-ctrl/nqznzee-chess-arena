(() => {
  'use strict';

  const { CycleGame, DIRECTIONS, keyOf } = window.CycleCaro;
  const STORAGE_KEY = 'nqznzee-caro-lab-v01';
  const SESSION_KEY = 'nqznzee-caro-session-v1';
  const BOT_DELAY = 360;
  const BOT_LEVELS = Object.freeze({
    easy:    { name: 'Dễ', label: 'Tập sự', thinkMs: 220, elo: 700 },
    normal:  { name: 'Thường', label: 'Chiến thuật', thinkMs: 340, elo: 1000 },
    hard:    { name: 'Khó', label: 'Thợ săn điểm', thinkMs: 430, elo: 1400 },
    extreme: { name: 'Cực khó', label: 'NguyenEngine Caro', thinkMs: 520, elo: 2200 }
  });
  const CHUNK_SIZE = 16;
  const BASE_CELL = 46;
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 1.8;
  const THEME_KEY = 'nqznzee-caro-theme-v1';
  const CHESS_THEME_STORE = 'nqznzee-arena-ultimate-v6';
  const CARO_RATING_STORE = 'nqznzee-caro-ratings-v1';
  const DEFAULT_CARO_ELO = 1000;
  const ONLINE_QUERY = new URLSearchParams(location.search);

  function loadOnlineLaunchHint() {
    const direct = {
      roomId: ONLINE_QUERY.get('online_room') || '',
      roomCode: (ONLINE_QUERY.get('room_code') || '').replace(/\D/g, '').slice(0, 4),
      side: (ONLINE_QUERY.get('side') || '').toUpperCase(),
      gameType: 'caro'
    };
    if (direct.roomId) return direct;
    for (const store of [sessionStorage, localStorage]) {
      try {
        const saved = JSON.parse(store.getItem('nqz-online-launch-v1') || 'null');
        if (saved?.gameType === 'caro' && saved.roomId && Date.now() - Number(saved.savedAt || 0) < 6 * 60 * 60 * 1000) {
          return { roomId: saved.roomId, roomCode: String(saved.roomCode || '').replace(/\D/g, '').slice(0,4), side: String(saved.side || '').toUpperCase(), gameType: 'caro' };
        }
      } catch {}
    }
    return direct;
  }

  // Exact board colors are shared with the NqznZee Chess theme workshop.
  const THEMES = {
    standard: {
      name: 'Mặc Định', note: 'Cổ điển, sạch và rõ nét.',
      light: '#ebe3cf', dark: '#78925d', accent: '#8eb35d', surface: '#222126',
      x: '#f2ead9', o: '#283329', xEdge: '#5c704d', oEdge: '#d7dec8'
    },
    dinosaur: {
      name: 'Khủng Long', note: 'Hóa thạch, rừng tiền sử và sắc rêu.',
      light: '#d9cf9f', dark: '#66894a', accent: '#82b85c', surface: '#20241d',
      x: '#e3d09a', o: '#657f35', xEdge: '#5a4a2d', oEdge: '#d7c479'
    },
    future: {
      name: 'Tương Lai', note: 'Cyber, mecha và lõi năng lượng neon.',
      light: '#17233d', dark: '#352458', accent: '#22d3ee', surface: '#111827',
      x: '#c36cff', o: '#22d3ee', xEdge: '#6d32c6', oEdge: '#087b91'
    },
    renaissance: {
      name: 'Phục Hưng', note: 'Gỗ cung điện, đồng và kim loại dát vàng.',
      light: '#ead7af', dark: '#8e5b42', accent: '#c89b4c', surface: '#281d18',
      x: '#e8bb59', o: '#6f321f', xEdge: '#70451f', oEdge: '#e2af55'
    },
    crystal: {
      name: 'Pha Lê', note: 'Kính băng lam và mặt cắt pha lê.',
      light: '#e2f4fb', dark: '#6e9eb8', accent: '#63d7ed', surface: '#18242f',
      x: '#dffbff', o: '#3188bd', xEdge: '#61bad6', oEdge: '#c5f6ff'
    }
  };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('boardWrap');
  const toast = document.getElementById('toast');
  const sidePanel = document.getElementById('sidePanel');
  const botPicker = document.getElementById('botPicker');
  const matchSetup = document.getElementById('matchSetup');
  const resultModal = document.getElementById('resultModal');

  const ui = {
    scoreX: document.getElementById('scoreX'),
    scoreO: document.getElementById('scoreO'),
    scoreCardX: document.getElementById('scoreCardX'),
    scoreCardO: document.getElementById('scoreCardO'),
    turnText: document.getElementById('turnText'),
    moveCount: document.getElementById('moveCount'),
    cycleCount: document.getElementById('cycleCount'),
    chunkCount: document.getElementById('chunkCount'),
    zoomValue: document.getElementById('zoomValue'),
    cycleLog: document.getElementById('cycleLog'),
    hudText: document.getElementById('hudText'),
    scoreMirrorX: document.querySelector('.score-mirror-x'),
    scoreMirrorO: document.querySelector('.score-mirror-o'),
    themeGallery: document.getElementById('themeGallery'),
    lobbyThemeGallery: document.getElementById('lobbyThemeGallery'),
    themeCurrents: Array.from(document.querySelectorAll('.theme-current')),
    lobby: document.getElementById('lobby'),
    continueBtn: document.getElementById('continueBtn'),
    continueMeta: document.getElementById('continueMeta'),
    modeLabel: document.getElementById('modeLabel'),
    sideModeLabel: document.getElementById('sideModeLabel'),
    matchSetupMode: document.getElementById('matchSetupMode'),
    targetPointsInput: document.getElementById('targetPointsInput'),
    groupSizeInput: document.getElementById('groupSizeInput'),
    setupPreview: document.getElementById('setupPreview'),
    setupError: document.getElementById('setupError'),
    ruleGroupSize: document.getElementById('ruleGroupSize'),
    ruleTargetPoints: document.getElementById('ruleTargetPoints'),
    resultTitle: document.getElementById('resultTitle'),
    resultSummary: document.getElementById('resultSummary'),
    topPlayerStrip: document.getElementById('topPlayerStrip'),
    bottomPlayerStrip: document.getElementById('bottomPlayerStrip'),
    topPlayerName: document.getElementById('topPlayerName'),
    bottomPlayerName: document.getElementById('bottomPlayerName'),
    topPlayerMeta: document.getElementById('topPlayerMeta'),
    bottomPlayerMeta: document.getElementById('bottomPlayerMeta'),
    topStripScore: document.getElementById('topStripScore'),
    bottomStripScore: document.getElementById('bottomStripScore'),
    lobbyAccountLine: document.getElementById('lobbyAccountLine'),
    topPlayerAvatar: document.getElementById('topPlayerAvatar'),
    bottomPlayerAvatar: document.getElementById('bottomPlayerAvatar')
  };

  let currentTheme = loadThemeId();
  let game = loadGame();
  let session = loadSession();
  let botThinking = false;
  let lobbyOpen = true;
  const loadedChunks = new Set();
  const camera = { x: 0, y: 0, zoom: 1 };
  let cssWidth = 1;
  let cssHeight = 1;
  let dpr = 1;
  let renderQueued = false;
  let toastTimer = 0;
  let pendingSetup = { mode: 'local', botLevel: 'normal' };
  let playerIdentity = { displayName: 'Bạn', rating: DEFAULT_CARO_ELO, accountKey: 'guest' };
  let onlineContext = null;
  let onlineChannel = null;
  let onlineClient = null;
  let onlineLifecycleBusy = false;

  function clearOnlineLaunchContext(roomId = onlineContext?.roomId) {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const raw = store.getItem('nqz-online-launch-v1');
        const saved = raw ? JSON.parse(raw) : null;
        if (!saved || !roomId || saved.roomId === roomId) store.removeItem('nqz-online-launch-v1');
      } catch {
        try { store.removeItem('nqz-online-launch-v1'); } catch {}
      }
    }
    if (roomId) {
      try { localStorage.removeItem(`nqznzee-caro-online-${roomId}`); } catch {}
    }
  }

  async function finishOnlineRoom(reason = 'completed') {
    if (!onlineContext || !onlineClient || onlineLifecycleBusy) return;
    onlineLifecycleBusy = true;
    try {
      const winnerSide = game?.winner ? String(game.winner).toLowerCase() : null;
      const payload = {
        score_x: Number(game?.scores?.X || 0),
        score_o: Number(game?.scores?.O || 0),
        moves: Number(game?.moveNumber || 0),
        reason
      };
      const { error } = await onlineClient.rpc('finish_game_room', {
        p_room_id: onlineContext.roomId,
        p_winner_side: winnerSide,
        p_result: payload
      });
      if (error && !String(error.message || '').includes('ROOM_NOT_PLAYING')) throw error;
    } catch (error) {
      console.warn('Không thể kết thúc phòng Online:', error);
    } finally {
      onlineLifecycleBusy = false;
    }
  }

  async function exitOnlineMatchToLobby() {
    if (!onlineContext) { openLobby(); return; }
    const roomId = onlineContext.roomId;
    try {
      if (game?.finished) await finishOnlineRoom('completed');
      else if (onlineClient) {
        const { error } = await onlineClient.rpc('leave_game_room', { p_room_id: roomId });
        if (error) throw error;
      }
    } catch (error) {
      console.warn('Không thể rời phòng Online:', error);
    }
    if (onlineChannel && onlineClient) {
      try { await onlineClient.removeChannel(onlineChannel); } catch {}
      onlineChannel = null;
    }
    clearOnlineLaunchContext(roomId);
    onlineContext = null;
    document.body.classList.remove('online-match-active');
    session = defaultSession();
    game = loadGame();
    renderPlayerIdentity();
    openLobby();
  }

  function normalizedPlayerName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ') || 'Bạn';
  }

  function caroRatingKey(account) {
    return String(account?.id || account?.username || account?.display_name || 'guest').trim() || 'guest';
  }

  function loadCaroRating(account) {
    const key = caroRatingKey(account);
    try {
      const map = JSON.parse(localStorage.getItem(CARO_RATING_STORE) || '{}');
      const value = Number(map[key]);
      if (Number.isFinite(value) && value >= 100) return Math.round(value);
      map[key] = DEFAULT_CARO_ELO;
      localStorage.setItem(CARO_RATING_STORE, JSON.stringify(map));
    } catch (error) {
      console.warn('Không thể đọc Caro Elo:', error);
    }
    return DEFAULT_CARO_ELO;
  }

  function applyAccountIdentity(account) {
    const displayName = normalizedPlayerName(account?.display_name || account?.username || 'Bạn');
    playerIdentity = {
      displayName,
      rating: loadCaroRating(account),
      accountKey: caroRatingKey(account)
    };
    renderPlayerIdentity();
  }

  function opponentIdentity() {
    if (onlineContext) {
      return {
        displayName: onlineContext.opponentName || 'Đối thủ Online',
        meta: `Caro Elo ${onlineContext.opponentElo ?? DEFAULT_CARO_ELO}`
      };
    }
    if (session.mode === 'bot') {
      const level = BOT_LEVELS[session.botLevel] || BOT_LEVELS.normal;
      return {
        displayName: level.label || `Bot ${level.name}`,
        meta: `${level.name} · Caro Elo ${level.elo || DEFAULT_CARO_ELO}`
      };
    }
    return { displayName: 'Người chơi O', meta: `Caro Elo ${DEFAULT_CARO_ELO}` };
  }

  function renderPlayerIdentity() {
    const opponent = opponentIdentity();
    const ownElo = onlineContext?.myElo ?? playerIdentity.rating;
    const ownSide = onlineContext?.side || 'X';
    const opponentSide = ownSide === 'X' ? 'O' : 'X';
    if (ui.bottomPlayerName) ui.bottomPlayerName.textContent = playerIdentity.displayName;
    if (ui.bottomPlayerMeta) ui.bottomPlayerMeta.textContent = `Caro Elo ${ownElo}${onlineContext ? ` · ${ownSide}` : ''}`;
    if (ui.topPlayerName) ui.topPlayerName.textContent = opponent.displayName;
    if (ui.topPlayerMeta) ui.topPlayerMeta.textContent = `${opponent.meta}${onlineContext ? ` · ${opponentSide}` : ''}`;
    if (ui.bottomPlayerAvatar) ui.bottomPlayerAvatar.textContent = ownSide === 'X' ? '×' : '○';
    if (ui.topPlayerAvatar) ui.topPlayerAvatar.textContent = opponentSide === 'X' ? '×' : '○';
    if (ui.lobbyAccountLine) ui.lobbyAccountLine.textContent = `${playerIdentity.displayName} · Caro Elo ${ownElo}`;
  }

  async function refreshPlayerIdentity() {
    try {
      const account = await window.NQZ_ACCOUNT?.refreshAccount?.();
      applyAccountIdentity(account || null);
    } catch (error) {
      console.warn('Không thể tải hồ sơ NqznZee cho Caro:', error);
      applyAccountIdentity(null);
    }
  }

  function setLobbyPanel(name = 'play') {
    const valid = new Set(['play', 'bot', 'rules', 'style', 'lab']);
    if (!valid.has(name)) name = 'play';
    document.querySelectorAll('[data-lobby-tab]').forEach(button => {
      const active = button.dataset.lobbyTab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-lobby-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.lobbyPanel === name);
    });
  }

  const pointer = {
    id: null,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    dragged: false
  };

  function loadThemeId() {
    try {
      const own = localStorage.getItem(THEME_KEY);
      if (own && THEMES[own]) return own;
      const chessRaw = localStorage.getItem(CHESS_THEME_STORE);
      if (chessRaw) {
        const chessStore = JSON.parse(chessRaw);
        const shared = chessStore?.settings?.theme;
        if (shared && THEMES[shared]) return shared;
      }
    } catch (error) {
      console.warn('Không thể đọc theme NqznZee:', error);
    }
    return 'standard';
  }

  function persistTheme(id) {
    try {
      localStorage.setItem(THEME_KEY, id);
      // If the Chess store already exists on the same GitHub Pages origin,
      // keep its current visual style in sync with Caro without creating a fake store.
      const chessRaw = localStorage.getItem(CHESS_THEME_STORE);
      if (chessRaw) {
        const chessStore = JSON.parse(chessRaw);
        if (chessStore && typeof chessStore === 'object') {
          chessStore.settings = chessStore.settings || {};
          chessStore.settings.theme = id;
          localStorage.setItem(CHESS_THEME_STORE, JSON.stringify(chessStore));
        }
      }
    } catch (error) {
      console.warn('Không thể lưu theme NqznZee:', error);
    }
  }

  function applyTheme(id, persist = true) {
    if (!THEMES[id]) id = 'standard';
    currentTheme = id;
    const theme = THEMES[id];
    document.body.dataset.caroTheme = id;
    document.documentElement.style.setProperty('--light-square', theme.light);
    document.documentElement.style.setProperty('--dark-square', theme.dark);
    document.documentElement.style.setProperty('--accent', theme.accent);
    ui.themeCurrents.forEach(el => { el.textContent = theme.name; });
    if (persist) persistTheme(id);
    renderThemeGallery();
    requestRender();
  }

  function renderThemeGallery() {
    const galleries = [ui.themeGallery, ui.lobbyThemeGallery].filter(Boolean);
    const markup = Object.entries(THEMES).map(([id, theme]) => `
      <button class="theme-card ${id === currentTheme ? 'active' : ''}" type="button" data-theme="${id}"
        style="--theme-light:${theme.light};--theme-dark:${theme.dark};--theme-accent:${theme.accent};--theme-x:${theme.x};--theme-o:${theme.o}">
        <span class="theme-preview" aria-hidden="true">
          <span class="theme-preview-piece x">×</span>
          <span class="theme-preview-piece o">○</span>
        </span>
        <strong>${theme.name}</strong>
        <small>${theme.note}</small>
      </button>`).join('');

    galleries.forEach(gallery => {
      gallery.innerHTML = markup;
      gallery.querySelectorAll('[data-theme]').forEach(button => {
        button.addEventListener('click', () => {
          applyTheme(button.dataset.theme, true);
          showToast(`Phong cách: ${THEMES[button.dataset.theme].name}`);
        });
      });
    });
  }

  function defaultSession() {
    return {
      version: 2, mode: 'local', human: 'X', bot: 'O', botLevel: 'normal',
      groupSize: 5, targetPoints: 5, updatedAt: Date.now()
    };
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return defaultSession();
      const data = JSON.parse(raw);
      if (![1, 2].includes(data?.version)) return defaultSession();
      const level = BOT_LEVELS[data.botLevel] ? data.botLevel : 'normal';
      const groupSize = Number.isInteger(Number(data.groupSize)) && Number(data.groupSize) >= 3 ? Math.min(25, Number(data.groupSize)) : 5;
      const targetPoints = Number.isInteger(Number(data.targetPoints)) && Number(data.targetPoints) >= 1 ? Math.min(99, Number(data.targetPoints)) : 5;
      return { ...defaultSession(), ...data, version: 2, botLevel: level, groupSize, targetPoints, mode: data.mode === 'bot' ? 'bot' : 'local' };
    } catch (error) {
      console.warn('Không thể đọc phiên Caro:', error);
      return defaultSession();
    }
  }

  function saveSession() {
    try {
      session.version = 2;
      session.updatedAt = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn('Không thể lưu phiên Caro:', error);
    }
  }

  function hasSavedGame() {
    try { return localStorage.getItem(STORAGE_KEY) !== null; }
    catch (_) { return false; }
  }

  function modeText() {
    if (onlineContext) return `Online · phòng ${onlineContext.roomCode} · bạn cầm ${onlineContext.side}`;
    if (session.mode !== 'bot') return '2 người cùng thiết bị';
    const level = BOT_LEVELS[session.botLevel] || BOT_LEVELS.normal;
    return `Đấu Bot ${level.name} · ${session.groupSize} quân/điểm · chạm ${session.targetPoints} điểm thắng`;
  }

  function updateLobby() {
    const hasSave = hasSavedGame();
    if (ui.continueBtn) ui.continueBtn.disabled = !hasSave;
    if (ui.continueMeta) {
      if (!hasSave) ui.continueMeta.textContent = 'Chưa có ván đã lưu';
      else ui.continueMeta.textContent = `${modeText()} · ${game.moveNumber} nước · ${game.scores.X}:${game.scores.O} điểm${game.finished ? ' · đã kết thúc' : ''}`;
    }
    ui.themeCurrents.forEach(el => { el.textContent = THEMES[currentTheme].name; });
    document.querySelectorAll('[data-current-group-size]').forEach(el => { el.textContent = String(session.groupSize || 5); });
    document.querySelectorAll('[data-current-target-points]').forEach(el => { el.textContent = String(session.targetPoints || 5); });
  }

  function openLobby() {
    closeBotPicker();
    saveGame();
    lobbyOpen = true;
    botThinking = false;
    setMenu(false);
    updateLobby();
    setLobbyPanel('play');
    ui.lobby?.classList.add('show');
  }

  function enterGame() {
    closeBotPicker();
    lobbyOpen = false;
    ui.lobby?.classList.remove('show');
    requestRender();
    if (game.finished) { window.setTimeout(showResult, 60); return; }
    if (session.mode === 'bot' && game.turn === session.bot) scheduleBotMove();
  }

  function startNewGame(mode, botLevel = 'normal', config = {}) {
    const groupSize = Math.max(3, Math.min(25, Number(config.groupSize) || 5));
    const targetPoints = Math.max(1, Math.min(99, Number(config.targetPoints) || 5));
    game = new CycleGame(null, { groupSize, targetPoints });
    session = {
      ...defaultSession(),
      mode: mode === 'bot' ? 'bot' : 'local',
      botLevel: BOT_LEVELS[botLevel] ? botLevel : 'normal',
      groupSize, targetPoints
    };
    loadedChunks.clear();
    camera.x = 0; camera.y = 0; camera.zoom = 1;
    saveGame();
    saveSession();
    updateLobby();
    closeMatchSetup();
    closeResult();
    enterGame();
    const level = BOT_LEVELS[session.botLevel] || BOT_LEVELS.normal;
    const rule = `${groupSize} quân = 1 điểm · ${targetPoints} điểm thắng`;
    showToast(session.mode === 'bot' ? `Đấu Bot ${level.name} · ${rule}` : `Ván 2 người · ${rule}`);
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new CycleGame(JSON.parse(raw)) : new CycleGame();
    } catch (error) {
      console.warn('Không thể đọc save Caro LAB:', error);
      return new CycleGame();
    }
  }

  function saveGame() {
    try {
      if (onlineContext) {
        localStorage.setItem(`nqznzee-caro-online-${onlineContext.roomId}`, JSON.stringify(game.serialize()));
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game.serialize()));
      saveSession();
    } catch (error) {
      console.warn('Không thể lưu Caro LAB:', error);
    }
  }

  function resizeCanvas() {
    const rect = wrap.getBoundingClientRect();
    cssWidth = Math.max(1, Math.floor(rect.width));
    cssHeight = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestRender();
  }

  function cellPx() {
    return BASE_CELL * camera.zoom;
  }

  function screenToWorld(sx, sy) {
    const c = cellPx();
    return {
      x: camera.x + (sx - cssWidth / 2) / c,
      y: camera.y + (sy - cssHeight / 2) / c
    };
  }

  function worldToScreen(wx, wy) {
    const c = cellPx();
    return {
      x: (wx - camera.x) * c + cssWidth / 2,
      y: (wy - camera.y) * c + cssHeight / 2
    };
  }

  function visibleBounds() {
    const a = screenToWorld(0, 0);
    const b = screenToWorld(cssWidth, cssHeight);
    return {
      minX: Math.floor(Math.min(a.x, b.x)) - 1,
      maxX: Math.floor(Math.max(a.x, b.x)) + 1,
      minY: Math.floor(Math.min(a.y, b.y)) - 1,
      maxY: Math.floor(Math.max(a.y, b.y)) + 1
    };
  }

  function floorDiv(n, divisor) {
    return Math.floor(n / divisor);
  }

  function ensureVisibleChunks(bounds) {
    const minCX = floorDiv(bounds.minX, CHUNK_SIZE);
    const maxCX = floorDiv(bounds.maxX, CHUNK_SIZE);
    const minCY = floorDiv(bounds.minY, CHUNK_SIZE);
    const maxCY = floorDiv(bounds.maxY, CHUNK_SIZE);
    for (let cy = minCY; cy <= maxCY; cy += 1) {
      for (let cx = minCX; cx <= maxCX; cx += 1) {
        loadedChunks.add(`${cx},${cy}`);
      }
    }
  }

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const bounds = visibleBounds();
    ensureVisibleChunks(bounds);
    drawBoard(bounds);
    drawCycles(bounds);
    drawPieces(bounds);
    drawLastMove();
    updateUI();
  }

  function drawBoard(bounds) {
    const c = cellPx();
    const theme = THEMES[currentTheme];
    ctx.save();

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const p = worldToScreen(x, y);
        const light = ((x + y) & 1) === 0;
        const px = Math.floor(p.x);
        const py = Math.floor(p.y);
        const size = Math.ceil(c) + 1; // one-pixel overdraw keeps the infinite board seamless
        ctx.fillStyle = light ? theme.light : theme.dark;
        ctx.fillRect(px, py, size, size);
        drawCellTexture(currentTheme, light, px, py, size, x, y);
      }
    }

    drawOrigin(c);
    ctx.restore();
  }

  function drawCellTexture(themeId, light, px, py, size, wx, wy) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, size, size);
    ctx.clip();

    const soft = ctx.createLinearGradient(px, py, px + size, py + size);
    soft.addColorStop(0, light ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.045)');
    soft.addColorStop(.48, 'rgba(255,255,255,0)');
    soft.addColorStop(1, 'rgba(0,0,0,.025)');
    ctx.fillStyle = soft;
    ctx.fillRect(px, py, size, size);

    if (themeId === 'standard') {
      ctx.strokeStyle = light ? 'rgba(104,82,56,.025)' : 'rgba(29,48,24,.035)';
      ctx.lineWidth = 1;
      const offset = ((wx * 7 + wy * 3) % 11 + 11) % 11;
      for (let i = -size; i < size * 2; i += Math.max(11, size * .22)) {
        ctx.beginPath(); ctx.moveTo(px + i + offset, py); ctx.lineTo(px + i + size * .16, py + size); ctx.stroke();
      }
    } else if (themeId === 'dinosaur') {
      if (light) {
        ctx.fillStyle = 'rgba(91,68,35,.10)';
        const pts = [[.22,.25],[.72,.66],[.50,.42]];
        pts.forEach(([dx,dy],i) => { ctx.beginPath(); ctx.arc(px+size*dx,py+size*dy,Math.max(.7,size*(.012+i*.002)),0,Math.PI*2); ctx.fill(); });
      } else {
        ctx.strokeStyle = 'rgba(30,64,31,.065)'; ctx.lineWidth = Math.max(1,size*.025);
        for (let i=-size;i<size*2;i+=Math.max(13,size*.30)) { ctx.beginPath(); ctx.moveTo(px+i,py); ctx.lineTo(px+i+size*.72,py+size); ctx.stroke(); }
      }
    } else if (themeId === 'future') {
      ctx.strokeStyle = light ? 'rgba(34,211,238,.055)' : 'rgba(180,74,255,.06)';
      ctx.lineWidth = 1;
      [0.34,0.68].forEach(t => {
        ctx.beginPath(); ctx.moveTo(px+size*t,py+size*.18); ctx.lineTo(px+size*t,py+size*.82); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px+size*.18,py+size*t); ctx.lineTo(px+size*.82,py+size*t); ctx.stroke();
      });
      ctx.fillStyle = light ? 'rgba(34,211,238,.09)' : 'rgba(193,85,255,.08)';
      ctx.beginPath(); ctx.arc(px+size*.5,py+size*.5,Math.max(1,size*.025),0,Math.PI*2); ctx.fill();
    } else if (themeId === 'renaissance') {
      ctx.strokeStyle = light ? 'rgba(115,75,37,.038)' : 'rgba(62,27,20,.07)';
      ctx.lineWidth = 1;
      const gap = Math.max(9,size*.18);
      for (let i=-size;i<size*2;i+=gap) { ctx.beginPath(); ctx.moveTo(px+i,py); ctx.lineTo(px+i-size*.09,py+size); ctx.stroke(); }
    } else if (themeId === 'crystal') {
      ctx.strokeStyle = light ? 'rgba(73,151,190,.09)' : 'rgba(215,249,255,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px+size*.10,py+size*.72); ctx.lineTo(px+size*.47,py+size*.22); ctx.lineTo(px+size*.90,py+size*.58); ctx.stroke();
      ctx.fillStyle = light ? 'rgba(255,255,255,.20)' : 'rgba(222,249,255,.08)';
      ctx.beginPath(); ctx.moveTo(px+size*.06,py+size*.08); ctx.lineTo(px+size*.52,py+size*.08); ctx.lineTo(px+size*.18,py+size*.38); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawChunkBorders(bounds) {
    ctx.save();
    ctx.strokeStyle = 'rgba(31, 25, 42, .27)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();

    let x = Math.ceil(bounds.minX / CHUNK_SIZE) * CHUNK_SIZE;
    for (; x <= bounds.maxX; x += CHUNK_SIZE) {
      const p = worldToScreen(x, 0);
      ctx.moveTo(p.x, 0); ctx.lineTo(p.x, cssHeight);
    }
    let y = Math.ceil(bounds.minY / CHUNK_SIZE) * CHUNK_SIZE;
    for (; y <= bounds.maxY; y += CHUNK_SIZE) {
      const p = worldToScreen(0, y);
      ctx.moveTo(0, p.y); ctx.lineTo(cssWidth, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawOrigin(c) {
    const p = worldToScreen(0, 0);
    if (p.x < -c || p.x > cssWidth + c || p.y < -c || p.y > cssHeight + c) return;
    ctx.save();
    ctx.strokeStyle = THEMES[currentTheme].accent;
    ctx.lineWidth = Math.max(2, c * .045);
    ctx.strokeRect(p.x + 3, p.y + 3, c - 6, c - 6);
    ctx.restore();
  }

  function drawCoordinates(bounds, c) {
    if (c < 28) return;
    ctx.save();
    ctx.font = `${Math.max(8, Math.min(11, c * .19))}px -apple-system, BlinkMacSystemFont, Segoe UI, Arial`;
    ctx.fillStyle = 'rgba(25,28,24,.48)';
    ctx.textBaseline = 'top';
    for (let y = bounds.minY; y <= bounds.maxY; y += 5) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 5) {
        const p = worldToScreen(x, y);
        ctx.fillText(`${x},${y}`, p.x + 4, p.y + 3);
      }
    }
    ctx.restore();
  }

  function drawCycles(bounds) {
    const c = cellPx();
    for (const cycle of game.cycles) {
      if (!cycle.cells?.length) continue;
      const xs = cycle.cells.map(v => v.x);
      const ys = cycle.cells.map(v => v.y);
      if (Math.max(...xs) < bounds.minX || Math.min(...xs) > bounds.maxX || Math.max(...ys) < bounds.minY || Math.min(...ys) > bounds.maxY) continue;

      const first = cycle.cells[0];
      const last = cycle.cells[cycle.cells.length - 1];
      const a = worldToScreen(first.x + .5, first.y + .5);
      const b = worldToScreen(last.x + .5, last.y + .5);
      const isX = cycle.player === 'X';

      // LAB 0.5: the cycle marker is still one clean straight visual, but roughly
      // twice the previous thickness. Each model gives it a different material.
      const width = Math.max(2.5, Math.min(5.2, c * .09));
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / length, uy = dy / length;
      const px = -uy, py = ux;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (currentTheme === 'dinosaur') {
        // A slim straight dinosaur tail: broad at the root, tapered at the tip,
        // with tiny dorsal spikes. It stays centered on the five-piece axis.
        const root = width * .70;
        const tip = width * .22;
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, isX ? '#ecd083' : '#b8d16d');
        grad.addColorStop(.42, isX ? '#a67a35' : '#729743');
        grad.addColorStop(1, isX ? '#d9b35a' : '#9dbb55');
        ctx.shadowColor = isX ? 'rgba(105,72,30,.48)' : 'rgba(56,91,34,.48)';
        ctx.shadowBlur = Math.min(4.2, c * .08);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(a.x + px * root, a.y + py * root);
        ctx.lineTo(b.x + px * tip, b.y + py * tip);
        ctx.quadraticCurveTo(b.x + ux * width * .65, b.y + uy * width * .65, b.x, b.y);
        ctx.lineTo(b.x - px * tip, b.y - py * tip);
        ctx.lineTo(a.x - px * root, a.y - py * root);
        ctx.closePath();
        ctx.fill();

        // Small scales/spikes make the tail recognizable without turning it into a thick banner.
        ctx.fillStyle = isX ? 'rgba(93,62,26,.72)' : 'rgba(47,79,31,.72)';
        for (const t of [.18, .36, .54, .72]) {
          const cx = a.x + dx * t, cy = a.y + dy * t;
          const spike = width * (.62 - t * .28);
          ctx.beginPath();
          ctx.moveTo(cx + px * width * .50, cy + py * width * .50);
          ctx.lineTo(cx - ux * width * .38 + px * (width * .50 + spike), cy - uy * width * .38 + py * (width * .50 + spike));
          ctx.lineTo(cx + ux * width * .38 + px * width * .42, cy + uy * width * .38 + py * width * .42);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = isX ? 'rgba(255,232,159,.72)' : 'rgba(219,238,150,.62)';
        ctx.lineWidth = Math.max(1, width * .20);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else if (currentTheme === 'future') {
        const beam = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        beam.addColorStop(0, isX ? '#b94cff' : '#00d9ff');
        beam.addColorStop(.48, '#f7f2ff');
        beam.addColorStop(1, isX ? '#725cff' : '#76f5ff');
        ctx.shadowColor = isX ? 'rgba(185,76,255,.92)' : 'rgba(0,217,255,.92)';
        ctx.shadowBlur = Math.min(10, c * .18);
        ctx.strokeStyle = beam;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        // White energy core keeps it looking like one luminous beam.
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.78)';
        ctx.lineWidth = Math.max(1, width * .22);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else if (currentTheme === 'renaissance') {
        const metal = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        metal.addColorStop(0, isX ? '#f2d17b' : '#c9824e');
        metal.addColorStop(.30, '#fff0b0');
        metal.addColorStop(.58, isX ? '#af7328' : '#f0be6c');
        metal.addColorStop(1, isX ? '#e4ad4b' : '#a95b35');
        ctx.shadowColor = 'rgba(76,42,20,.45)';
        ctx.shadowBlur = Math.min(4, c * .07);
        ctx.strokeStyle = metal;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,240,186,.55)';
        ctx.lineWidth = Math.max(1, width * .18);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else if (currentTheme === 'crystal') {
        const ice = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        ice.addColorStop(0, isX ? '#effeff' : '#77e3ff');
        ice.addColorStop(.33, '#a3ecf8');
        ice.addColorStop(.62, '#ffffff');
        ice.addColorStop(1, isX ? '#b8f3ff' : '#3eacd5');
        ctx.shadowColor = 'rgba(91,226,248,.78)';
        ctx.shadowBlur = Math.min(8, c * .15);
        ctx.strokeStyle = ice;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.72)';
        ctx.lineWidth = Math.max(1, width * .20);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else {
        const classic = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        classic.addColorStop(0, isX ? '#fff5db' : '#dce9c8');
        classic.addColorStop(.50, isX ? '#c6b184' : '#5d754d');
        classic.addColorStop(1, isX ? '#f0dfb8' : '#abc98b');
        ctx.shadowColor = 'rgba(24,34,24,.32)';
        ctx.shadowBlur = Math.min(3.4, c * .06);
        ctx.strokeStyle = classic;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPieces(bounds) {
    const c = cellPx();
    const minX = bounds.minX - 1, maxX = bounds.maxX + 1;
    const minY = bounds.minY - 1, maxY = bounds.maxY + 1;
    for (const [key, player] of game.board) {
      const comma = key.indexOf(',');
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const p = worldToScreen(x, y);
      drawPiece(player, p.x + c / 2, p.y + c / 2, c);
    }
  }

  function drawPiece(player, cx, cy, c) {
    const theme = THEMES[currentTheme];
    const radius = c * .31;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = c * .10;
    ctx.shadowOffsetY = c * .05;

    if (player === 'X') drawThemedX(theme, cx, cy, c, radius);
    else drawThemedO(theme, cx, cy, c, radius);
    ctx.restore();
  }

  function drawThemedX(theme, cx, cy, c, radius) {
    const g = ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);
    if (currentTheme === 'future') { g.addColorStop(0,'#f0a2ff'); g.addColorStop(.5,theme.x); g.addColorStop(1,'#6d3dff'); ctx.shadowColor='rgba(195,108,255,.50)'; ctx.shadowBlur=c*.18; }
    else if (currentTheme === 'dinosaur') { g.addColorStop(0,'#f2e2b5'); g.addColorStop(.55,theme.x); g.addColorStop(1,'#a88a52'); }
    else if (currentTheme === 'renaissance') { g.addColorStop(0,'#ffe092'); g.addColorStop(.48,theme.x); g.addColorStop(1,'#9f6229'); }
    else if (currentTheme === 'crystal') { g.addColorStop(0,'#ffffff'); g.addColorStop(.45,theme.x); g.addColorStop(1,'#5eb9dc'); ctx.shadowColor='rgba(157,237,255,.38)'; ctx.shadowBlur=c*.15; }
    else { g.addColorStop(0,'#fffaf0'); g.addColorStop(.48,theme.x); g.addColorStop(1,'#c9c0aa'); }

    ctx.strokeStyle = theme.xEdge;
    ctx.lineWidth = c * .19;
    ctx.beginPath();
    ctx.moveTo(cx-radius,cy-radius); ctx.lineTo(cx+radius,cy+radius);
    ctx.moveTo(cx+radius,cy-radius); ctx.lineTo(cx-radius,cy+radius);
    ctx.stroke();
    ctx.shadowColor='transparent';
    ctx.strokeStyle=g; ctx.lineWidth=c*.115; ctx.stroke();

    if (currentTheme === 'dinosaur') {
      ctx.strokeStyle='rgba(80,59,34,.48)'; ctx.lineWidth=Math.max(1,c*.025);
      ctx.beginPath(); ctx.moveTo(cx-radius*.42,cy-radius*.48); ctx.lineTo(cx-radius*.10,cy-radius*.18); ctx.lineTo(cx-radius*.30,cy-radius*.02); ctx.stroke();
    } else if (currentTheme === 'future') {
      ctx.strokeStyle='rgba(255,255,255,.62)'; ctx.lineWidth=Math.max(1,c*.018);
      ctx.beginPath(); ctx.moveTo(cx-radius*.72,cy-radius*.72); ctx.lineTo(cx+radius*.72,cy+radius*.72); ctx.stroke();
    } else if (currentTheme === 'crystal') {
      ctx.strokeStyle='rgba(255,255,255,.72)'; ctx.lineWidth=Math.max(1,c*.018);
      ctx.beginPath(); ctx.moveTo(cx-radius*.62,cy-radius*.82); ctx.lineTo(cx+radius*.08,cy-radius*.14); ctx.stroke();
    }
  }

  function drawThemedO(theme, cx, cy, c, radius) {
    const r = radius*.92;
    const g=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);
    if (currentTheme === 'future') { g.addColorStop(0,'#d8fdff'); g.addColorStop(.45,theme.o); g.addColorStop(1,'#087f9d'); ctx.shadowColor='rgba(34,211,238,.52)'; ctx.shadowBlur=c*.18; }
    else if (currentTheme === 'dinosaur') { g.addColorStop(0,'#d7c979'); g.addColorStop(.48,theme.o); g.addColorStop(1,'#3e5d29'); }
    else if (currentTheme === 'renaissance') { g.addColorStop(0,'#f0bd67'); g.addColorStop(.34,theme.oEdge); g.addColorStop(.55,theme.o); g.addColorStop(1,'#4d2117'); }
    else if (currentTheme === 'crystal') { g.addColorStop(0,'#e8fcff'); g.addColorStop(.42,'#67cbe9'); g.addColorStop(1,theme.o); ctx.shadowColor='rgba(99,215,237,.36)'; ctx.shadowBlur=c*.15; }
    else { g.addColorStop(0,'#6b7868'); g.addColorStop(.42,theme.o); g.addColorStop(1,'#111812'); }

    ctx.strokeStyle=theme.oEdge; ctx.lineWidth=c*.19;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    ctx.shadowColor='transparent'; ctx.strokeStyle=g; ctx.lineWidth=c*.112; ctx.stroke();

    if (currentTheme === 'dinosaur') {
      ctx.fillStyle='rgba(224,208,142,.50)';
      [[-.34,-.24,.055],[.28,-.12,.04],[-.05,.34,.045]].forEach(([dx,dy,rr])=>{ctx.beginPath();ctx.arc(cx+r*dx,cy+r*dy,c*rr,0,Math.PI*2);ctx.fill();});
    } else if (currentTheme === 'renaissance') {
      ctx.strokeStyle='rgba(255,224,146,.58)'; ctx.lineWidth=Math.max(1,c*.022);
      ctx.beginPath(); ctx.arc(cx,cy,r*.72,-2.4,-.5); ctx.stroke();
    } else if (currentTheme === 'crystal') {
      ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=Math.max(1,c*.018);
      ctx.beginPath(); ctx.arc(cx,cy,r*.76,-2.55,-1.12); ctx.stroke();
    }
  }

  function drawLastMove() {
    if (!game.lastMove) return;
    const c = cellPx();
    const p = worldToScreen(game.lastMove.x, game.lastMove.y);
    if (p.x < -c || p.x > cssWidth + c || p.y < -c || p.y > cssHeight + c) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(242,201,76,.88)';
    ctx.lineWidth = Math.max(2, c * .055);
    ctx.strokeRect(p.x + 4, p.y + 4, c - 8, c - 8);
    ctx.restore();
  }

  function updateUI() {
    ui.scoreX.textContent = game.scores.X;
    ui.scoreO.textContent = game.scores.O;
    if (ui.scoreMirrorX) ui.scoreMirrorX.textContent = game.scores.X;
    if (ui.scoreMirrorO) ui.scoreMirrorO.textContent = game.scores.O;
    const ownSide = onlineContext?.side || 'X';
    const opponentSide = ownSide === 'X' ? 'O' : 'X';
    if (ui.bottomStripScore) ui.bottomStripScore.textContent = game.scores[ownSide];
    if (ui.topStripScore) ui.topStripScore.textContent = game.scores[opponentSide];
    ui.moveCount.textContent = game.moveNumber;
    ui.cycleCount.textContent = game.cycles.length;
    if (ui.ruleGroupSize) ui.ruleGroupSize.textContent = game.groupSize;
    if (ui.ruleTargetPoints) ui.ruleTargetPoints.textContent = game.targetPoints;
    ui.chunkCount.textContent = loadedChunks.size;
    ui.zoomValue.textContent = `${Math.round(camera.zoom * 100)}%`;
    const opponent = opponentIdentity();
    const actor = onlineContext
      ? (game.turn === ownSide ? playerIdentity.displayName : opponent.displayName)
      : (game.turn === 'X' ? playerIdentity.displayName : opponent.displayName);
    ui.turnText.innerHTML = `Lượt hiện tại: <strong>${escapeHtml(actor)}</strong>`;
    ui.scoreCardX.classList.toggle('active', game.turn === 'X');
    ui.scoreCardO.classList.toggle('active', game.turn === 'O');
    ui.bottomPlayerStrip?.classList.toggle('active', onlineContext ? game.turn === ownSide : game.turn === 'X');
    ui.topPlayerStrip?.classList.toggle('active', onlineContext ? game.turn === opponentSide : game.turn === 'O');
    renderPlayerIdentity();
    const centerCell = screenToWorld(cssWidth / 2, cssHeight / 2);
    ui.hudText.textContent = botThinking ? 'Bot đang tính nước…' : `Tâm ${Math.floor(centerCell.x)},${Math.floor(centerCell.y)} · kéo để di chuyển`;
    if (ui.modeLabel) ui.modeLabel.textContent = onlineContext
      ? `ONLINE · PHÒNG ${onlineContext.roomCode} · BẠN ${onlineContext.side}`
      : session.mode === 'bot' ? `ĐẤU BOT ${String((BOT_LEVELS[session.botLevel] || BOT_LEVELS.normal).name).toUpperCase()} · CARO ARENA` : '2 NGƯỜI · CARO ARENA';
    if (ui.sideModeLabel) ui.sideModeLabel.textContent = modeText();
    renderCycleLog();
  }

  function renderCycleLog() {
    if (!game.cycles.length) {
      ui.cycleLog.innerHTML = '<div class="log-empty">Chưa có điểm nào.</div>';
      return;
    }
    const items = game.cycles.slice(-10).reverse().map(cycle => {
      const cellText = cycle.cells.map(c => `(${c.x},${c.y})`).join(' ');
      return `<div class="log-item ${cycle.player.toLowerCase()}"><strong>${cycle.player} +1</strong> · ${escapeHtml(cycle.directionLabel)} · nước ${cycle.moveNumber}<br>${escapeHtml(cellText)}</div>`;
    });
    ui.cycleLog.innerHTML = items.join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function parseBoardKey(key) {
    const comma = key.indexOf(',');
    return { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)) };
  }

  function countLineOn(state, player, x, y, direction) {
    let negative = 0, positive = 0;
    const scan = Math.max(6, (state.groupSize || 5) + 2);
    for (let step = 1; step <= scan; step += 1) {
      if (state.get(x - direction.dx * step, y - direction.dy * step) !== player) break;
      negative += 1;
    }
    for (let step = 1; step <= scan; step += 1) {
      if (state.get(x + direction.dx * step, y + direction.dy * step) !== player) break;
      positive += 1;
    }
    const ax = x - direction.dx * (negative + 1);
    const ay = y - direction.dy * (negative + 1);
    const bx = x + direction.dx * (positive + 1);
    const by = y + direction.dy * (positive + 1);
    const openEnds = (state.isEmpty(ax, ay) ? 1 : 0) + (state.isEmpty(bx, by) ? 1 : 0);
    return { length: 1 + negative + positive, openEnds };
  }

  function positionalScoreOn(state, player, x, y) {
    const needed = Math.max(3, state.groupSize || 5);
    let score = 0;
    let strongDirections = 0;
    for (const direction of DIRECTIONS) {
      const line = countLineOn(state, player, x, y, direction);
      const capped = Math.min(line.length, needed);
      const progress = capped / needed;
      const base = capped >= needed ? 160000 : Math.pow(9, Math.max(0, capped - 1)) * 4 * (1 + progress);
      score += base * (1 + line.openEnds * 0.20);
      if (line.length >= Math.max(2, needed - 2) && line.openEnds) strongDirections += 1;
    }
    if (strongDirections >= 2) score += strongDirections * 1800;
    return score;
  }

  function botCandidatesOn(state, radius = 2) {
    if (state.board.size === 0) return [{ x: 0, y: 0 }];
    const seen = new Set();
    const out = [];
    for (const key of state.board.keys()) {
      const cell = parseBoardKey(key);
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = cell.x + dx, y = cell.y + dy;
          const k = keyOf(x, y);
          if (seen.has(k) || !state.isEmpty(x, y)) continue;
          seen.add(k);
          out.push({ x, y });
        }
      }
    }
    return out;
  }

  function simulateMove(state, player, x, y) {
    try {
      const clone = new CycleGame(state.serialize());
      clone.turn = player;
      const result = clone.play(x, y);
      return result.ok ? { state: clone, result } : null;
    } catch (_) {
      return null;
    }
  }

  function probeCyclesOn(state, player, x, y) {
    const sim = simulateMove(state, player, x, y);
    return sim ? sim.result.newCycles.length : 0;
  }

  function candidateHeuristic(state, player, opponent, cell) {
    const own = positionalScoreOn(state, player, cell.x, cell.y);
    const block = positionalScoreOn(state, opponent, cell.x, cell.y);
    const ownCycles = probeCyclesOn(state, player, cell.x, cell.y);
    const blockCycles = probeCyclesOn(state, opponent, cell.x, cell.y);
    const nearLast = state.lastMove ? Math.hypot(cell.x - state.lastMove.x, cell.y - state.lastMove.y) : 0;
    return own * 1.18 + block * 1.04 + ownCycles * 12_000_000 + blockCycles * 8_000_000 - nearLast * .08;
  }

  function orderedCandidates(state, player, opponent, limit = 24, radius = 2) {
    return botCandidatesOn(state, radius)
      .map(cell => ({ ...cell, score: candidateHeuristic(state, player, opponent, cell) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function immediateScoringMoves(state, player, opponent, limit = 3) {
    const out = [];
    const candidates = orderedCandidates(state, player, opponent, 32, 2);
    for (const cell of candidates) {
      const cycles = probeCyclesOn(state, player, cell.x, cell.y);
      if (cycles > 0) out.push({ ...cell, cycles });
      if (out.length >= limit) break;
    }
    return out;
  }

  function evaluateState(state, bot, human) {
    let value = (state.scores[bot] - state.scores[human]) * 20_000_000;
    const botTop = orderedCandidates(state, bot, human, 5, 2);
    const humanTop = orderedCandidates(state, human, bot, 5, 2);
    if (botTop[0]) value += Math.min(botTop[0].score, 9_000_000) * .22;
    if (humanTop[0]) value -= Math.min(humanTop[0].score, 9_000_000) * .24;
    const botThreats = immediateScoringMoves(state, bot, human, 3).length;
    const humanThreats = immediateScoringMoves(state, human, bot, 3).length;
    value += botThreats * 900_000;
    value -= humanThreats * 1_050_000;
    if (botThreats >= 2) value += 1_400_000; // multiple scoring threats = a powerful fork
    if (humanThreats >= 2) value -= 1_700_000;
    return value;
  }

  function chooseEasyMove(bot, human) {
    const candidates = orderedCandidates(game, bot, human, 18, 2);
    if (!candidates.length) return { x: 0, y: 0 };
    const winning = candidates.filter(cell => probeCyclesOn(game, bot, cell.x, cell.y) > 0);
    if (winning.length) return winning[0];
    // Easy bot notices an obvious scoring threat only some of the time.
    const blocks = candidates.filter(cell => probeCyclesOn(game, human, cell.x, cell.y) > 0);
    if (blocks.length && Math.random() < .58) return blocks[0];
    const pool = candidates.slice(0, Math.min(8, candidates.length));
    const index = Math.min(pool.length - 1, Math.floor(Math.pow(Math.random(), .70) * pool.length));
    return pool[index];
  }

  function chooseNormalMove(bot, human) {
    const candidates = orderedCandidates(game, bot, human, 34, 2);
    return candidates[0] || { x: 0, y: 0 };
  }

  function chooseHardMove(bot, human) {
    const candidates = orderedCandidates(game, bot, human, 20, 2);
    let best = candidates[0] || { x: 0, y: 0 };
    let bestScore = -Infinity;
    for (const cell of candidates) {
      const sim = simulateMove(game, bot, cell.x, cell.y);
      if (!sim) continue;
      let score = cell.score + sim.result.newCycles.length * 18_000_000;
      const humanImmediate = immediateScoringMoves(sim.state, human, bot, 3);
      const botFollowUps = immediateScoringMoves(sim.state, bot, human, 3);
      score -= humanImmediate.reduce((sum, v) => sum + v.cycles * 6_000_000, 0);
      score += botFollowUps.reduce((sum, v) => sum + v.cycles * 1_800_000, 0);
      if (botFollowUps.length >= 2) score += 2_200_000;
      score += evaluateState(sim.state, bot, human) * .10;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  }

  function chooseExtremeMove(bot, human) {
    const deadline = performance.now() + 260;
    const root = orderedCandidates(game, bot, human, 14, 2);
    if (!root.length) return { x: 0, y: 0 };

    // Never miss a point that is available immediately.
    const immediate = root
      .map(cell => ({ cell, cycles: probeCyclesOn(game, bot, cell.x, cell.y) }))
      .filter(v => v.cycles > 0)
      .sort((a, b) => b.cycles - a.cycles || b.cell.score - a.cell.score);
    if (immediate.length) return immediate[0].cell;

    let best = root[0];
    let bestScore = -Infinity;
    for (const cell of root) {
      if (performance.now() > deadline) break;
      const first = simulateMove(game, bot, cell.x, cell.y);
      if (!first) continue;
      const humanReplies = orderedCandidates(first.state, human, bot, 8, 2);
      let worstReply = Infinity;

      if (!humanReplies.length) {
        worstReply = evaluateState(first.state, bot, human);
      } else {
        for (const reply of humanReplies) {
          if (performance.now() > deadline) break;
          const second = simulateMove(first.state, human, reply.x, reply.y);
          if (!second) continue;
          let replyValue = evaluateState(second.state, bot, human);

          // Third ply: find the engine's strongest tactical continuation.
          const followUps = orderedCandidates(second.state, bot, human, 6, 2);
          let bestFollow = -Infinity;
          for (const follow of followUps) {
            if (performance.now() > deadline) break;
            const third = simulateMove(second.state, bot, follow.x, follow.y);
            if (!third) continue;
            const value = evaluateState(third.state, bot, human) + third.result.newCycles.length * 12_000_000;
            if (value > bestFollow) bestFollow = value;
          }
          if (bestFollow > -Infinity) replyValue = bestFollow;
          if (replyValue < worstReply) worstReply = replyValue;
        }
      }

      // Preserve root ordering as a small strategic tie-breaker.
      const total = worstReply + cell.score * .06;
      if (total > bestScore) { bestScore = total; best = cell; }
    }
    return best;
  }

  function chooseBotMove() {
    const bot = session.bot || 'O';
    const human = session.human || 'X';
    const level = BOT_LEVELS[session.botLevel] ? session.botLevel : 'normal';
    if (level === 'easy') return chooseEasyMove(bot, human);
    if (level === 'hard') return chooseHardMove(bot, human);
    if (level === 'extreme') return chooseExtremeMove(bot, human);
    return chooseNormalMove(bot, human);
  }

  function scheduleBotMove() {
    if (lobbyOpen || session.mode !== 'bot' || game.turn !== session.bot || botThinking) return;
    botThinking = true;
    requestRender();
    window.setTimeout(() => {
      if (lobbyOpen || session.mode !== 'bot' || game.turn !== session.bot) {
        botThinking = false;
        requestRender();
        return;
      }
      const move = chooseBotMove();
      const result = game.play(move.x, move.y);
      botThinking = false;
      if (result.ok) {
        saveGame();
        if (result.newCycles.length) {
          showToast(`BOT O ghi ${result.newCycles.length} điểm · được thêm 1 lượt!`);
          if (navigator.vibrate) navigator.vibrate([25, 20, 35]);
        } else {
          showToast(`Bot đánh ${move.x},${move.y}`);
        }
      }
      requestRender();
      if (result.ok && result.finished) {
        window.setTimeout(showResult, 180);
        return;
      }
      // If the Bot just scored, the engine keeps O's turn. Schedule exactly
      // one additional Bot move. Scoring again can earn another bonus turn.
      if (result.ok && session.mode === 'bot' && game.turn === session.bot) scheduleBotMove();
    }, (BOT_LEVELS[session.botLevel] || BOT_LEVELS.normal).thinkMs || BOT_DELAY);
  }

  function placeFromScreen(sx, sy) {
    if (lobbyOpen) return;
    if (onlineContext && game.turn !== onlineContext.side) { showToast('Đang tới lượt đối thủ.'); return; }
    if (session.mode === 'bot' && (game.turn === session.bot || botThinking)) { showToast('Đang tới lượt Bot.'); return; }
    const world = screenToWorld(sx, sy);
    const x = Math.floor(world.x);
    const y = Math.floor(world.y);
    const result = game.play(x, y);
    if (!result.ok) {
      if (result.reason === 'occupied') showToast('Ô này đã có quân.');
      if (result.reason === 'finished') showResult();
      return;
    }
    saveGame();
    if (onlineContext) broadcastOnlineMove(x, y, result);
    if (result.newCycles.length) {
      const dirs = result.newCycles.map(c => c.directionLabel).join(' + ');
      const bonus = result.bonusTurn ? ' · được thêm 1 lượt!' : '';
      showToast(`${result.player} ghi ${result.newCycles.length} điểm · ${dirs}${bonus}`);
      if (navigator.vibrate) navigator.vibrate([35, 25, 55]);
    }
    requestRender();
    if (result.finished) { window.setTimeout(showResult, 180); return; }
    // scheduleBotMove() has its own turn guard. If X just scored, X keeps the
    // turn and the Bot will correctly wait for X's bonus move.
    if (session.mode === 'bot') scheduleBotMove();
  }


  function onlineSnapshotKey() {
    return onlineContext ? `nqznzee-caro-online-${onlineContext.roomId}` : '';
  }

  function loadOnlineSnapshot(roomId) {
    try {
      const raw = localStorage.getItem(`nqznzee-caro-online-${roomId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  async function broadcastOnlineMove(x, y, result) {
    if (!onlineContext || !onlineChannel) return;
    try {
      await onlineChannel.send({
        type: 'broadcast',
        event: 'caro_move',
        payload: {
          sender: onlineContext.userId,
          x, y,
          player: result.player,
          moveNumber: game.moveNumber
        }
      });
    } catch (error) {
      console.warn('Không thể gửi nước Online:', error);
      showToast('Mất kết nối realtime · đang thử đồng bộ lại.');
    }
  }

  function applyOnlineSnapshot(snapshot) {
    try {
      const incomingMove = Number(snapshot?.moveNumber) || 0;
      if (incomingMove <= game.moveNumber) return false;
      game = new CycleGame(snapshot, { groupSize: session.groupSize, targetPoints: session.targetPoints });
      saveGame();
      requestRender();
      return true;
    } catch (error) {
      console.warn('Snapshot Online không hợp lệ:', error);
      return false;
    }
  }

  async function setupOnlineChannel() {
    if (!onlineContext || !onlineClient) return;
    if (onlineChannel) await onlineClient.removeChannel(onlineChannel);
    onlineChannel = onlineClient.channel(`nqz-caro-game-${onlineContext.roomId}`, {
      config: { broadcast: { self: false } }
    })
      .on('broadcast', { event: 'caro_move' }, ({ payload }) => {
        if (!payload || payload.sender === onlineContext.userId) return;
        if ((Number(payload.moveNumber) || 0) <= game.moveNumber) return;
        if (String(payload.player || '').toUpperCase() !== game.turn) {
          onlineChannel.send({ type: 'broadcast', event: 'caro_sync_request', payload: { sender: onlineContext.userId, moveNumber: game.moveNumber } });
          return;
        }
        const result = game.play(Number(payload.x), Number(payload.y));
        if (!result.ok) {
          onlineChannel.send({ type: 'broadcast', event: 'caro_sync_request', payload: { sender: onlineContext.userId, moveNumber: game.moveNumber } });
          return;
        }
        saveGame();
        requestRender();
        if (result.newCycles.length) showToast(`${result.player} ghi ${result.newCycles.length} điểm${result.bonusTurn ? ' · thêm 1 lượt!' : ''}`);
        else showToast(`${result.player} đã đi ${payload.x},${payload.y}`);
        if (result.finished) window.setTimeout(showResult, 180);
      })
      .on('broadcast', { event: 'caro_sync_request' }, ({ payload }) => {
        if (!payload || payload.sender === onlineContext.userId) return;
        if (game.moveNumber <= (Number(payload.moveNumber) || 0)) return;
        onlineChannel.send({
          type: 'broadcast', event: 'caro_sync_state',
          payload: { sender: onlineContext.userId, snapshot: game.serialize() }
        });
      })
      .on('broadcast', { event: 'caro_sync_state' }, ({ payload }) => {
        if (!payload || payload.sender === onlineContext.userId) return;
        if (applyOnlineSnapshot(payload.snapshot)) showToast('Đã đồng bộ lại bàn Online.');
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          onlineChannel.send({ type: 'broadcast', event: 'caro_sync_request', payload: { sender: onlineContext.userId, moveNumber: game.moveNumber } });
        }
      });
  }

  async function bootOnlineMatch() {
    try {
      onlineClient = window.NQZ_ACCOUNT?.getClient?.();
      if (!onlineClient) return false;
      const account = await window.NQZ_ACCOUNT.refreshAccount();
      if (!account) return false;
      const { data: authData } = await onlineClient.auth.getSession();
      const userId = authData?.session?.user?.id || account.id;
      if (!userId) return false;

      const hint = loadOnlineLaunchHint();
      let room = null;
      let error = null;

      if (hint.roomId) {
        const result = await onlineClient.from('game_rooms').select('*').eq('id', hint.roomId).maybeSingle();
        room = result.data; error = result.error;
      } else {
        // Robust fallback: if GitHub/browser strips the query string, recover the
        // currently playing Caro room that belongs to this logged-in account.
        const result = await onlineClient.from('game_rooms')
          .select('*')
          .eq('game_type', 'caro')
          .eq('status', 'playing')
          .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        room = result.data; error = result.error;
      }

      if (error) throw error;
      if (!room) return false;
      if (room.game_type !== 'caro') return false;
      if (room.status !== 'playing') return false;

      const isHost = userId === room.host_id;
      const isGuest = userId === room.guest_id;
      if (!isHost && !isGuest) throw new Error('Bạn không thuộc phòng này.');

      const sideHint = hint.side || '';
      const side = String((isHost ? room.host_side : room.guest_side) || sideHint || 'x').toUpperCase();
      const opponentName = isHost ? room.guest_name : room.host_name;
      const opponentElo = isHost ? room.guest_elo : room.host_elo;
      const myElo = isHost ? room.host_elo : room.guest_elo;
      const settings = room.settings || {};
      const groupSize = Math.max(3, Math.min(25, Number(settings.pieces_per_point) || 5));
      const targetPoints = Math.max(1, Math.min(99, Number(settings.points_to_win) || 5));

      onlineContext = {
        roomId: room.id,
        roomCode: room.room_code || hint.roomCode,
        userId, side: side === 'O' ? 'O' : 'X',
        opponentName: opponentName || 'Đối thủ Online',
        opponentElo: Number(opponentElo) || DEFAULT_CARO_ELO,
        myElo: Number(myElo) || DEFAULT_CARO_ELO,
        rated: !!room.rated
      };

      try {
        const launch = { roomId: room.id, roomCode: room.room_code, gameType: 'caro', side: onlineContext.side, savedAt: Date.now() };
        sessionStorage.setItem('nqz-online-launch-v1', JSON.stringify(launch));
        localStorage.setItem('nqz-online-launch-v1', JSON.stringify(launch));
      } catch {}

      applyAccountIdentity(account);
      const snapshot = loadOnlineSnapshot(room.id);

      // V1.3: nếu build cũ đã kết thúc ván ở client nhưng room Supabase vẫn kẹt
      // ở `playing`, tự chốt room trước khi mở sảnh. Đây là đường dọn trạng thái
      // cho các ván V1/V1.2 đã chơi xong.
      if (snapshot?.finished) {
        try {
          await onlineClient.rpc('finish_game_room', {
            p_room_id: room.id,
            p_winner_side: snapshot.winner ? String(snapshot.winner).toLowerCase() : null,
            p_result: {
              score_x: Number(snapshot.scores?.X || 0),
              score_o: Number(snapshot.scores?.O || 0),
              moves: Number(snapshot.moveNumber || 0),
              reason: 'legacy-client-finished'
            }
          });
        } catch (cleanupError) {
          console.warn('Không thể dọn room Online cũ:', cleanupError);
        }
        clearOnlineLaunchContext(room.id);
        return false;
      }

      game = snapshot ? new CycleGame(snapshot, { groupSize, targetPoints }) : new CycleGame(null, { groupSize, targetPoints });
      session = { ...defaultSession(), mode: 'online', human: onlineContext.side, groupSize, targetPoints };
      loadedChunks.clear();
      camera.x = 0; camera.y = 0; camera.zoom = 1;
      lobbyOpen = false;
      ui.lobby?.classList.remove('show');
      document.body.classList.add('online-match-active');
      closeBotPicker(); closeMatchSetup(); closeResult(); setMenu(false);
      renderPlayerIdentity();
      requestRender();
      await setupOnlineChannel();
      showToast(`ONLINE V1.3 · phòng ${onlineContext.roomCode} · bạn cầm ${onlineContext.side}`);
      return true;
    } catch (error) {
      console.error('Không thể mở trận Caro Online:', error);
      showToast(`Online: ${String(error?.message || error)}`);
      return false;
    }
  }


  canvas.addEventListener('pointerdown', event => {
    if (pointer.id !== null) return;
    pointer.id = event.pointerId;
    pointer.downX = pointer.lastX = event.clientX;
    pointer.downY = pointer.lastY = event.clientY;
    pointer.dragged = false;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    if (Math.hypot(event.clientX - pointer.downX, event.clientY - pointer.downY) > 6) pointer.dragged = true;
    if (pointer.dragged) {
      const c = cellPx();
      camera.x -= dx / c;
      camera.y -= dy / c;
      requestRender();
    }
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  });

  function endPointer(event) {
    if (event.pointerId !== pointer.id) return;
    const rect = canvas.getBoundingClientRect();
    const shouldPlace = !pointer.dragged;
    pointer.id = null;
    canvas.classList.remove('dragging');
    if (shouldPlace) placeFromScreen(event.clientX - rect.left, event.clientY - rect.top);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', event => {
    if (event.pointerId === pointer.id) {
      pointer.id = null;
      canvas.classList.remove('dragging');
    }
  });

  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    zoomAt(sx, sy, event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
    const c = cellPx();
    camera.x = before.x - (sx - cssWidth / 2) / c;
    camera.y = before.y - (sy - cssHeight / 2) / c;
    requestRender();
  }

  document.getElementById('zoomInBtn').addEventListener('click', () => zoomAt(cssWidth / 2, cssHeight / 2, 1.15));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomAt(cssWidth / 2, cssHeight / 2, 1 / 1.15));
  document.getElementById('centerBtn').addEventListener('click', () => {
    camera.x = 0; camera.y = 0;
    showToast('Đã trở về tâm bàn cờ.');
    requestRender();
  });
  document.getElementById('resetBtn').addEventListener('click', async () => {
    // Online: rời/kết thúc room trước để tài khoản không bị kẹt ở `playing`.
    setMenu(false);
    if (onlineContext) await exitOnlineMatchToLobby();
    else openLobby();
    showToast('Chọn đối thủ và luật cho ván mới.');
  });

  const menuBtn = document.getElementById('menuBtn');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  const menuBackdrop = document.getElementById('menuBackdrop');
  const continueBtn = document.getElementById('continueBtn');
  const newLocalBtn = document.getElementById('newLocalBtn');
  const newBotBtn = document.getElementById('newBotBtn');
  const backLobbyBtn = document.getElementById('backLobbyBtn');

  document.querySelectorAll('[data-lobby-tab]').forEach(button => {
    button.addEventListener('click', () => setLobbyPanel(button.dataset.lobbyTab));
  });
  document.querySelectorAll('[data-lobby-bot-level]').forEach(button => {
    button.addEventListener('click', () => {
      const level = BOT_LEVELS[button.dataset.lobbyBotLevel] ? button.dataset.lobbyBotLevel : 'normal';
      openMatchSetup('bot', level);
    });
  });

  continueBtn?.addEventListener('click', () => {
    if (!hasSavedGame()) return;
    game = loadGame();
    session = loadSession();
    enterGame();
  });

  newLocalBtn?.addEventListener('click', () => {
    openMatchSetup('local', 'normal');
  });

  function updateSetupPreview() {
    const groupSize = Number(ui.groupSizeInput?.value);
    const targetPoints = Number(ui.targetPointsInput?.value);
    if (ui.setupPreview) ui.setupPreview.textContent = `${Number.isFinite(groupSize) ? groupSize : '?'} quân liên tiếp = 1 điểm · ${Number.isFinite(targetPoints) ? targetPoints : '?'} điểm = thắng · ghi điểm = thêm 1 lượt`;
  }

  function openMatchSetup(mode, botLevel = 'normal') {
    pendingSetup = { mode: mode === 'bot' ? 'bot' : 'local', botLevel: BOT_LEVELS[botLevel] ? botLevel : 'normal' };
    const level = BOT_LEVELS[pendingSetup.botLevel] || BOT_LEVELS.normal;
    if (ui.matchSetupMode) ui.matchSetupMode.textContent = pendingSetup.mode === 'bot' ? `Đấu ${level.label} · ${playerIdentity.displayName} X / Bot O · Elo ${level.elo}` : `${playerIdentity.displayName} X / Người chơi O · mỗi người Elo 1000`;
    if (ui.targetPointsInput) ui.targetPointsInput.value = String(session.targetPoints || 5);
    if (ui.groupSizeInput) ui.groupSizeInput.value = String(session.groupSize || 5);
    if (ui.setupError) ui.setupError.textContent = '';
    updateSetupPreview();
    matchSetup?.classList.add('show');
    matchSetup?.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => ui.targetPointsInput?.focus?.(), 30);
  }

  function closeMatchSetup() {
    matchSetup?.classList.remove('show');
    matchSetup?.setAttribute('aria-hidden', 'true');
  }

  function readMatchConfig() {
    const targetPoints = Number(ui.targetPointsInput?.value);
    const groupSize = Number(ui.groupSizeInput?.value);
    if (!Number.isInteger(groupSize) || groupSize < 3 || groupSize > 25) return { ok: false, message: 'Số quân cho 1 điểm phải là số nguyên từ 3 đến 25.' };
    if (!Number.isInteger(targetPoints) || targetPoints < 1 || targetPoints > 99) return { ok: false, message: 'Điểm để thắng phải là số nguyên từ 1 đến 99.' };
    return { ok: true, groupSize, targetPoints };
  }

  function showResult() {
    if (!game.finished || !game.winner) return;
    if (onlineContext) finishOnlineRoom('completed');
    const opponent = opponentIdentity();
    const winnerName = game.winner === 'X' ? playerIdentity.displayName : opponent.displayName;
    if (ui.resultTitle) ui.resultTitle.textContent = `${winnerName} thắng!`;
    if (ui.resultSummary) ui.resultSummary.textContent = `${game.scores.X} : ${game.scores.O} điểm · ${game.groupSize} quân cho mỗi điểm · mục tiêu ${game.targetPoints} điểm.`;
    resultModal?.classList.add('show');
    resultModal?.setAttribute('aria-hidden', 'false');
  }

  function closeResult() {
    resultModal?.classList.remove('show');
    resultModal?.setAttribute('aria-hidden', 'true');
  }

  function openBotPicker() {
    if (!botPicker) return;
    botPicker.classList.add('show');
    botPicker.setAttribute('aria-hidden', 'false');
  }

  function closeBotPicker() {
    if (!botPicker) return;
    botPicker.classList.remove('show');
    botPicker.setAttribute('aria-hidden', 'true');
  }

  newBotBtn?.addEventListener('click', () => {
    openBotPicker();
    // Keep focus inside the game UI so mobile browsers visibly respond to the tap.
    botPicker?.querySelector('[data-bot-level]')?.focus?.();
  });
  document.getElementById('closeBotPickerBtn')?.addEventListener('click', closeBotPicker);
  botPicker?.addEventListener('click', event => {
    if (event.target === botPicker) { closeBotPicker(); return; }
    const button = event.target.closest?.('[data-bot-level]');
    if (!button) return;
    const level = BOT_LEVELS[button.dataset.botLevel] ? button.dataset.botLevel : 'normal';
    closeBotPicker();
    openMatchSetup('bot', level);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && botPicker?.classList.contains('show')) closeBotPicker();
    if (event.key === 'Escape' && matchSetup?.classList.contains('show')) closeMatchSetup();
  });

  backLobbyBtn?.addEventListener('click', async () => { if (onlineContext) await exitOnlineMatchToLobby(); else openLobby(); });

  document.getElementById('closeMatchSetupBtn')?.addEventListener('click', closeMatchSetup);
  matchSetup?.addEventListener('click', event => { if (event.target === matchSetup) closeMatchSetup(); });
  ui.targetPointsInput?.addEventListener('input', updateSetupPreview);
  ui.groupSizeInput?.addEventListener('input', updateSetupPreview);
  document.getElementById('startConfiguredGameBtn')?.addEventListener('click', () => {
    const config = readMatchConfig();
    if (!config.ok) { if (ui.setupError) ui.setupError.textContent = config.message; return; }
    startNewGame(pendingSetup.mode, pendingSetup.botLevel, config);
  });
  document.getElementById('resultLobbyBtn')?.addEventListener('click', async () => { closeResult(); if (onlineContext) await exitOnlineMatchToLobby(); else openLobby(); });
  document.getElementById('resultNewBtn')?.addEventListener('click', async () => { closeResult(); if (onlineContext) await exitOnlineMatchToLobby(); else openLobby(); });

  function setMenu(open) {
    sidePanel.classList.toggle('open', open);
    sidePanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    menuBackdrop.classList.toggle('show', open);
  }

  menuBtn.addEventListener('click', () => setMenu(true));
  closeMenuBtn.addEventListener('click', () => setMenu(false));
  menuBackdrop.addEventListener('click', () => setMenu(false));

  window.addEventListener('nqz-account-updated', event => {
    applyAccountIdentity(event.detail?.account || null);
  });

  renderPlayerIdentity();
  renderThemeGallery();
  applyTheme(currentTheme, false);
  updateLobby();

  (async () => {
    const openedOnline = await bootOnlineMatch();
    if (!openedOnline) await refreshPlayerIdentity();
  })();

  window.addEventListener('storage', event => {
    if (event.key === THEME_KEY || event.key === CHESS_THEME_STORE) {
      const next = loadThemeId();
      if (next !== currentTheme) applyTheme(next, false);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (onlineChannel && onlineClient) onlineClient.removeChannel(onlineChannel);
  });

  new ResizeObserver(resizeCanvas).observe(wrap);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
})();

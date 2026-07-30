(() => {
  'use strict';

  const PAGE = window.NQZ_ROOM_PAGE || {};
  const selectedGame = PAGE.game === 'caro' ? 'caro' : 'chess';
  const root = PAGE.root || '../../';
  const returnPath = PAGE.returnPath || (selectedGame === 'caro' ? 'caro/' : 'play.html');
  const version = '1.3';

  const $ = id => document.getElementById(id);
  const ui = {
    entry: $('entryPanel'), room: $('roomPanel'), loginNotice: $('loginNotice'), accountLine: $('accountLine'),
    create: $('createRoomBtn'), join: $('joinRoomBtn'), codeInput: $('roomCodeInput'),
    chessSettings: $('chessSettings'), caroSettings: $('caroSettings'), chessMinutes: $('chessMinutes'), chessIncrement: $('chessIncrement'),
    caroPoints: $('caroPoints'), caroPieces: $('caroPieces'), caroBonus: $('caroBonusTurn'), rated: $('ratedToggle'),
    roomGameLabel: $('roomGameLabel'), codeBadge: $('copyCodeBtn'), status: $('roomStatusText'), hostName: $('hostName'), hostMeta: $('hostMeta'),
    guestName: $('guestName'), guestMeta: $('guestMeta'), hostReady: $('hostReady'), guestReady: $('guestReady'), summary: $('roomSummary'),
    ready: $('readyBtn'), start: $('startBtn'), leave: $('leaveRoomBtn'), launch: $('launchBox'), openGame: $('openGameBtn'), toast: $('toast'),
    activeNotice: $('activeRoomNotice'), activeText: $('activeRoomText'), resumeActive: $('resumeActiveRoom'), abandonActive: $('abandonActiveRoom')
  };

  let sb = null;
  let account = null;
  let currentUserId = null;
  let room = null;
  let channel = null;
  let toastTimer = 0;
  let launchTimer = 0;
  let launchRoomId = null;

  function toast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400);
  }

  function cleanError(error) {
    const raw = String(error?.message || error || 'Có lỗi xảy ra.');
    const map = {
      LOGIN_REQUIRED: 'Bạn cần đăng nhập trước.',
      INVALID_ROOM_CODE: 'Mã phòng phải có đúng 4 số.',
      ROOM_NOT_FOUND: 'Không tìm thấy phòng đang hoạt động.',
      ROOM_NOT_FOUND_FOR_GAME: selectedGame === 'caro' ? 'Không tìm thấy phòng Caro với mã này.' : 'Không tìm thấy phòng Cờ vua với mã này.',
      ROOM_FULL: 'Phòng đã đủ 2 người.',
      ALREADY_IN_PLAYING_ROOM: 'Tài khoản đang ở trong một trận khác. Hãy tiếp tục hoặc rời trận cũ trước.',
      HOST_ONLY: 'Chỉ chủ phòng mới có thể bắt đầu.',
      WAITING_FOR_GUEST: 'Chưa có đối thủ vào phòng.',
      PLAYERS_NOT_READY: 'Cả hai người phải sẵn sàng.',
      ROOM_ALREADY_STARTED: 'Phòng này đã bắt đầu.',
      NOT_ROOM_MEMBER: 'Bạn không thuộc phòng này.',
      ROOM_NOT_PLAYING: 'Phòng này không ở trạng thái đang chơi.'
    };
    const key = Object.keys(map).find(k => raw.includes(k));
    return key ? map[key] : raw.replace(/^.*?message[:=]\s*/i, '');
  }

  function localCaroElo() {
    if (!account) return 1000;
    const key = String(account.id || account.username || account.display_name || 'guest').trim() || 'guest';
    try {
      const map = JSON.parse(localStorage.getItem('nqznzee-caro-ratings-v1') || '{}');
      const value = Number(map[key]);
      return Number.isFinite(value) ? Math.round(value) : 1000;
    } catch { return 1000; }
  }

  function renderAccountLine() {
    if (!account || !ui.accountLine) return;
    const identity = window.NQZ_ACCOUNT.getAccountIdentity(account);
    const elo = selectedGame === 'chess' ? (account?.rating?.bot_rating ?? 1000) : localCaroElo();
    ui.accountLine.textContent = `${identity.label} · ${selectedGame === 'chess' ? 'Chess' : 'Caro'} Elo ${elo}`;
  }

  function getSettings() {
    if (selectedGame === 'chess') {
      return { time_minutes: Number(ui.chessMinutes?.value) || 10, increment_seconds: Number(ui.chessIncrement?.value) || 0 };
    }
    const points = Math.max(1, Math.min(99, Math.round(Number(ui.caroPoints?.value) || 5)));
    const pieces = Math.max(3, Math.min(25, Math.round(Number(ui.caroPieces?.value) || 5)));
    if (ui.caroPoints) ui.caroPoints.value = String(points);
    if (ui.caroPieces) ui.caroPieces.value = String(pieces);
    return { points_to_win: points, pieces_per_point: pieces, bonus_turn: !!ui.caroBonus?.checked };
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?';
  }

  function sideLabel(side, game) {
    if (!side) return 'Chưa chia bên';
    if (game === 'chess') return side === 'white' ? 'Trắng' : 'Đen';
    return String(side).toUpperCase();
  }

  function gameLaunchHref(r) {
    if (!r || r.status !== 'playing') return '';
    const isHost = currentUserId === r.host_id;
    const side = isHost ? r.host_side : r.guest_side;
    if (r.game_type === 'chess') {
      return `${root}play.html?v=9.10&online_v=${version}&online_room=${encodeURIComponent(r.id)}&room_code=${r.room_code}&side=${side || ''}`;
    }
    return `${root}caro/?online_v=${version}&online_room=${encodeURIComponent(r.id)}&room_code=${r.room_code}&side=${side || ''}`;
  }

  function rememberLaunchContext(r) {
    if (!r?.id) return;
    const isHost = currentUserId === r.host_id;
    const side = isHost ? r.host_side : r.guest_side;
    const payload = { roomId: r.id, roomCode: r.room_code, gameType: r.game_type, side: side || '', savedAt: Date.now() };
    try {
      sessionStorage.setItem('nqz-online-launch-v1', JSON.stringify(payload));
      localStorage.setItem('nqz-online-launch-v1', JSON.stringify(payload));
    } catch {}
  }

  function scheduleGameLaunch(r) {
    const href = gameLaunchHref(r);
    if (!href || launchRoomId === r.id) return;
    launchRoomId = r.id;
    rememberLaunchContext(r);
    clearTimeout(launchTimer);
    launchTimer = setTimeout(() => location.replace(href), 180);
  }

  function roomSummaryText(r) {
    const s = r.settings || {};
    if (r.game_type === 'chess') return `${s.time_minutes || 10} phút + ${s.increment_seconds || 0} giây · ${r.rated ? 'Xếp hạng' : 'Thường'}`;
    return `${s.pieces_per_point || 5} quân = 1 điểm · ${s.points_to_win || 5} điểm thắng · ${s.bonus_turn !== false ? 'ghi điểm +1 lượt' : 'không thưởng lượt'} · ${r.rated ? 'Xếp hạng' : 'Thường'}`;
  }

  function renderRoom() {
    if (!room) {
      if (ui.entry) ui.entry.hidden = false;
      if (ui.room) ui.room.hidden = true;
      return;
    }
    ui.entry.hidden = true;
    ui.room.hidden = false;
    ui.roomGameLabel.textContent = room.game_type === 'chess' ? 'CỜ VUA ONLINE' : 'CARO ONLINE';
    ui.codeBadge.textContent = room.room_code;
    ui.status.textContent = room.status === 'playing' ? 'Trận đã bắt đầu.' : room.guest_id ? (room.host_ready && room.guest_ready ? 'Cả hai đã sẵn sàng.' : 'Đối thủ đã vào phòng.') : 'Đang chờ đối thủ…';
    ui.hostName.textContent = room.host_name || 'Chủ phòng';
    ui.hostMeta.textContent = `Elo ${room.host_elo ?? 1000} · ${sideLabel(room.host_side, room.game_type)}`;
    ui.guestName.textContent = room.guest_name || 'Đang chờ…';
    ui.guestMeta.textContent = room.guest_id ? `Elo ${room.guest_elo ?? 1000} · ${sideLabel(room.guest_side, room.game_type)}` : 'Gửi mã phòng cho bạn bè';
    $('hostAvatar').textContent = initials(room.host_name);
    $('guestAvatar').textContent = room.guest_id ? initials(room.guest_name) : '?';
    ui.hostReady.textContent = room.host_ready ? '✓ Sẵn sàng' : 'Chưa sẵn sàng';
    ui.hostReady.classList.toggle('ready', !!room.host_ready);
    ui.guestReady.textContent = !room.guest_id ? 'Chưa vào phòng' : room.guest_ready ? '✓ Sẵn sàng' : 'Chưa sẵn sàng';
    ui.guestReady.classList.toggle('ready', !!room.guest_ready);
    ui.summary.textContent = roomSummaryText(room);

    const isHost = currentUserId === room.host_id;
    const myReady = isHost ? room.host_ready : room.guest_ready;
    ui.ready.textContent = myReady ? 'Bỏ sẵn sàng' : '✓ Sẵn sàng';
    ui.ready.disabled = !room.guest_id || room.status === 'playing';
    ui.start.hidden = !(isHost && room.guest_id && room.host_ready && room.guest_ready && room.status !== 'playing');
    ui.launch.hidden = room.status !== 'playing';
    if (room.status === 'playing') {
      ui.openGame.href = gameLaunchHref(room);
      ui.openGame.textContent = room.game_type === 'chess' ? 'Mở bàn Cờ vua' : 'Mở bàn Caro';
      rememberLaunchContext(room);
      scheduleGameLaunch(room);
    }
  }

  async function subscribeRoom(id) {
    if (channel) { await sb.removeChannel(channel); channel = null; }
    channel = sb.channel(`nqz-room-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${id}` }, payload => {
        room = payload.new;
        if (room.status === 'cancelled' || room.status === 'finished') {
          toast(room.status === 'finished' ? 'Trận đã kết thúc.' : 'Phòng đã đóng.');
          setTimeout(() => setCurrentRoom(null), 500);
          return;
        }
        renderRoom();
      })
      .subscribe();
  }

  async function setCurrentRoom(next) {
    room = next;
    const url = new URL(location.href);
    if (room?.room_code) url.searchParams.set('room', room.room_code);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url);
    renderRoom();
    if (room?.id) await subscribeRoom(room.id);
  }

  async function callRpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function findActiveRoom() {
    if (!sb || !currentUserId) return null;
    const { data, error } = await sb.from('game_rooms')
      .select('*')
      .eq('status', 'playing')
      .or(`host_id.eq.${currentUserId},guest_id.eq.${currentUserId}`)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data || null;
  }

  function renderActiveRoomRecovery(active) {
    if (!ui.activeNotice) return;
    if (!active) { ui.activeNotice.hidden = true; return; }
    const gameName = active.game_type === 'caro' ? 'Caro' : 'Cờ vua';
    ui.activeNotice.hidden = false;
    if (ui.activeText) ui.activeText.textContent = `Tài khoản đang ở trong trận ${gameName} · phòng ${active.room_code}.`;
    if (ui.resumeActive) ui.resumeActive.href = gameLaunchHref(active);
    if (ui.abandonActive) {
      ui.abandonActive.onclick = async () => {
        ui.abandonActive.disabled = true;
        try {
          await callRpc('leave_game_room', { p_room_id: active.id });
          renderActiveRoomRecovery(null);
          toast('Đã rời trận cũ. Bạn có thể tạo phòng mới.');
        } catch (error) { toast(cleanError(error)); }
        finally { ui.abandonActive.disabled = false; }
      };
    }
  }

  async function createRoom() {
    if (!account) return toast('Bạn cần đăng nhập trước.');
    ui.create.disabled = true;
    try {
      const result = await callRpc('create_game_room', { p_game_type: selectedGame, p_settings: getSettings(), p_rated: !!ui.rated?.checked });
      await setCurrentRoom(result);
      toast(`Đã tạo phòng ${result.room_code}`);
    } catch (error) {
      toast(cleanError(error));
      if (String(error?.message || '').includes('ALREADY_IN_PLAYING_ROOM')) renderActiveRoomRecovery(await findActiveRoom());
    }
    finally { ui.create.disabled = false; }
  }

  async function joinRoom() {
    if (!account) return toast('Bạn cần đăng nhập trước.');
    const code = ui.codeInput.value.replace(/\D/g, '').slice(0, 4);
    if (code.length !== 4) return toast('Nhập đủ 4 chữ số.');
    ui.join.disabled = true;
    try {
      const result = await callRpc('join_game_room_for_game', { p_room_code: code, p_game_type: selectedGame });
      await setCurrentRoom(result);
      toast(`Đã vào phòng ${code}`);
    } catch (error) { toast(cleanError(error)); }
    finally { ui.join.disabled = false; }
  }

  async function toggleReady() {
    if (!room) return;
    const isHost = currentUserId === room.host_id;
    const current = isHost ? room.host_ready : room.guest_ready;
    try { await setCurrentRoom(await callRpc('set_game_room_ready', { p_room_id: room.id, p_ready: !current })); }
    catch (error) { toast(cleanError(error)); }
  }

  async function startRoom() {
    if (!room) return;
    try {
      await setCurrentRoom(await callRpc('start_game_room', { p_room_id: room.id }));
      toast('Trận đã bắt đầu.');
    } catch (error) { toast(cleanError(error)); }
  }

  async function leaveRoom() {
    if (!room) return;
    try { await callRpc('leave_game_room', { p_room_id: room.id }); }
    catch (error) { toast(cleanError(error)); }
    if (channel) { await sb.removeChannel(channel); channel = null; }
    await setCurrentRoom(null);
  }

  async function boot() {
    document.documentElement.dataset.game = selectedGame;
    if (ui.chessSettings) ui.chessSettings.hidden = selectedGame !== 'chess';
    if (ui.caroSettings) ui.caroSettings.hidden = selectedGame !== 'caro';
    ui.codeInput?.addEventListener('input', () => { ui.codeInput.value = ui.codeInput.value.replace(/\D/g, '').slice(0, 4); });
    ui.create?.addEventListener('click', createRoom);
    ui.join?.addEventListener('click', joinRoom);
    ui.ready?.addEventListener('click', toggleReady);
    ui.start?.addEventListener('click', startRoom);
    ui.leave?.addEventListener('click', leaveRoom);
    ui.codeBadge?.addEventListener('click', async () => {
      if (!room) return;
      try { await navigator.clipboard.writeText(room.room_code); toast('Đã sao chép mã phòng.'); }
      catch { toast(`Mã phòng: ${room.room_code}`); }
    });

    try {
      sb = window.NQZ_ACCOUNT?.getClient?.();
      if (!sb) throw new Error('Supabase chưa được cấu hình.');
      account = await window.NQZ_ACCOUNT.refreshAccount();
      if (!account) {
        ui.loginNotice.hidden = false;
        const returnUrl = encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
        ui.accountLine.innerHTML = `Chưa đăng nhập · <a href="${root}login.html?return=${returnUrl}">Đăng nhập</a>`;
        ui.create.disabled = true;
        ui.join.disabled = true;
        return;
      }
      const { data: authData } = await sb.auth.getSession();
      currentUserId = authData?.session?.user?.id || account.id;
      renderAccountLine();
      renderActiveRoomRecovery(await findActiveRoom());

      const resumeCode = new URLSearchParams(location.search).get('room');
      if (resumeCode && /^\d{4}$/.test(resumeCode)) {
        const { data: savedRoom, error: savedError } = await sb.from('game_rooms')
          .select('*')
          .eq('room_code', resumeCode)
          .eq('game_type', selectedGame)
          .in('status', ['waiting', 'ready', 'playing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!savedError && savedRoom) await setCurrentRoom(savedRoom);
      }
    } catch (error) {
      ui.loginNotice.hidden = false;
      ui.loginNotice.textContent = `Không thể kết nối Supabase: ${cleanError(error)}`;
      ui.accountLine.textContent = 'Online chưa sẵn sàng.';
      ui.create.disabled = true;
      ui.join.disabled = true;
    }
  }

  window.addEventListener('beforeunload', () => { if (channel && sb) sb.removeChannel(channel); });
  boot();
})();

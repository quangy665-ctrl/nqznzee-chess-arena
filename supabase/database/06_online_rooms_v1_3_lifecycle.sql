-- NqznZee Arena · Online Rooms v1.3 lifecycle + game-separated joins
-- Chạy file này SAU 05_shared_online_rooms.sql nếu project đã cài Online Rooms V1/V1.2.

alter table public.game_rooms
    add column if not exists winner_side text,
    add column if not exists result jsonb not null default '{}'::jsonb;

-- Kết thúc một trận đã chơi. Chỉ thành viên của phòng được gọi.
-- Hàm idempotent: gọi lại sau khi phòng đã finished/cancelled vẫn an toàn.
create or replace function public.finish_game_room(
    p_room_id uuid,
    p_winner_side text default null,
    p_result jsonb default '{}'::jsonb
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_room public.game_rooms;
    v_side text := lower(nullif(trim(coalesce(p_winner_side, '')), ''));
begin
    if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;

    select * into v_room
      from public.game_rooms
     where id = p_room_id
     for update;

    if not found then raise exception 'ROOM_NOT_FOUND'; end if;
    if v_room.host_id <> v_uid and v_room.guest_id is distinct from v_uid then
        raise exception 'NOT_ROOM_MEMBER';
    end if;

    if v_room.status in ('finished', 'cancelled') then
        return v_room;
    end if;
    if v_room.status <> 'playing' then
        raise exception 'ROOM_NOT_PLAYING';
    end if;

    if v_side is not null then
        if v_room.game_type = 'chess' and v_side not in ('white','black','draw') then
            raise exception 'INVALID_WINNER_SIDE';
        elsif v_room.game_type = 'caro' and v_side not in ('x','o','draw') then
            raise exception 'INVALID_WINNER_SIDE';
        end if;
    end if;

    update public.game_rooms
       set status = 'finished',
           finished_at = now(),
           winner_side = v_side,
           result = coalesce(p_result, '{}'::jsonb)
     where id = p_room_id
     returning * into v_room;

    return v_room;
end;
$$;

-- Vào phòng nhưng bắt buộc đúng loại game của trang hiện tại.
-- Nhờ vậy Caro không thể nhập mã phòng Chess và ngược lại.
create or replace function public.join_game_room_for_game(
    p_room_code text,
    p_game_type text
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_room public.game_rooms;
    v_host_side text;
    v_guest_side text;
begin
    if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
    if p_room_code is null or p_room_code !~ '^[0-9]{4}$' then raise exception 'INVALID_ROOM_CODE'; end if;
    if p_game_type not in ('chess', 'caro') then raise exception 'INVALID_GAME_TYPE'; end if;

    update public.game_rooms
       set status = 'cancelled', finished_at = now()
     where status in ('waiting','ready','playing')
       and expires_at <= now();

    select * into v_room
      from public.game_rooms
     where room_code = p_room_code
       and game_type = p_game_type
       and status in ('waiting', 'ready')
       and expires_at > now()
     order by created_at desc
     limit 1
     for update;

    if not found then raise exception 'ROOM_NOT_FOUND_FOR_GAME'; end if;
    if v_room.host_id = v_uid then return v_room; end if;
    if v_room.guest_id is not null and v_room.guest_id <> v_uid then raise exception 'ROOM_FULL'; end if;
    if exists (
        select 1 from public.game_rooms
         where status = 'playing'
           and (host_id = v_uid or guest_id = v_uid)
           and id <> v_room.id
    ) then
        raise exception 'ALREADY_IN_PLAYING_ROOM';
    end if;

    if v_room.game_type = 'chess' then
        if random() < 0.5 then
            v_host_side := 'white'; v_guest_side := 'black';
        else
            v_host_side := 'black'; v_guest_side := 'white';
        end if;
    else
        if random() < 0.5 then
            v_host_side := 'x'; v_guest_side := 'o';
        else
            v_host_side := 'o'; v_guest_side := 'x';
        end if;
    end if;

    update public.game_rooms
       set guest_id = v_uid,
           guest_name = public.nqz_player_display_name(v_uid),
           guest_elo = public.nqz_game_elo(v_uid, v_room.game_type),
           host_side = v_host_side,
           guest_side = v_guest_side,
           host_ready = false,
           guest_ready = false,
           status = 'waiting'
     where id = v_room.id
     returning * into v_room;

    return v_room;
end;
$$;

-- V1.3: dọn cả phòng playing đã hết hạn trước khi tạo phòng mới.
create or replace function public.create_game_room(
    p_game_type text,
    p_settings jsonb default '{}'::jsonb,
    p_rated boolean default false
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_code text;
    v_room public.game_rooms;
    v_try integer;
begin
    if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
    if p_game_type not in ('chess', 'caro') then raise exception 'INVALID_GAME_TYPE'; end if;

    update public.game_rooms
       set status = 'cancelled', finished_at = now()
     where status in ('waiting', 'ready', 'playing')
       and expires_at <= now();

    if exists (
        select 1 from public.game_rooms
         where status = 'playing'
           and (host_id = v_uid or guest_id = v_uid)
    ) then
        raise exception 'ALREADY_IN_PLAYING_ROOM';
    end if;

    update public.game_rooms
       set status = 'cancelled', finished_at = now()
     where host_id = v_uid
       and status in ('waiting', 'ready');

    for v_try in 1..80 loop
        v_code := lpad(floor(random() * 10000)::int::text, 4, '0');
        begin
            insert into public.game_rooms (
                room_code, game_type, rated, settings,
                host_id, host_name, host_elo,
                host_ready, guest_ready
            ) values (
                v_code, p_game_type, coalesce(p_rated, false), coalesce(p_settings, '{}'::jsonb),
                v_uid, public.nqz_player_display_name(v_uid), public.nqz_game_elo(v_uid, p_game_type),
                false, false
            ) returning * into v_room;
            return v_room;
        exception when unique_violation then
        end;
    end loop;

    raise exception 'NO_ROOM_CODE_AVAILABLE';
end;
$$;

revoke all on function public.finish_game_room(uuid, text, jsonb) from public;
revoke all on function public.join_game_room_for_game(text, text) from public;
grant execute on function public.finish_game_room(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.join_game_room_for_game(text, text) to authenticated, service_role;

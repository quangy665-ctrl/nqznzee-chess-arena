-- NqznZee Arena · Shared Online Rooms v1
-- Dùng chung cho Chess + Caro. Chạy toàn bộ file trong Supabase SQL Editor.
-- Giai đoạn này cung cấp: tạo phòng 4 số, vào phòng, Ready, bắt đầu, rời/hủy phòng,
-- và Realtime cập nhật trạng thái phòng. Nước đi realtime sẽ nối ở migration tiếp theo.

create extension if not exists pgcrypto;

create table if not exists public.game_rooms (
    id uuid primary key default gen_random_uuid(),
    room_code text not null check (room_code ~ '^[0-9]{4}$'),
    game_type text not null check (game_type in ('chess', 'caro')),
    status text not null default 'waiting'
        check (status in ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
    rated boolean not null default false,
    settings jsonb not null default '{}'::jsonb,

    host_id uuid not null references auth.users(id) on delete cascade,
    guest_id uuid references auth.users(id) on delete set null,
    host_name text not null default 'Người chơi',
    guest_name text,
    host_elo integer not null default 1000,
    guest_elo integer,
    host_side text,
    guest_side text,
    host_ready boolean not null default false,
    guest_ready boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    expires_at timestamptz not null default (now() + interval '2 hours'),
    version bigint not null default 1
);

create unique index if not exists game_rooms_active_code_uq
    on public.game_rooms(room_code)
    where status in ('waiting', 'ready', 'playing');

create index if not exists game_rooms_host_idx on public.game_rooms(host_id);
create index if not exists game_rooms_guest_idx on public.game_rooms(guest_id);
create index if not exists game_rooms_status_idx on public.game_rooms(status, game_type);

alter table public.game_rooms enable row level security;

-- Chỉ hai người trong phòng mới đọc được trạng thái phòng sau khi đã tạo/vào.
drop policy if exists "room members can read room" on public.game_rooms;
create policy "room members can read room"
on public.game_rooms
for select
to authenticated
using (auth.uid() = host_id or auth.uid() = guest_id);

-- Không cho client tự insert/update/delete trực tiếp. Mọi thay đổi đi qua RPC bảo vệ bên dưới.
revoke insert, update, delete on public.game_rooms from anon, authenticated;
grant select on public.game_rooms to authenticated;
grant all on public.game_rooms to service_role;

create or replace function public.nqz_room_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    new.version := old.version + 1;
    return new;
end;
$$;

drop trigger if exists game_rooms_touch_updated_at on public.game_rooms;
create trigger game_rooms_touch_updated_at
before update on public.game_rooms
for each row execute function public.nqz_room_touch_updated_at();

create or replace function public.nqz_player_display_name(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text;
begin
    select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Người chơi')
      into v_name
      from public.profiles
     where id = p_user_id;

    return coalesce(v_name, 'Người chơi');
end;
$$;

create or replace function public.nqz_game_elo(p_user_id uuid, p_game_type text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_elo integer := 1000;
    v_col text;
begin
    if p_game_type = 'chess' then
        select coalesce(bot_rating, 1000)::integer
          into v_elo
          from public.ratings
         where user_id = p_user_id;
        return greatest(100, coalesce(v_elo, 1000));
    end if;

    -- Nếu project đã có bảng caro_ratings, tự tìm một trong các tên cột Elo phổ biến.
    if to_regclass('public.caro_ratings') is not null then
        select column_name
          into v_col
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'caro_ratings'
           and column_name in ('elo', 'caro_elo', 'rating')
         order by case column_name when 'elo' then 1 when 'caro_elo' then 2 else 3 end
         limit 1;

        if v_col is not null then
            begin
                execute format(
                    'select coalesce(%I, 1000)::integer from public.caro_ratings where user_id = $1 limit 1',
                    v_col
                ) into v_elo using p_user_id;
            exception when others then
                v_elo := 1000;
            end;
        end if;
    end if;

    return greatest(100, coalesce(v_elo, 1000));
end;
$$;

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
    if v_uid is null then
        raise exception 'LOGIN_REQUIRED';
    end if;
    if p_game_type not in ('chess', 'caro') then
        raise exception 'INVALID_GAME_TYPE';
    end if;

    update public.game_rooms
       set status = 'cancelled', finished_at = now()
     where status in ('waiting', 'ready')
       and expires_at <= now();

    -- Một tài khoản không thể mở thêm phòng nếu đang trong một trận đã bắt đầu.
    if exists (
        select 1 from public.game_rooms
         where status = 'playing'
           and (host_id = v_uid or guest_id = v_uid)
    ) then
        raise exception 'ALREADY_IN_PLAYING_ROOM';
    end if;

    -- Đóng sảnh cũ của chính người tạo để không giữ mã 4 số vô ích.
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
            -- Mã đang được phòng khác sử dụng, thử số khác.
        end;
    end loop;

    raise exception 'NO_ROOM_CODE_AVAILABLE';
end;
$$;

create or replace function public.join_game_room(p_room_code text)
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
    if v_uid is null then
        raise exception 'LOGIN_REQUIRED';
    end if;
    if p_room_code is null or p_room_code !~ '^[0-9]{4}$' then
        raise exception 'INVALID_ROOM_CODE';
    end if;

    select * into v_room
      from public.game_rooms
     where room_code = p_room_code
       and status in ('waiting', 'ready')
       and expires_at > now()
     order by created_at desc
     limit 1
     for update;

    if not found then
        raise exception 'ROOM_NOT_FOUND';
    end if;
    if v_room.host_id = v_uid then
        return v_room;
    end if;
    if v_room.guest_id is not null and v_room.guest_id <> v_uid then
        raise exception 'ROOM_FULL';
    end if;
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

create or replace function public.set_game_room_ready(
    p_room_id uuid,
    p_ready boolean
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_room public.game_rooms;
begin
    if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;

    select * into v_room from public.game_rooms where id = p_room_id for update;
    if not found then raise exception 'ROOM_NOT_FOUND'; end if;
    if v_room.status not in ('waiting', 'ready') then raise exception 'ROOM_ALREADY_STARTED'; end if;
    if v_room.host_id <> v_uid and v_room.guest_id is distinct from v_uid then raise exception 'NOT_ROOM_MEMBER'; end if;

    if v_room.host_id = v_uid then
        update public.game_rooms set host_ready = coalesce(p_ready, false) where id = p_room_id returning * into v_room;
    else
        update public.game_rooms set guest_ready = coalesce(p_ready, false) where id = p_room_id returning * into v_room;
    end if;

    update public.game_rooms
       set status = case when host_ready and guest_ready and guest_id is not null then 'ready' else 'waiting' end
     where id = p_room_id
     returning * into v_room;

    return v_room;
end;
$$;

create or replace function public.start_game_room(p_room_id uuid)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_room public.game_rooms;
begin
    if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;

    select * into v_room from public.game_rooms where id = p_room_id for update;
    if not found then raise exception 'ROOM_NOT_FOUND'; end if;
    if v_room.host_id <> v_uid then raise exception 'HOST_ONLY'; end if;
    if v_room.guest_id is null then raise exception 'WAITING_FOR_GUEST'; end if;
    if not (v_room.host_ready and v_room.guest_ready) then raise exception 'PLAYERS_NOT_READY'; end if;
    if v_room.status not in ('waiting', 'ready') then raise exception 'ROOM_ALREADY_STARTED'; end if;

    update public.game_rooms
       set status = 'playing', started_at = now()
     where id = p_room_id
     returning * into v_room;
    return v_room;
end;
$$;

create or replace function public.leave_game_room(p_room_id uuid)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_room public.game_rooms;
begin
    if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;

    select * into v_room from public.game_rooms where id = p_room_id for update;
    if not found then raise exception 'ROOM_NOT_FOUND'; end if;
    if v_room.host_id <> v_uid and v_room.guest_id is distinct from v_uid then raise exception 'NOT_ROOM_MEMBER'; end if;

    if v_room.status = 'playing' then
        update public.game_rooms
           set status = 'cancelled', finished_at = now()
         where id = p_room_id
         returning * into v_room;
        return v_room;
    end if;

    if v_room.host_id = v_uid then
        update public.game_rooms
           set status = 'cancelled', finished_at = now()
         where id = p_room_id
         returning * into v_room;
    else
        update public.game_rooms
           set guest_id = null,
               guest_name = null,
               guest_elo = null,
               guest_side = null,
               host_side = null,
               host_ready = false,
               guest_ready = false,
               status = 'waiting'
         where id = p_room_id
         returning * into v_room;
    end if;
    return v_room;
end;
$$;

revoke all on function public.create_game_room(text, jsonb, boolean) from public;
revoke all on function public.join_game_room(text) from public;
revoke all on function public.set_game_room_ready(uuid, boolean) from public;
revoke all on function public.start_game_room(uuid) from public;
revoke all on function public.leave_game_room(uuid) from public;

grant execute on function public.create_game_room(text, jsonb, boolean) to authenticated, service_role;
grant execute on function public.join_game_room(text) to authenticated, service_role;
grant execute on function public.set_game_room_ready(uuid, boolean) to authenticated, service_role;
grant execute on function public.start_game_room(uuid) to authenticated, service_role;
grant execute on function public.leave_game_room(uuid) to authenticated, service_role;

-- Bật Realtime Postgres Changes cho bảng phòng (idempotent).
do $$
begin
    if not exists (
        select 1
          from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'game_rooms'
    ) then
        alter publication supabase_realtime add table public.game_rooms;
    end if;
end $$;
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

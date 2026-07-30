-- TEST: grant one standard title to a player.
-- Replace YOUR_USERNAME_HERE and GM as needed.
-- Valid title codes: GM, IM, FM.

insert into public.user_badges (
    user_id,
    badge_id,
    granted_by,
    note
)
select
    p.id,
    b.id,
    null,
    'Standard chess title'
from public.profiles as p
cross join public.badges as b
where lower(p.username) =
      lower('YOUR_USERNAME_HERE')
  and b.code = 'GM'
on conflict (user_id, badge_id)
do update set
    granted_at = now(),
    expires_at = null,
    note = excluded.note;

select
    p.username,
    b.code as title,
    r.bot_rating
from public.user_badges as ub
join public.profiles as p
  on p.id = ub.user_id
join public.badges as b
  on b.id = ub.badge_id
join public.ratings as r
  on r.user_id = p.id
where lower(p.username) =
      lower('YOUR_USERNAME_HERE')
  and b.code in ('GM', 'IM', 'FM');

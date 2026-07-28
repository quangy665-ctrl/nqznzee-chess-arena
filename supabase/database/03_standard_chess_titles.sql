-- NqznZee V8.0 — Standard chess titles
-- Creates the three title badges used by the game name display.

insert into public.badges (
    code,
    display_name,
    description,
    color,
    icon,
    is_active
)
values
    (
        'GM',
        'GM',
        'Grandmaster',
        '#a63d4d',
        'GM',
        true
    ),
    (
        'IM',
        'IM',
        'International Master',
        '#c55b3f',
        'IM',
        true
    ),
    (
        'FM',
        'FM',
        'FIDE Master',
        '#9a6a45',
        'FM',
        true
    )
on conflict (code)
do update set
    display_name =
        excluded.display_name,
    description =
        excluded.description,
    color =
        excluded.color,
    icon =
        excluded.icon,
    is_active =
        true;

select
    code,
    display_name,
    description,
    color,
    is_active
from public.badges
where code in ('GM', 'IM', 'FM')
order by
    case code
        when 'GM' then 1
        when 'IM' then 2
        when 'FM' then 3
        else 4
    end;

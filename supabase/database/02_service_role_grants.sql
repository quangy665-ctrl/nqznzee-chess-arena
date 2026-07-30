grant usage on schema public
to service_role;

grant select, insert, update, delete
on table
    public.profiles,
    public.ratings,
    public.badges,
    public.user_badges,
    public.admin_actions
to service_role;

grant usage, select
on all sequences in schema public
to service_role;

alter default privileges
for role postgres
in schema public
grant select, insert, update, delete
on tables
to service_role;

alter default privileges
for role postgres
in schema public
grant usage, select
on sequences
to service_role;

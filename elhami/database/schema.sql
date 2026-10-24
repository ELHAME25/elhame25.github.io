-- Apply in a new Supabase project. No secret keys belong in this file.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 60),
 created_at timestamptz not null default now()
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 150),
 kind text not null check (kind in ('book','topic')),
 scope text not null,
 scheduled_at timestamptz,
 duration_minutes integer not null default 45 check (duration_minutes in (45,60)),
 save_summary boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid references public.sessions(id) on delete set null,
 title text not null,
 body text not null,
 created_at timestamptz not null default now()
);
create table public.references (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 kind text not null,
 url text check (url is null or url ~ '^https?://'),
 note text,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.reviews enable row level security;
alter table public.references enable row level security;
create policy own_profile on public.profiles for all to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy own_sessions on public.sessions for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy own_reviews on public.reviews for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid() and (session_id is null or exists(select 1 from public.sessions s where s.id=session_id and s.owner_id=auth.uid())));
create policy own_references on public.references for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
grant select,insert,update,delete on public.profiles,public.sessions,public.reviews,public.references to authenticated;

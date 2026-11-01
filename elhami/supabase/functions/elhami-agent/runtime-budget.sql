-- REVIEW ONLY; not applied. Disabled/zero spending until explicit operator approval.
begin;
create schema if not exists elhami_runtime;
revoke all on schema elhami_runtime from public,anon,authenticated;
create table if not exists elhami_runtime.budget (
 id boolean primary key default true check(id), enabled boolean not null default false,
 ceiling_usd numeric not null default 0 check(ceiling_usd>=0), spent_usd numeric not null default 0 check(spent_usd>=0), reserved_usd numeric not null default 0 check(reserved_usd>=0),
 per_request_usd numeric not null default 0 check(per_request_usd>=0), requests_per_minute integer not null default 6 check(requests_per_minute between 1 and 120),
 concurrent_per_owner integer not null default 1 check(concurrent_per_owner between 1 and 5), concurrent_global integer not null default 4 check(concurrent_global between 1 and 100));
insert into elhami_runtime.budget(id) values(true) on conflict do nothing;
create table if not exists elhami_runtime.requests (
 request_id uuid primary key,owner_id uuid not null references auth.users(id), created_at timestamptz not null default now(),finished_at timestamptz,
 reserved_usd numeric not null check(reserved_usd>0), actual_usd numeric, kind text not null default 'text' check(kind in ('text','audio')),
 status text not null default 'reserved' check(status in ('reserved','completed','failed')));
alter table elhami_runtime.budget enable row level security;
alter table elhami_runtime.requests enable row level security;
-- Audit stores no content, email, prompts, audio, credentials or output.
create or replace function elhami_runtime.elhami_agent_reserve(p_owner uuid,p_request uuid,p_reserved_usd numeric,p_kind text default 'text')
returns table(allowed boolean,reason text) language plpgsql security definer set search_path='' as $$
declare b elhami_runtime.budget%rowtype;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'forbidden'; end if;
 select * into b from elhami_runtime.budget where id=true for update;
 if not found then return query select false,'budget_unavailable'::text;return;end if;
 if p_owner is null or p_request is null or p_kind is null or p_kind not in ('text','audio') then raise exception 'invalid kind';end if;
 if not b.enabled or p_reserved_usd is null or p_reserved_usd<=0 or p_reserved_usd>b.per_request_usd or b.spent_usd+b.reserved_usd+p_reserved_usd>b.ceiling_usd then return query select false,'budget_gate'::text;return;end if;
 if (select count(*) from elhami_runtime.requests where owner_id=p_owner and created_at>now()-interval '1 minute')>=b.requests_per_minute then return query select false,'rate_limit'::text;return;end if;
 if (select count(*) from elhami_runtime.requests where owner_id=p_owner and status='reserved')>=b.concurrent_per_owner or (select count(*) from elhami_runtime.requests where status='reserved')>=b.concurrent_global then return query select false,'busy'::text;return;end if;
 insert into elhami_runtime.requests(request_id,owner_id,reserved_usd,kind) values(p_request,p_owner,p_reserved_usd,p_kind);
 update elhami_runtime.budget set reserved_usd=reserved_usd+p_reserved_usd where id=true;
 return query select true,'reserved'::text;
end $$;
create or replace function elhami_runtime.elhami_agent_settle(p_owner uuid,p_request uuid,p_actual_usd numeric,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare r elhami_runtime.requests%rowtype; charge numeric;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'forbidden'; end if;
 perform 1 from elhami_runtime.budget where id=true for update;
 select * into r from elhami_runtime.requests where request_id=p_request and owner_id=p_owner for update;
 if not found or r.status<>'reserved' then return;end if;
 if p_status is null or p_status not in ('completed','failed') or p_actual_usd<0 or p_actual_usd='NaN'::numeric or p_actual_usd='Infinity'::numeric then raise exception 'invalid settlement';end if;
 -- Unknown upstream billing conservatively consumes the whole reservation.
 charge:=coalesce(p_actual_usd,r.reserved_usd);
 update elhami_runtime.requests set actual_usd=charge,status=p_status,finished_at=now() where request_id=p_request;
 update elhami_runtime.budget set reserved_usd=reserved_usd-r.reserved_usd,spent_usd=spent_usd+charge,
 enabled=case when charge>r.reserved_usd then false else enabled end where id=true;
end $$;
revoke all on function elhami_runtime.elhami_agent_reserve(uuid,uuid,numeric,text) from public,anon,authenticated;
revoke all on function elhami_runtime.elhami_agent_settle(uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function elhami_runtime.elhami_agent_reserve(uuid,uuid,numeric,text) to service_role;
grant execute on function elhami_runtime.elhami_agent_settle(uuid,uuid,numeric,text) to service_role;

create table if not exists elhami_runtime.sessions (
 session_id uuid primary key, owner_id uuid not null references auth.users(id), mode text not null,
 steps integer not null default 0, hashes text[] not null default '{}', ended boolean not null default false,
 busy boolean not null default false, touched_at timestamptz not null default now()
);
alter table elhami_runtime.sessions enable row level security;
create or replace function elhami_runtime.elhami_agent_begin_session(p_owner uuid,p_session uuid,p_mode text,p_hash text,p_stop boolean)
returns table(allowed boolean,reason text) language plpgsql security definer set search_path='' as $$
declare s elhami_runtime.sessions%rowtype;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'forbidden';end if;
 if p_owner is null or p_session is null or p_stop is null or p_hash is null or p_mode is null or p_hash !~ '^[a-f0-9]{64}$' or p_mode not in ('open-question','reader-discussion','idea-development','semantic-extraction','personal-application','group-intervention') then raise exception 'invalid session';end if;
 -- Global budget lock serializes new-session admission as well as spend reservations.
 perform 1 from elhami_runtime.budget where id=true for update;
 if not exists(select 1 from elhami_runtime.sessions where session_id=p_session) and (select count(*) from elhami_runtime.sessions where owner_id=p_owner and touched_at>now()-interval '1 minute')>=12 then return query select false,'rate_limit'::text;return;end if;
 insert into elhami_runtime.sessions(session_id,owner_id,mode) values(p_session,p_owner,p_mode) on conflict do nothing;
 select * into s from elhami_runtime.sessions where session_id=p_session for update;
 if s.owner_id<>p_owner or s.mode<>p_mode then raise exception 'forbidden';end if;
 if p_stop then update elhami_runtime.sessions set ended=true,busy=false where session_id=p_session;return query select false,'user_stop'::text;return;end if;
 if s.ended then return query select false,'session_ended'::text;return;end if;
 if s.busy then return query select false,'session_busy'::text;return;end if;
 if s.steps>=6 or (select count(*) from unnest(s.hashes) h where h=p_hash)>=2 then
 update elhami_runtime.sessions set ended=true where session_id=p_session;
 return query select false,case when s.steps>=6 then 'step_limit' else 'repetition' end;return;end if;
 update elhami_runtime.sessions set steps=steps+1,hashes=array_append(hashes,p_hash),busy=true,touched_at=now() where session_id=p_session;
 return query select true,'started'::text;
end $$;
create or replace function elhami_runtime.elhami_agent_finish_session(p_owner uuid,p_session uuid,p_end boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'forbidden';end if;
 if p_owner is null or p_session is null or p_end is null then raise exception 'invalid finish';end if;
 update elhami_runtime.sessions set ended=ended or p_end,busy=false,touched_at=now() where owner_id=p_owner and session_id=p_session;
end $$;
revoke all on function elhami_runtime.elhami_agent_begin_session(uuid,uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function elhami_runtime.elhami_agent_finish_session(uuid,uuid,boolean) from public,anon,authenticated;
grant usage on schema elhami_runtime to service_role;
grant execute on all functions in schema elhami_runtime to service_role;
-- Exposed wrappers are invokers. Only the service role can invoke them or the private implementations.
create or replace function public.elhami_agent_reserve(p_owner uuid,p_request uuid,p_reserved_usd numeric,p_kind text default 'text')
returns table(allowed boolean,reason text) language sql security invoker set search_path='' as $$ select * from elhami_runtime.elhami_agent_reserve(p_owner,p_request,p_reserved_usd,p_kind) $$;
create or replace function public.elhami_agent_settle(p_owner uuid,p_request uuid,p_actual_usd numeric,p_status text)
returns void language sql security invoker set search_path='' as $$ select elhami_runtime.elhami_agent_settle(p_owner,p_request,p_actual_usd,p_status) $$;
create or replace function public.elhami_agent_begin_session(p_owner uuid,p_session uuid,p_mode text,p_hash text,p_stop boolean)
returns table(allowed boolean,reason text) language sql security invoker set search_path='' as $$ select * from elhami_runtime.elhami_agent_begin_session(p_owner,p_session,p_mode,p_hash,p_stop) $$;
create or replace function public.elhami_agent_finish_session(p_owner uuid,p_session uuid,p_end boolean)
returns void language sql security invoker set search_path='' as $$ select elhami_runtime.elhami_agent_finish_session(p_owner,p_session,p_end) $$;
revoke all on function public.elhami_agent_reserve(uuid,uuid,numeric,text),public.elhami_agent_settle(uuid,uuid,numeric,text),public.elhami_agent_begin_session(uuid,uuid,text,text,boolean),public.elhami_agent_finish_session(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.elhami_agent_reserve(uuid,uuid,numeric,text),public.elhami_agent_settle(uuid,uuid,numeric,text),public.elhami_agent_begin_session(uuid,uuid,text,text,boolean),public.elhami_agent_finish_session(uuid,uuid,boolean) to service_role;
commit;
-- Crashed requests stay reserved; reconcile provider usage before manual release.

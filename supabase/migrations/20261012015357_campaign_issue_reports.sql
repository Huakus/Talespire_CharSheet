create schema issue_reporting;
revoke all on schema issue_reporting from public, anon;
grant usage on schema issue_reporting to authenticated, service_role;

create table private.campaign_issue_snapshots (
  campaign_id uuid not null,
  hash text not null check (hash ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('state','catalog')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key(campaign_id,hash),
  constraint campaign_issue_snapshot_integrity check (
    hash = encode(extensions.digest(kind || E'\n' || payload::text,'sha256'),'hex')
  )
);
alter table private.campaign_issue_snapshots alter column payload set storage extended;
alter table private.campaign_issue_snapshots alter column payload set compression pglz;

create table private.campaign_issue_contexts (
  id uuid primary key,
  campaign_id uuid not null,
  captured_by uuid references auth.users(id) on delete set null,
  capture_started_at timestamptz not null,
  capture_completed_at timestamptz not null,
  server_state_hash text not null,
  server_catalog_hash text not null,
  client_catalog_hash text,
  client_context jsonb not null check (jsonb_typeof(client_context)='object'),
  client_context_hash text not null check (client_context_hash=encode(extensions.digest(client_context::text,'sha256'),'hex')),
  foreign key(campaign_id,server_state_hash) references private.campaign_issue_snapshots(campaign_id,hash),
  foreign key(campaign_id,server_catalog_hash) references private.campaign_issue_snapshots(campaign_id,hash),
  foreign key(campaign_id,client_catalog_hash) references private.campaign_issue_snapshots(campaign_id,hash)
);
alter table private.campaign_issue_contexts alter column client_context set storage extended;
alter table private.campaign_issue_contexts alter column client_context set compression pglz;
create index campaign_issue_contexts_actor_time_idx on private.campaign_issue_contexts(captured_by,capture_started_at);
create index campaign_issue_contexts_state_idx on private.campaign_issue_contexts(campaign_id,server_state_hash);
create index campaign_issue_contexts_catalog_idx on private.campaign_issue_contexts(campaign_id,server_catalog_hash);
create index campaign_issue_contexts_client_catalog_idx on private.campaign_issue_contexts(campaign_id,client_catalog_hash);

create table private.campaign_issue_reports (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null unique references private.campaign_issue_contexts(id),
  campaign_id uuid not null,
  reported_by uuid references auth.users(id) on delete set null,
  description text not null check (char_length(btrim(description)) between 10 and 8000),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','triaged','resolved'))
);
create index campaign_issue_reports_campaign_time_idx on private.campaign_issue_reports(campaign_id,created_at);
create index campaign_issue_reports_reporter_idx on private.campaign_issue_reports(reported_by);

alter table private.campaign_issue_snapshots enable row level security;
alter table private.campaign_issue_contexts enable row level security;
alter table private.campaign_issue_reports enable row level security;
revoke all on private.campaign_issue_snapshots,private.campaign_issue_contexts,private.campaign_issue_reports
from public,anon,authenticated,service_role;
create policy campaign_issue_snapshots_deny_clients on private.campaign_issue_snapshots
as restrictive for all to anon,authenticated using(false) with check(false);
create policy campaign_issue_contexts_deny_clients on private.campaign_issue_contexts
as restrictive for all to anon,authenticated using(false) with check(false);
create policy campaign_issue_reports_deny_clients on private.campaign_issue_reports
as restrictive for all to anon,authenticated using(false) with check(false);

create function private.reject_issue_snapshot_update()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception using errcode='55000',message='ISSUE_SNAPSHOT_IMMUTABLE'; end; $$;
revoke all on function private.reject_issue_snapshot_update() from public,anon,authenticated,service_role;
create trigger campaign_issue_snapshots_immutable before update on private.campaign_issue_snapshots
for each row execute function private.reject_issue_snapshot_update();

-- Both client and server catalogs use the same canonical representation and ordering.
create function private.canonical_issue_catalog(p_campaign_id uuid,p_entries jsonb)
returns jsonb language sql immutable set search_path=''
as $$
  select jsonb_build_object('format','campaign-content-v1','entries',coalesce(jsonb_agg(
    jsonb_build_object('campaignId',p_campaign_id,'kind',e.value->'kind','contentKey',e.value->'contentKey',
      'name',e.value->'name','origin',e.value->'origin','tags',e.value->'tags','payload',e.value->'payload',
      'revision',e.value->'revision','updatedAt',e.value->'updatedAt')
    order by (e.value->>'kind') collate "C",(e.value->>'contentKey') collate "C"),'[]'::jsonb))
  from jsonb_array_elements(p_entries) e;
$$;
revoke all on function private.canonical_issue_catalog(uuid,jsonb) from public,anon,authenticated,service_role;

create function issue_reporting.capture_context(p_campaign_id uuid,p_request_id uuid,p_client_context jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor_id uuid := auth.uid();
  existing_context private.campaign_issue_contexts%rowtype;
  state_payload jsonb;
  catalog_entries jsonb;
  catalog_payload jsonb;
  client_catalog jsonb := p_client_context->'loadedCatalog';
  client_payload jsonb := p_client_context - 'loadedCatalog';
  state_hash text;
  catalog_hash text;
  loaded_catalog_hash text;
  started_at timestamptz;
  completed_at timestamptz;
begin
  if actor_id is null then raise exception using errcode='42501',message='AUTHENTICATION_REQUIRED'; end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception using errcode='42501',message='CAMPAIGN_ACCESS_DENIED';
  end if;
  if p_request_id is null or p_client_context is null or jsonb_typeof(p_client_context)<>'object'
    or p_client_context->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(p_client_context->'build') is distinct from 'object'
    or jsonb_typeof(p_client_context->'view') is distinct from 'object'
    or not (p_client_context ? 'capturedAt')
    or octet_length(p_client_context::text)>24000000 then
    raise exception using errcode='22023',message='INVALID_ISSUE_CONTEXT';
  end if;
  if client_catalog is not null and client_catalog<>'null'::jsonb then
    if jsonb_typeof(client_catalog)<>'array' then
      raise exception using errcode='22023',message='INVALID_ISSUE_CATALOG';
    end if;
    if exists(select 1 from jsonb_array_elements(client_catalog) e where
      jsonb_typeof(e.value)<>'object' or e.value->>'campaignId' is distinct from p_campaign_id::text
      or jsonb_typeof(e.value->'payload') is distinct from 'object') then
      raise exception using errcode='22023',message='INVALID_ISSUE_CATALOG';
    end if;
  end if;
  if octet_length(client_payload::text)>8000000 then
    raise exception using errcode='22023',message='ISSUE_CONTEXT_TOO_LARGE';
  end if;
  -- Serialize capture attempts per actor; request UUID makes timeout retries idempotent.
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text,701));
  select * into existing_context from private.campaign_issue_contexts where id=p_request_id;
  if found then
    if existing_context.captured_by is distinct from actor_id or existing_context.campaign_id<>p_campaign_id then
      raise exception using errcode='42501',message='ISSUE_CONTEXT_ACCESS_DENIED';
    end if;
    return jsonb_build_object('contextId',existing_context.id,'capturedAt',existing_context.capture_started_at);
  end if;
  if (select count(*) from private.campaign_issue_contexts where captured_by=actor_id and capture_started_at>now()-interval '1 hour')>=10
    or (select count(*) from private.campaign_issue_contexts where captured_by=actor_id and capture_started_at>now()-interval '1 day')>=30 then
    raise exception using errcode='P0001',message='ISSUE_CAPTURE_RATE_LIMIT';
  end if;
  -- Expired, unsubmitted captures only. Submitted reports always retain their context.
  delete from private.campaign_issue_contexts c where c.captured_by=actor_id
    and c.capture_started_at<now()-interval '7 days'
    and not exists(select 1 from private.campaign_issue_reports r where r.context_id=c.id);
  delete from private.campaign_issue_snapshots s where s.campaign_id=p_campaign_id and s.created_at<now()-interval '7 days'
    and not exists(select 1 from private.campaign_issue_contexts c where c.campaign_id=s.campaign_id
      and (c.server_state_hash=s.hash or c.server_catalog_hash=s.hash or c.client_catalog_hash=s.hash));
  started_at := clock_timestamp();
  -- All live campaign tables and the catalog are read in ONE SQL statement / MVCC snapshot.
  select jsonb_build_object('format','campaign-server-state-v1','campaign',to_jsonb(c),
    'schemaMigrations',coalesce((select jsonb_agg(jsonb_build_object('version',m.version,'name',m.name) order by m.version)
      from supabase_migrations.schema_migrations m),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.user_id) from public.campaign_members m where m.campaign_id=c.id),'[]'::jsonb),
    'characterVersions',coalesce((select jsonb_agg(to_jsonb(v) order by v.character_id) from public.campaign_character_versions v where v.campaign_id=c.id),'[]'::jsonb),
    'fragments',coalesce((select jsonb_agg(to_jsonb(f) order by f.fragment_kind,f.parent_id,f.entity_id) from public.campaign_state_fragments f where f.campaign_id=c.id),'[]'::jsonb)),
    coalesce((select jsonb_agg(jsonb_build_object('campaignId',e.campaign_id,'kind',e.kind,'contentKey',e.content_key,
      'name',e.name,'origin',e.origin,'tags',e.tags,'payload',e.payload,'revision',e.revision,'updatedAt',e.updated_at))
      from public.campaign_content_entries e where e.campaign_id=c.id and e.deleted_at is null),'[]'::jsonb)
  into state_payload,catalog_entries from public.campaigns c
  where c.id=p_campaign_id and exists(select 1 from public.campaign_members m where m.campaign_id=c.id and m.user_id=actor_id);
  if state_payload is null then raise exception using errcode='42501',message='CAMPAIGN_ACCESS_DENIED'; end if;
  completed_at := clock_timestamp();
  catalog_payload := private.canonical_issue_catalog(p_campaign_id,catalog_entries);
  state_hash := encode(extensions.digest('state' || E'\n' || state_payload::text,'sha256'),'hex');
  catalog_hash := encode(extensions.digest('catalog' || E'\n' || catalog_payload::text,'sha256'),'hex');
  insert into private.campaign_issue_snapshots(campaign_id,hash,kind,payload)
  values(p_campaign_id,state_hash,'state',state_payload),(p_campaign_id,catalog_hash,'catalog',catalog_payload)
  on conflict(campaign_id,hash) do nothing;
  if client_catalog is not null and client_catalog<>'null'::jsonb then
    client_catalog := private.canonical_issue_catalog(p_campaign_id,client_catalog);
    loaded_catalog_hash := encode(extensions.digest('catalog' || E'\n' || client_catalog::text,'sha256'),'hex');
    insert into private.campaign_issue_snapshots(campaign_id,hash,kind,payload)
    values(p_campaign_id,loaded_catalog_hash,'catalog',client_catalog) on conflict(campaign_id,hash) do nothing;
  end if;
  insert into private.campaign_issue_contexts(id,campaign_id,captured_by,capture_started_at,capture_completed_at,
    server_state_hash,server_catalog_hash,client_catalog_hash,client_context,client_context_hash)
  values(p_request_id,p_campaign_id,actor_id,started_at,completed_at,state_hash,catalog_hash,loaded_catalog_hash,
    client_payload,encode(extensions.digest(client_payload::text,'sha256'),'hex'));
  return jsonb_build_object('contextId',p_request_id,'capturedAt',started_at);
end;
$$;
revoke all on function issue_reporting.capture_context(uuid,uuid,jsonb) from public,anon;
grant execute on function issue_reporting.capture_context(uuid,uuid,jsonb) to authenticated;

create function issue_reporting.submit_report(p_context_id uuid,p_description text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor_id uuid:=auth.uid(); context_row private.campaign_issue_contexts%rowtype; report_row private.campaign_issue_reports%rowtype;
begin
  if actor_id is null then raise exception using errcode='42501',message='AUTHENTICATION_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_description,''))) not between 10 and 8000 then
    raise exception using errcode='22023',message='INVALID_ISSUE_DESCRIPTION';
  end if;
  select * into context_row from private.campaign_issue_contexts where id=p_context_id for update;
  if not found or context_row.captured_by is distinct from actor_id then
    raise exception using errcode='42501',message='ISSUE_CONTEXT_ACCESS_DENIED';
  end if;
  if not public.is_campaign_member(context_row.campaign_id) then
    raise exception using errcode='42501',message='CAMPAIGN_ACCESS_DENIED';
  end if;
  select * into report_row from private.campaign_issue_reports where context_id=p_context_id;
  if not found then
    if context_row.capture_started_at<now()-interval '1 day' then
      raise exception using errcode='22023',message='ISSUE_CONTEXT_EXPIRED';
    end if;
    insert into private.campaign_issue_reports(context_id,campaign_id,reported_by,description)
    values(p_context_id,context_row.campaign_id,actor_id,btrim(p_description)) returning * into report_row;
  end if;
  return jsonb_build_object('reportId',report_row.id,'createdAt',report_row.created_at,'capturedAt',context_row.capture_started_at);
end;
$$;
revoke all on function issue_reporting.submit_report(uuid,text) from public,anon;
grant execute on function issue_reporting.submit_report(uuid,text) to authenticated;

-- Exposed RPCs use invoker privileges; narrowly scoped definer code is in an unexposed schema.
create function public.capture_campaign_issue_context(p_campaign_id uuid,p_request_id uuid,p_client_context jsonb)
returns jsonb language sql security invoker set search_path=''
as $$ select issue_reporting.capture_context(p_campaign_id,p_request_id,p_client_context); $$;
revoke all on function public.capture_campaign_issue_context(uuid,uuid,jsonb) from public,anon;
grant execute on function public.capture_campaign_issue_context(uuid,uuid,jsonb) to authenticated;
create function public.submit_campaign_issue_report(p_context_id uuid,p_description text)
returns jsonb language sql security invoker set search_path=''
as $$ select issue_reporting.submit_report(p_context_id,p_description); $$;
revoke all on function public.submit_campaign_issue_report(uuid,text) from public,anon;
grant execute on function public.submit_campaign_issue_report(uuid,text) to authenticated;

-- Diagnostic retrieval is for trusted server tooling, never for player clients.
create function issue_reporting.read_report(p_report_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object('report',to_jsonb(r),'capture',to_jsonb(c)-'client_context',
    'client',c.client_context,'serverState',s.payload,'serverCatalog',k.payload,'clientCatalog',l.payload)
  from private.campaign_issue_reports r join private.campaign_issue_contexts c on c.id=r.context_id
  join private.campaign_issue_snapshots s on s.campaign_id=c.campaign_id and s.hash=c.server_state_hash
  join private.campaign_issue_snapshots k on k.campaign_id=c.campaign_id and k.hash=c.server_catalog_hash
  left join private.campaign_issue_snapshots l on l.campaign_id=c.campaign_id and l.hash=c.client_catalog_hash
  where r.id=p_report_id;
$$;
revoke all on function issue_reporting.read_report(uuid) from public,anon,authenticated;
grant execute on function issue_reporting.read_report(uuid) to service_role;
create function public.read_campaign_issue_report(p_report_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select issue_reporting.read_report(p_report_id); $$;
revoke all on function public.read_campaign_issue_report(uuid) from public,anon,authenticated;
grant execute on function public.read_campaign_issue_report(uuid) to service_role;

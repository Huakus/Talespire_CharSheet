-- Keep only retirement identities here; full recovery evidence lives outside the active catalog.
create table private.campaign_content_retirements (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind text not null,
  content_key text not null,
  replacement_keys text[] not null default '{}',
  reason text not null check (length(trim(reason)) > 0),
  archive_sha256 text not null check (archive_sha256 ~ '^[a-f0-9]{64}$'),
  retired_at timestamptz not null default now(),
  primary key (campaign_id, kind, content_key)
);
alter table private.campaign_content_retirements enable row level security;
revoke all on private.campaign_content_retirements from public, anon, authenticated;

-- Preserve the existing checked GM RPC and its grants. No new callable endpoint.
create or replace function public.seed_campaign_content(p_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare inserted_count integer;
begin
  if not public.can_manage_campaign_content(p_campaign_id) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_GM_REQUIRED';
  end if;
  -- Retirement batches take the same campaign lock before deleting. The INSERT
  -- then receives a fresh snapshot after a concurrent retirement has committed.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('campaign-content:' || p_campaign_id::text, 0));
  insert into public.campaign_content_entries
    (campaign_id, kind, content_key, name, origin, tags, payload, created_by, updated_by)
  select p_campaign_id, entry.kind, entry.content_key, entry.name, entry.origin,
    entry.tags, entry.payload, auth.uid(), auth.uid()
  from public.official_content_entries entry
  where not exists (
    select 1 from private.campaign_content_retirements retired
    where retired.campaign_id = p_campaign_id
      and retired.kind = entry.kind and retired.content_key = entry.content_key
  )
  on conflict (campaign_id, kind, content_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

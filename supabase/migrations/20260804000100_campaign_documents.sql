create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'gm', 'player')),
  created_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, user_id)
);

create table public.campaign_documents (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default statement_timestamp()
);

create index campaign_members_user_id_idx
  on public.campaign_members(user_id, campaign_id);

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_documents enable row level security;

create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members as member
    where member.campaign_id = p_campaign_id
      and member.user_id = auth.uid()
  );
$$;

revoke all on function public.is_campaign_member(uuid) from public;
grant execute on function public.is_campaign_member(uuid) to authenticated;

create policy campaigns_select_member
on public.campaigns
for select
to authenticated
using (public.is_campaign_member(id));

create policy campaign_members_select_member
on public.campaign_members
for select
to authenticated
using (public.is_campaign_member(campaign_id));

create policy campaign_documents_select_member
on public.campaign_documents
for select
to authenticated
using (public.is_campaign_member(campaign_id));

revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.campaign_members from anon, authenticated;
revoke all on table public.campaign_documents from anon, authenticated;
grant select on table public.campaigns to authenticated;
grant select on table public.campaign_members to authenticated;
grant select on table public.campaign_documents to authenticated;

create or replace function public.create_campaign(
  p_name text,
  p_payload jsonb
)
returns table (
  campaign_id uuid,
  revision bigint,
  payload jsonb,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_campaign_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_NAME';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_PAYLOAD';
  end if;

  insert into public.campaigns (name, owner_user_id)
  values (btrim(p_name), current_user_id)
  returning id into new_campaign_id;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (new_campaign_id, current_user_id, 'owner');

  insert into public.campaign_documents (campaign_id, payload, updated_by)
  values (new_campaign_id, p_payload, current_user_id);

  return query
  select document.campaign_id,
         document.revision,
         document.payload,
         document.updated_by,
         document.updated_at
  from public.campaign_documents as document
  where document.campaign_id = new_campaign_id;
end;
$$;

create or replace function public.read_campaign_document(p_campaign_id uuid)
returns table (
  campaign_id uuid,
  revision bigint,
  payload jsonb,
  updated_by uuid,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select document.campaign_id,
         document.revision,
         document.payload,
         document.updated_by,
         document.updated_at
  from public.campaign_documents as document
  where document.campaign_id = p_campaign_id;
$$;

create or replace function public.save_campaign_document(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_payload jsonb
)
returns table (
  campaign_id uuid,
  revision bigint,
  payload jsonb,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_revision bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_ACCESS_DENIED';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_REVISION';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_PAYLOAD';
  end if;

  return query
  update public.campaign_documents as document
  set payload = p_payload,
      revision = document.revision + 1,
      updated_by = current_user_id,
      updated_at = statement_timestamp()
  where document.campaign_id = p_campaign_id
    and document.revision = p_expected_revision
  returning document.campaign_id,
            document.revision,
            document.payload,
            document.updated_by,
            document.updated_at;

  if found then
    update public.campaigns
    set updated_at = statement_timestamp()
    where id = p_campaign_id;
    return;
  end if;

  select document.revision
  into current_revision
  from public.campaign_documents as document
  where document.campaign_id = p_campaign_id;

  if current_revision is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_DOCUMENT_NOT_FOUND';
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'CAMPAIGN_REVISION_CONFLICT',
    detail = format('expected=%s,current=%s', p_expected_revision, current_revision);
end;
$$;

create or replace function public.add_campaign_member(
  p_campaign_id uuid,
  p_user_id uuid,
  p_role text default 'player'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  campaign_owner_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select campaign.owner_user_id
  into campaign_owner_id
  from public.campaigns as campaign
  where campaign.id = p_campaign_id;

  if campaign_owner_id is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_NOT_FOUND';
  end if;
  if campaign_owner_id <> current_user_id then
    raise exception using errcode = '42501', message = 'CAMPAIGN_OWNER_REQUIRED';
  end if;
  if p_role not in ('gm', 'player') then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_ROLE';
  end if;
  if p_user_id = campaign_owner_id then
    raise exception using errcode = '22023', message = 'OWNER_ROLE_IS_IMMUTABLE';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (p_campaign_id, p_user_id, p_role)
  on conflict (campaign_id, user_id)
  do update set role = excluded.role;
end;
$$;

create or replace function public.delete_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  delete from public.campaigns
  where id = p_campaign_id
    and owner_user_id = auth.uid();
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception using errcode = '42501', message = 'CAMPAIGN_OWNER_REQUIRED';
  end if;
  return true;
end;
$$;

revoke all on function public.create_campaign(text, jsonb) from public;
revoke all on function public.read_campaign_document(uuid) from public;
revoke all on function public.save_campaign_document(uuid, bigint, jsonb) from public;
revoke all on function public.add_campaign_member(uuid, uuid, text) from public;
revoke all on function public.delete_campaign(uuid) from public;

grant execute on function public.create_campaign(text, jsonb) to authenticated;
grant execute on function public.read_campaign_document(uuid) to authenticated;
grant execute on function public.save_campaign_document(uuid, bigint, jsonb) to authenticated;
grant execute on function public.add_campaign_member(uuid, uuid, text) to authenticated;
grant execute on function public.delete_campaign(uuid) to authenticated;

alter table public.campaign_documents replica identity full;
alter publication supabase_realtime add table public.campaign_documents;

comment on table public.campaign_documents is
  'Versioned source document for a TaleSpire campaign; one row per campaign.';
comment on function public.save_campaign_document(uuid, bigint, jsonb) is
  'Atomically replaces a campaign document when the expected revision matches.';

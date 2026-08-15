-- Applied to the linked project as migration 20260815031105.
alter table public.campaigns
  add column if not exists state_revision bigint not null default 0,
  add column if not exists state_updated_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'campaigns_state_revision_nonnegative'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint campaigns_state_revision_nonnegative check (state_revision >= 0);
  end if;
end $$;

create index if not exists campaigns_state_updated_by_idx
  on public.campaigns (state_updated_by)
  where state_updated_by is not null;

create table if not exists public.campaign_state_fragments (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  fragment_kind text not null,
  parent_id text not null default '',
  entity_id text not null,
  position integer not null default 0,
  payload jsonb not null,
  revision bigint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (campaign_id, fragment_kind, parent_id, entity_id),
  constraint campaign_state_fragments_kind_check check (fragment_kind in (
    'campaign',
    'character-core',
    'character-runtime',
    'character-action',
    'character-inventory',
    'character-trait',
    'character-note',
    'character-extra',
    'character-spell',
    'encounter',
    'gm-settings',
    'gm-note-group',
    'gm-random-table'
  )),
  constraint campaign_state_fragments_entity_id_check check (char_length(btrim(entity_id)) between 1 and 200),
  constraint campaign_state_fragments_parent_id_check check (char_length(parent_id) <= 200),
  constraint campaign_state_fragments_position_check check (position >= 0),
  constraint campaign_state_fragments_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint campaign_state_fragments_revision_check check (revision >= 0)
);

create index if not exists campaign_state_fragments_read_idx
  on public.campaign_state_fragments (campaign_id, fragment_kind, parent_id, position, entity_id);
create index if not exists campaign_state_fragments_updated_by_idx
  on public.campaign_state_fragments (updated_by)
  where updated_by is not null;

create table if not exists public.campaign_character_versions (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id text not null,
  revision bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  updated_by uuid references auth.users(id) on delete set null,
  primary key (campaign_id, character_id),
  constraint campaign_character_versions_id_check check (char_length(btrim(character_id)) between 1 and 200),
  constraint campaign_character_versions_revision_check check (revision >= 0)
);

create index if not exists campaign_character_versions_updated_by_idx
  on public.campaign_character_versions (updated_by)
  where updated_by is not null;

alter table public.campaign_state_fragments enable row level security;
alter table public.campaign_character_versions enable row level security;

drop policy if exists campaign_state_fragments_select_member on public.campaign_state_fragments;
create policy campaign_state_fragments_select_member
  on public.campaign_state_fragments
  for select
  to authenticated
  using ((select public.is_campaign_member(campaign_id)));

drop policy if exists campaign_character_versions_select_member on public.campaign_character_versions;
create policy campaign_character_versions_select_member
  on public.campaign_character_versions
  for select
  to authenticated
  using ((select public.is_campaign_member(campaign_id)));

revoke all on table public.campaign_state_fragments from anon;
revoke all on table public.campaign_character_versions from anon;
revoke insert, update, delete on table public.campaign_state_fragments from authenticated;
revoke insert, update, delete on table public.campaign_character_versions from authenticated;
grant select on table public.campaign_state_fragments to authenticated;
grant select on table public.campaign_character_versions to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.seed_campaign_fragments(
  p_campaign_id uuid,
  p_envelope jsonb,
  p_updated_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  campaign_value jsonb := p_envelope -> 'campaign';
  character_entry record;
  array_entry record;
  gm_value jsonb;
begin
  if campaign_value is null or jsonb_typeof(campaign_value) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_GRANULAR_CAMPAIGN_ENVELOPE';
  end if;

  update public.campaigns
  set state_revision = greatest(0, coalesce((campaign_value ->> 'revision')::bigint, 0)),
      state_updated_by = p_updated_by
  where id = p_campaign_id;

  insert into public.campaign_state_fragments (
    campaign_id, fragment_kind, parent_id, entity_id, position, payload, updated_by
  ) values (
    p_campaign_id,
    'campaign',
    '',
    'root',
    0,
    jsonb_build_object(
      'schemaVersion', campaign_value -> 'schemaVersion',
      'id', campaign_value -> 'id',
      'metadata', jsonb_build_object('createdAt', campaign_value -> 'metadata' -> 'createdAt')
    ),
    p_updated_by
  ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;

  for character_entry in
    select key as character_id, value as character_value
    from jsonb_each(coalesce(campaign_value -> 'characters', '{}'::jsonb))
  loop
    insert into public.campaign_character_versions (
      campaign_id, character_id, revision, created_at, updated_at, updated_by
    ) values (
      p_campaign_id,
      character_entry.character_id,
      greatest(0, coalesce((character_entry.character_value ->> 'revision')::bigint, 0)),
      (character_entry.character_value -> 'metadata' ->> 'createdAt')::timestamptz,
      (character_entry.character_value -> 'metadata' ->> 'updatedAt')::timestamptz,
      p_updated_by
    ) on conflict (campaign_id, character_id) do nothing;

    insert into public.campaign_state_fragments (
      campaign_id, fragment_kind, parent_id, entity_id, position, payload, updated_by
    ) values (
      p_campaign_id,
      'character-core',
      character_entry.character_id,
      character_entry.character_id,
      0,
      character_entry.character_value
        - 'revision' - 'metadata' - 'combat' - 'commerce' - 'currency'
        - 'spellcasting' - 'actions' - 'inventory' - 'traits' - 'notes' - 'extras',
      p_updated_by
    ), (
      p_campaign_id,
      'character-runtime',
      character_entry.character_id,
      character_entry.character_id,
      0,
      jsonb_build_object(
        'combat', character_entry.character_value -> 'combat',
        'commerce', coalesce(character_entry.character_value -> 'commerce', '{"suspicionByMerchant":{}}'::jsonb),
        'currency', character_entry.character_value -> 'currency',
        'spellcasting', (character_entry.character_value -> 'spellcasting') - 'spells'
      ),
      p_updated_by
    ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;

    for array_entry in
      select value as payload, ordinality - 1 as position
      from jsonb_array_elements(coalesce(character_entry.character_value -> 'actions', '[]'::jsonb)) with ordinality
    loop
      insert into public.campaign_state_fragments values (
        p_campaign_id, 'character-action', character_entry.character_id,
        array_entry.payload ->> 'id', array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
      ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
    end loop;
    for array_entry in
      select value as payload, ordinality - 1 as position
      from jsonb_array_elements(coalesce(character_entry.character_value -> 'inventory', '[]'::jsonb)) with ordinality
    loop
      insert into public.campaign_state_fragments values (
        p_campaign_id, 'character-inventory', character_entry.character_id,
        array_entry.payload ->> 'id', array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
      ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
    end loop;
    for array_entry in
      select value as payload, ordinality - 1 as position
      from jsonb_array_elements(coalesce(character_entry.character_value -> 'traits', '[]'::jsonb)) with ordinality
    loop
      insert into public.campaign_state_fragments values (
        p_campaign_id, 'character-trait', character_entry.character_id,
        array_entry.payload ->> 'id', array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
      ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
    end loop;
    for array_entry in
      select value as payload, ordinality - 1 as position
      from jsonb_array_elements(coalesce(character_entry.character_value -> 'notes', '[]'::jsonb)) with ordinality
    loop
      insert into public.campaign_state_fragments values (
        p_campaign_id, 'character-note', character_entry.character_id,
        array_entry.payload ->> 'id', array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
      ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
    end loop;
    for array_entry in
      select value as payload, ordinality - 1 as position
      from jsonb_array_elements(coalesce(character_entry.character_value -> 'extras', '[]'::jsonb)) with ordinality
    loop
      insert into public.campaign_state_fragments values (
        p_campaign_id, 'character-extra', character_entry.character_id,
        array_entry.payload ->> 'id', array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
      ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
    end loop;
    for array_entry in
      select value as payload, ordinality - 1 as position
      from jsonb_array_elements(coalesce(character_entry.character_value -> 'spellcasting' -> 'spells', '[]'::jsonb)) with ordinality
    loop
      insert into public.campaign_state_fragments values (
        p_campaign_id, 'character-spell', character_entry.character_id,
        array_entry.payload ->> 'id', array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
      ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
    end loop;
  end loop;

  for array_entry in
    select key as entity_id, value as payload
    from jsonb_each(coalesce(campaign_value -> 'encounters', '{}'::jsonb))
  loop
    insert into public.campaign_state_fragments values (
      p_campaign_id, 'encounter', '', array_entry.entity_id, 0,
      array_entry.payload, 0, p_updated_by, statement_timestamp()
    ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
  end loop;

  gm_value := coalesce(campaign_value -> 'gm', '{}'::jsonb);
  insert into public.campaign_state_fragments values (
    p_campaign_id, 'gm-settings', '', 'root', 0,
    jsonb_build_object('googleDocsUrl', coalesce(gm_value -> 'googleDocsUrl', '""'::jsonb)),
    0, p_updated_by, statement_timestamp()
  ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;

  for array_entry in
    select value as payload, ordinality - 1 as position
    from jsonb_array_elements(coalesce(gm_value -> 'noteGroups', '[]'::jsonb)) with ordinality
  loop
    insert into public.campaign_state_fragments values (
      p_campaign_id, 'gm-note-group', '', array_entry.payload ->> 'id',
      array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
    ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
  end loop;
  for array_entry in
    select value as payload, ordinality - 1 as position
    from jsonb_array_elements(coalesce(gm_value -> 'randomTables', '[]'::jsonb)) with ordinality
  loop
    insert into public.campaign_state_fragments values (
      p_campaign_id, 'gm-random-table', '', array_entry.payload ->> 'id',
      array_entry.position, array_entry.payload, 0, p_updated_by, statement_timestamp()
    ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing;
  end loop;
end;
$function$;

revoke execute on function private.seed_campaign_fragments(uuid, jsonb, uuid)
  from public, anon, authenticated;

create or replace function private.seed_campaign_fragments_on_document_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.seed_campaign_fragments(new.campaign_id, new.payload, new.updated_by);
  return new;
end;
$function$;

revoke execute on function private.seed_campaign_fragments_on_document_insert()
  from public, anon, authenticated;

drop trigger if exists seed_campaign_fragments_after_document_insert on public.campaign_documents;
create trigger seed_campaign_fragments_after_document_insert
after insert on public.campaign_documents
for each row execute function private.seed_campaign_fragments_on_document_insert();

select private.seed_campaign_fragments(document.campaign_id, document.payload, document.updated_by)
from public.campaign_documents as document
where not exists (
  select 1 from public.campaign_state_fragments as fragment
  where fragment.campaign_id = document.campaign_id
);

create or replace function public.read_campaign_fragments(p_campaign_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'campaignRevision', campaign.state_revision,
    'campaignUpdatedAt', campaign.updated_at,
    'updatedBy', campaign.state_updated_by,
    'characters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'characterId', character.character_id,
        'revision', character.revision,
        'createdAt', character.created_at,
        'updatedAt', character.updated_at
      ) order by character.character_id)
      from public.campaign_character_versions as character
      where character.campaign_id = campaign.id
    ), '[]'::jsonb),
    'fragments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', fragment.fragment_kind,
        'parentId', fragment.parent_id,
        'entityId', fragment.entity_id,
        'position', fragment.position,
        'payload', fragment.payload,
        'revision', fragment.revision
      ) order by fragment.fragment_kind, fragment.parent_id, fragment.position, fragment.entity_id)
      from public.campaign_state_fragments as fragment
      where fragment.campaign_id = campaign.id
    ), '[]'::jsonb)
  )
  from public.campaigns as campaign
  where campaign.id = p_campaign_id;
$function$;

revoke execute on function public.read_campaign_fragments(uuid) from public, anon;
grant execute on function public.read_campaign_fragments(uuid) to authenticated;

create or replace function public.save_campaign_fragments(
  p_campaign_id uuid,
  p_expected_campaign_revision bigint,
  p_changes jsonb,
  p_character_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  previous_campaign_revision bigint;
  saved_campaign_revision bigint;
  saved_campaign_updated_at timestamptz;
  change_value jsonb;
  kind_value text;
  parent_value text;
  entity_value text;
  operation_value text;
  payload_value jsonb;
  position_value integer;
  expected_revision bigint;
  saved_revision bigint;
  affected integer;
  fragment_results jsonb := '[]'::jsonb;
  character_results jsonb := '[]'::jsonb;
  saved_character record;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_ACCESS_DENIED';
  end if;
  if p_expected_campaign_revision is null or p_expected_campaign_revision < 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_CAMPAIGN_REVISION';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_typeof(p_character_changes) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_FRAGMENT_CHANGES';
  end if;
  if jsonb_array_length(p_changes) > 1000 or jsonb_array_length(p_character_changes) > 200 then
    raise exception using errcode = '22023', message = 'TOO_MANY_CAMPAIGN_FRAGMENT_CHANGES';
  end if;

  select campaign.state_revision
  into previous_campaign_revision
  from public.campaigns as campaign
  where campaign.id = p_campaign_id
  for update;
  if previous_campaign_revision is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_NOT_FOUND';
  end if;

  for change_value in
    select value
    from jsonb_array_elements(p_changes)
    order by value ->> 'kind', value ->> 'parentId', value ->> 'entityId'
  loop
    kind_value := change_value ->> 'kind';
    parent_value := coalesce(change_value ->> 'parentId', '');
    entity_value := change_value ->> 'entityId';
    operation_value := change_value ->> 'operation';
    if kind_value not in (
      'campaign','character-core','character-runtime','character-action','character-inventory',
      'character-trait','character-note','character-extra','character-spell','encounter',
      'gm-settings','gm-note-group','gm-random-table'
    ) or btrim(coalesce(entity_value, '')) = '' or char_length(entity_value) > 200
      or char_length(parent_value) > 200 or operation_value not in ('upsert', 'delete') then
      raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_FRAGMENT_CHANGE';
    end if;

    expected_revision := case
      when jsonb_typeof(change_value -> 'expectedRevision') = 'number'
        then (change_value ->> 'expectedRevision')::bigint
      else null
    end;

    if operation_value = 'upsert' then
      payload_value := change_value -> 'payload';
      position_value := coalesce((change_value ->> 'position')::integer, 0);
      if payload_value is null or jsonb_typeof(payload_value) <> 'object' or position_value < 0 then
        raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_FRAGMENT_PAYLOAD';
      end if;
      saved_revision := null;
      if expected_revision is null then
        insert into public.campaign_state_fragments (
          campaign_id, fragment_kind, parent_id, entity_id, position, payload, updated_by
        ) values (
          p_campaign_id, kind_value, parent_value, entity_value, position_value, payload_value, current_user_id
        ) on conflict (campaign_id, fragment_kind, parent_id, entity_id) do nothing
        returning revision into saved_revision;
      else
        update public.campaign_state_fragments as fragment
        set position = position_value,
            payload = payload_value,
            revision = fragment.revision + 1,
            updated_by = current_user_id,
            updated_at = statement_timestamp()
        where fragment.campaign_id = p_campaign_id
          and fragment.fragment_kind = kind_value
          and fragment.parent_id = parent_value
          and fragment.entity_id = entity_value
          and fragment.revision = expected_revision
        returning fragment.revision into saved_revision;
      end if;
      if saved_revision is null then
        raise exception using errcode = 'P0001',
          message = format('CAMPAIGN_FRAGMENT_CONFLICT:%s:%s:%s', kind_value, parent_value, entity_value);
      end if;
      fragment_results := fragment_results || jsonb_build_array(jsonb_build_object(
        'kind', kind_value, 'parentId', parent_value, 'entityId', entity_value,
        'revision', saved_revision, 'deleted', false
      ));
    else
      if expected_revision is null then
        raise exception using errcode = '22023', message = 'MISSING_CAMPAIGN_FRAGMENT_REVISION';
      end if;
      delete from public.campaign_state_fragments as fragment
      where fragment.campaign_id = p_campaign_id
        and fragment.fragment_kind = kind_value
        and fragment.parent_id = parent_value
        and fragment.entity_id = entity_value
        and fragment.revision = expected_revision;
      get diagnostics affected = row_count;
      if affected = 0 then
        raise exception using errcode = 'P0001',
          message = format('CAMPAIGN_FRAGMENT_CONFLICT:%s:%s:%s', kind_value, parent_value, entity_value);
      end if;
      fragment_results := fragment_results || jsonb_build_array(jsonb_build_object(
        'kind', kind_value, 'parentId', parent_value, 'entityId', entity_value,
        'revision', expected_revision + 1, 'deleted', true
      ));
    end if;
  end loop;

  for change_value in
    select value
    from jsonb_array_elements(p_character_changes)
    order by value ->> 'characterId'
  loop
    entity_value := change_value ->> 'characterId';
    operation_value := change_value ->> 'operation';
    if btrim(coalesce(entity_value, '')) = '' or char_length(entity_value) > 200
      or operation_value not in ('create', 'touch', 'delete') then
      raise exception using errcode = '22023', message = 'INVALID_CHARACTER_VERSION_CHANGE';
    end if;
    if operation_value = 'create' then
      insert into public.campaign_character_versions (
        campaign_id, character_id, revision, created_at, updated_at, updated_by
      ) values (
        p_campaign_id, entity_value, 0,
        (change_value ->> 'createdAt')::timestamptz,
        statement_timestamp(), current_user_id
      ) on conflict (campaign_id, character_id) do nothing;
      get diagnostics affected = row_count;
    elsif operation_value = 'touch' then
      update public.campaign_character_versions as character
      set revision = character.revision + 1,
          updated_at = statement_timestamp(),
          updated_by = current_user_id
      where character.campaign_id = p_campaign_id
        and character.character_id = entity_value;
      get diagnostics affected = row_count;
    else
      delete from public.campaign_character_versions as character
      where character.campaign_id = p_campaign_id
        and character.character_id = entity_value;
      get diagnostics affected = row_count;
    end if;
    if affected = 0 then
      raise exception using errcode = 'P0001',
        message = format('CAMPAIGN_FRAGMENT_CONFLICT:character-version:%s', entity_value);
    end if;
    if operation_value <> 'delete' then
      select character.character_id, character.revision, character.created_at, character.updated_at
      into saved_character
      from public.campaign_character_versions as character
      where character.campaign_id = p_campaign_id
        and character.character_id = entity_value;
      character_results := character_results || jsonb_build_array(jsonb_build_object(
        'characterId', saved_character.character_id,
        'revision', saved_character.revision,
        'createdAt', saved_character.created_at,
        'updatedAt', saved_character.updated_at
      ));
    end if;
  end loop;

  update public.campaigns as campaign
  set state_revision = campaign.state_revision + 1,
      state_updated_by = current_user_id,
      updated_at = statement_timestamp()
  where campaign.id = p_campaign_id
  returning campaign.state_revision, campaign.updated_at
  into saved_campaign_revision, saved_campaign_updated_at;

  return jsonb_build_object(
    'previousCampaignRevision', previous_campaign_revision,
    'campaignRevision', saved_campaign_revision,
    'campaignUpdatedAt', saved_campaign_updated_at,
    'updatedBy', current_user_id,
    'characters', character_results,
    'fragments', fragment_results
  );
end;
$function$;

revoke execute on function public.save_campaign_fragments(uuid, bigint, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_campaign_fragments(uuid, bigint, jsonb, jsonb)
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'campaigns'
  ) then
    alter publication supabase_realtime add table public.campaigns;
  end if;
end $$;

-- Keep domain timestamps stable while server audit timestamps remain independent.
alter table public.campaigns
  add column if not exists state_updated_at timestamptz;

update public.campaigns as campaign
set state_updated_at = coalesce(
  (document.payload -> 'campaign' -> 'metadata' ->> 'updatedAt')::timestamptz,
  campaign.updated_at
)
from public.campaign_documents as document
where document.campaign_id = campaign.id
  and campaign.state_updated_at is null;

update public.campaigns
set state_updated_at = updated_at
where state_updated_at is null;

alter table public.campaigns
  alter column state_updated_at set default statement_timestamp(),
  alter column state_updated_at set not null;

create or replace function private.seed_campaign_fragments_on_document_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.seed_campaign_fragments(new.campaign_id, new.payload, new.updated_by);
  update public.campaigns
  set state_updated_at = coalesce(
    (new.payload -> 'campaign' -> 'metadata' ->> 'updatedAt')::timestamptz,
    statement_timestamp()
  )
  where id = new.campaign_id;
  return new;
end;
$function$;

revoke execute on function private.seed_campaign_fragments_on_document_insert()
  from public, anon, authenticated;

create or replace function public.read_campaign_fragments(p_campaign_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'campaignRevision', campaign.state_revision,
    'campaignUpdatedAt', campaign.state_updated_at,
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

create or replace function public.save_campaign_fragment_batch(
  p_campaign_id uuid,
  p_expected_campaign_revision bigint,
  p_campaign_updated_at timestamptz,
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
  result jsonb;
  change_value jsonb;
  character_results jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_ACCESS_DENIED';
  end if;
  if p_campaign_updated_at is null then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_UPDATED_AT';
  end if;

  result := public.save_campaign_fragments(
    p_campaign_id,
    p_expected_campaign_revision,
    p_changes,
    p_character_changes
  );

  for change_value in
    select value
    from jsonb_array_elements(p_character_changes)
    where value ->> 'operation' in ('create', 'touch')
  loop
    if change_value ->> 'updatedAt' is null then
      raise exception using errcode = '22023', message = 'INVALID_CHARACTER_UPDATED_AT';
    end if;
    update public.campaign_character_versions as character
    set updated_at = (change_value ->> 'updatedAt')::timestamptz
    where character.campaign_id = p_campaign_id
      and character.character_id = change_value ->> 'characterId';
  end loop;

  update public.campaigns
  set state_updated_at = p_campaign_updated_at
  where id = p_campaign_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'characterId', character.character_id,
    'revision', character.revision,
    'createdAt', character.created_at,
    'updatedAt', character.updated_at
  ) order by character.character_id), '[]'::jsonb)
  into character_results
  from public.campaign_character_versions as character
  where character.campaign_id = p_campaign_id
    and character.character_id in (
      select value ->> 'characterId'
      from jsonb_array_elements(p_character_changes)
      where value ->> 'operation' in ('create', 'touch')
    );

  return result || jsonb_build_object(
    'campaignUpdatedAt', p_campaign_updated_at,
    'characters', character_results
  );
end;
$function$;

revoke execute on function public.save_campaign_fragments(uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.save_campaign_fragment_batch(uuid, bigint, timestamptz, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_campaign_fragment_batch(uuid, bigint, timestamptz, jsonb, jsonb)
  to authenticated;

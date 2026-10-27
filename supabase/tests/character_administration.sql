-- Run as a maintenance role against a campaign with an owner, a player and a character.
-- All writes are rolled back. Claims exercise the trigger used by both current and legacy RPCs.
begin;
do $$
declare
  campaign uuid; owner_id uuid; player_id uuid; character_key text;
begin
  select o.campaign_id, o.user_id, p.user_id into campaign, owner_id, player_id
  from public.campaign_members o join public.campaign_members p using (campaign_id)
  where o.role = 'owner' and p.role = 'player'
    and exists (select 1 from public.campaign_state_fragments f where f.campaign_id=o.campaign_id and f.fragment_kind='character-core')
  limit 1;
  if campaign is null then raise exception 'TEST_FIXTURE_REQUIRES_OWNER_PLAYER_CHARACTER'; end if;
  select entity_id into character_key from public.campaign_state_fragments
  where campaign_id=campaign and fragment_kind='character-core' limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated')::text,true);
  begin
    update public.campaign_state_fragments set payload=jsonb_set(payload,'{archived}',to_jsonb(not coalesce((payload->>'archived')::boolean,false)))
    where campaign_id=campaign and entity_id=character_key and fragment_kind='character-core';
    raise exception 'TEST_PLAYER_ARCHIVE_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'CHARACTER_ADMIN_REQUIRES_GM' then raise; end if;
  end;
  begin
    delete from public.campaign_state_fragments where campaign_id=campaign and entity_id=character_key and fragment_kind='character-core';
    raise exception 'TEST_PLAYER_DELETE_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'CHARACTER_ADMIN_REQUIRES_GM' then raise; end if;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  update public.campaign_state_fragments set payload=jsonb_set(payload,'{archived}',to_jsonb(not coalesce((payload->>'archived')::boolean,false)))
  where campaign_id=campaign and entity_id=character_key and fragment_kind='character-core';
  if not found then raise exception 'TEST_OWNER_DID_NOT_UPDATE_CHARACTER'; end if;
end;
$$;
rollback;

-- Runs against an existing GM campaign. All fixtures and seed effects roll back.
begin;
do $test$
declare
  campaign_uuid uuid;
  other_uuid uuid;
  gm_uuid uuid;
  retired_key text := 'test:retired:' || gen_random_uuid();
  active_key text := 'test:active:' || gen_random_uuid();
  caught boolean;
begin
  select c.id, c.owner_user_id into campaign_uuid, gm_uuid
    from public.campaigns c where c.name='ECE' limit 1;
  if campaign_uuid is null then raise exception 'TEST_REQUIRES_GM_CAMPAIGN'; end if;
  select id into other_uuid from public.campaigns where id<>campaign_uuid limit 1;
  if other_uuid is null then raise exception 'TEST_REQUIRES_SECOND_CAMPAIGN'; end if;
  if has_table_privilege('anon','private.campaign_content_retirements','select')
    or has_table_privilege('authenticated','private.campaign_content_retirements','insert')
    or has_table_privilege('authenticated','private.campaign_content_retirements','select') then
    raise exception 'RETIREMENT_REGISTRY_EXPOSED';
  end if;
  insert into public.official_content_entries(kind,content_key,name,origin,tags,payload)
    values ('equipment',retired_key,'Retired fixture','official',array['eng'],'{}'),
           ('equipment',active_key,'Active fixture','official',array['es'],'{}');
  insert into private.campaign_content_retirements(campaign_id,kind,content_key,reason,archive_sha256)
    values (campaign_uuid,'equipment',retired_key,'test',repeat('0',64)),
           (other_uuid,'equipment',active_key,'different campaign',repeat('0',64));
  perform set_config('request.jwt.claims','{}',true);
  caught:=false;
  begin perform public.seed_campaign_content(campaign_uuid);
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'UNAUTHENTICATED_SEED_ALLOWED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  caught:=false;
  begin perform public.seed_campaign_content(campaign_uuid);
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'NONMEMBER_SEED_ALLOWED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_uuid,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.seed_campaign_content(campaign_uuid);
  execute 'reset role';
  if exists(select 1 from public.campaign_content_entries
    where campaign_id=campaign_uuid and content_key=retired_key) then
    raise exception 'RETIRED_CONTENT_RECREATED';
  end if;
  if not exists(select 1 from public.campaign_content_entries
    where campaign_id=campaign_uuid and content_key=active_key) then
    raise exception 'OTHER_CAMPAIGN_RETIREMENT_LEAKED';
  end if;
  update public.campaign_content_entries set name='Local edit'
    where campaign_id=campaign_uuid and content_key=active_key;
  if public.seed_campaign_content(campaign_uuid)<>0 then raise exception 'SEED_NOT_IDEMPOTENT'; end if;
  if not exists(select 1 from public.campaign_content_entries
    where campaign_id=campaign_uuid and content_key=active_key and name='Local edit') then
    raise exception 'SEED_OVERWROTE_LOCAL_EDIT';
  end if;
end;
$test$;
rollback;
select 'retirement, campaign isolation, GM access and idempotency checks passed; rolled back' as result;

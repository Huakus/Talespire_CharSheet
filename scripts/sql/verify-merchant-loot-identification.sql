-- Execute against a development/verification connection. All fixture writes roll back.
begin;
do $test$
declare
  campaign uuid := gen_random_uuid(); owner_id uuid; player_id uuid;
  hero text := 'chr_' || md5(gen_random_uuid()::text);
  stock_id text := 'inv_' || md5(gen_random_uuid()::text);
  npc_id text := 'npc_' || md5(gen_random_uuid()::text);
  item jsonb; received jsonb; result jsonb; rejected boolean;
  money jsonb := '{"copper":3,"silver":2,"electrum":1,"gold":7,"platinum":0}';
begin
  select owner_user_id into owner_id from public.campaigns order by created_at limit 1;
  select user_id into player_id from public.campaign_members where role='player' limit 1;
  assert owner_id is not null and player_id is not null, 'Verification requires an existing owner and player account';
  perform set_config('request.jwt.claim.sub','',true);
  insert into public.campaigns(id,name,owner_user_id,created_at,updated_at,state_revision)
    values(campaign,'ROLLBACK verification: loot and identification',owner_id,now(),now(),0);
  insert into public.campaign_members(campaign_id,user_id,role) values(campaign,player_id,'player') on conflict(campaign_id,user_id) do update set role='player';
  insert into public.campaign_character_versions(campaign_id,character_id,revision,created_at,updated_at,updated_by) values(campaign,hero,0,now(),now(),owner_id);
  insert into public.campaign_state_fragments(campaign_id,fragment_kind,parent_id,entity_id,position,payload,updated_by,updated_at) values
    (campaign,'character-core',hero,hero,0,jsonb_build_object('id',hero,'name','Verification','archived',false),owner_id,now()),
    (campaign,'character-runtime',hero,hero,0,jsonb_build_object('currency',money),owner_id,now());
  item := jsonb_build_object('id',stock_id,'name','Reserved identity','description','Reserved description','quantity',2,'order',0,'group','backpack','equipped',false,'attuned',false,
    'charges',jsonb_build_object('current',2,'maximum',5,'reset','long-rest'),'features','[]'::jsonb,
    'identification',jsonb_build_object('identified',false,'name','Dusty object','appearance','Old markings'));
  insert into public.campaign_content_entries(campaign_id,kind,content_key,name,origin,tags,payload,revision,created_by,updated_by) values
    (campaign,'monster','verification:npc','Verification NPC','gm',array['es'],jsonb_build_object('id',npc_id,'inventory',jsonb_build_array(item)),1,owner_id,owner_id),
    (campaign,'shop','verification:shop','Verification shop','gm',array['es'],jsonb_build_object('npcId',npc_id,'interactions',jsonb_build_object('interaction',true,'loot',true,'state','dead','barter',false,'fundsCopper',321)),1,owner_id,owner_id);
  perform set_config('request.jwt.claim.sub',player_id::text,true);
  assert not public.can_manage_campaign_content(campaign), 'Fixture actor must be a player';
  result := public.execute_campaign_merchant_loot(campaign,hero,'verification:shop','verification:npc',0,0,1,1,jsonb_build_array(jsonb_build_object('itemId',stock_id,'quantity',1)),'[]');
  select payload into received from public.campaign_state_fragments where campaign_id=campaign and fragment_kind='character-inventory' and parent_id=hero;
  assert received->'identification'=item->'identification', 'Loot lost identification';
  assert received->'charges'=item->'charges', 'Loot reset resources';
  assert (received->>'quantity')::int=1, 'Wrong recipient quantity';
  assert (select payload->'currency'=money from public.campaign_state_fragments where campaign_id=campaign and fragment_kind='character-runtime' and parent_id=hero), 'Loot changed coin composition';
  assert result->>'characterCurrencyDeltaCopper'='0', 'Loot charged money';
  assert (select payload #>> '{inventory,0,quantity}'='1' from public.campaign_content_entries where campaign_id=campaign and kind='monster' and content_key='verification:npc'), 'Wrong remaining stock';
  assert (select payload #>> '{interactions,fundsCopper}'='321' and revision=1 from public.campaign_content_entries where campaign_id=campaign and kind='shop' and content_key='verification:shop'), 'Loot changed merchant funds';
  rejected := false;
  begin
    perform public.execute_campaign_merchant_loot(campaign,hero,'verification:shop','verification:npc',0,0,1,1,jsonb_build_array(jsonb_build_object('itemId',stock_id,'quantity',1)),'[]');
  exception when others then if SQLERRM='MERCHANT_TRADE_CONFLICT' then rejected:=true; else raise; end if; end;
  assert rejected, 'A retry duplicated loot';
  rejected:=false;
  begin
    update public.campaign_state_fragments set payload=jsonb_set(payload,'{identification,identified}','true') where campaign_id=campaign and fragment_kind='character-inventory' and parent_id=hero;
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'A player identified an item';
  rejected:=false;
  begin
    update public.campaign_state_fragments set payload=jsonb_set(payload,'{charges,current}','5') where campaign_id=campaign and fragment_kind='character-inventory' and parent_id=hero;
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'A player changed undiscovered resources';
  -- Quantities remain editable without revealing or identifying the item.
  update public.campaign_state_fragments set payload=jsonb_set(payload,'{quantity}','2') where campaign_id=campaign and fragment_kind='character-inventory' and parent_id=hero;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  insert into public.campaign_members(campaign_id,user_id,role) values(campaign,owner_id,'owner') on conflict(campaign_id,user_id) do update set role='owner';
  update public.campaign_state_fragments set payload=jsonb_set(payload,'{identification,identified}','true') where campaign_id=campaign and fragment_kind='character-inventory' and parent_id=hero;
  update public.campaign_content_entries set payload=jsonb_set(payload,'{interactions,state}','"active"') where campaign_id=campaign and kind='shop' and content_key='verification:shop';
  perform set_config('request.jwt.claim.sub',player_id::text,true);
  rejected:=false;
  begin
    perform public.execute_campaign_merchant_loot(campaign,hero,'verification:shop','verification:npc',1,1,1,2,jsonb_build_array(jsonb_build_object('itemId',stock_id,'quantity',1)),'[]');
  exception when others then if SQLERRM='MERCHANT_NOT_AVAILABLE' then rejected:=true; else raise; end if; end;
  assert rejected, 'An active NPC could be looted';
  rejected:=false;
  begin
    perform public.execute_campaign_merchant_trade(campaign,hero,'verification:shop','verification:npc',1,1,1,2,jsonb_build_array(jsonb_build_object('itemId',stock_id,'quantity',1)),'[]');
  exception when others then if SQLERRM='MERCHANT_NOT_AVAILABLE' then rejected:=true; else raise; end if; end;
  assert rejected, 'Disabled barter could execute';
end;
$test$;
rollback;
select 'PASS: atomic loot, preserved resources and currency, retry protection, player/GM identification, active NPC and disabled trade rejected; fixtures rolled back' as verification;

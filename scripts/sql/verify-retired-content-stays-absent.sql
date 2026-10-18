-- Verify all real retirement keys, using the GM's normal import RPC; roll everything back.
begin;
create temporary table retirement_reseed_result(registry_count integer) on commit drop;
do $test$
declare campaign_uuid uuid:='9e5f3b10-be82-456c-9e9a-c2ec4a6b97cd'; gm_uuid uuid; n integer;
begin
 select owner_user_id into gm_uuid from public.campaigns where id=campaign_uuid;
 select count(*) into n from private.campaign_content_retirements where campaign_id=campaign_uuid;
 if gm_uuid is null or n=0 then raise exception 'MISSING_RETIREMENT_FIXTURE';end if;
 insert into retirement_reseed_result values(n);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_uuid,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.seed_campaign_content(campaign_uuid);
 execute 'reset role';
 if exists(select 1 from public.campaign_content_entries c join private.campaign_content_retirements r using(campaign_id,kind,content_key) where c.campaign_id=campaign_uuid) then raise exception 'RETIRED_CONTENT_REAPPEARED';end if;
end $test$;
select registry_count,'No retired definition or preparation reappears after the GM seed' as result from retirement_reseed_result;
rollback;

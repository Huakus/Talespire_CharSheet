begin;
do $$
declare
  campaign_uuid uuid;
  actor_uuid uuid;
  request_uuid uuid:=gen_random_uuid();
  second_uuid uuid:=gen_random_uuid();
  receipt jsonb;
  second_receipt jsonb;
  report_receipt jsonb;
  diagnostic jsonb;
  catalog_payload jsonb;
  context_payload jsonb := '{"schemaVersion":1,"capturedAt":"2026-10-11T23:00:00Z","build":{"version":"test","sourceHash":null,"builtAt":null},"view":{"mode":"player","screen":"inventory"},"selectedCharacterId":"fixture-hero","character":{"hp":10},"loadedCatalog":null}'::jsonb;
  caught boolean;
  baseline_snapshots bigint;
  captured_hash text;
begin
  select c.id,m.user_id into campaign_uuid,actor_uuid from public.campaigns c
  join public.campaign_members m on m.campaign_id=c.id where c.name='ECE' order by m.user_id limit 1;
  if campaign_uuid is null then raise exception 'TEST_REQUIRES_ECE_MEMBER'; end if;
  if has_function_privilege('anon','public.capture_campaign_issue_context(uuid,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','public.read_campaign_issue_report(uuid)','execute')
    or has_table_privilege('authenticated','private.campaign_issue_snapshots','select')
    or has_table_privilege('authenticated','private.campaign_issue_reports','insert') then
    raise exception 'UNSAFE_REPORT_PERMISSIONS';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('capture_campaign_issue_context','submit_campaign_issue_report','read_campaign_issue_report') and p.prosecdef) then
    raise exception 'DEFINER_RPC_EXPOSED';
  end if;
  perform set_config('request.jwt.claims','{}',true);
  caught:=false;
  begin perform public.capture_campaign_issue_context(campaign_uuid,request_uuid,context_payload);
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'UNAUTHENTICATED_CAPTURE_ALLOWED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  caught:=false;
  begin perform public.capture_campaign_issue_context(campaign_uuid,request_uuid,context_payload);
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'NONMEMBER_CAPTURE_ALLOWED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_uuid,'role','authenticated')::text,true);
  select count(*) into baseline_snapshots from private.campaign_issue_snapshots where campaign_id=campaign_uuid;
  execute 'set local role authenticated';
  receipt:=public.capture_campaign_issue_context(campaign_uuid,request_uuid,context_payload);
  execute 'reset role';
  if receipt->>'contextId'<>request_uuid::text then raise exception 'CAPTURE_IDENTIFIER_MISMATCH'; end if;
  second_receipt:=public.capture_campaign_issue_context(campaign_uuid,request_uuid,context_payload || '{"character":{"hp":1}}');
  if second_receipt<>receipt then raise exception 'CAPTURE_RETRY_CHANGED_RECEIPT'; end if;
  if (select client_context->'character'->>'hp' from private.campaign_issue_contexts where id=request_uuid)<>'10' then
    raise exception 'CAPTURE_RETRY_OVERWROTE_CONTEXT';
  end if;
  select s.payload into catalog_payload from private.campaign_issue_snapshots s
  join private.campaign_issue_contexts c on c.campaign_id=s.campaign_id and c.server_catalog_hash=s.hash where c.id=request_uuid;
  second_receipt:=public.capture_campaign_issue_context(campaign_uuid,second_uuid,
    context_payload || jsonb_build_object('loadedCatalog',catalog_payload->'entries'));
  if not exists(select 1 from private.campaign_issue_contexts where id=second_uuid and client_catalog_hash=server_catalog_hash) then
    raise exception 'IDENTICAL_CLIENT_SERVER_CATALOG_NOT_SHARED';
  end if;
  if (select count(*) from private.campaign_issue_snapshots where campaign_id=campaign_uuid)>baseline_snapshots+2 then
    raise exception 'IDENTICAL_SNAPSHOTS_DUPLICATED';
  end if;
  if exists(select 1 from private.campaign_issue_snapshots s join private.campaign_issue_contexts c
    on c.campaign_id=s.campaign_id and c.server_catalog_hash=s.hash where c.id=request_uuid
    and pg_column_size(s.payload)>=octet_length(s.payload::text)) then
    raise exception 'CATALOG_STORAGE_NOT_COMPRESSED';
  end if;
  caught:=false;
  begin perform public.capture_campaign_issue_context(campaign_uuid,gen_random_uuid(),context_payload || jsonb_build_object('loadedCatalog',
    jsonb_build_array(jsonb_build_object('campaignId',gen_random_uuid(),'payload','{}'::jsonb))));
  exception when invalid_parameter_value then caught:=true; end;
  if not caught then raise exception 'OTHER_CAMPAIGN_CLIENT_CATALOG_ALLOWED'; end if;
  caught:=false;
  begin perform public.submit_campaign_issue_report(request_uuid,'short');
  exception when invalid_parameter_value then caught:=true; end;
  if not caught then raise exception 'INVALID_DESCRIPTION_ACCEPTED'; end if;
  report_receipt:=public.submit_campaign_issue_report(request_uuid,'El inventario no se actualiza al comprar.');
  if public.submit_campaign_issue_report(request_uuid,'Otra descripción para el reintento.')<>report_receipt then
    raise exception 'REPORT_RETRY_DUPLICATED';
  end if;
  diagnostic:=public.read_campaign_issue_report((report_receipt->>'reportId')::uuid);
  if diagnostic->'report'->>'description'<>'El inventario no se actualiza al comprar.'
    or diagnostic->'client'->'character'->>'hp'<>'10'
    or diagnostic->'serverState'->'campaign'->>'id'<>campaign_uuid::text
    or diagnostic->'serverState' ? 'lore' then
    raise exception 'DIAGNOSTIC_RETRIEVAL_INCORRECT';
  end if;
  if exists(select 1 from jsonb_array_elements(diagnostic->'serverState'->'fragments') e where e.value->>'campaign_id'<>campaign_uuid::text)
    or exists(select 1 from jsonb_array_elements(diagnostic->'serverCatalog'->'entries') e where e.value->>'campaignId'<>campaign_uuid::text) then
    raise exception 'OTHER_CAMPAIGN_DATA_CAPTURED';
  end if;
  select server_state_hash into captured_hash from private.campaign_issue_contexts where id=request_uuid;
  caught:=false;
  begin update private.campaign_issue_snapshots set payload=payload where campaign_id=campaign_uuid and hash=captured_hash;
  exception when object_not_in_prerequisite_state then caught:=true; end;
  if not caught then raise exception 'SNAPSHOT_UPDATE_ALLOWED'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  caught:=false;
  begin perform public.submit_campaign_issue_report(request_uuid,'Intento de otro usuario sobre esta captura.');
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'OTHER_USER_CAPTURE_SUBMITTED'; end if;
end;
$$;
rollback;
select 'campaign report checks passed; fixtures rolled back' as result;

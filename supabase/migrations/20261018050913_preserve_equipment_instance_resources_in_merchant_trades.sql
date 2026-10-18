-- Resource-bearing copies retain their own counters through remote merchant trades.
-- Existing authorization, transaction handling and grants remain unchanged.
create or replace function private.merchant_trade_item_signature(p_item jsonb)
returns jsonb language sql immutable strict set search_path to '' as $function$
  select
    (p_item - array['id', 'order', 'quantity', 'equipped', 'attuned', 'group', 'catalog'])
    || jsonb_build_object('name', lower(btrim(coalesce(p_item ->> 'name', ''))))
    || case when
      jsonb_typeof(p_item -> 'charges') = 'object'
      or jsonb_typeof(p_item #> '{rules,storage}') = 'object'
      or exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(p_item -> 'features')='array' then p_item -> 'features' else '[]'::jsonb end) f
        where jsonb_typeof(f -> 'uses')='object'
      )
      or jsonb_path_exists(p_item, '$.rules.definition.capabilities[*].effects[*] ? (@.kind == "spell-slot-capacity")')
      then jsonb_build_object('__resource_instance', p_item -> 'id')
      else '{}'::jsonb end;
$function$;

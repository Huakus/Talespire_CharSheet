create or replace function private.merchant_trade_item_signature(p_item jsonb)
returns jsonb
language sql
immutable
strict
security invoker
set search_path = ''
as $function$
  select
    (p_item - array['id', 'order', 'quantity', 'equipped', 'attuned', 'group', 'catalog'])
    || jsonb_build_object('name', lower(btrim(coalesce(p_item ->> 'name', ''))));
$function$;

revoke execute on function private.merchant_trade_item_signature(jsonb)
  from public, anon, authenticated;

create or replace function private.merchant_trade_item_cost_copper(p_item jsonb)
returns bigint
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $function$
declare
  quantity_value numeric;
  unit_key text;
  unit_value bigint;
  result_value numeric;
begin
  if jsonb_typeof(p_item -> 'cost') <> 'object'
    or jsonb_typeof(p_item -> 'cost' -> 'quantity') <> 'number'
    or jsonb_typeof(p_item -> 'cost' -> 'unit') <> 'string' then
    raise exception using errcode = '22023', message = 'INVALID_MERCHANT_ITEM_COST';
  end if;

  quantity_value := (p_item -> 'cost' ->> 'quantity')::numeric;
  if quantity_value < 0 or quantity_value > 1000000000 then
    raise exception using errcode = '22023', message = 'INVALID_MERCHANT_ITEM_COST';
  end if;
  unit_key := lower(regexp_replace(
    translate(p_item -> 'cost' ->> 'unit', 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'),
    '[^a-zA-Z]',
    '',
    'g'
  ));
  unit_value := case unit_key
    when 'cp' then 1 when 'pc' then 1 when 'copper' then 1
    when 'copperpiece' then 1 when 'copperpieces' then 1 when 'cobres' then 1
    when 'sp' then 10 when 'pp' then 10 when 'silver' then 10
    when 'silverpiece' then 10 when 'silverpieces' then 10 when 'plata' then 10
    when 'ep' then 50 when 'pe' then 50 when 'electrum' then 50
    when 'electrumpiece' then 50 when 'electrumpieces' then 50 when 'electro' then 50
    when 'gp' then 100 when 'po' then 100 when 'gold' then 100
    when 'goldpiece' then 100 when 'goldpieces' then 100 when 'oro' then 100
    when 'platinum' then 1000 when 'ppl' then 1000
    when 'platinumpiece' then 1000 when 'platinumpieces' then 1000 when 'platino' then 1000
    else 1
  end;
  result_value := round(quantity_value * unit_value);
  if result_value < 0 or result_value > 1000000000000 then
    raise exception using errcode = '22023', message = 'INVALID_MERCHANT_ITEM_COST';
  end if;
  return result_value::bigint;
end;
$function$;

revoke execute on function private.merchant_trade_item_cost_copper(jsonb)
  from public, anon, authenticated;

create or replace function public.execute_campaign_merchant_trade(
  p_campaign_id uuid,
  p_character_id text,
  p_shop_content_key text,
  p_monster_content_key text,
  p_expected_campaign_revision bigint,
  p_expected_character_revision bigint,
  p_expected_shop_revision bigint,
  p_expected_monster_revision bigint,
  p_buys jsonb,
  p_sells jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_campaign_revision bigint;
  current_character_revision bigint;
  shop_payload jsonb;
  monster_payload jsonb;
  runtime_payload jsonb;
  original_character_inventory jsonb;
  character_inventory jsonb;
  merchant_inventory jsonb;
  normalized_inventory jsonb;
  selection jsonb;
  source_item jsonb;
  transferable jsonb;
  signature_value jsonb;
  item_id text;
  seen_ids text[];
  quantity_numeric numeric;
  quantity_value bigint;
  source_quantity bigint;
  remaining_quantity bigint;
  source_index integer;
  stack_index integer;
  item_position integer;
  buy_subtotal bigint := 0;
  sell_subtotal bigint := 0;
  net_base bigint;
  commission_percent numeric;
  commission_copper bigint;
  character_currency_delta bigint;
  merchant_currency_delta bigint;
  character_funds bigint;
  merchant_funds bigint;
  projected_character_funds bigint;
  projected_merchant_funds bigint;
  remainder bigint;
  next_currency jsonb;
  saved_campaign_revision bigint;
  saved_character_revision bigint;
  saved_shop_revision bigint;
  saved_monster_revision bigint;
  trade_timestamp timestamptz := statement_timestamp();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.campaign_members as member
    where member.campaign_id = p_campaign_id
      and member.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_ACCESS_DENIED';
  end if;
  if btrim(coalesce(p_character_id, '')) = '' or char_length(p_character_id) > 200
    or btrim(coalesce(p_shop_content_key, '')) = ''
    or btrim(coalesce(p_monster_content_key, '')) = ''
    or p_expected_campaign_revision is null or p_expected_campaign_revision < 0
    or p_expected_character_revision is null or p_expected_character_revision < 0
    or p_expected_shop_revision is null or p_expected_shop_revision < 0
    or p_expected_monster_revision is null or p_expected_monster_revision < 0
    or jsonb_typeof(p_buys) <> 'array'
    or jsonb_typeof(p_sells) <> 'array'
    or jsonb_array_length(p_buys) + jsonb_array_length(p_sells) = 0
    or jsonb_array_length(p_buys) > 100
    or jsonb_array_length(p_sells) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_MERCHANT_TRADE';
  end if;

  select campaign.state_revision
  into current_campaign_revision
  from public.campaigns as campaign
  where campaign.id = p_campaign_id
  for update;
  if current_campaign_revision is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_NOT_FOUND';
  end if;
  if current_campaign_revision <> p_expected_campaign_revision then
    raise exception using errcode = 'P0001', message = 'MERCHANT_TRADE_CONFLICT';
  end if;

  select character.revision
  into current_character_revision
  from public.campaign_character_versions as character
  where character.campaign_id = p_campaign_id
    and character.character_id = p_character_id
  for update;
  if current_character_revision is null then
    raise exception using errcode = 'P0002', message = 'CHARACTER_NOT_FOUND';
  end if;
  if current_character_revision <> p_expected_character_revision then
    raise exception using errcode = 'P0001', message = 'MERCHANT_TRADE_CONFLICT';
  end if;

  select entry.payload
  into shop_payload
  from public.campaign_content_entries as entry
  where entry.campaign_id = p_campaign_id
    and entry.kind = 'shop'
    and entry.content_key = p_shop_content_key
    and entry.revision = p_expected_shop_revision
    and entry.deleted_at is null
  for update;
  if shop_payload is null then
    raise exception using errcode = 'P0001', message = 'MERCHANT_TRADE_CONFLICT';
  end if;

  select entry.payload
  into monster_payload
  from public.campaign_content_entries as entry
  where entry.campaign_id = p_campaign_id
    and entry.kind = 'monster'
    and entry.content_key = p_monster_content_key
    and entry.revision = p_expected_monster_revision
    and entry.deleted_at is null
  for update;
  if monster_payload is null then
    raise exception using errcode = 'P0001', message = 'MERCHANT_TRADE_CONFLICT';
  end if;
  if btrim(coalesce(shop_payload ->> 'npcId', '')) = ''
    or shop_payload ->> 'npcId' <> monster_payload ->> 'id'
    or coalesce((shop_payload -> 'interactions' ->> 'barter')::boolean, false) is not true
    or coalesce(shop_payload -> 'interactions' ->> 'state', 'active') <> 'active' then
    raise exception using errcode = '22023', message = 'MERCHANT_NOT_AVAILABLE';
  end if;

  select fragment.payload
  into runtime_payload
  from public.campaign_state_fragments as fragment
  where fragment.campaign_id = p_campaign_id
    and fragment.fragment_kind = 'character-runtime'
    and fragment.parent_id = p_character_id
    and fragment.entity_id = p_character_id;
  if runtime_payload is null or jsonb_typeof(runtime_payload -> 'currency') <> 'object' then
    raise exception using errcode = 'P0002', message = 'CHARACTER_RUNTIME_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(fragment.payload order by fragment.position, fragment.entity_id), '[]'::jsonb)
  into original_character_inventory
  from public.campaign_state_fragments as fragment
  where fragment.campaign_id = p_campaign_id
    and fragment.fragment_kind = 'character-inventory'
    and fragment.parent_id = p_character_id;
  character_inventory := original_character_inventory;
  merchant_inventory := coalesce(monster_payload -> 'inventory', '[]'::jsonb);
  if jsonb_typeof(character_inventory) <> 'array'
    or jsonb_typeof(merchant_inventory) <> 'array'
    or jsonb_array_length(character_inventory) > 2000
    or jsonb_array_length(merchant_inventory) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_MERCHANT_INVENTORY';
  end if;
  if jsonb_array_length(character_inventory) <> (
      select count(distinct item ->> 'id')
      from jsonb_array_elements(character_inventory) as entry(item)
    )
    or jsonb_array_length(merchant_inventory) <> (
      select count(distinct item ->> 'id')
      from jsonb_array_elements(merchant_inventory) as entry(item)
    ) then
    raise exception using errcode = '22023', message = 'DUPLICATE_MERCHANT_TRADE_ITEM_ID';
  end if;

  seen_ids := array[]::text[];
  for selection in select value from jsonb_array_elements(p_buys)
  loop
    if jsonb_typeof(selection) <> 'object'
      or jsonb_typeof(selection -> 'itemId') <> 'string'
      or jsonb_typeof(selection -> 'quantity') <> 'number' then
      raise exception using errcode = '22023', message = 'INVALID_MERCHANT_TRADE_SELECTION';
    end if;
    item_id := btrim(selection ->> 'itemId');
    quantity_numeric := (selection ->> 'quantity')::numeric;
    if item_id = '' or char_length(item_id) > 200
      or item_id = any(seen_ids)
      or quantity_numeric <> trunc(quantity_numeric)
      or quantity_numeric < 1 or quantity_numeric > 1000000 then
      raise exception using errcode = '22023', message = 'INVALID_MERCHANT_TRADE_SELECTION';
    end if;
    seen_ids := array_append(seen_ids, item_id);
    quantity_value := quantity_numeric::bigint;

    source_item := null;
    source_index := null;
    select entry.item, (entry.ordinal - 1)::integer
    into source_item, source_index
    from jsonb_array_elements(merchant_inventory) with ordinality as entry(item, ordinal)
    where entry.item ->> 'id' = item_id
    limit 1;
    if source_item is null or jsonb_typeof(source_item -> 'quantity') <> 'number' then
      raise exception using errcode = 'P0001', message = 'MERCHANT_TRADE_CONFLICT';
    end if;
    source_quantity := (source_item ->> 'quantity')::bigint;
    if quantity_value > source_quantity then
      raise exception using errcode = 'P0001', message = 'MERCHANT_STOCK_CHANGED';
    end if;
    buy_subtotal := buy_subtotal
      + private.merchant_trade_item_cost_copper(source_item) * quantity_value;
    if buy_subtotal > 9000000000000000 then
      raise exception using errcode = '22003', message = 'MERCHANT_TRADE_TOTAL_TOO_LARGE';
    end if;

    remaining_quantity := source_quantity - quantity_value;
    if remaining_quantity = 0 then
      merchant_inventory := merchant_inventory - source_index;
    else
      merchant_inventory := jsonb_set(
        merchant_inventory,
        array[source_index::text, 'quantity'],
        to_jsonb(remaining_quantity),
        false
      );
    end if;

    transferable := (source_item - 'catalog') || jsonb_build_object(
      'quantity', quantity_value,
      'equipped', false,
      'attuned', false
    );
    signature_value := private.merchant_trade_item_signature(transferable);
    stack_index := null;
    select (entry.ordinal - 1)::integer
    into stack_index
    from jsonb_array_elements(character_inventory) with ordinality as entry(item, ordinal)
    where private.merchant_trade_item_signature(entry.item) = signature_value
      and coalesce((entry.item ->> 'equipped')::boolean, false) is false
      and coalesce((entry.item ->> 'attuned')::boolean, false) is false
    limit 1;
    if stack_index is null then
      transferable := transferable || jsonb_build_object(
        'id', 'inv_' || replace(gen_random_uuid()::text, '-', ''),
        'order', jsonb_array_length(character_inventory),
        'group', 'backpack'
      );
      character_inventory := character_inventory || jsonb_build_array(transferable);
    else
      source_quantity := (character_inventory -> stack_index ->> 'quantity')::bigint;
      character_inventory := jsonb_set(
        character_inventory,
        array[stack_index::text, 'quantity'],
        to_jsonb(source_quantity + quantity_value),
        false
      );
    end if;
  end loop;

  seen_ids := array[]::text[];
  for selection in select value from jsonb_array_elements(p_sells)
  loop
    if jsonb_typeof(selection) <> 'object'
      or jsonb_typeof(selection -> 'itemId') <> 'string'
      or jsonb_typeof(selection -> 'quantity') <> 'number' then
      raise exception using errcode = '22023', message = 'INVALID_MERCHANT_TRADE_SELECTION';
    end if;
    item_id := btrim(selection ->> 'itemId');
    quantity_numeric := (selection ->> 'quantity')::numeric;
    if item_id = '' or char_length(item_id) > 200
      or item_id = any(seen_ids)
      or quantity_numeric <> trunc(quantity_numeric)
      or quantity_numeric < 1 or quantity_numeric > 1000000 then
      raise exception using errcode = '22023', message = 'INVALID_MERCHANT_TRADE_SELECTION';
    end if;
    seen_ids := array_append(seen_ids, item_id);
    quantity_value := quantity_numeric::bigint;

    source_item := null;
    select entry.item
    into source_item
    from jsonb_array_elements(original_character_inventory) as entry(item)
    where entry.item ->> 'id' = item_id
    limit 1;
    if source_item is null or jsonb_typeof(source_item -> 'quantity') <> 'number'
      or coalesce((source_item ->> 'equipped')::boolean, false) is true then
      raise exception using errcode = 'P0001', message = 'CHARACTER_INVENTORY_CHANGED';
    end if;
    source_quantity := (source_item ->> 'quantity')::bigint;
    if quantity_value > source_quantity then
      raise exception using errcode = 'P0001', message = 'CHARACTER_INVENTORY_CHANGED';
    end if;
    sell_subtotal := sell_subtotal
      + private.merchant_trade_item_cost_copper(source_item) * quantity_value;
    if sell_subtotal > 9000000000000000 then
      raise exception using errcode = '22003', message = 'MERCHANT_TRADE_TOTAL_TOO_LARGE';
    end if;

    source_index := null;
    select (entry.ordinal - 1)::integer
    into source_index
    from jsonb_array_elements(character_inventory) with ordinality as entry(item, ordinal)
    where entry.item ->> 'id' = item_id
    limit 1;
    if source_index is null then
      raise exception using errcode = 'P0001', message = 'CHARACTER_INVENTORY_CHANGED';
    end if;
    source_quantity := (character_inventory -> source_index ->> 'quantity')::bigint;
    remaining_quantity := source_quantity - quantity_value;
    if remaining_quantity < 0 then
      raise exception using errcode = 'P0001', message = 'CHARACTER_INVENTORY_CHANGED';
    elsif remaining_quantity = 0 then
      character_inventory := character_inventory - source_index;
    else
      character_inventory := jsonb_set(
        character_inventory,
        array[source_index::text, 'quantity'],
        to_jsonb(remaining_quantity),
        false
      );
    end if;

    transferable := (source_item - 'catalog') || jsonb_build_object(
      'quantity', quantity_value,
      'equipped', false,
      'attuned', false
    );
    signature_value := private.merchant_trade_item_signature(transferable);
    stack_index := null;
    select (entry.ordinal - 1)::integer
    into stack_index
    from jsonb_array_elements(merchant_inventory) with ordinality as entry(item, ordinal)
    where private.merchant_trade_item_signature(entry.item) = signature_value
      and coalesce((entry.item ->> 'equipped')::boolean, false) is false
      and coalesce((entry.item ->> 'attuned')::boolean, false) is false
    limit 1;
    if stack_index is null then
      transferable := transferable || jsonb_build_object(
        'id', 'inv_' || replace(gen_random_uuid()::text, '-', ''),
        'order', jsonb_array_length(merchant_inventory)
      );
      merchant_inventory := merchant_inventory || jsonb_build_array(transferable);
    else
      source_quantity := (merchant_inventory -> stack_index ->> 'quantity')::bigint;
      merchant_inventory := jsonb_set(
        merchant_inventory,
        array[stack_index::text, 'quantity'],
        to_jsonb(source_quantity + quantity_value),
        false
      );
    end if;
  end loop;

  net_base := buy_subtotal - sell_subtotal;
  commission_percent := least(100, greatest(0,
    coalesce((shop_payload -> 'interactions' ->> 'commissionPercent')::numeric, 20)
  ));
  commission_copper := round(abs(net_base) * commission_percent / 100)::bigint;
  character_currency_delta := case
    when net_base > 0 then -(net_base + commission_copper)
    when net_base < 0 then abs(net_base) - commission_copper
    else 0
  end;
  merchant_currency_delta := -character_currency_delta;

  character_funds :=
      coalesce((runtime_payload -> 'currency' ->> 'copper')::bigint, 0)
    + coalesce((runtime_payload -> 'currency' ->> 'silver')::bigint, 0) * 10
    + coalesce((runtime_payload -> 'currency' ->> 'electrum')::bigint, 0) * 50
    + coalesce((runtime_payload -> 'currency' ->> 'gold')::bigint, 0) * 100
    + coalesce((runtime_payload -> 'currency' ->> 'platinum')::bigint, 0) * 1000;
  merchant_funds := coalesce((shop_payload -> 'interactions' ->> 'fundsCopper')::bigint, 10000);
  projected_character_funds := character_funds + character_currency_delta;
  projected_merchant_funds := merchant_funds + merchant_currency_delta;
  if character_funds < 0 or merchant_funds < 0
    or projected_character_funds < 0 then
    raise exception using errcode = '22023', message = 'INSUFFICIENT_CHARACTER_FUNDS';
  end if;
  if projected_merchant_funds < 0 then
    raise exception using errcode = '22023', message = 'INSUFFICIENT_MERCHANT_FUNDS';
  end if;
  if projected_character_funds > 9000000000000000
    or projected_merchant_funds > 9000000000000000 then
    raise exception using errcode = '22003', message = 'MERCHANT_TRADE_TOTAL_TOO_LARGE';
  end if;

  remainder := projected_character_funds;
  next_currency := jsonb_build_object(
    'platinum', remainder / 1000,
    'gold', (remainder % 1000) / 100,
    'electrum', (remainder % 100) / 50,
    'silver', (remainder % 50) / 10,
    'copper', remainder % 10
  );
  runtime_payload := jsonb_set(runtime_payload, '{currency}', next_currency, false);
  shop_payload := jsonb_set(
    shop_payload,
    '{interactions,fundsCopper}',
    to_jsonb(projected_merchant_funds),
    true
  );

  if jsonb_array_length(character_inventory) > 2000
    or jsonb_array_length(merchant_inventory) > 2000 then
    raise exception using errcode = '22023', message = 'MERCHANT_INVENTORY_LIMIT_EXCEEDED';
  end if;

  normalized_inventory := '[]'::jsonb;
  item_position := 0;
  for source_item in select value from jsonb_array_elements(character_inventory)
  loop
    if jsonb_typeof(source_item) <> 'object'
      or btrim(coalesce(source_item ->> 'id', '')) = ''
      or char_length(source_item ->> 'id') > 200
      or jsonb_typeof(source_item -> 'quantity') <> 'number'
      or (source_item ->> 'quantity')::bigint < 1 then
      raise exception using errcode = '22023', message = 'INVALID_CHARACTER_INVENTORY';
    end if;
    normalized_inventory := normalized_inventory || jsonb_build_array(
      jsonb_set(source_item, '{order}', to_jsonb(item_position), true)
    );
    item_position := item_position + 1;
  end loop;
  character_inventory := normalized_inventory;
  if jsonb_array_length(character_inventory) <> (
    select count(distinct item ->> 'id')
    from jsonb_array_elements(character_inventory) as entry(item)
  ) then
    raise exception using errcode = '22023', message = 'DUPLICATE_CHARACTER_INVENTORY_ID';
  end if;

  normalized_inventory := '[]'::jsonb;
  item_position := 0;
  for source_item in select value from jsonb_array_elements(merchant_inventory)
  loop
    if jsonb_typeof(source_item) <> 'object'
      or btrim(coalesce(source_item ->> 'id', '')) = ''
      or char_length(source_item ->> 'id') > 200
      or jsonb_typeof(source_item -> 'quantity') <> 'number'
      or (source_item ->> 'quantity')::bigint < 1 then
      raise exception using errcode = '22023', message = 'INVALID_MERCHANT_INVENTORY';
    end if;
    normalized_inventory := normalized_inventory || jsonb_build_array(
      jsonb_set(source_item, '{order}', to_jsonb(item_position), true)
    );
    item_position := item_position + 1;
  end loop;
  merchant_inventory := normalized_inventory;
  if jsonb_array_length(merchant_inventory) <> (
    select count(distinct item ->> 'id')
    from jsonb_array_elements(merchant_inventory) as entry(item)
  ) then
    raise exception using errcode = '22023', message = 'DUPLICATE_MERCHANT_INVENTORY_ID';
  end if;

  update public.campaign_state_fragments as fragment
  set payload = runtime_payload,
      revision = fragment.revision + 1,
      updated_by = current_user_id,
      updated_at = trade_timestamp
  where fragment.campaign_id = p_campaign_id
    and fragment.fragment_kind = 'character-runtime'
    and fragment.parent_id = p_character_id
    and fragment.entity_id = p_character_id;

  delete from public.campaign_state_fragments as fragment
  where fragment.campaign_id = p_campaign_id
    and fragment.fragment_kind = 'character-inventory'
    and fragment.parent_id = p_character_id
    and not exists (
      select 1
      from jsonb_array_elements(character_inventory) as entry(item)
      where entry.item ->> 'id' = fragment.entity_id
    );

  item_position := 0;
  for source_item in select value from jsonb_array_elements(character_inventory)
  loop
    update public.campaign_state_fragments as fragment
    set position = item_position,
        payload = source_item,
        revision = fragment.revision + 1,
        updated_by = current_user_id,
        updated_at = trade_timestamp
    where fragment.campaign_id = p_campaign_id
      and fragment.fragment_kind = 'character-inventory'
      and fragment.parent_id = p_character_id
      and fragment.entity_id = source_item ->> 'id';
    if not found then
      insert into public.campaign_state_fragments (
        campaign_id, fragment_kind, parent_id, entity_id, position, payload, updated_by, updated_at
      ) values (
        p_campaign_id, 'character-inventory', p_character_id, source_item ->> 'id',
        item_position, source_item, current_user_id, trade_timestamp
      );
    end if;
    item_position := item_position + 1;
  end loop;

  update public.campaign_character_versions as character
  set revision = character.revision + 1,
      updated_by = current_user_id,
      updated_at = trade_timestamp
  where character.campaign_id = p_campaign_id
    and character.character_id = p_character_id
  returning character.revision into saved_character_revision;

  update public.campaign_content_entries as entry
  set payload = jsonb_set(monster_payload, '{inventory}', merchant_inventory, true),
      revision = entry.revision + 1,
      updated_by = current_user_id,
      updated_at = trade_timestamp
  where entry.campaign_id = p_campaign_id
    and entry.kind = 'monster'
    and entry.content_key = p_monster_content_key
  returning entry.revision into saved_monster_revision;

  update public.campaign_content_entries as entry
  set payload = shop_payload,
      revision = entry.revision + 1,
      updated_by = current_user_id,
      updated_at = trade_timestamp
  where entry.campaign_id = p_campaign_id
    and entry.kind = 'shop'
    and entry.content_key = p_shop_content_key
  returning entry.revision into saved_shop_revision;

  update public.campaigns as campaign
  set state_revision = campaign.state_revision + 1,
      state_updated_by = current_user_id,
      state_updated_at = trade_timestamp,
      updated_at = trade_timestamp
  where campaign.id = p_campaign_id
  returning campaign.state_revision into saved_campaign_revision;

  return jsonb_build_object(
    'campaignRevision', saved_campaign_revision,
    'characterRevision', saved_character_revision,
    'shopRevision', saved_shop_revision,
    'monsterRevision', saved_monster_revision,
    'buySubtotalCopper', buy_subtotal,
    'sellSubtotalCopper', sell_subtotal,
    'commissionCopper', commission_copper,
    'characterCurrencyDeltaCopper', character_currency_delta,
    'merchantCurrencyDeltaCopper', merchant_currency_delta,
    'updatedAt', trade_timestamp
  );
end;
$function$;

revoke execute on function public.execute_campaign_merchant_trade(
  uuid, text, text, text, bigint, bigint, bigint, bigint, jsonb, jsonb
) from public, anon;
grant execute on function public.execute_campaign_merchant_trade(
  uuid, text, text, text, bigint, bigint, bigint, bigint, jsonb, jsonb
) to authenticated;

-- Normalize the remaining imported spell class strings and remove the retired
-- singular field once every spell has a canonical classes array.
with normalized_campaign_spells as (
  select
    entry.campaign_id,
    entry.kind,
    entry.content_key,
    coalesce((
      select jsonb_agg(to_jsonb(mapped.class_key) order by mapped.first_position)
      from (
        select class_key, min(position) as first_position
        from (
          select
            position,
            case translate(lower(btrim(class_name)), U&'\00E1\00E9\00ED\00F3\00FA\00FC', 'aeiouu')
              when 'artifice' then 'artificer'
              when 'artificer' then 'artificer'
              when 'bard' then 'bard'
              when 'bardo' then 'bard'
              when 'warlock' then 'warlock'
              when 'brujo' then 'warlock'
              when 'cleric' then 'cleric'
              when 'clerigo' then 'cleric'
              when 'druid' then 'druid'
              when 'druida' then 'druid'
              when 'ranger' then 'ranger'
              when 'explorador' then 'ranger'
              when 'sorcerer' then 'sorcerer'
              when 'hechicero' then 'sorcerer'
              when 'wizard' then 'wizard'
              when 'mago' then 'wizard'
              when 'paladin' then 'paladin'
              -- Ritual casting is a spell property, never a class.
              when 'ritual caster' then null
              when 'lanzador de rituales' then null
              else translate(lower(btrim(class_name)), U&'\00E1\00E9\00ED\00F3\00FA\00FC', 'aeiouu')
            end as class_key
          from regexp_split_to_table(entry.payload ->> 'class', '[,;]')
            with ordinality as source(class_name, position)
        ) parsed
        where class_key is not null and class_key <> ''
        group by class_key
      ) mapped
    ), '[]'::jsonb) as classes
  from public.campaign_content_entries entry
  where entry.kind = 'spell'
    and jsonb_typeof(entry.payload -> 'class') = 'string'
    and (
      not (entry.payload ? 'classes')
      or jsonb_typeof(entry.payload -> 'classes') <> 'array'
    )
)
update public.campaign_content_entries entry
set
  payload = jsonb_set(entry.payload, '{classes}', normalized.classes, true) - 'class',
  revision = entry.revision + 1,
  updated_at = statement_timestamp()
from normalized_campaign_spells normalized
where entry.campaign_id = normalized.campaign_id
  and entry.kind = normalized.kind
  and entry.content_key = normalized.content_key;

update public.campaign_content_entries
set
  payload = payload - 'class',
  revision = revision + 1,
  updated_at = statement_timestamp()
where kind = 'spell'
  and payload ? 'class'
  and jsonb_typeof(payload -> 'classes') = 'array';

update public.official_content_entries
set payload = payload - 'class'
where kind = 'spell'
  and payload ? 'class'
  and jsonb_typeof(payload -> 'classes') = 'array';

create or replace function public.backend_healthcheck()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok',
    'schemaVersion', 1,
    'serverTime', statement_timestamp()
  );
$$;

comment on function public.backend_healthcheck() is
  'Unauthenticated connectivity probe for the TaleSpire Character Sheet backend.';

create or replace function public.persistence_roundtrip_probe(p_payload jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_payload;
$$;

comment on function public.persistence_roundtrip_probe(jsonb) is
  'Temporary integration probe proving that campaign envelopes survive a JSONB API round trip.';

revoke all on function public.backend_healthcheck() from public;
revoke all on function public.persistence_roundtrip_probe(jsonb) from public;
grant execute on function public.backend_healthcheck() to anon, authenticated;
grant execute on function public.persistence_roundtrip_probe(jsonb) to anon, authenticated;

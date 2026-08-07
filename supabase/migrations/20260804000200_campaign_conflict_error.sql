-- SQLSTATE 40001 marks a retryable serialization failure. A stale document
-- revision is an application conflict, so expose it as an explicit exception.
create or replace function public.save_campaign_document(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_payload jsonb
)
returns table (
  campaign_id uuid,
  revision bigint,
  payload jsonb,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_revision bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.is_campaign_member(p_campaign_id) then
    raise exception using errcode = '42501', message = 'CAMPAIGN_ACCESS_DENIED';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_REVISION';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_PAYLOAD';
  end if;

  return query
  update public.campaign_documents as document
  set payload = p_payload,
      revision = document.revision + 1,
      updated_by = current_user_id,
      updated_at = statement_timestamp()
  where document.campaign_id = p_campaign_id
    and document.revision = p_expected_revision
  returning document.campaign_id,
            document.revision,
            document.payload,
            document.updated_by,
            document.updated_at;

  if found then
    update public.campaigns
    set updated_at = statement_timestamp()
    where id = p_campaign_id;
    return;
  end if;

  select document.revision
  into current_revision
  from public.campaign_documents as document
  where document.campaign_id = p_campaign_id;

  if current_revision is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_DOCUMENT_NOT_FOUND';
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'CAMPAIGN_REVISION_CONFLICT',
    detail = format('expected=%s,current=%s', p_expected_revision, current_revision);
end;
$$;

revoke all on function public.save_campaign_document(uuid, bigint, jsonb) from public;
grant execute on function public.save_campaign_document(uuid, bigint, jsonb) to authenticated;

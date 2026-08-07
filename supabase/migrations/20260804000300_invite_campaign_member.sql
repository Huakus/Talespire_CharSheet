create or replace function public.add_campaign_member_by_email(
  p_campaign_id uuid,
  p_email text,
  p_role text default 'player'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  campaign_owner_id uuid;
  invited_user_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_email is null or btrim(p_email) = '' then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER_EMAIL';
  end if;
  if p_role not in ('gm', 'player') then
    raise exception using errcode = '22023', message = 'INVALID_CAMPAIGN_ROLE';
  end if;

  select campaign.owner_user_id
  into campaign_owner_id
  from public.campaigns as campaign
  where campaign.id = p_campaign_id;

  if campaign_owner_id is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_NOT_FOUND';
  end if;
  if campaign_owner_id <> current_user_id then
    raise exception using errcode = '42501', message = 'CAMPAIGN_OWNER_REQUIRED';
  end if;

  select account.id
  into invited_user_id
  from auth.users as account
  where lower(account.email) = lower(btrim(p_email));

  if invited_user_id is null then
    raise exception using errcode = 'P0002', message = 'CAMPAIGN_MEMBER_ACCOUNT_NOT_FOUND';
  end if;
  if invited_user_id = campaign_owner_id then
    raise exception using errcode = '22023', message = 'OWNER_ROLE_IS_IMMUTABLE';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (p_campaign_id, invited_user_id, p_role)
  on conflict (campaign_id, user_id)
  do update set role = excluded.role;

  return invited_user_id;
end;
$$;

revoke all on function public.add_campaign_member_by_email(uuid, text, text) from public;
grant execute on function public.add_campaign_member_by_email(uuid, text, text) to authenticated;

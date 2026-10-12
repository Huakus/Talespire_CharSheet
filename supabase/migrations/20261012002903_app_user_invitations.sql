-- Account invitations are independent of campaign membership and GM roles.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_inviter_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table private.app_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  invited_by uuid references auth.users(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null deferrable initially deferred,
  status text not null default 'sending' check (status in ('sending','created','sent','accepted','failed')),
  authorization_hash text not null,
  authorization_expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  failure_code text
);
create index app_invitations_inviter_created_idx on private.app_invitations(invited_by, created_at);
create index app_invitations_email_created_idx on private.app_invitations(email, created_at);
create index app_invitations_auth_user_idx on private.app_invitations(auth_user_id);
create unique index app_invitations_sending_email_idx on private.app_invitations(email) where status = 'sending';
alter table private.app_inviter_permissions enable row level security;
alter table private.app_invitations enable row level security;
revoke all on private.app_inviter_permissions, private.app_invitations from public, anon, authenticated, service_role;

create function public.can_invite_app_users()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from private.app_inviter_permissions
    where user_id = auth.uid() and revoked_at is null
  );
$$;
revoke all on function public.can_invite_app_users() from public, anon;
grant execute on function public.can_invite_app_users() to authenticated;

-- Only the server can reserve invitations. p_inviter_id comes from getUser(token).
create function public.reserve_app_invitation(p_inviter_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  email_value text := lower(btrim(p_email));
  invitation_id uuid;
  authorization_token text := encode(extensions.gen_random_bytes(32), 'hex');
  existing_user_id uuid;
  existing_confirmation timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_inviter_id::text, 619));
  perform 1 from private.app_inviter_permissions
  where user_id = p_inviter_id and revoked_at is null for share;
  if not found then raise exception using errcode = '42501', message = 'APP_INVITER_REQUIRED'; end if;
  if email_value is null or char_length(email_value) > 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION_EMAIL';
  end if;
  if (select count(*) from private.app_invitations where invited_by = p_inviter_id and created_at > now() - interval '1 hour') >= 10
    or (select count(*) from private.app_invitations where invited_by = p_inviter_id and created_at > now() - interval '1 day') >= 30 then
    raise exception using errcode = 'P0001', message = 'APP_INVITATION_RATE_LIMIT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(email_value, 620));
  if exists (select 1 from private.app_invitations where email = email_value and created_at > now() - interval '1 minute') then
    raise exception using errcode = 'P0001', message = 'APP_INVITATION_COOLDOWN';
  end if;
  update private.app_invitations set status = 'failed', failure_code = 'SEND_LEASE_EXPIRED'
  where email = email_value and status = 'sending' and authorization_expires_at < now();
  if exists (select 1 from private.app_invitations where email = email_value and status = 'sending') then
    raise exception using errcode = 'P0001', message = 'APP_INVITATION_IN_PROGRESS';
  end if;
  select id, email_confirmed_at into existing_user_id, existing_confirmation
  from auth.users where lower(email) = email_value and deleted_at is null;
  if existing_user_id is not null and (existing_confirmation is not null or not exists (
    select 1 from private.app_invitations where auth_user_id = existing_user_id and status in ('created','sent')
  )) then
    raise exception using errcode = 'P0001', message = 'APP_USER_ALREADY_EXISTS';
  end if;
  insert into private.app_invitations(email, invited_by, authorization_hash, auth_user_id)
  values (email_value, p_inviter_id, encode(extensions.digest(authorization_token, 'sha256'), 'hex'), existing_user_id)
  returning id into invitation_id;
  return jsonb_build_object('invitationId', invitation_id, 'authorizationToken', authorization_token, 'email', email_value);
end;
$$;
revoke all on function public.reserve_app_invitation(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_app_invitation(uuid,text) to service_role;

create function public.finish_app_invitation(p_invitation_id uuid, p_user_id uuid, p_failure_code text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_failure_code is null then
    if not exists (select 1 from private.app_invitations i join auth.users u on u.id = p_user_id
      where i.id = p_invitation_id and lower(u.email) = i.email and i.auth_user_id = u.id) then
      raise exception using errcode = '22023', message = 'APP_INVITATION_USER_MISMATCH';
    end if;
    update private.app_invitations
    set status = case when status = 'accepted' then status else 'sent' end, sent_at = now(), failure_code = null
    where id = p_invitation_id and status in ('sending','created','accepted');
  else
    -- A timeout after Auth committed must not erase evidence of the created account.
    update private.app_invitations set status = 'failed', failure_code = left(p_failure_code,80)
    where id = p_invitation_id and status = 'sending' and auth_user_id is null;
  end if;
end;
$$;
revoke all on function public.finish_app_invitation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finish_app_invitation(uuid,uuid,text) to service_role;

-- Database guard also covers direct signUp, OTP auto-registration, OAuth and anonymous users.
-- Metadata is not trusted as a permission: a random one-use capability is checked against
-- a private row, matching email, active inviter and lease; the secret is then discarded.
create function private.require_app_invitation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  invitation_id uuid;
  authorization_token text := new.raw_user_meta_data ->> '_app_invitation_token';
begin
  begin
    invitation_id := (new.raw_user_meta_data ->> '_app_invitation_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '42501', message = 'APP_INVITATION_REQUIRED';
  end;
  if invitation_id is null or authorization_token is null or length(authorization_token) <> 64
    or new.email is null or coalesce(new.is_anonymous,false) then
    raise exception using errcode = '42501', message = 'APP_INVITATION_REQUIRED';
  end if;
  perform 1 from private.app_inviter_permissions p join private.app_invitations i on i.invited_by = p.user_id
  where i.id = invitation_id and p.revoked_at is null for share of p;
  if not found then raise exception using errcode = '42501', message = 'APP_INVITATION_REQUIRED'; end if;
  update private.app_invitations
  set status = 'created', auth_user_id = new.id
  where id = invitation_id and email = lower(btrim(new.email)) and status = 'sending'
    and auth_user_id is null and authorization_expires_at > now()
    and authorization_hash = encode(extensions.digest(authorization_token, 'sha256'), 'hex');
  if not found then raise exception using errcode = '42501', message = 'APP_INVITATION_REQUIRED'; end if;
  new.raw_user_meta_data := new.raw_user_meta_data - '_app_invitation_id' - '_app_invitation_token';
  return new;
end;
$$;
revoke all on function private.require_app_invitation() from public, anon, authenticated, service_role;
create trigger require_app_invitation_before_insert
before insert on auth.users for each row execute function private.require_app_invitation();

create function private.record_app_invitation_acceptance()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update private.app_invitations set status = 'accepted', accepted_at = now()
  where auth_user_id = new.id and status in ('sending','created','sent') and accepted_at is null;
  return new;
end;
$$;
revoke all on function private.record_app_invitation_acceptance() from public, anon, authenticated, service_role;
create trigger record_app_invitation_acceptance_after_update
after update of email_confirmed_at on auth.users for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function private.record_app_invitation_acceptance();

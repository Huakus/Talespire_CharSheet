begin;
do $$
declare
  inviter_id uuid;
  user_id uuid := gen_random_uuid();
  email_value text := 'codex-invite-check-' || gen_random_uuid()::text || '@example.invalid';
  reservation jsonb;
  expired_reservation jsonb;
  caught boolean;
  loop_index integer;
  previous_claims text := current_setting('request.jwt.claims', true);
begin
  select p.user_id into inviter_id from private.app_inviter_permissions p where revoked_at is null limit 1;
  if inviter_id is null then raise exception 'TEST_REQUIRES_AN_ENABLED_INVITER'; end if;
  if not public.is_protected_app_inviter(inviter_id) then raise exception 'INVITER_ACCOUNT_NOT_PROTECTED'; end if;
  if has_function_privilege('authenticated','public.reserve_app_invitation(uuid,text)','execute')
    or has_function_privilege('anon','public.reserve_app_invitation(uuid,text)','execute')
    or has_function_privilege('authenticated','public.finish_app_invitation(uuid,uuid,text)','execute')
    or has_function_privilege('authenticated','public.is_protected_app_inviter(uuid)','execute')
    or has_table_privilege('authenticated','private.app_inviter_permissions','update')
    or has_table_privilege('authenticated','private.app_invitations','select') then
    raise exception 'UNSAFE_CLIENT_PERMISSIONS';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',inviter_id,'role','authenticated')::text,true);
  if not public.can_invite_app_users() then raise exception 'ENABLED_INVITER_NOT_RECOGNIZED'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  if public.can_invite_app_users() then raise exception 'UNLISTED_USER_CAN_INVITE'; end if;
  caught := false;
  begin
    perform public.reserve_app_invitation(gen_random_uuid(), email_value);
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'UNAUTHORIZED_RESERVATION_ALLOWED'; end if;
  caught := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(user_id,email_value,'{}');
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'PUBLIC_REGISTRATION_ALLOWED'; end if;
  reservation := public.reserve_app_invitation(inviter_id,email_value);
  caught := false;
  begin
    perform public.reserve_app_invitation(inviter_id,email_value);
  exception when raise_exception then
    if sqlerrm <> 'APP_INVITATION_COOLDOWN' then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'DUPLICATE_RESERVATION_ALLOWED'; end if;
  caught := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(user_id,'different-' || email_value,
      jsonb_build_object('_app_invitation_id',reservation->>'invitationId','_app_invitation_token',reservation->>'authorizationToken'));
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'EMAIL_MISMATCH_ALLOWED'; end if;
  caught := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(user_id,email_value,
      jsonb_build_object('_app_invitation_id',reservation->>'invitationId','_app_invitation_token',repeat('0',64)));
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'FORGED_AUTHORIZATION_ALLOWED'; end if;
  insert into auth.users(id,email,raw_user_meta_data,is_anonymous) values(user_id,email_value,
    jsonb_build_object('_app_invitation_id',reservation->>'invitationId','_app_invitation_token',reservation->>'authorizationToken','display_name','fixture'),false);
  if not exists(select 1 from auth.users where id=user_id and raw_user_meta_data = '{"display_name":"fixture"}'::jsonb) then
    raise exception 'SECRET_METADATA_NOT_REMOVED';
  end if;
  caught := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),email_value,
      jsonb_build_object('_app_invitation_id',reservation->>'invitationId','_app_invitation_token',reservation->>'authorizationToken'));
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'AUTHORIZATION_REPLAY_ALLOWED'; end if;
  perform public.finish_app_invitation((reservation->>'invitationId')::uuid,user_id,null);
  if not exists(select 1 from private.app_invitations where id=(reservation->>'invitationId')::uuid and status='sent') then
    raise exception 'SENT_AUDIT_MISSING';
  end if;
  update auth.users set email_confirmed_at=now() where id=user_id;
  if not exists(select 1 from private.app_invitations where id=(reservation->>'invitationId')::uuid and status='accepted') then
    raise exception 'ACCEPTANCE_AUDIT_MISSING';
  end if;
  expired_reservation := public.reserve_app_invitation(inviter_id,'expired-' || email_value);
  update private.app_invitations set authorization_expires_at=now()-interval '1 second'
    where id=(expired_reservation->>'invitationId')::uuid;
  caught := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'expired-' || email_value,
      jsonb_build_object('_app_invitation_id',expired_reservation->>'invitationId','_app_invitation_token',expired_reservation->>'authorizationToken'));
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'EXPIRED_AUTHORIZATION_ALLOWED'; end if;
  expired_reservation := public.reserve_app_invitation(inviter_id,'revoked-' || email_value);
  for loop_index in 1..10 loop
    insert into private.app_invitations(email,invited_by,status,authorization_hash)
    values('rate-' || loop_index || '-' || email_value,inviter_id,'failed','fixture');
  end loop;
  caught := false;
  begin
    perform public.reserve_app_invitation(inviter_id,'limited-' || email_value);
  exception when raise_exception then
    if sqlerrm <> 'APP_INVITATION_RATE_LIMIT' then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'RATE_LIMIT_NOT_ENFORCED'; end if;
  update private.app_inviter_permissions p set revoked_at=now() where p.user_id=inviter_id;
  caught := false;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'revoked-' || email_value,
      jsonb_build_object('_app_invitation_id',expired_reservation->>'invitationId','_app_invitation_token',expired_reservation->>'authorizationToken'));
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'REVOKED_INVITER_AUTHORIZATION_ALLOWED'; end if;
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
end;
$$;
rollback;
select 'app invitation checks passed; transaction rolled back' as result;

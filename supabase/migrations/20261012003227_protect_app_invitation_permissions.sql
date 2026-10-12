-- Server-managed tables also deny clients if future grants are added by mistake.
create policy app_inviter_permissions_deny_clients
on private.app_inviter_permissions as restrictive for all to anon, authenticated
using (false) with check (false);
create policy app_invitations_deny_clients
on private.app_invitations as restrictive for all to anon, authenticated
using (false) with check (false);

-- Campaign ownership cannot be used to take over an account with global access.
create function public.is_protected_app_inviter(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from private.app_inviter_permissions where user_id=p_user_id and revoked_at is null);
$$;
revoke all on function public.is_protected_app_inviter(uuid) from public, anon, authenticated;
grant execute on function public.is_protected_app_inviter(uuid) to service_role;

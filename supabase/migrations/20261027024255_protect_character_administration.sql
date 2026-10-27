-- GM-only character archival and deletion, including writes through legacy RPCs.
create or replace function private.guard_character_administration()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare required boolean := false; campaign uuid; actor uuid := auth.uid();
begin
  campaign := case when TG_OP = 'DELETE' then OLD.campaign_id else NEW.campaign_id end;
  if TG_TABLE_NAME = 'campaign_character_versions' then
    required := TG_OP = 'DELETE';
  elsif (case when TG_OP = 'DELETE' then OLD.fragment_kind else NEW.fragment_kind end) = 'character-core' then
    if TG_OP = 'DELETE' then required := true;
    elsif TG_OP = 'INSERT' then required := coalesce((NEW.payload->>'archived')::boolean, false);
    else required := coalesce((NEW.payload->>'archived')::boolean, false) is distinct from coalesce((OLD.payload->>'archived')::boolean, false);
    end if;
  end if;
  if required then
    -- A deleted parent campaign can cascade its children. Its own deletion is authorized separately.
    if not exists (select 1 from public.campaigns c where c.id = campaign) then
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end if;
    if actor is null then
      if current_user not in ('postgres', 'service_role', 'supabase_admin') then raise exception 'CHARACTER_ADMIN_REQUIRES_GM'; end if;
    elsif not exists (select 1 from public.campaign_members m where m.campaign_id = campaign and m.user_id = actor and m.role in ('owner', 'gm')) then
      raise exception 'CHARACTER_ADMIN_REQUIRES_GM';
    end if;
  end if;
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;
revoke all on function private.guard_character_administration() from public, anon, authenticated;
drop trigger if exists guard_character_administration on public.campaign_state_fragments;
create trigger guard_character_administration before insert or update or delete on public.campaign_state_fragments for each row execute function private.guard_character_administration();
drop trigger if exists guard_character_deletion on public.campaign_character_versions;
create trigger guard_character_deletion before delete on public.campaign_character_versions for each row execute function private.guard_character_administration();

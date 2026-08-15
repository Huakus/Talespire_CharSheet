-- Merchant inventories and funds live in campaign content. Publish changes so
-- open carts can refresh and revalidate against the latest committed revision.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'campaign_content_entries'
  ) then
    alter publication supabase_realtime add table public.campaign_content_entries;
  end if;
end $$;

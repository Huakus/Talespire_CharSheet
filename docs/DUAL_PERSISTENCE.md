# Dual persistence milestone

`DualCampaignRepository` is the safety bridge between the existing TaleSpire
storage and Supabase. It is implemented but is not selected by the application
yet.

## Invariants

- The existing repository is authoritative.
- A successful local save is returned even when Supabase is unavailable.
- Replication runs in an ordered background queue.
- Remote data is always a checked `talespire-toolset-campaign-v2` envelope.
- A remote document is overwritten only when it matches the expected local base
  or a previously verified remote revision.
- Unexpected remote content is reported as `diverged` and is never overwritten.

## Status states

- `idle`: there is no local campaign.
- `syncing`: a comparison or replication is running.
- `synced`: checksums match exactly.
- `diverged`: local and remote histories do not share the expected base.
- `missing`: the configured remote campaign document does not exist.
- `unavailable`: the backend could not be reached.

The next milestone is authentication and campaign selection. Only after a user
has a Supabase session and selects a campaign can the application safely bind a
`SupabaseCampaignReplica` and enable dual mode.

## Runtime modes

Set `VITE_PERSISTENCE_MODE` in the untracked `.env.local` file:

- `local`: only the existing TaleSpire/browser repository.
- `dual`: existing repository is authoritative; Supabase is a checked replica.
- `remote`: Supabase is authoritative. Updates from other users trigger a reload
  while the finer-grained UI refresh protocol is developed.

Dual mode now provides an onboarding screen for email/password authentication,
campaign selection or creation from the current local snapshot, persistent
binding, owner-only invitation by email and live replication status. It falls
back to local mode when remote setup fails or the user chooses local mode.

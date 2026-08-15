# Granular campaign persistence

Supabase no longer rewrites the complete campaign JSON for every edit. The
legacy `campaign_documents` row remains as an import/bootstrap source, while
runtime reads and saves use granular state.

## Storage model

- `campaign_state_fragments` stores independently versioned pieces identified
  by campaign, kind, parent and entity ID.
- `campaign_character_versions` stores each character's domain revision and
  timestamps.
- `campaigns.state_revision` is a small monotonic campaign signal used by
  Realtime; `state_updated_at` preserves the domain timestamp independently of
  server audit timestamps.

Fragment kinds separate campaign metadata, character core and runtime values,
individual actions/items/traits/notes/extras/spells, encounters, GM settings,
note groups and random tables. Ordered collections retain an explicit
`position`.

## Read, save and conflicts

`read_campaign_fragments` returns the state in one request. The client changes
only rows whose canonical payload or position changed and sends them together
to `save_campaign_fragment_batch`. The function locks the campaign briefly,
checks every expected fragment revision, applies the batch atomically and emits
a small campaign revision signal.

Two users editing different fragments can save without a conflict. If they
edit the same fragment from the same revision, the second save is rejected;
the client reads once, performs a three-way merge and retries only when the
changes are compatible. Direct writes to granular tables and the lower-level
save function are not granted to clients; membership is checked inside the
transactional RPC and reads remain protected by RLS.

New `campaign_documents` inserts are decomposed by a trigger. Existing rows
were backfilled by the migration, allowing campaign creation to retain its
current API while all subsequent editing uses granular persistence.

## UI and local optimizations

The Summary form autosaves after a short debounce only when dirty and skips
semantically unchanged submissions. Resource buttons flush that form only when
needed. TaleSpire blob persistence caches its byte usage after load/save, so it
does not re-read the entire local blob merely to update the storage meter.

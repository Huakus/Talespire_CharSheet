# Architecture foundation

The TypeScript application under `src/` is the only runtime implementation.
The previous standalone HTML and JavaScript application is not part of this
repository.

## Dependency direction

```text
UI / TaleSpire adapters
        ↓
application use cases
        ↓
domain schemas and operations
        ↓
shared deterministic primitives
```

Domain and application modules must not import browser DOM APIs, TaleSpire
globals, filesystem APIs or Git tooling. Infrastructure implements those
boundaries behind narrow ports.

## Current modules

- `domain/character/character-v2.ts`: validated v2 campaign/character types;
- `domain/gm`: typed GM workspace, shops and checklist content;
- `domain/character/edit-character.ts`: immutable core character edits and
  character-level optimistic revision checks;
- `application/campaign`: import, load and edit use cases;
- `application/ports`: persistence contracts with checksum expectations;
- `application/migration`: tolerant v1 reader and pure migration preview;
- `infrastructure/persistence`: checked localStorage and in-memory repository
  adapters plus a namespaced string-blob repository;
- `infrastructure/talespire`: narrow wrappers around the injected TaleSpire API;
- `ui/browser-app.ts`: the complete player-sheet browser adapter;
- `ui/gm-app.ts` and `ui/gm-tools-panel.ts`: encounter operation and the
  campaign/global GM workspaces;
- `shared/json.ts`: JSON cloning and canonical serialization;
- `shared/hash.ts`: SHA-256 checksums over canonical JSON;
- `shared/id.ts`: deterministic stable IDs generated from migration identity.

## Deliberate transitional choice

Collections have typed runtime models and stable IDs. Their original payloads
remain in `legacyData`/`collections` only as a lossless compatibility record;
runtime behavior does not depend on legacy positions.

## Persistence concurrency

Every loaded campaign is returned with a checksum. Saving requires either an
explicit `empty` expectation for the initial import, or the exact checksum that
was loaded. Character and campaign revisions provide readable monotonic
versions; the checksum protects the complete persisted value, including fields
that are not part of the current editor.

The checksum comparison and localStorage write execute in one exclusive
critical section. The browser adapter uses the Web Locks API to coordinate
pages from the same origin when available, with a shared in-process mutex as a
fallback.

The remote Supabase repository additionally retains recently loaded checksums
as merge bases. If another player saves first, it performs a three-way merge
between the loaded base, the local candidate and the latest remote document.
Independent JSON fields (including fields on different characters) are merged;
arrays of entities with stable IDs are merged per entity. Only paths changed to
different values by both clients are rejected and reported as conflicts.

The database still commits the complete campaign document atomically. The
granularity comes from deterministic client-side reconciliation followed by a
revision-checked retry, so existing remote campaigns require no schema migration.

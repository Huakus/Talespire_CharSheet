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
- `application/campaign`: create, load and edit use cases;
- `application/ports`: persistence contracts with checksum expectations;
- `infrastructure/persistence`: checked localStorage and in-memory repository
  adapters plus a namespaced string-blob repository;
- `infrastructure/talespire`: narrow wrappers around the injected TaleSpire API;
- `ui/browser-app.ts`: the complete player-sheet browser adapter;
- `ui/gm-app.ts` and `ui/gm-tools-panel.ts`: encounter operation and the
  campaign/global GM workspaces;
- `shared/json.ts`: JSON cloning and canonical serialization;
- `shared/hash.ts`: SHA-256 checksums over canonical JSON;
- `shared/id.ts`: random and deterministic stable ID helpers.

## Persistence concurrency

Every loaded campaign is returned with a checksum. Saving requires either an
explicit `empty` expectation for initial creation, or the exact checksum that
was loaded. Character and campaign revisions provide readable monotonic
versions; the checksum protects the complete persisted value, including fields
that are not part of the current editor.

The checksum comparison and localStorage write execute in one exclusive
critical section. The browser adapter uses the Web Locks API to coordinate
pages from the same origin when available, with a shared in-process mutex as a
fallback.

The remote Supabase repository decomposes campaign state into independently
versioned fragments: campaign metadata, character core/runtime data, each
collection entity, encounters and GM workspace entities. A save sends only the
changed fragments in one transactional RPC. Each fragment uses compare-and-set
revision checks, while a lightweight campaign revision is the Realtime signal.

Recently loaded checksums remain merge bases. If the same fragment was changed
concurrently, the repository loads the latest state once and performs the
existing three-way merge. Changes to independent fragments do not conflict.
Character and campaign domain timestamps are kept separate from server audit
timestamps so local and remote checksums remain stable in dual mode. See
[`GRANULAR_PERSISTENCE.md`](GRANULAR_PERSISTENCE.md).

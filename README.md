# TaleSpire Character Sheet

Clean TypeScript implementation of a D&D 5e character-sheet Symbiote for
TaleSpire.

## Development

```powershell
npm install
npm run dev:v2
```

Validation:

```powershell
npm run check
```

The application entry point is `v2.html`; production assets are generated in
`dist-v2/` and loaded by `manifest.json`.

Campaign data in `.localstorage/` is user-owned and intentionally excluded
from Git.

The first external-persistence milestone is documented in
[`docs/LOCAL_BACKEND.md`](docs/LOCAL_BACKEND.md). It adds an optional local
Supabase connectivity probe while keeping the current persistence authoritative.

The implemented safety contract for the next migration stage is described in
[`docs/DUAL_PERSISTENCE.md`](docs/DUAL_PERSISTENCE.md).

The campaign-scoped Supabase content catalog, provenance model and explicit
legacy import are documented in
[`docs/CAMPAIGN_CONTENT.md`](docs/CAMPAIGN_CONTENT.md).

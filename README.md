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

Campaign state is stored in granular, revision-checked Supabase fragments;
campaign-scoped catalog content is stored separately. The persistence model is
documented in [`docs/v2/GRANULAR_PERSISTENCE.md`](docs/v2/GRANULAR_PERSISTENCE.md),
and the catalog model in [`docs/CAMPAIGN_CONTENT.md`](docs/CAMPAIGN_CONTENT.md).
The read-only campaign lore browser is documented in
[`docs/CAMPAIGN_LORE.md`](docs/CAMPAIGN_LORE.md).

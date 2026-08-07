# Local backend milestone

This milestone proves that the Symbiote can call a local Supabase API without
changing the current source of truth.

## Prerequisite

Install Docker Desktop and ensure `docker --version` succeeds in a new terminal.

## Start and configure

```powershell
npm run backend:start
npm run backend:migrate
npm run backend:status
```

Copy `.env.example` to `.env.local`. Keep the local API URL and replace the
publishable key with the value printed by `npm run backend:status`.

## Exercise the probe

```powershell
npm run dev:v2
```

The page displays `Servidor externo conectado`, schema version and latency.
With `VITE_PERSISTENCE_MODE=dual`, the page then requests a Supabase account and
campaign selection. The existing TaleSpire/browser persistence remains
authoritative.

## Compare with current persistence

With the local backend running and `.env.local` configured:

```powershell
npm run test:integration
```

The integration test creates a campaign through the current
`LocalStorageCampaignRepository`, sends its checked envelope through Supabase
JSONB, decodes it with the current persistence decoder and requires both
snapshots to be exactly equal. The probe does not store campaign data.

The campaign-access integration test also creates three temporary authenticated
users. It verifies that a campaign member can read and update the shared
document, an external user cannot access it, and a stale write is rejected
instead of overwriting a newer revision.

`backend:migrate` applies migrations that were added after the local Docker
volume was created. It preserves existing local data. `backend:reset` rebuilds
the local database and is intentionally reserved for disposable test data.

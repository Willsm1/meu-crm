# WhatsApp 24x7 hardening

## What is already production-ready

- QR login and multi-session UI are loaded by the official CRM.
- Hosted gateway is used in production.
- Follow-up matching and history are integrated.
- Media persistence to Supabase is validated for image, audio, video and document.

## Direct persistence requirement

For the gateway to persist WhatsApp events and media even when no browser has the CRM open, Render must expose a server-only environment variable:

`SUPABASE_SERVICE_ROLE_KEY=<service role key do projeto Taurus>`

The key must never be shipped to the browser or committed to Git. With this variable present, gateway `direct-persist-v3` writes eligible 1:1 events and their media straight to Supabase as they arrive.

## Runtime persistence requirement

The gateway uses Baileys `useMultiFileAuthState` below `TAURUS_DATA_ROOT/auth` and temporary media below `TAURUS_DATA_ROOT/media`.
To preserve login across process restart/redeploy, the host must mount persistent storage and set `TAURUS_DATA_ROOT` to that mount path.

Recommended Render target after enabling a persistent disk:

`TAURUS_DATA_ROOT=/var/data/taurus`

## Acceptance gate

A deploy is 24x7-safe only when all three checks pass:

1. `/health` reports `version: direct-persist-v3` and `directPersistence: true`.
2. A message sent while the CRM browser is closed appears in Supabase/Follow-up after reopening.
3. A controlled Render restart reconnects the same WhatsApp session without generating a new QR.

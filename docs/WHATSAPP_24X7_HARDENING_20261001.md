# WhatsApp 24x7 hardening

## What is already production-ready

- QR login and multi-session UI are loaded by the official CRM.
- Hosted gateway is used in production.
- Follow-up matching and history are integrated.
- Media persistence to Supabase is validated for image, audio, video and document.

## Runtime persistence requirement

The gateway uses Baileys `useMultiFileAuthState` below `TAURUS_DATA_ROOT/auth` and temporary media below `TAURUS_DATA_ROOT/media`.
To preserve login across process restart/redeploy, the host must mount persistent storage and set `TAURUS_DATA_ROOT` to that mount path.

Recommended Render target after enabling a persistent disk:

`TAURUS_DATA_ROOT=/var/data/taurus`

A deploy must not be considered 24x7-safe until a controlled restart confirms the same WhatsApp session reconnects without a new QR.

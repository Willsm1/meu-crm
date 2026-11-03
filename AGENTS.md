# Taurus Magnum Engineering Rules

## Production invariants

Any change touching CRM, WhatsApp, Follow-up, Storage, auth or history must preserve all of these:

1. WhatsApp can pair/connect.
2. Connected session exposes the linked number.
3. Inbound text persists.
4. Outbound text sent from the linked mobile/device persists.
5. Follow-up consumes persisted interactions correctly.
6. Images persist and resolve from Supabase Storage.
7. Audio persists and resolves from Supabase Storage.
8. Existing conversation history remains queryable.
9. Observer/gateway processing is idempotent and does not create conflicting duplicates.
10. Tests never delete or rewrite existing production lead/history data.

## Hard rules

- Supabase is canonical; browser/local storage is cache only.
- crm.interactions is append-only.
- Never globally reset WhatsApp auth.
- Never run destructive tests against production Supabase or production Storage.
- Never mount production WhatsApp auth into staging.
- Realtime incidents are fixed before history/backfill work resumes.
- History/backfill must not control normal QR pairing or reconnect behavior.
- Bug fixes and behavior changes use RED -> GREEN tests.
- No direct production edits. Use a branch, PR and required checks.
- Do not claim a regression is fixed without fresh verification evidence.

## Required verification by subsystem

### WhatsApp realtime
Pair/connect, linked number, inbound, outbound linked-device/mobile, LID/PN mapping, reconnect/515.

### Media
Image, audio, retry, Storage registration, media lookup, local cleanup only after remote persistence.

### Follow-up
Inbound received-state, outbound cadence, correct lead/owner identity, no silent duplicate corruption.

### History
Queryability, idempotent append, isolation from realtime, no auth reset.

## Destructive actions

Any auth reset, production data deletion, schema-destructive migration or forced branch update requires explicit evidence, narrow scope and an explicit decision before execution.

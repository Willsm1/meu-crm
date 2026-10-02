# Taurus Magnum — ChatGPT Account Integration Readiness

Status: preparation only; production fallback remains unchanged.

## Production behavior preserved

The current button `Analisar com meu ChatGPT` keeps the validated handoff flow: Taurus composes CRM + WhatsApp + TXT memory + Taurus knowledge, copies the briefing, and opens ChatGPT in a new tab. No production behavior is replaced until the official OpenAI OAuth/client access required for a hosted commercial app is available and validated.

## Target architecture

Goal: each Taurus executive connects their own ChatGPT account and receives the model response inside the CRM.

Target flow:

1. Taurus executive signs in to Taurus normally.
2. Executive selects `Conectar ChatGPT`.
3. Taurus backend starts OpenAI OAuth/OIDC Authorization Code + PKCE.
4. Callback verifies issuer, state, nonce, ID token, client identity and the plan-usage permission made available by OpenAI for the Taurus integration.
5. Taurus associates the OpenAI subject/workspace authorization with the authenticated Taurus user.
6. Tokens remain server-side; never expose long-lived credentials in GitHub Pages/localStorage.
7. `Analisar com meu ChatGPT` sends the already validated Taurus briefing to the backend.
8. Backend performs the eligible Responses API call using that user's authorized ChatGPT-plan credential.
9. CRM renders the response in the existing analysis modal.
10. If OAuth/plan usage is unavailable, revoked or disabled, fallback remains `copy briefing + open ChatGPT`.

## Security invariants

- Do not store OpenAI client secrets or user OAuth tokens in the public GitHub repository.
- Do not store OAuth access/refresh credentials in browser localStorage.
- Bind OAuth transaction state to the logged-in Taurus user and expire it.
- Use PKCE, state and nonce.
- Validate ID token issuer/audience/signature against OpenAI discovery/JWKS.
- Never allow one Taurus user to reuse another user's ChatGPT authorization.
- Disconnect/revoke must remove the Taurus-side credential association.
- Admin may see connection status, but not user tokens.

## Backend location

Use a server-side component (Render service or dedicated backend/edge function). GitHub Pages remains frontend-only.

Suggested endpoints once OpenAI enables the Taurus client:

- `GET /api/chatgpt/status`
- `POST /api/chatgpt/connect`
- `GET /api/chatgpt/callback`
- `POST /api/chatgpt/disconnect`
- `POST /api/chatgpt/analyze`

All endpoints must authenticate the Taurus/Supabase user first.

## UI states

- `Não conectado` → button `Conectar ChatGPT`
- `Conectado` → show account label/status + `Desconectar`
- `Plano autorizado` → `Analisar com meu ChatGPT` returns result in CRM
- `Sem permissão / indisponível` → keep current handoff fallback

## Current external dependency

For a remotely hosted/commercial Taurus deployment, do not invent an OAuth `client_id`. Activation depends on OpenAI granting/approving the applicable Sign in with ChatGPT / ChatGPT-plan-usage integration for Taurus. Until then, only the validated fallback ships to production.

## Cutover checklist

When OpenAI access is granted:

1. Register exact Taurus callback URLs.
2. Store OAuth configuration only as server-side secrets.
3. Implement backend transaction/session storage.
4. Implement token verification and per-user credential association.
5. Implement Responses API call according to the current OpenAI plan-usage requirements.
6. Test with at least two different Taurus users/ChatGPT accounts.
7. Test revoke/disconnect and expired authorization.
8. Verify no cross-user leakage.
9. Run Production Regression Guard.
10. Only then switch the CRM button from handoff-first to connected-account-first.

Checkpoint date: 2026-10-02.

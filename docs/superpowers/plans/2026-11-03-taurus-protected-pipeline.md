# Taurus Protected Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Transform the Taurus Magnum repository into a protected development pipeline where regressions in WhatsApp realtime, media, Follow-up, and history are detected before production.

**Architecture:** Keep GitHub, Render and Supabase. Add repository rules, testable gateway helpers, deterministic integration fixtures, browser regression checks and staging gates. Production remains isolated from CI.

**Tech Stack:** GitHub Actions, Node.js 20+, Baileys, Supabase, Render, Python regression guards, Playwright/browser smoke tests.

**Spec:** `docs/superpowers/specs/2026-11-03-taurus-protected-pipeline-design.md`

## Global Constraints

- Do not modify production data from tests.
- Do not reset production WhatsApp auth.
- `crm.interactions` remains append-only.
- History/backfill code must not control normal pairing/realtime paths.
- All bug fixes and behavior changes require RED→GREEN tests.
- No direct production edits; changes flow through branch/PR.
- Existing `regression_guard.py` stays as structural defense, not the sole defense.

## Review Focus

- Duplicate message IDs arriving from observer and gateway must remain idempotent.
- Media download failure must not lose the text/conversation event.
- A 515 restart must reconnect without turning history sync on.
- LID/PN resolution must resolve direct-chat phone numbers without groups/status.
- History append events must never be classified as realtime unless explicitly eligible.

---

### Task 1: Repository engineering contract

**Files:**
- Create: `AGENTS.md`
- Create: `docs/engineering/regression-contract.md`
- Create: `docs/engineering/release-checklist.md`
- Create: `docs/engineering/rollback.md`

**Interfaces:**
- Produces: binding engineering rules used by humans and agents.

- [ ] Write docs defining production invariants and forbidden destructive actions.
- [ ] Verify docs contain all 10 regression contract items from the spec.
- [ ] Commit: `docs: add Taurus engineering guardrails`

### Task 2: Extract testable WhatsApp core helpers

**Files:**
- Create: `services/whatsapp-gateway/core.mjs`
- Create: `services/whatsapp-gateway/test/core.test.mjs`
- Modify: `services/whatsapp-gateway/server.mjs`
- Modify: `services/whatsapp-gateway/package.json`

**Interfaces:**
- Produces: `classifyEvent(e)`, `disconnectPolicy(code)`, `phoneFromMessageKey(key,lidPnMap)`, `shouldSyncHistory(mode)`.

- [ ] Write failing tests for realtime notify, linked-device outbound append, history append, groups/status exclusion, 515 restart policy and LID mapping.
- [ ] Run tests and verify RED.
- [ ] Extract minimal pure helpers and wire server to them.
- [ ] Run gateway unit suite and verify GREEN.
- [ ] Commit: `test: protect WhatsApp realtime core behavior`

### Task 3: Protect media persistence behavior

**Files:**
- Create: `services/whatsapp-gateway/media-core.mjs`
- Create: `services/whatsapp-gateway/test/media-core.test.mjs`
- Modify: `services/whatsapp-gateway/server.mjs`

**Interfaces:**
- Produces: retry/download decision helpers and cleanup policy.

- [ ] Write failing tests proving two download attempts, no cleanup before remote persistence, and event persistence independence from media failure.
- [ ] Verify RED.
- [ ] Implement minimal helpers and wire gateway.
- [ ] Verify GREEN plus Task 2 suite.
- [ ] Commit: `test: protect WhatsApp media persistence`

### Task 4: Add deterministic integration fixtures

**Files:**
- Create: `services/whatsapp-gateway/test/fixtures/*.json`
- Create: `services/whatsapp-gateway/test/integration.test.mjs`

**Interfaces:**
- Consumes Task 2/3 helpers.
- Produces regression coverage for inbound/outbound/image/audio/history/duplicate IDs.

- [ ] Add fixture-driven failing tests.
- [ ] Verify RED where behavior is not yet represented.
- [ ] Add minimal adapter seams needed for deterministic execution.
- [ ] Verify GREEN.
- [ ] Commit: `test: add WhatsApp integration regression fixtures`

### Task 5: Strengthen GitHub Actions

**Files:**
- Modify: `.github/workflows/regression-guard.yml`
- Modify: `tools/regression_guard.py`

**Interfaces:**
- Consumes gateway test commands from Tasks 2–4.

- [ ] Add gateway test job/step.
- [ ] Add invariant that production workflow cannot omit gateway tests.
- [ ] Run workflow-equivalent commands locally.
- [ ] Commit: `ci: require WhatsApp behavioral regression suite`

### Task 6: Follow-up behavioral contract

**Files:**
- Create: `tools/followup_contract_test.py` or equivalent isolated test.
- Modify: `.github/workflows/regression-guard.yml`

**Interfaces:**
- Produces checks that inbound updates received-state while outbound drives cadence.

- [ ] Encode current expected Follow-up semantics with deterministic data.
- [ ] Verify tests fail against intentionally wrong expectation, then pass against correct contract.
- [ ] Add to CI.
- [ ] Commit: `test: protect Follow-up interaction semantics`

### Task 7: Browser regression layer

**Files:**
- Create: `tests/e2e/`
- Create/modify test configuration as required.
- Modify: `.github/workflows/regression-guard.yml`

**Interfaces:**
- Produces UI checks for connection manager, Follow-up, conversation history and media preview.

- [ ] Add critical-path browser tests.
- [ ] Verify against local static/test harness.
- [ ] Add to CI.
- [ ] Commit: `test: add Taurus critical browser regressions`

### Task 8: Staging architecture and deployment guard

**Files:**
- Create: `docs/engineering/staging.md`
- Create or modify Render Blueprint/config only if it can be isolated safely.

**Interfaces:**
- Produces staging topology with separate credentials/auth/media.

- [ ] Document staging environment variables and isolation.
- [ ] Create staging services only with non-production credentials.
- [ ] Verify staging cannot mount production WhatsApp auth or Storage.
- [ ] Record service IDs and deployment process.
- [ ] Commit: `ops: define isolated Taurus staging`

### Task 9: Final regression gate

**Files:**
- Modify docs/checklists only as findings require.

**Interfaces:**
- Consumes all prior tasks.

- [ ] Run full suite.
- [ ] Deliberately break one assertion in each domain and prove CI/test catches it, then restore.
- [ ] Run clean suite again.
- [ ] Review branch against spec.
- [ ] Prepare PR; do not merge until checks are green.


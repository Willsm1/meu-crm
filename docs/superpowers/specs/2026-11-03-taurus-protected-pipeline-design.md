# Taurus Magnum Protected Pipeline — Design

## Intent

Criar uma camada de engenharia que permita continuar evoluindo o Taurus Magnum sem transformar produção em ambiente de teste e sem repetir regressões entre WhatsApp, mídia, histórico, Follow-up e CRM.

O objetivo não é reconstruir o produto nem migrar de plataforma. O objetivo é preservar a arquitetura atual (GitHub + Render + Supabase) e adicionar isolamento, testes comportamentais, staging, revisão e rollback previsível.

## Goals

1. Toda mudança relevante passa por branch e Pull Request.
2. Nenhuma alteração de produção entra sem CI verde.
3. O CI valida comportamento, não apenas presença de arquivos/strings.
4. WhatsApp realtime, mídia, histórico e Follow-up são tratados como subsistemas independentes, com contratos explícitos.
5. O sistema impede regressões conhecidas antes do merge.
6. Staging passa a receber as mudanças antes de produção.
7. Cada release tem checkpoint e caminho de rollback documentado.
8. Qualquer agente/IA que trabalhar no repositório recebe as mesmas regras por meio de documentação de engenharia.

## Non-goals

- Reescrever o CRM.
- Migrar o Taurus para Replit, Lovable, Firebase ou outra plataforma.
- Alterar regras comerciais do Follow-up nesta etapa.
- Implementar o catch-up de histórico agora.
- Substituir Supabase, Render ou GitHub.
- Criar uma nova arquitetura de WhatsApp enquanto o pipeline não estiver protegido.

## Anti-goals

O projeto falha mesmo que “os testes passem” se:
- produção continuar sendo usada para descobrir regressões;
- os testes só verificarem strings/arquivos;
- uma mudança em histórico puder quebrar QR, mídia ou realtime sem bloquear o merge;
- observer e gateway puderem gerar duplicações silenciosas;
- staging compartilhar estado destrutivo com produção;
- releases não tiverem rollback claro.

## Existing constraints

- GitHub repository: `Willsm1/meu-crm`.
- Production branch: `main`.
- Existing workflow: `.github/workflows/regression-guard.yml`.
- Existing guard: `tools/regression_guard.py`.
- WhatsApp gateway lives under `services/whatsapp-gateway/`.
- Supabase remains the canonical data source.
- Production WhatsApp authentication/state must never be globally reset by tests.
- `crm.interactions` remains append-only.
- Existing production data and media must not be modified by CI.
- Backfill/history work remains isolated from realtime connection work.

## Approaches considered

### 1. Harden current regression guard only
Pros: fastest and smallest change.
Cons: still heavily static; cannot prove real behavior across subsystems.

Rejected because it would not prevent the class of regressions already observed.

### 2. Protected pipeline with behavioral tests and staging — selected
GitHub remains the source of truth. Changes run through isolated branches, CI, behavioral test suites, staging, review and controlled promotion.

Selected because it protects the current investment without forcing a rewrite.

### 3. Rebuild/migrate to a new development platform
Pros: clean slate.
Cons: high migration risk, duplicated work and no automatic guarantee of fewer regressions.

Rejected because the main problem is process and verification, not the hosting platform.

## Architecture

The pipeline will have four independent verification domains.

### A. CRM / Follow-up
Validates:
- inbound interaction updates expected lead state;
- outbound interaction updates cadence;
- received contact does not incorrectly mark outbound cadence;
- append-only interaction history is preserved;
- duplicate leads do not silently corrupt follow-up calculations.

### B. WhatsApp realtime
Validates:
- pairing state transitions;
- 515 restart behavior;
- inbound text;
- outbound text from linked device/mobile;
- LID-to-phone resolution;
- reconnect does not enable history sync accidentally;
- groups/status/newsletters remain excluded.

### C. Media
Validates:
- image download;
- audio download;
- retry behavior;
- Supabase Storage registration;
- conversation event remains linked to media asset;
- local cache cleanup only occurs after successful remote persistence;
- media failure does not discard text/event persistence.

### D. History / catch-up
Validates separately:
- history batches never block realtime;
- backfill classification does not change live-message classification;
- manual/automatic catch-up cannot reset auth;
- historical messages remain idempotent;
- catch-up can be disabled without changing core capture.

No history/catch-up change may share an untested code path with QR pairing or normal reconnect.

## Required regression contract

Every change touching WhatsApp, CRM, Follow-up, storage, auth or history must preserve:

1. WhatsApp session can pair/connect.
2. Connected session exposes the linked number.
3. Inbound text persists.
4. Outbound mobile/linked-device text persists.
5. Follow-up consumes the persisted interaction correctly.
6. Image persists and can be resolved from Storage.
7. Audio persists and can be resolved from Storage.
8. Existing conversation history remains queryable.
9. Observer/gateway do not create conflicting duplicates.
10. No existing lead/history data is deleted or rewritten by tests.

## Test strategy

### Static guards
Keep the existing `regression_guard.py` for structural invariants.

### Unit tests
Extract pure helpers from the gateway where feasible:
- message classification;
- phone/LID resolution;
- media metadata;
- backfill eligibility;
- restart decision.

These tests run without WhatsApp or Supabase.

### Integration tests
Use deterministic fixtures for:
- `messages.upsert` inbound/outbound;
- image/audio messages;
- 515 disconnect;
- history append batches;
- duplicate message IDs.

External calls are routed through test adapters so CI never touches production credentials.

### Contract tests for Supabase
Run against a non-production environment or isolated test schema/project.
Verify RPC and view contracts used by the application.

### Browser / E2E tests
Use Playwright for critical UI flows:
- connection manager states;
- Follow-up KPIs/cadence;
- conversation history;
- media preview;
- error states.

## Staging

Create a separate Render staging service for the gateway and a separate staging frontend/environment.

Preferred data isolation:
- separate Supabase staging project.

Minimum acceptable fallback:
- dedicated non-production schema/data fixtures with credentials that cannot write to production.

Production WhatsApp auth directories and production Storage must never be mounted into staging.

## Git workflow

- `main` remains production.
- Work happens on feature/fix branches.
- Pull Request required.
- Required CI checks must pass.
- No direct production code edits.
- Gateway release branch must not be used as an unreviewed long-lived production bypass.
- Every deployable change has a PR-linked commit.

## Repository rules for agents

Create `AGENTS.md` documenting:
- production invariants;
- forbidden destructive actions;
- TDD requirement for bug fixes/features;
- required test suites by subsystem;
- no completion claims without verification;
- no history/backfill edits during realtime incidents;
- scoped auth reset only after evidence and explicit decision.

Create `docs/engineering/` for:
- regression contract;
- release checklist;
- rollback procedure;
- staging architecture.

## CI gates

At minimum:
1. syntax/lint;
2. current regression guard;
3. gateway unit tests;
4. integration fixtures;
5. Follow-up tests;
6. media tests;
7. history isolation tests;
8. browser smoke/E2E where applicable.

A failed required check blocks merge.

## Release flow

1. Feature/fix branch.
2. TDD implementation.
3. Local/CI verification.
4. PR review.
5. Deploy to staging.
6. Staging smoke against regression contract.
7. Merge to `main`.
8. Production deploy.
9. Post-deploy smoke.
10. Record checkpoint commit/deploy ID.

## Rollback

Every production release records:
- Git commit SHA;
- Render deploy ID;
- schema migration IDs, if any;
- affected subsystem.

Rollback must prefer code rollback over data mutation.

Database migrations that are not safely reversible require an explicit forward-fix plan before merge.

## Initial implementation order

1. Freeze new feature work temporarily.
2. Add engineering rules and regression contract.
3. Add test framework for gateway.
4. Pin current realtime behavior with tests.
5. Pin media behavior with tests.
6. Pin Follow-up behavior with tests.
7. Pin history isolation behavior with tests.
8. Add Playwright critical-path coverage.
9. Create staging environment.
10. Make all checks required for production PRs.
11. Resume WhatsApp history/catch-up work only after the protected pipeline is green.

## Success criteria

The pipeline is considered ready when a deliberate regression in each of the four domains is detected by CI before merge, and the clean baseline passes all required checks without touching production data.

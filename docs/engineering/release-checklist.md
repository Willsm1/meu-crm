# Taurus Magnum Release Checklist

Before merge:
- Feature/fix branch used.
- RED -> GREEN evidence exists for behavior changes.
- Structural regression guard passes.
- Gateway unit/integration tests pass.
- Follow-up contract tests pass.
- Media tests pass.
- History isolation tests pass.
- Browser critical-path checks pass.
- No production secrets or auth material are used by CI.
- PR review completed.

Before production:
- Staging deploy succeeds.
- Staging smoke verifies the regression contract.
- Commit SHA and staging deploy ID recorded.

After production:
- Pair/connect smoke.
- Inbound text smoke.
- Outbound mobile smoke.
- Follow-up smoke.
- Image smoke.
- Audio smoke.
- Existing history query smoke.
- Production commit SHA and Render deploy ID recorded.

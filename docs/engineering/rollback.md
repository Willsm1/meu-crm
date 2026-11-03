# Taurus Magnum Rollback Procedure

Prefer code rollback over data mutation.

Record for every production release:
- Git commit SHA.
- Render deploy ID.
- Database migration IDs, if any.
- Affected subsystem.

Rollback rules:
1. Do not delete production interactions/history to fix application behavior.
2. Do not globally reset WhatsApp auth.
3. Roll back the smallest affected code surface.
4. If a migration is not safely reversible, prepare a forward-fix before merge.
5. After rollback, rerun the regression contract smoke checks.

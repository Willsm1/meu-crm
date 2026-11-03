# GitHub Branch Protection

A branch `main` deve bloquear merge enquanto o check abaixo não estiver verde:

- Workflow: `Production Regression Guard`
- Job/check: `regression-guard`

Configuração recomendada:
- Require a pull request before merging.
- Require status checks to pass.
- Exigir `regression-guard`.
- Require branches to be up to date before merging.
- Bloquear force-push.
- Bloquear deleção da branch.
- Não permitir bypass de status check para mudanças normais.

A branch histórica `release/taurus-magnum-rc-20261001` não deve permanecer como bypass permanente. Após o gateway atual estar sincronizado e validado em `main`, o Render deve ser migrado para deployar a fonte canônica protegida.

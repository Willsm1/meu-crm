# Taurus Magnum CRM — Pré-rollout 20/09/2026

## Estado promovível

Base de código: commit `36397437f0d829b5d83e55bbec9e238aae4929fc`.

Hotfixes de banco já aplicados em produção:
- `archive_lead`: arquivamento sem intenção explícita é ignorado, protegendo clientes com JS antigo/cacheado contra exclusão acidental durante edição.
- `create_lead_v2`: quando o mesmo `local_id` reaparece com dados diferentes, o registro existente é atualizado em vez de criar/arquivar incorretamente.

## Auditoria operacional

Usuários ativos testados: Will, Beatriz Oliveira, Eduardo Ferraz, Guilherme Carvalho, Joseph Boeta, Pedro D Aloisio e Rafael Costa.

Para cada usuário foi validada, em transação com rollback, a sequência:
`criar lead -> editar lead -> registrar interação -> resolver por telefone`.

Resultado: PASS para os 7 usuários; o `resolve_lead_by_phone` retornou o mesmo lead criado pelo próprio usuário.

## Isolamento e integridade

- RLS ativo em `leads`, `lead_assignments` e `interactions`.
- `v_followup` usa `security_invoker=true`.
- Executivos veem apenas leads atribuídos a si.
- Mesmo telefone em responsáveis diferentes permanece como leads independentes.
- 0 assignments órfãos.
- 0 interações órfãs.
- 0 leads ativos com múltiplos responsáveis atuais.
- 0 leads ativos sem responsável.
- 0 grupos duplicados por telefone dentro do mesmo responsável.

## Follow-up

Regra operacional vigente no frontend:
- Interações
- Em negociação
- Proposta enviada
- Gold apenas quando a opção "Incluir Gold" estiver ativada.

A cadência usa histórico de interações por responsável; eventos brutos não inflacionam o funil do Dashboard.

## Restrição do piloto

Exclusão/arquivamento permanece deliberadamente protegida até existir fluxo explícito validado ponta a ponta. Durante o piloto, criar, editar, mudar status/telefone, registrar interações, localizar por telefone e usar Follow-up estão autorizados; exclusão não deve ser parte do protocolo de teste.

## Critério de distribuição

Antes da distribuição da extensão:
1. usar apenas a build mais recente validada;
2. confirmar autenticação por executivo;
3. validar que lead novo cai na carteira do próprio usuário;
4. validar atualização de status/telefone após refresh;
5. validar que interações alimentam apenas o histórico do mesmo responsável;
6. validar entrada no Follow-up após status elegível.

# Taurus Magnum — Extensão 2.0.15 — Ligações Supabase-only

## Objetivo
Eliminar a camada local do fluxo de ligações para impedir divergência entre extensão, navegador e CRM.

Fluxo alvo:

`Ligação feita -> RPC record_call_at -> confirmação Supabase -> releitura de crm.calls -> UI`

## Regra estrutural

Para ligações, `chrome.storage.local` deixa de ser fonte, fila, cache ou confirmação.

- Nenhuma ligação nova é gravada em `crm_calls` local.
- Ligações antigas eventualmente existentes no storage local não são apagadas nesta versão; ficam apenas como backup inerte e não participam mais do fluxo.
- A UI de "Ligações hoje" é reconstruída a partir de `crm.calls` no Supabase.
- Em falha de rede/backend, a extensão NÃO apresenta a ligação como salva. Exibe falha explícita.
- Retry futuro deve reutilizar o mesmo `client_event_id`; não criar uma segunda fonte local de verdade.

## Escopo permitido

Arquivos funcionais alterados no pacote candidato:

- `content.js`
- `supabase.js`
- `bridge.js`
- `manifest.json`

Não alterar outras funções da extensão nesta correção.

## Gates obrigatórios

1. Sintaxe JS válida.
2. Manifest válido e versão 2.0.15.
3. Ausência de referências ativas a `crm_calls`, `CALLS_BASE`, `callsKey`, `JSON.stringify(calls)` no fluxo da extensão/bridge.
4. `registerCall()` não pode inserir em array/cache local antes da confirmação remota.
5. Gravação deve usar `record_call_at`.
6. Após sucesso, UI deve reler `crm.calls` via Supabase.
7. Erro de rede/401/403/UUID deve deixar claro que a ligação NÃO foi registrada.
8. Dedupe do backend deve impedir duplicação do mesmo `client_event_id`.
9. Testar duas contas e dois leads distintos.
10. Executar regressão das funções existentes da 2.0.13 antes de liberar.

## Critério de liberação

A 2.0.15 só pode ser promovida a estável depois de teste manual em navegador real e confirmação explícita do usuário. Até lá é candidata.

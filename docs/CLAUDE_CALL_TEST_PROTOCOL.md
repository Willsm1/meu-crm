# Taurus Magnum — protocolo rápido de teste de ligações (Claude)

## Objetivo
Descobrir rapidamente onde uma ligação se perde no fluxo:

`WhatsApp -> extensão -> Supabase -> CRM`

Não alterar `main`. Esta branch é apenas diagnóstico/piloto.

## Estado conhecido antes do teste

- Extensão estável anterior: `2.0.13 PILOTO`.
- Bug reproduzido: a UI da extensão mostra `Ligação feita` e contabiliza `Ligações hoje`, mas o evento não aparece persistido no CRM.
- Causa encontrada no código 2.0.13: `registerCall()` grava somente no cache local (`crm_calls:<uid>`). Não existe chamada ao Supabase nesse caminho.
- O banco já possui `crm.calls`, mas não havia RPC de gravação de ligação para a extensão.
- Foi criado no backend o RPC autenticado `crm.record_call_at(...)`, com deduplicação por `client_event_id`, vínculo a `crm.interactions` e checagem de permissão sobre o lead.
- Teste transacional com `BEGIN/ROLLBACK` confirmou que a gravação funciona e o rollback deixou zero resíduos.

## Build sob teste

Use a extensão `2.0.14 DIAGNOSTICO LIGACOES`.

Mudança esperada:

1. `registerCall()` continua atualizando a UI local imediatamente.
2. Em seguida chama `CRM_SB.registrarLigacao(...)`.
3. `registrarLigacao()` envia `POST /rest/v1/rpc/record_call_at`.
4. Resultado local deve mudar de `…` para:
   - `☁` = sincronizado com Supabase;
   - `⚠` = falhou, com motivo disponível no log/título.

## Regra de velocidade

Faça primeiro testes que eliminam classes inteiras de erro. Pare ao encontrar um erro determinístico. Não repita manualmente a mesma sequência sem mudar uma variável.

## Sequência de teste

### Bloco A — preflight (sem gravar ligação)

1. Confirmar que a extensão carregada mostra versão `2.0.14`.
2. Confirmar login da extensão na mesma conta do CRM.
3. Abrir um contato que já exista no CRM/Supabase.
4. Confirmar que o painel mostra o lead e não exibe erro de Supabase.
5. Se houver console disponível no contexto da extensão, executar `await CRM_SB.diagnostico()` e registrar:
   - `tokenUtilizavel`;
   - `perfil`;
   - `ultimoErro`;
   - `fila`.

Falha aqui = não testar gravação ainda.

### Bloco B — uma ligação real

Em um lead que o usuário autorizar testar:

1. Clicar `Ligação feita`.
2. Escolher `Caixa Postal`.
3. Observar a linha `Ligações hoje`.
4. Resultado esperado em até poucos segundos: `Caixa Postal ☁`.
5. O log deve mostrar `☁ ligação sincronizada`.
6. Se aparecer `⚠`, registrar exatamente o texto do erro e interromper.

### Bloco C — matriz de resultados

Somente se o bloco B passar. Em chamadas reais/permitidas, testar os quatro resultados em momentos distintos:

- `Atendeu`
- `Caixa Postal`
- `Perdido`
- `Número Errado`

Para cada um, capturar:

- contato;
- horário;
- resultado escolhido;
- indicador final `☁` ou `⚠`;
- eventual erro.

Não gerar chamadas fictícias em massa no banco de produção.

### Bloco D — idempotência/dedupe

Objetivo: garantir que retry do mesmo evento não duplica.

Não faça múltiplos cliques na UI. Se houver acesso ao contexto da extensão e ao mesmo `eventId`, reenviar exatamente o mesmo payload uma única vez. Resultado esperado do backend: `existente`, sem criar segunda linha.

### Bloco E — troca de usuário

Rodar no máximo com 2 contas reais:

1. usuário A registra uma ligação em lead próprio;
2. usuário B registra uma ligação em lead próprio;
3. cada ligação deve aparecer associada ao usuário correto;
4. nenhuma conta deve conseguir gravar em lead sem permissão.

### Bloco F — recuperação de erro

Simular apenas erros reversíveis e seguros:

- ficar offline antes de registrar uma ligação;
- voltar online;
- observar se aparece `⚠` e se o erro é explícito.

Nesta versão diagnóstica ainda não assumir retry automático de chamadas. O objetivo é localizar a falha com clareza antes de implementar fila de retry.

## Testes lógicos paralelos, sem banco

Enquanto o teste de navegador ocorre, revisar em paralelo:

1. geração de `eventId` — deve ser única por clique;
2. UUID — chamada remota só pode ocorrer com `lead._uuid`;
3. token — `registrarLigacao()` precisa usar token autenticado atual;
4. schema — headers precisam usar `Content-Profile: crm` e `Accept-Profile: crm`;
5. payload — `p_result` deve ser exatamente um dos quatro valores do enum;
6. timestamp — enviar ISO com timezone;
7. dedupe — `p_client_event_id` deve permanecer igual em retry do mesmo evento;
8. isolamento — cache local continua namespaced por usuário.

## Critérios de aprovação

A correção só está aprovada se:

- UI local registra a ligação;
- indicador muda para `☁`;
- Supabase contém a chamada vinculada ao lead e usuário corretos;
- existe interação `call` vinculada;
- nenhum duplicado aparece para o mesmo `client_event_id`;
- outro usuário não consegue gravar em lead sem permissão;
- demais funções da extensão 2.0.13 continuam funcionando.

## Critérios de parada imediata

Pare e reporte sem tentar remendar se ocorrer qualquer um:

- lead sem `_uuid` mesmo vindo do Supabase;
- HTTP 401/403;
- erro de enum/resultado;
- chamada vinculada a usuário ou lead errado;
- duplicação com mesmo `client_event_id`;
- alteração inesperada de status do lead;
- perda de sessão/login;
- regressão na criação/edição de lead.

## Formato de relatório para devolver

Use exatamente:

```text
BUILD: 2.0.14
CONTA:
LEAD:
RESULTADO DA LIGAÇÃO:
UI LOCAL: PASS/FAIL
SYNC SUPABASE: PASS/FAIL
INDICADOR: ☁ / ⚠ / nenhum
ERRO EXATO:
DUPLICOU: SIM/NÃO
STATUS DO LEAD MUDOU SOZINHO: SIM/NÃO
OBSERVAÇÃO:
```

No final, entregar apenas:

- falhas reproduzíveis;
- hipótese de causa por falha;
- evidência observada;
- menor correção possível;
- risco de regressão.

# Taurus Magnum — Extensão 2.0.16 — protocolo de teste

## Objetivo
Validar a candidata 2.0.16 sem tocar na `main` e sem promover pacote antes de teste real.

Mudanças desta candidata:

1. Supabase passa a ser a única fonte de verdade para leads e ligações na extensão.
2. A fila comercial local e o cache local de leads deixam de participar do fluxo.
3. O bridge da extensão para a página GitHub Pages foi removido do pacote.
4. A extensão continua podendo guardar apenas sessão e preferências de interface pequenas.
5. Abaixo de `Moradia / Investimento` entram quatro botões pequenos: `SCP`, `Lanç`, `Obras`, `Pronto`.
6. `Pronto` e `Moradia` deixam de ser opções selecionáveis de status comercial na extensão.
7. O novo campo canônico é `crm.leads.perfil_produto`, limitado a `SCP | Lanç | Obras | Pronto`.
8. A gravação desse campo usa o RPC autenticado `crm.set_lead_profile_product`.

## Backend já preparado

Migração aditiva aplicada em produção:

- coluna nullable `crm.leads.perfil_produto`;
- constraint de domínio para os quatro valores;
- RPC `crm.set_lead_profile_product(uuid,text)` com autenticação, visibilidade e isolamento por executivo.

Teste transacional com `BEGIN/ROLLBACK` no lead `Joseph Novo` confirmou gravação de `Obras`; após `ROLLBACK`, o valor voltou a `NULL`. Nenhum resíduo.

## Regra de segurança sobre os status antigos

Existem atualmente 27 leads ativos usando status legado:

- `Pronto`: 14
- `Moradia`: 13

NÃO migrar esses 27 registros automaticamente neste teste. A candidata apenas deixa de oferecer esses status para novas alterações na extensão. A migração dos 27 será um passo separado, com regra explícita e rollback, antes de remover definitivamente as colunas/visões de Kanban correspondentes no CRM.

## Artefato sob teste

Nome: `taurus-magnum-webstore-2.0.16-supabase-first-profile.zip`

SHA-256 esperado:

`0782002815a4696f2f089c5690ca240bf0feed8f625f3650ed13aef8d6fe9837`

Se o hash divergir, parar.

## Ordem dos testes

### A. Preflight

1. Confirmar versão `2.0.16` em `chrome://extensions`.
2. Confirmar que a conta logada é a mesma do CRM.
3. Abrir um lead existente e verificar que os dados aparecem mesmo sem qualquer base local.
4. Confirmar que o painel mostra `Moradia / Investimento` e abaixo `SCP / Lanç / Obras / Pronto`.
5. Confirmar que `Moradia` e `Pronto` NÃO aparecem em `Alterar etapa`.

### B. Supabase-first

1. Abrir 10 contatos já existentes em sequência.
2. Em cada troca, validar que o lead correto veio do Supabase.
3. Não aceitar fallback de lead vindo de `chrome.storage`.
4. Colocar a rede offline e abrir um contato novo: a extensão deve mostrar indisponibilidade e NÃO cadastrar localmente.
5. Voltar a rede e repetir: o contato deve ser resolvido/cadastrado normalmente.

### C. Perfil principal

Em lead autorizado:

1. marcar `Moradia`;
2. recarregar a aba;
3. reabrir o lead e confirmar `Moradia` vindo do Supabase;
4. trocar para `Investimento` e repetir;
5. clicar novamente no mesmo botão e validar a regra atual de desmarcar, se mantida.

### D. Perfil de produto

No mesmo lead, testar em sequência, um por vez:

- SCP
- Lanç
- Obras
- Pronto

Para cada valor:

1. clicar;
2. aguardar confirmação;
3. recarregar a página inteira;
4. reabrir o mesmo contato;
5. confirmar que o botão correto continua ativo;
6. validar diretamente no Supabase `crm.leads.perfil_produto`;
7. confirmar que o `status` comercial não mudou.

Depois clicar novamente no valor ativo para desmarcar e confirmar `perfil_produto IS NULL`.

### E. Ligações — regressão da 2.0.14/2.0.15

Repetir pelo menos:

- Atendeu
- Caixa Postal

Esperado:

- gravação em `crm.calls`;
- `interaction_id` válido;
- sem duplicata;
- sem mudança de status;
- UI relê as ligações do Supabase.

### F. Criação e edição de lead

1. Criar um lead de teste autorizado.
2. Confirmar que ele aparece no Supabase.
3. Atualizar região, perfil e anotação.
4. Recarregar a aba.
5. Confirmar persistência sem depender de cache local.
6. Confirmar que erro de rede NÃO cria lead fantasma local.

### G. Isolamento de usuários

Com duas contas reais:

1. usuário A abre lead próprio;
2. usuário B abre lead próprio;
3. cada um altera `perfil_produto` no próprio lead;
4. tentativa de B escrever no lead de A deve falhar;
5. nenhum dado da conta A pode aparecer ao trocar para B.

### H. Regressão visual

Checar:

- painel abre/minimiza;
- região;
- notas;
- status comerciais existentes;
- botão de ligação;
- login/logout;
- troca de conversa;
- contato estrangeiro;
- grupo não tratado como lead;
- painel não pisca dados do contato anterior.

## Teste acelerado

Priorizar classes de falha em paralelo:

- 100 trocas de conversa alternando 5 leads conhecidos;
- 100 leituras do mesmo lead após reload, verificando estabilidade dos campos;
- 100 payloads sintéticos apenas no teste lógico local, sem gravar produção;
- repetir RPC idempotente de ligação com o mesmo `client_event_id` apenas uma vez para dedupe;
- nunca gerar milhares de writes reais no Supabase.

Pare no primeiro erro determinístico e isole a variável antes de continuar.

## Critérios de bloqueio

Bloquear a 2.0.16 se ocorrer qualquer um:

- dado comercial reaparecer de cache local;
- criação local sem confirmação do Supabase;
- perda de login inesperada;
- perfil de produto alterar status;
- usuário escrever em lead de outro usuário;
- ligação duplicar;
- lead incorreto aparecer ao trocar de conversa;
- `Pronto` ou `Moradia` voltarem como opção de status na extensão;
- qualquer regressão em criação, edição, região, notas ou ligação.

## Formato do relatório

```text
BUILD: 2.0.16
HASH: PASS/FAIL
CONTA:
LEAD:
SUPABASE-FIRST: PASS/FAIL
CACHE LOCAL DE LEADS USADO: SIM/NÃO
MORADIA/INVESTIMENTO: PASS/FAIL
SCP/LANÇ/OBRAS/PRONTO: PASS/FAIL
STATUS MUDOU SOZINHO: SIM/NÃO
LIGAÇÕES: PASS/FAIL
CRIAÇÃO/EDIÇÃO: PASS/FAIL
ISOLAMENTO: PASS/FAIL/NÃO TESTADO
OFFLINE: PASS/FAIL/NÃO TESTADO
ERRO EXATO:
EVIDÊNCIA:
```

Não corrigir a `main`. Se encontrar erro, relatar a menor correção possível e o risco de regressão.
# Claude Results — Extensão 2.0.16

CICLO: 2026-09-21 (autopilot TM216)
BRANCH: `test-extension-supabase-first-profile-2.0.16`
MAIN: não tocada
27 LEADS LEGADOS: não migrados (confirmado intactos — ver Bloco S)

---

## BLOCO S — Contrato de backend no Supabase (read-only) — PASS

Projeto: `taurus-magnum-crm` (`dbnjlvnkmgbiknhbefys`, sa-east-1, PG 17.6.1).
Todas as verificações abaixo foram feitas por leitura de catálogo/SELECT. Nenhum write, nenhum DDL, nenhuma migração.

| Check | Resultado | Evidência |
|---|---|---|
| Coluna `crm.leads.perfil_produto` | PASS | `text`, `is_nullable=YES`, sem default |
| Constraint de domínio | PASS | `leads_perfil_produto_chk`: `perfil_produto IS NULL OR perfil_produto = ANY (ARRAY['SCP','Lanç','Obras','Pronto'])` |
| RPC `crm.set_lead_profile_product(uuid,text)` | PASS | `SECURITY DEFINER`, `SET search_path TO ''`, exige `auth.uid()`, perfil ativo + org ativa, `can_see_lead()`, e para `role='executivo'` exige assignment ativo próprio |
| Grants do RPC | PASS | `postgres:EXECUTE, authenticated:EXECUTE` — `anon` sem EXECUTE |
| Validação de valor no RPC | PASS | normaliza vazio→NULL e rejeita fora de `SCP/Lanç/Obras/Pronto` com `22023` |
| Perfil de produto altera status? | NÃO | o RPC só executa `update crm.leads set perfil_produto=...`; o trigger `leads_log_status` é `AFTER INSERT OR UPDATE OF status, is_critical` — não dispara |
| Outro caminho de escrita em `perfil_produto` | NENHUM | `update_lead_by_id`, `update_lead_fields`, `create_lead_v2`, `import_lead` não mencionam a coluna; grant `UPDATE` de `authenticated` em `crm.leads` cobre apenas: `data_entrada, email, empresa, nome, notas, origem, perfil, regiao, status, telefone, valor` (perfil_produto **fora**) |
| Resíduo do teste `BEGIN/ROLLBACK` (Joseph Novo) | LIMPO | `perfil_produto` = NULL em 1885/1885 leads ativos |
| 27 leads legados | INTACTOS | `Pronto`=14, `Moradia`=13 (total 27), nenhum alterado |
| Enum `crm.lead_status` | inalterado | `Novo | Contato feito | Interações | Em negociação | Proposta enviada | Fechado | Perdido | Gold ⭐ | Manter Atualizado | Pronto | Moradia | Crítico` — remoção de `Pronto`/`Moradia` é regra de UI da extensão, não do banco (correto para esta candidata) |
| RPC `crm.record_call_at(uuid, call_result, timestamptz, text)` | PASS | `SECURITY DEFINER`; exige `client_event_id`; janela `-31d / +5min`; `can_see_lead()` |
| Idempotência de ligação | PASS (lógico) | lookup prévio por `calls.legacy_id = client_event_id`; `on conflict on constraint int_dedupe_uk do nothing` (`organization_id, lead_id, dedupe_key`) e `calls_legacy_uk` (`organization_id, legacy_id`); retorna `existente` sem criar duplicata |
| Ligação altera status? | NÃO | `record_call_at` não escreve em `crm.leads` |
| RLS | PASS | `crm.leads` (`leads_select[r]`, `leads_update[w]`), `crm.calls`, `crm.interactions`, `crm.lead_assignments`, `crm.profiles` — todas com RLS ativo; sem policy de INSERT/DELETE (escrita só via RPC) |
| `anon` em `crm.leads` | SEM ACESSO | nenhum grant de coluna para `anon` |

### Observações (não bloqueantes)
1. `status` **é** diretamente atualizável por `authenticated` (grant de coluna). Ou seja, o banco não impede gravar `Pronto`/`Moradia` como status — o bloqueio é só na UI da extensão, exatamente como o protocolo define. Quando os 27 forem migrados, vale avaliar mover o status para RPC com whitelist.
2. Advisor de segurança: `crm.duplicate_groups`, `crm.duplicate_group_members`, `crm.duplicate_merge_events` e `crm.invitations` estão com RLS ativo e **sem policy** (INFO — na prática nega tudo via API, mas convém tornar explícito).
3. Advisor: "Leaked Password Protection" desativado no Auth (WARN, independente da 2.0.16).

## BLOCO G — Isolamento (verificação lógica read-only) — PASS

Matriz completa usuário × lead reproduzindo a lógica de `crm.can_see_lead` sobre a base real:

| Papel | Usuários ativos | Pares visíveis | Pares bloqueados |
|---|---|---|---|
| admin | 1 | 1885 | 0 |
| executivo | 6 | 168 | 11142 |

Nenhum executivo enxerga lead fora dos próprios assignments. O RPC de perfil de produto aplica ainda uma segunda trava (`lead_assignments.user_id = auth.uid()`) além do `can_see_lead`. Teste com duas contas reais logadas continua pendente (ação humana).

## BLOCO H-web — Guard estático do CRM web — PASS

`python3 tools/regression_guard.py` → `REGRESSION GUARD: PASS` na branch de teste.

---

## BLOQUEADOS — ação humana necessária

| Item | Motivo |
|---|---|
| HASH do artefato | `taurus-magnum-webstore-2.0.16-supabase-first-profile.zip` não está no repositório nem disponível nesta sessão. SHA-256 esperado: `0782002815a4696f2f089c5690ca240bf0feed8f625f3650ed13aef8d6fe9837` |
| `tools/extension_2_0_16_guard.py` | Exige o código-fonte da extensão (`manifest.json`, `content.js`, `supabase.js`, `popup.js`, `popup.html`, `panel.css`). Nenhuma branch de `Willsm1/meu-crm` contém esses arquivos |
| A Preflight | Exige `chrome://extensions` com a 2.0.16 carregada |
| B Supabase-first (UI) | Exige extensão carregada + WhatsApp Web; item 4 (offline) exige desligar rede |
| C Perfil principal | Exige escrita real em lead autorizado |
| D Perfil de produto (UI) | Backend validado; clique/reload/reabertura exigem extensão carregada |
| E Ligações (UI) | Idempotência validada no banco; `Atendeu`/`Caixa Postal` reais exigem extensão |
| F Criação/edição | Exige lead de teste autorizado |
| G Isolamento com 2 contas | Exige segunda conta logada |
| H Regressão visual | Exige extensão carregada |

---

```text
BUILD: 2.0.16
HASH: BLOQUEADO (pacote indisponível nesta sessão)
VEREDITO: CANDIDATA BLOQUEADA — por evidência ausente, não por defeito encontrado

A SUPABASE-FIRST: PASS (backend) / BLOQUEADO (UI)
B PERFIL PRINCIPAL: BLOQUEADO
C PERFIL PRODUTO: PASS (contrato de banco) / BLOQUEADO (UI)
D LIGAÇÕES: PASS (idempotência e ausência de efeito em status) / BLOQUEADO (UI)
E CRIAÇÃO/EDIÇÃO: BLOQUEADO
F OFFLINE: BLOQUEADO
G ISOLAMENTO: PASS (lógico, base real) / BLOQUEADO (2 contas)
H REGRESSÃO VISUAL: BLOQUEADO (guard estático do CRM web: PASS)

ERROS DETERMINÍSTICOS: nenhum
EFEITOS COLATERAIS: nenhum observado
EVIDÊNCIAS: catálogo e SELECTs do projeto dbnjlvnkmgbiknhbefys, seção BLOCO S/G acima; tools/regression_guard.py
MENOR CORREÇÃO NECESSÁRIA: nenhuma no backend
RISCO DE REGRESSÃO: nenhum introduzido neste ciclo (zero writes)
PENDÊNCIAS HUMANAS: disponibilizar o .zip 2.0.16 e o código-fonte da extensão; carregar a 2.0.16 no Chrome; autorizar lead de teste; segunda conta para o bloco de isolamento
```

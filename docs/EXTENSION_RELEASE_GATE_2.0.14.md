# Taurus Magnum Extension 2.0.14 — Release Gate

Este pacote segue o mesmo princípio de segurança usado no CRM: nenhuma correção entra em distribuição só porque funciona em um caso manual.

## Baseline congelada

- Versão estável anterior: `2.0.13`
- SHA-256 do ZIP baseline: `3d5399f21e509c1fe584f02f54bb4718dfff3da36e5789d913808a2e1ad5eb85`

## Candidato atual

- Versão de diagnóstico: `2.0.14`
- SHA-256 do ZIP candidato: `d90f1015036a14d92bb5dd5824a05d18885883b3fd67a02a7297a5208174bb52`
- Branch: `diag-extension-calls-2.0.14`

## Escopo permitido de mudança

O pacote 2.0.14 deve diferir da 2.0.13 SOMENTE em:

1. `content.js`
2. `supabase.js`
3. `manifest.json` (apenas versão + mudanças estritamente necessárias)

Qualquer alteração em `bridge.js`, `crm.js`, `popup.js`, `index.html`, `panel.css`, `popup.html`, ícones ou outros arquivos bloqueia a promoção.

## Gates obrigatórios antes de distribuição

1. Executar `tools/extension_regression_guard.py` contra os ZIPs 2.0.13 e 2.0.14.
2. Resultado precisa ser PASS e confirmar os dois SHA-256 congelados.
3. Rodar teste de contrato massivo de eventos de ligação (100.000 casos) sem escrita em produção.
4. Rodar teste transacional no Supabase com `ROLLBACK` e confirmar zero resíduo.
5. Teste manual no navegador com pelo menos:
   - Atendeu
   - Caixa Postal
   - Perdido
   - Número Errado
   - retry do mesmo evento (não duplicar)
   - lead sem UUID (falha explícita, sem falso positivo)
   - sessão expirada/deslogada (falha explícita)
   - após reload, ligação continua visível no CRM
6. Confirmar que recursos antigos continuam funcionando:
   - login
   - captura de lead
   - atualização de lead
   - follow-up
   - interações inbound/outbound
   - isolamento por usuário
   - data local BRT
7. Só após aprovação manual criar checkpoint estável da extensão e liberar pacote ao time.

## Política de promoção

- Não alterar a versão 2.0.13 congelada.
- Não sobrescrever o ZIP validado.
- Toda nova correção gera nova versão e novo SHA-256.
- Se um gate falhar, não distribuir.
- A main do CRM não é alterada por este trabalho.

## Observação

Nenhum processo sério consegue garantir literalmente "zero regressão". O objetivo deste gate é impedir regressões conhecidas, limitar o diff, congelar artefatos por hash e tornar qualquer mudança futura detectável e reversível.

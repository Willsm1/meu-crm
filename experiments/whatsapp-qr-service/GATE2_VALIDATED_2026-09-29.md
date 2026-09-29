# Gate 2 validado — multi-sessao + eventos WhatsApp

Data: 2026-09-29
Branch: `test/whatsapp-qr-gate2-multisession-20260929`

## Evidencias validadas em ambiente real

1. Duas sessoes simultaneas ficaram conectadas no mesmo servico sem logout cruzado:
   - `taurus-test`
   - `whatsapp-2`
2. `/sessions` exibiu ambas com `phase=connected` e `connected=true` ao mesmo tempo.
3. Cada sessao manteve buffer de eventos separado por `sessionId`.
4. `taurus-test` registrou evento ao vivo outbound com `upsertType=notify`, `live=true`, `fromMe=true`, `direction=outbound`.
5. `taurus-test` tambem registrou evento ao vivo inbound com `upsertType=notify`, `live=true`, `fromMe=false`, `direction=inbound`.
6. `whatsapp-2` registrou eventos proprios com `sessionId=whatsapp-2`, incluindo outbound ao vivo, sem aparecer no buffer de `taurus-test`.
7. Foi observado ruido de protocolo/sincronizacao (`append/live=false`, `status@broadcast`, grupos `@g.us`, `senderKeyDistributionMessage`, `protocolMessage`, reactions e outros). Esses eventos NAO devem atualizar follow-up.

## Regras aprovadas para o proximo gate

Somente eventos de atividade comercial elegivel poderao virar sinal de follow-up. O proximo gate deve aplicar, no minimo:

- `upsertType === 'notify'`
- `live === true`
- conversa 1:1; excluir grupos `@g.us`
- excluir `status@broadcast` e outros broadcasts
- excluir eventos puramente tecnicos/protocolo
- manter `sessionId`, `messageId`, `chatJid`, direcao e timestamp como identidade forte
- deduplicar por `sessionId + messageId`
- nao gravar no CRM antes de validar o filtro e o matching com lead

## Observacao de producao

As credenciais das sessoes persistem separadas em `.auth/<sessionId>`. O servico ainda exige iniciar cada sessao apos o boot; auto-reconnect de todas as sessoes persistidas deve ser tratado antes de producao.

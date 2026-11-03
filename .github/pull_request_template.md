## Taurus Magnum — Pull Request

### Objetivo
Descreva o que muda e por quê.

### Subsistemas tocados
- [ ] CRM / Follow-up
- [ ] WhatsApp realtime
- [ ] Mídia
- [ ] Histórico / catch-up
- [ ] Supabase
- [ ] Render / infraestrutura
- [ ] UI

### Evidência RED → GREEN
Para bugfix/alteração de comportamento, registre:
- teste que falhou antes:
- motivo esperado da falha:
- teste que passou depois:

### Contrato de regressão
- [ ] WhatsApp continua pareando/conectando.
- [ ] Número conectado continua visível.
- [ ] Inbound de texto persiste.
- [ ] Outbound pelo celular/dispositivo vinculado persiste.
- [ ] Follow-up consome a interação corretamente.
- [ ] Imagem persiste e resolve do Storage.
- [ ] Áudio persiste e resolve do Storage.
- [ ] Histórico existente continua consultável.
- [ ] Observer/gateway continuam idempotentes.
- [ ] Nenhum teste altera dados reais de produção.

### Segurança
- [ ] Nenhum reset global de auth.
- [ ] Nenhum segredo foi commitado.
- [ ] Nenhum teste usa credenciais de produção.
- [ ] Mudança de histórico não controla fluxo normal de QR/reconnect.

### Release
- [ ] Regression Guard verde.
- [ ] Staging validado quando aplicável.
- [ ] Rollback conhecido.


### Célula Anti-Regressão
- [ ] A célula afetada está identificada.
- [ ] Novos comportamentos registram novos testes em `TAURUS_REGRESSION`.
- [ ] Limites com outras células têm teste de integração.
- [ ] O botão Anti-Regressão foi executado e não introduziu falha crítica.

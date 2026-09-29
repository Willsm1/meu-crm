# Gate 2 — multi-sessão + captura controlada de eventos

Objetivo: evoluir o POC para suportar múltiplas contas WhatsApp simultaneamente e observar eventos de mensagem de forma isolada por sessão, ainda sem gravar no Supabase.

## Invariantes

- Uma sessão = um `sessionId` lógico estável.
- Cada sessão usa diretório de autenticação próprio: `.auth/<sessionId>`.
- Nunca reutilizar credenciais entre sessões.
- Cada evento capturado carrega `sessionId`, JID da conversa, direção, message id e timestamp do WhatsApp.
- Nenhuma regra de follow-up usa nome visível como identidade.
- Nenhuma escrita em `crm.leads`, `crm.interactions`, `crm.calls` ou follow-up neste Gate.
- `syncFullHistory=false`.
- Eventos históricos/upsert de histórico devem ser classificados separadamente de eventos `notify`/live.

## Critério de aceite

1. Duas sessões distintas podem ser iniciadas sem compartilhar `.auth`.
2. Estado de cada sessão é consultado separadamente.
3. Um evento novo recebido aparece somente no buffer da sessão correta.
4. Um evento novo enviado aparece somente no buffer da sessão correta.
5. O evento preserva identidade forte e timestamp da origem.
6. Reinício do serviço preserva as sessões autenticadas.
7. Nenhum evento é gravado no Supabase.

## Meta para follow-up

A futura integração deverá derivar follow-up dos eventos canônicos capturados diretamente da sessão do WhatsApp, em vez de depender exclusivamente de leitura visual/DOM da extensão. Isso tende a reduzir falsos positivos de bolhas históricas/lazy-renderizadas e permite distinguir com mais precisão inbound, outbound, horário real e conta de origem.

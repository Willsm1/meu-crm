# Checkpoint — piloto WhatsApp + GPT antes do modo zero-custo

Data: 2026-10-01

Estado validado antes desta mudança:
- Follow-up WhatsApp funcionando.
- Histórico e mídias persistidas no Supabase funcionando.
- TXT/compactação e limpeza segura funcionando.
- Base Taurus retornando fonte no briefing.
- Edge Function `taurus-ai-analyze` autenticada e funcional até a chamada OpenAI.
- Chamada direta pela API bloqueada apenas por ausência de créditos (HTTP 429).

Regra de regressão:
- Não alterar `crm-whatsapp-storage-gate.js`, `crm-whatsapp-media-preview.js`, `crm-whatsapp-archive-ui.js`, `crm-whatsapp-archive-hotfix.js` nem observer de mídia para implementar o modo zero-custo.
- O modo zero-custo deve alterar apenas a camada final de IA/handoff.

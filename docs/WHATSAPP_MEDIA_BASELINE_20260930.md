# WhatsApp Media Baseline — 2026-09-30

Checkpoint aprovado manualmente em navegador real.

## Commit base
`932666f7cb5808709f0843ec9f771ffc5ef51455`

## Gate aprovado
- Follow-up inbound/outbound funcionando.
- Histórico WhatsApp vinculado ao lead funcionando.
- Imagem visível e persistida no Supabase.
- Áudio com player e persistido no Supabase.
- Vídeo com player e persistido no Supabase.
- Indicador `✓ armazenado no Supabase` validado visualmente.

## Regra de proteção
O pipeline de mídia deste checkpoint é baseline congelado. Mudanças em `crm-whatsapp-storage-gate.js`, `crm-whatsapp-media-preview.js` ou no observer de captura de mídia exigem branch própria, comparação com este baseline e teste explícito de regressão antes de integração.

## Próxima integração
Reaplicar TXT/arquivamento, conhecimento Taurus e GPT sem alterar o pipeline de mídia aprovado.

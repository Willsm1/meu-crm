# Taurus Magnum — Production Checkpoint 2026-10-01

Base oficial: `main`.

## Capacidades protegidas

- Carteira, Kanban, Dashboard, Quentes, Retomar e Críticos.
- Duplicidade/identidade de lead.
- Follow-up e matching WhatsApp.
- Login WhatsApp por QR Code e múltiplas sessões por usuário Taurus.
- Histórico WhatsApp.
- Mídia: imagem, áudio, vídeo e documento.
- Persistência de mídia no Supabase Storage.
- Compilação TXT e limpeza segura.

## Regra de release

Toda mudança nasce da `main`, passa por branch isolada, diff mínimo, Production Regression Guard e só então merge.
Branches de deploy não são fonte funcional: devem apontar para o mesmo commit aprovado da `main`.

## Mídia validada

Fluxo aprovado em produção: WhatsApp -> gateway Render -> Supabase -> histórico CRM, com imagem, áudio, vídeo e documento exibindo `armazenado no Supabase`.

## Pendências operacionais

- Persistência do diretório Baileys deve usar disco persistente no host (`TAURUS_DATA_ROOT`) para sobreviver a restart/redeploy.
- O serviço Render deve acompanhar a `main` (diretamente ou por branch de deploy sincronizada com a `main`).

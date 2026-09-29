# Taurus Magnum — WhatsApp QR experiment

Branch experimental. Não integrar na `main` antes da prova manual.

## Objetivo da fase 1

Validar somente quatro coisas:

1. gerar QR como dispositivo vinculado do WhatsApp Web;
2. manter a sessão após o primeiro pareamento;
3. receber eventos de mensagens em tempo real sem extensão Chrome;
4. normalizar direção, horário e identificador da conversa.

Nesta fase o serviço NÃO escreve mensagens, Follow-up ou anotações no Supabase.

## Arquitetura

`crm-whatsapp-qr-test.html` combina o CRM atual com a tela experimental.

`whatsapp-qr-test.html` é apenas a interface do QR e dos eventos.

`experiments/whatsapp-qr-service/src/server.js` é o processo Node persistente. Ele mantém o WebSocket do WhatsApp, gera o QR e publica eventos por SSE para a tela.

A sessão do WhatsApp fica somente no serviço, em `.sessions/`, que está ignorado pelo Git. Credenciais de sessão nunca devem ser colocadas no HTML, localStorage do CRM ou repositório.

## Execução local da prova

```bash
cd experiments/whatsapp-qr-service
npm install
npm start
```

O serviço sobe por padrão em `http://127.0.0.1:8787`.

Depois abra `crm-whatsapp-qr-test.html` pela branch experimental e clique em `Gerar QR / Conectar`.

## Fase 2 — somente depois da aprovação da fase 1

Depois de provar conexão e estabilidade, o próximo passo é encaminhar eventos normalizados para as RPCs já existentes do CRM, respeitando usuário/owner e deduplicação. O primeiro alvo seria `record_interaction_at`, sem armazenar conteúdo integral da conversa.

Só depois disso será avaliada leitura histórica controlada e análise de conteúdo.

## Limites

Baileys é uma biblioteca não oficial baseada no protocolo do WhatsApp Web. O experimento deve ser tratado como prova de conceito e pode exigir manutenção quando o WhatsApp alterar o protocolo. Não usar para disparos em massa, spam ou automação de envio.

# Taurus Magnum — WhatsApp QR POC

Experimento isolado do **Caminho B: pareamento por QR no estilo WhatsApp Web**.

## Escopo desta fase

Gate 1 somente:

- gerar QR;
- parear o WhatsApp como dispositivo multi-device;
- confirmar `connected`;
- persistir a sessão localmente em `.auth/taurus-test`;
- reiniciar o serviço e confirmar que reconecta sem novo QR.

**Fora do escopo agora:** leitura de mensagens, atualização de follow-up, criação/edição de leads, envio de mensagens e qualquer gravação no Supabase.

## Segurança do teste

- branch isolada: `test/whatsapp-qr-login-20260929`;
- checkpoint: `checkpoint/whatsapp-qr-login-base-20260929`;
- `main` não é alterada;
- as credenciais do WhatsApp ficam apenas na pasta local `.auth`, que não deve ser versionada;
- não compartilhar a pasta `.auth` nem seus arquivos.

## Requisitos

Node.js 20+.

A dependência Baileys está fixada no commit `0af2386292907f7d9742d8d41f830d8c48208fa1`, que contém a correção de 2026 para o handshake Desktop/QR.

## Rodar

```bash
cd experiments/whatsapp-qr-service
npm install
npm start
```

O serviço sobe em:

```text
http://127.0.0.1:8787
```

Abra `whatsapp-qr-test.html` pelo branch de teste e clique em **Gerar QR**.

No telefone:

1. WhatsApp
2. Dispositivos conectados
3. Conectar dispositivo
4. Escanear o QR exibido

Critério de aceite do Gate 1: a tela muda para `connected`, o serviço é reiniciado e volta a `connected` sem pedir novo QR.

## Nota técnica

Esta integração usa uma biblioteca não oficial baseada no protocolo WhatsApp Web/Multi-Device. O teste existe para validar viabilidade técnica antes de qualquer integração com dados do CRM.

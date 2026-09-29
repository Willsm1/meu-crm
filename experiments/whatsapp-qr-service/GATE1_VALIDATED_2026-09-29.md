# Gate 1 — VALIDADO em ambiente real

Data: 2026-09-29

Branch testada: `test/whatsapp-qr-login-20260929`

Head de segurança anterior ao Gate 2: `5aef5230a20faf110825b92aaf41ac4306b3be5e`

## Evidência funcional observada

1. Serviço Node iniciou em `127.0.0.1:8787`.
2. QR real foi gerado.
3. WhatsApp real foi pareado como dispositivo conectado.
4. Estado chegou a `connected`.
5. Serviço foi encerrado e iniciado novamente.
6. Na nova execução o estado passou de `idle` para `starting` e voltou a `connected` sem gerar novo QR.
7. `syncFullHistory` foi mantido em `false` para preservar o escopo do Gate 1.
8. Nenhuma ingestão de mensagens nem escrita em Supabase foi implementada no Gate 1.

## Decisão

Gate 1 aprovado. A partir deste ponto, qualquer experimento de leitura de eventos deve ocorrer em branch separada e preservar este estado como rollback.

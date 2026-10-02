# Checkpoint Taurus Magnum — WhatsApp 24x7 — 2026-10-02

Base protegida: `main` em `71522ecee8c6bfe60e5ea796d84f20be4bd2e68d` antes deste checkpoint documental.

## Validado em navegador real

- Gateway Render pago e ativo.
- Persistent Disk de 1 GB montado em `/var/data`.
- `TAURUS_DATA_ROOT=/var/data/taurus`.
- Credenciais Baileys persistem entre restart/redeploy.
- Reconexão automática sem novo QR após restart.
- Ingestão 24x7 com CRM fechado.
- Texto inbound/outbound persistido no Supabase.
- Imagem, áudio, vídeo e PDF persistidos no bucket privado `whatsapp-media`.
- Histórico WhatsApp renderiza texto e mídia persistida.
- Compilação TXT validada com 43 mensagens e 18 mídias catalogadas no teste final.
- Follow-up reage a inbound e outbound: contatos recebidos, aguardando resposta e respondidos.
- Múltiplas sessões por executivo: `whatsapp-1`, `whatsapp-2`.
- Sessões de executivos diferentes isoladas por `user_id + slot`.
- Matching protegido por assignment ativo do lead; telefone pertencente a outro executivo retorna `owner_mismatch` e não grava.
- Admin usa o seletor VISÃO para observar sessões de outros executivos em modo somente leitura.
- Em visão administrativa, QR/reconexão/remoção/adicionar ficam bloqueados para terceiros.
- O pacote de análise GPT monta contexto com CRM + WhatsApp + memórias TXT + Base Taurus.
- Fallback atual sem custo de API: `Analisar com meu ChatGPT` copia briefing e abre ChatGPT em outra aba.

## Números usados em homologação

- `11921491147`
- `11977392993`
- `11956668681`

Esses números são exclusivamente de teste e podem ser usados como filtro em futura limpeza controlada. Não remover dados por número sem revisão prévia dos registros relacionados.

## Regra de proteção para futuras mudanças

Qualquer alteração no WhatsApp deve sair de `main` para branch isolada e só voltar após:

1. comparação do diff contra `main`;
2. Production Regression Guard com sucesso;
3. teste em navegador real quando tocar captura, autenticação, Follow-up ou mídia;
4. validação de rollback;
5. merge apenas do delta necessário.

Não reescrever ou substituir em bloco os módulos congelados de mídia/storage/follow-up.

## Testes mínimos obrigatórios para qualquer regressão futura

- QR e conexão inicial;
- restart/redeploy sem novo QR;
- duas sessões no mesmo executivo;
- dois executivos diferentes;
- inbound e outbound;
- owner mismatch;
- imagem;
- áudio;
- vídeo;
- documento;
- histórico após refresh;
- Follow-up inbound → aguardando resposta;
- Follow-up outbound → respondido;
- compilação TXT;
- visão Admin por executivo.

## Itens deliberadamente não fechados neste checkpoint

- Resposta do GPT diretamente dentro do CRM usando a conta ChatGPT individual do executivo. O fallback atual está funcional. A integração futura com conta ChatGPT deve ser aditiva e não pode substituir o fallback antes de validação.
- Limpeza dos dados de homologação. Deve ser feita separadamente, com seleção explícita e revisão antes de excluir.
- PRs antigos de teste (#18, #19, #21, #22) permanecem fora deste checkpoint e não devem ser mergeados em bloco na `main`.

Este arquivo existe para impedir regressões e servir como referência mínima do estado aprovado do Taurus Magnum.
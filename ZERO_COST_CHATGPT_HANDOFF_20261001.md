# Rota zero-custo para o piloto

A integração direta via OpenAI API permanece opcional e não é necessária para o piloto.

Modo principal do piloto:
1. CRM monta automaticamente o briefing usando lead + WhatsApp + memória TXT + Base Taurus.
2. Usuário clica em **Analisar com meu ChatGPT**.
3. O briefing é copiado para a área de transferência e o ChatGPT é aberto em nova aba.
4. Usuário cola com Cmd+V e envia.

Motivo: ChatGPT Plus não inclui créditos de API. O recurso de uso do plano ChatGPT em apps externos existe apenas em apps participantes/compatíveis; o Supabase não oferece token sharing para esse fluxo no momento. Para um CRM comercial próprio, a rota oficial futura é se tornar parceiro elegível do Sign in with ChatGPT/token sharing.

Regra: esta implementação não altera pipeline de mídia, TXT, limpeza ou matching.

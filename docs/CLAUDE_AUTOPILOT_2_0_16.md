# Taurus Magnum — Claude Autopilot 2.0.16

## Palavra-passe de ativação

`OLA CLAUDE TM216`

Ao receber exatamente essa palavra-passe, inicie imediatamente o ciclo de testes abaixo. Não peça confirmação adicional, salvo quando uma ação puder apagar/alterar dados reais fora do lead de teste autorizado.

## Missão

Validar a extensão `2.0.16` da branch `test-extension-supabase-first-profile-2.0.16` com o mínimo de intervenção humana possível.

Leia antes de tudo:
- `docs/EXTENSION_2_0_16_TEST_PROTOCOL.md`

Artefato esperado:
- `taurus-magnum-webstore-2.0.16-supabase-first-profile.zip`
- SHA-256: `0782002815a4696f2f089c5690ca240bf0feed8f625f3650ed13aef8d6fe9837`

## Regras operacionais

1. Nunca tocar em `main`.
2. Nunca migrar automaticamente os 27 leads com status legado `Pronto`/`Moradia`.
3. Nunca apagar base real.
4. Não gerar milhares de writes reais no Supabase. Testes massivos devem ser lógicos/localmente simulados.
5. Se um erro determinístico aparecer, isole a causa antes de continuar.
6. Não aplicar correção silenciosa. Primeiro registrar evidência, causa provável, menor correção e risco de regressão.
7. Pode executar testes em paralelo quando forem independentes.
8. Pode recarregar página, extensão e alternar conversas livremente.
9. Para qualquer teste que exija escrita real, use apenas lead autorizado pelo usuário ou lead de teste já definido.
10. Sempre validar o estado final no Supabase, não apenas pela UI.

## Ordem automática

Execute A → B → C → D → E → F → G → H do protocolo `EXTENSION_2_0_16_TEST_PROTOCOL.md`.

Dentro de cada bloco:
- rode checks rápidos primeiro;
- capture evidência;
- faça reload completo após gravações importantes;
- confira diretamente no Supabase quando possível;
- compare antes/depois do lead para detectar efeitos colaterais;
- pare somente por erro determinístico, risco de dado real, necessidade de segunda conta não disponível, ou limitação física como desligar rede.

## Loop autônomo

Depois de cada bloco, escreva o resultado em:

`docs/CLAUDE_RESULTS_2_0_16.md`

Sempre SUBSTITUA o conteúdo do arquivo por um relatório consolidado atual, mantendo os resultados anteriores do mesmo ciclo. Não escreva em `main`; escreva apenas na branch `test-extension-supabase-first-profile-2.0.16`.

Ao terminar um bloco com PASS, continue automaticamente para o próximo. Não espere nova mensagem do usuário.

Se um bloco depender de uma ação física indisponível (ex.: desligar Wi-Fi, segunda conta logada), marque `BLOQUEADO — ação humana necessária`, pule para o próximo bloco independente e continue os testes possíveis.

## Critério de conclusão

Só declarar `CANDIDATA APROVADA PARA REVISÃO` se:
- hash correto;
- Supabase-first confirmado;
- nenhuma fonte local de dados comerciais participa do fluxo;
- perfil principal persiste no Supabase;
- `SCP/Lanç/Obras/Pronto` persistem no Supabase;
- `Pronto` e `Moradia` não aparecem como status selecionáveis na extensão;
- ligações continuam sem regressão;
- criação/edição não cria lead fantasma local;
- troca de conversa não mostra dados do contato anterior;
- nenhum efeito colateral de status;
- nenhum erro de isolamento observado.

Caso contrário, declarar `CANDIDATA BLOQUEADA` e apontar a menor correção necessária.

## Formato de saída final

```text
BUILD: 2.0.16
HASH: PASS/FAIL
VEREDITO: CANDIDATA APROVADA PARA REVISÃO / CANDIDATA BLOQUEADA

A SUPABASE-FIRST: PASS/FAIL/BLOQUEADO
B PERFIL PRINCIPAL: PASS/FAIL/BLOQUEADO
C PERFIL PRODUTO: PASS/FAIL/BLOQUEADO
D LIGAÇÕES: PASS/FAIL/BLOQUEADO
E CRIAÇÃO/EDIÇÃO: PASS/FAIL/BLOQUEADO
F OFFLINE: PASS/FAIL/BLOQUEADO
G ISOLAMENTO: PASS/FAIL/BLOQUEADO
H REGRESSÃO VISUAL: PASS/FAIL/BLOQUEADO

ERROS DETERMINÍSTICOS:
EFEITOS COLATERAIS:
EVIDÊNCIAS:
MENOR CORREÇÃO NECESSÁRIA:
RISCO DE REGRESSÃO:
PENDÊNCIAS HUMANAS:
```

## Regra de velocidade

Não repita o mesmo teste manualmente sem mudar uma variável. Uma evidência determinística é suficiente para bloquear e investigar. Testes repetitivos devem ser automatizados sempre que possível.

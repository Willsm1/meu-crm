# Taurus Magnum Staging

## Objetivo

Validar código antes de produção sem compartilhar autenticação WhatsApp, Storage ou dados destrutivos com produção.

## Topologia

### Frontend
- Deploy separado do frontend Taurus.
- Aponta apenas para endpoints de staging.
- Nunca usa service-role de produção.

### WhatsApp Gateway
- Serviço Render separado.
- Branch/deploy de staging separado.
- Disco persistente próprio.
- `TAURUS_DATA_ROOT` exclusivo.
- Nunca monta ou copia `/var/data/taurus/auth` de produção.
- Sessão WhatsApp usada para staging deve ser conta/número de teste.

### Supabase
Preferência obrigatória para testes destrutivos:
- projeto Supabase de staging separado;
- Auth separado;
- banco separado;
- bucket `whatsapp-media` separado;
- service-role exclusivo de staging.

Nenhum teste automatizado deve possuir credencial capaz de escrever no projeto de produção.

## Variáveis

Staging deve possuir seus próprios valores para:
- SUPABASE_URL
- SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- TAURUS_ORIGIN
- TAURUS_DATA_ROOT

## Smoke obrigatório em staging

1. Conectar sessão de teste.
2. Confirmar número conectado.
3. Inbound texto.
4. Outbound pelo celular.
5. Follow-up.
6. Imagem.
7. Áudio.
8. Histórico já persistido.
9. Reconexão/515.
10. Confirmar ausência de escrita em produção.

## Promoção

Staging verde não promove automaticamente produção. A promoção exige PR verde, revisão e checkpoint do commit.

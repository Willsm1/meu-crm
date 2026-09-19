from pathlib import Path

p = Path('crm.html')
s = p.read_text(encoding='utf-8')

repls = [
    ("const CRM_SUPABASE_SOURCE_OF_TRUTH = false;  // OBRIGATORIO false nesta V1",
     "const CRM_SUPABASE_SOURCE_OF_TRUTH = true;   // Supabase canonico"),
    ("const CRM_FOLLOWUP_ENABLED         = false;  // OBRIGATORIO false nesta V1",
     "const CRM_FOLLOWUP_ENABLED         = true;   // follow-up canonico ativo"),
    ("const CRM_SUPABASE_ALLOW_WRITE     = false;  // trava anti-migracao acidental",
     "const CRM_SUPABASE_ALLOW_WRITE     = true;   // escrita somente via RPC auditada"),
    ("const CRM_CREATE_LEAD_IDEMPOTENTE       = false;  // V1.4A: obrigatorio false",
     "const CRM_CREATE_LEAD_IDEMPOTENTE       = true;   // create_lead_v2 auditada"),
    ("const CRM_AUTH_REQUIRED = false;   // NAO mudar nesta versao",
     "const CRM_AUTH_REQUIRED = true;    // login obrigatorio no CRM distribuido"),
]

for old, new in repls:
    if new in s:
        continue
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'PATCH ABORTADO: esperado 1 trecho, encontrado {n}: {old[:70]}')
    s = s.replace(old, new, 1)

# Carrega a camada canonica por ultimo, preservando todo o baseline legado.
tag = '<script src="supabase-canonical.js"></script>'
if tag not in s:
    marker = '</body>'
    if s.count(marker) != 1:
        raise SystemExit(f'PATCH ABORTADO: esperado 1 </body>, encontrado {s.count(marker)}')
    s = s.replace(marker, tag + '\n' + marker, 1)

p.write_text(s, encoding='utf-8')
print('Supabase-first patch aplicado com sucesso.')

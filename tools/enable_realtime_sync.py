from pathlib import Path
p=Path('crm.html')
s=p.read_text(encoding='utf-8')
tag='<script src="supabase-realtime.js"></script>'
if tag in s:
    print('Realtime tag already present.')
else:
    marker='<script src="supabase-canonical.js"></script>'
    if s.count(marker)!=1:
        raise SystemExit(f'PATCH ABORTADO: esperado 1 canonical tag, encontrado {s.count(marker)}')
    s=s.replace(marker, marker+'\n'+tag,1)
    p.write_text(s,encoding='utf-8')
    print('Realtime tag inserted.')

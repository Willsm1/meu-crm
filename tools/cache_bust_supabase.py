from pathlib import Path
p=Path('crm.html')
s=p.read_text(encoding='utf-8')
old='<script src="supabase-canonical.js"></script>'
new='<script src="supabase-canonical.js?v=20260919-1749"></script>'
if new in s:
    print('already patched')
elif s.count(old)==1:
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
    print('patched')
else:
    raise SystemExit(f'expected exactly one canonical script tag, found {s.count(old)}')

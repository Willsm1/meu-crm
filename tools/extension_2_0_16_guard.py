from pathlib import Path
import hashlib
import json
import re
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / 'artifacts' / 'taurus-magnum-webstore-2.0.16-supabase-first-profile.zip'
EXPECTED_SHA256 = '0782002815a4696f2f089c5690ca240bf0feed8f625f3650ed13aef8d6fe9837'

errors = []

if not ZIP.exists():
    print('FAIL')
    print(f'- missing artifact: {ZIP}')
    sys.exit(1)

actual = hashlib.sha256(ZIP.read_bytes()).hexdigest()
if actual != EXPECTED_SHA256:
    errors.append(f'zip sha256 mismatch: {actual}')

with tempfile.TemporaryDirectory(prefix='tm216-') as td:
    root = Path(td)
    try:
        with zipfile.ZipFile(ZIP) as zf:
            zf.extractall(root)
    except Exception as e:
        print('FAIL')
        print(f'- invalid zip: {e}')
        sys.exit(1)

    req = ['manifest.json','content.js','supabase.js','popup.js','popup.html','panel.css']
    for name in req:
        if not (root / name).exists():
            errors.append(f'missing {name}')

    try:
        manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
        if manifest.get('version') != '2.0.16':
            errors.append('manifest version != 2.0.16')
        js = [j for x in manifest.get('content_scripts', []) for j in (x.get('js') or [])]
        if 'bridge.js' in js:
            errors.append('bridge.js still loaded')
    except Exception as e:
        errors.append(f'manifest invalid: {e}')

    if (root / 'content.js').exists() and (root / 'supabase.js').exists():
        content = (root / 'content.js').read_text(encoding='utf-8')
        sb = (root / 'supabase.js').read_text(encoding='utf-8')
        joined = content + '\n' + sb

        for pat, label in [
            (r"chrome\.storage\.local\.set\([^\n]*crm_leads", 'writes crm_leads'),
            (r"crm_sb_fila", 'queue key remains active'),
            (r"crm_regions_cache", 'region cache remains active'),
            (r"\[kL\].*JSON\.stringify\(leads", 'lead cache write remains'),
        ]:
            if re.search(pat, joined):
                errors.append(label)

        for needle in ['data-crm-produto','SCP','Lanç','Obras','Pronto','atualizarPerfilProduto']:
            if needle not in content:
                errors.append(f'missing content needle {needle}')

        if 'set_lead_profile_product' not in sb:
            errors.append('missing profile product RPC')

        stage_arrays = re.findall(r"const stages=\[(.*?)\];", content)
        for arr in stage_arrays:
            if "'Moradia'" in arr or "'Pronto'" in arr:
                errors.append('legacy profile status still selectable')

        for needle in ['record_call_at','listarLigacoesHoje']:
            if needle not in sb:
                errors.append(f'missing calls canonical path {needle}')

if errors:
    print('FAIL')
    for error in errors:
        print('-', error)
    sys.exit(1)

print('PASS: extension 2.0.16 static regression guard')
print('sha256:', actual)
print('artifact:', ZIP.relative_to(ROOT))

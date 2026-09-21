from pathlib import Path
import json,re,sys

root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
errors=[]
req=['manifest.json','content.js','supabase.js','popup.js','popup.html','panel.css']
for x in req:
    if not (root/x).exists(): errors.append(f'missing {x}')
try:
    m=json.loads((root/'manifest.json').read_text())
    if m.get('version')!='2.0.16': errors.append('manifest version != 2.0.16')
    js=[j for x in m.get('content_scripts',[]) for j in (x.get('js') or [])]
    if 'bridge.js' in js: errors.append('bridge.js still loaded')
except Exception as e: errors.append(f'manifest invalid: {e}')
content=(root/'content.js').read_text()
sb=(root/'supabase.js').read_text()
for pat,label in [
    (r"chrome\.storage\.local\.set\([^\n]*crm_leads",'writes crm_leads'),
    (r"crm_sb_fila",'queue key remains active'),
    (r"crm_regions_cache",'region cache remains active'),
    (r"\[kL\].*JSON\.stringify\(leads",'lead cache write remains'),
]:
    if re.search(pat,content+'\n'+sb): errors.append(label)
for needle in ['data-crm-produto','SCP','Lanç','Obras','Pronto','atualizarPerfilProduto']:
    if needle not in content: errors.append(f'missing content needle {needle}')
if 'set_lead_profile_product' not in sb: errors.append('missing profile product RPC')
stage_arrays=re.findall(r"const stages=\[(.*?)\];",content)
for arr in stage_arrays:
    if "'Moradia'" in arr or "'Pronto'" in arr: errors.append('legacy profile status still selectable')
for needle in ['record_call_at','listarLigacoesHoje']:
    if needle not in sb: errors.append(f'missing calls canonical path {needle}')
if errors:
    print('FAIL')
    for e in errors: print('-',e)
    sys.exit(1)
print('PASS: extension 2.0.16 static regression guard')
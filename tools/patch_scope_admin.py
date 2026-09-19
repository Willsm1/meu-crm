from pathlib import Path
p=Path('crm.html')
s=p.read_text(encoding='utf-8')

# 1. Global scope must constrain Follow-up before local filters.
old="""  var lista=_fuLinhas.filter(function(x){
    if(fp && x.prioridade!==fp) return false;
"""
new="""  var lista=_fuLinhas.filter(function(x){
    if(window.CRM_SCOPE && window.CRM_SCOPE.allowFollowup && !window.CRM_SCOPE.allowFollowup(x)) return false;
    if(fp && x.prioridade!==fp) return false;
"""
if old not in s:
    raise SystemExit('followup filter anchor not found')
s=s.replace(old,new,1)

# 2. No fake stopped-days fallback when no outbound contact exists.
old2="""      + '<td style=\"font-size:12px\">'+(x.dias_parado===null||x.dias_parado===undefined?'—':x.dias_parado+'d')+'</td>'
"""
new2="""      + '<td style=\"font-size:12px\">'+(x.ultimo_contato?(x.dias_parado===null||x.dias_parado===undefined?'—':x.dias_parado+'d'):'Sem registro')+'</td>'
"""
if old2 not in s:
    raise SystemExit('dias_parado renderer not found')
s=s.replace(old2,new2,1)

# 3. Correct empty-table colspan after Cadencia 7D column.
s=s.replace('colspan=\"9\"><div class=\"empty\">Nenhum lead nesta fila.','colspan=\"10\"><div class=\"empty\">Nenhum lead nesta fila.',1)

# 4. Load the scoped/admin layer after all existing scripts.
if 'scope-admin.js?v=20260919-1704' not in s:
    if '</body>' not in s:
        raise SystemExit('body close not found')
    s=s.replace('</body>','<script src="scope-admin.js?v=20260919-1704"></script>\n</body>',1)

assert 'CRM_SCOPE.allowFollowup' in s
assert "'Sem registro'" in s
assert 'scope-admin.js?v=20260919-1704' in s
p.write_text(s,encoding='utf-8')
print('PATCH_OK')

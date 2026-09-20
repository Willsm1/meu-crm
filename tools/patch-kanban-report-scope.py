from pathlib import Path

# 1) Kanban: full-width only on the Kanban page, preserving fallback horizontal scroll on narrower screens.
p=Path('crm.html')
s=p.read_text()
old="""/* KANBAN */
.kanban{display:flex;flex-direction:row;flex-wrap:nowrap;gap:10px;overflow-x:auto;padding-bottom:.75rem;align-items:flex-start;width:100%}
.k-col{flex:0 0 220px;min-width:220px;background:var(--bg-card);border-radius:var(--radius-lg);border:0.5px solid var(--border);padding:10px;min-height:300px}"""
new="""/* KANBAN */
#page-kanban{padding:1.5rem 16px}
#page-kanban>.container{max-width:none;width:100%;margin:0}
#page-kanban .kanban{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;overflow-x:visible;padding-bottom:.75rem;align-items:stretch;width:100%}
#page-kanban .k-col{min-width:0;width:auto;background:var(--bg-card);border-radius:var(--radius-lg);border:0.5px solid var(--border);padding:10px;min-height:calc(100vh - 250px)}
@media(max-width:1200px){
  #page-kanban .kanban{grid-template-columns:repeat(6,minmax(200px,1fr));overflow-x:auto}
  #page-kanban .k-col{min-width:200px}
}"""
assert old in s, 'kanban baseline not found'
s=s.replace(old,new,1)
p.write_text(s)

# 2) Scope: when the user changes Visão while Report is already open, force the report to recalculate on the scoped leads.
p=Path('scope-admin.js')
s=p.read_text()
old="""function applyScope(){
  var rows=allRows.filter(allowed);
  window.leads=rows; try{ leads=rows; }catch(e){}
  snap(rows);
  try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
  syncFollowup();
  updateScopeLabel(rows.length);
  return rows;
}"""
new="""function applyScope(){
  var rows=allRows.filter(allowed);
  window.leads=rows; try{ leads=rows; }catch(e){}
  snap(rows);
  try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
  try{
    var rp=document.getElementById('page-relatorio');
    if(rp&&rp.classList.contains('active')&&typeof renderRelatorio==='function') renderRelatorio();
  }catch(e){}
  syncFollowup();
  updateScopeLabel(rows.length);
  return rows;
}"""
assert old in s, 'applyScope baseline not found'
s=s.replace(old,new,1)
p.write_text(s)
print('PATCH_OK')

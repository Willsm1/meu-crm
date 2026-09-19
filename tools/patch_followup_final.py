from pathlib import Path
import re

crm=Path('crm.html')
canon=Path('supabase-canonical.js')
s=crm.read_text(encoding='utf-8')
c=canon.read_text(encoding='utf-8')

# 1) Follow-up pagination beyond PostgREST 1000-row cap.
old="""  fetch(c.url+'/rest/v1/v_followup?select=*', {
      method:'GET',
      headers:{'apikey':c.publishableKey,'Authorization':'Bearer '+tok,
               'Accept-Profile': c.schema||'crm'},
      signal: ctl?ctl.signal:undefined
    })
    .then(function(r){
      clearTimeout(t);
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    })
    .then(function(rows){
      _fuLinhas = Array.isArray(rows)?rows:[];
"""
new="""  var pageSize=1000;
  function buscarPagina(offset, acumulado){
    return fetch(c.url+'/rest/v1/v_followup?select=*&order=lead_id.asc&limit='+pageSize+'&offset='+offset, {
        method:'GET',
        headers:{'apikey':c.publishableKey,'Authorization':'Bearer '+tok,
                 'Accept-Profile': c.schema||'crm'},
        signal: ctl?ctl.signal:undefined
      })
      .then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      })
      .then(function(rows){
        rows=Array.isArray(rows)?rows:[];
        Array.prototype.push.apply(acumulado,rows);
        return rows.length===pageSize ? buscarPagina(offset+pageSize,acumulado) : acumulado;
      });
  }
  buscarPagina(0,[])
    .then(function(rows){
      clearTimeout(t);
      _fuLinhas = Array.isArray(rows)?rows:[];
"""
if old not in s:
    raise SystemExit('fuCarregar block not found')
s=s.replace(old,new,1)

# 2) Seven-day cadence visual helper.
anchor="function _dt(d){ if(!d) return '—'; var p=String(d).split('-'); return p.length===3?(p[2]+'/'+p[1]):d; }\n"
helper="""function _dt(d){ if(!d) return '—'; var p=String(d).split('-'); return p.length===3?(p[2]+'/'+p[1]):d; }
function _fuCadencia(v){
  var a=Array.isArray(v)?v:[];
  if(!a.length) return '<span style=\"color:#4b5e78\">—</span>';
  return '<div style=\"display:flex;align-items:flex-end;gap:3px;height:18px;min-width:74px\">'+a.map(function(x,i){
    var ok=!!(x&&x.falou), h=7+(i*1.5), cor=ok?'#22c55e':'rgba(75,94,120,.32)';
    var bd=ok?'rgba(134,239,172,.55)':'rgba(75,94,120,.35)';
    return '<span title=\"'+_esc(_dt(x&&x.data))+(ok?' · contato feito':' · sem contato')+'\" style=\"display:inline-block;width:7px;height:'+h+'px;border-radius:3px 3px 1px 1px;background:'+cor+';border:.5px solid '+bd+'\"></span>';
  }).join('')+'</div>';
}
"""
if anchor not in s:
    raise SystemExit('_dt helper not found')
s=s.replace(anchor,helper,1)

# 3) Header + row cadence column.
oldh='<th style="width:8%">Ele falou</th>\n        <th style="width:7%">Parado</th>'
newh='<th style="width:8%">Ele falou</th>\n        <th style="width:12%">Cadência 7D</th>\n        <th style="width:7%">Parado</th>'
if oldh not in s:
    raise SystemExit('followup header not found')
s=s.replace(oldh,newh,1)

oldr="""      + '<td style=\"font-size:12px\">'+_dt(x.ult_dele)+'</td>'
      + '<td style=\"font-size:12px\">'+(x.dias_parado===null||x.dias_parado===undefined?'—':x.dias_parado+'d')+'</td>'
"""
newr="""      + '<td style=\"font-size:12px\">'+_dt(x.ult_dele)+'</td>'
      + '<td>'+_fuCadencia(x.cadencia_7d)+'</td>'
      + '<td style=\"font-size:12px\">'+(x.dias_parado===null||x.dias_parado===undefined?'—':x.dias_parado+'d')+'</td>'
"""
if oldr not in s:
    raise SystemExit('followup row not found')
s=s.replace(oldr,newr,1)

# 4) Realtime refresh also refreshes Follow-up when its page is open.
oldc="""  _refreshTimer=setTimeout(function(){ if(papelValido()) carregarNaTela(); },500);
"""
newc="""  _refreshTimer=setTimeout(function(){
    if(!papelValido()) return;
    carregarNaTela().then(function(){
      try{
        var pg=document.getElementById('page-followup');
        if(pg && pg.classList.contains('active') && window.CRM_FOLLOWUP && window.CRM_FOLLOWUP.carregar)
          window.CRM_FOLLOWUP.carregar();
      }catch(e){}
    });
  },500);
"""
if oldc not in c:
    raise SystemExit('canonical realtime block not found')
c=c.replace(oldc,newc,1)

crm.write_text(s,encoding='utf-8')
canon.write_text(c,encoding='utf-8')

# invariants
assert 'Cadência 7D' in s
assert "limit='+pageSize+'&offset=" in s
assert '_fuCadencia(x.cadencia_7d)' in s
assert 'window.CRM_FOLLOWUP.carregar();' in c
print('PATCH_OK')

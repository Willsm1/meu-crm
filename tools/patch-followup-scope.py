from pathlib import Path

# scope-admin.js: paginate assignments and annotate canonical owner name.
p=Path('scope-admin.js')
s=p.read_text()

old="var ctx={me:null,options:[],assignments:new Map(),teams:new Map()};"
new="var ctx={me:null,options:[],assignments:new Map(),teams:new Map(),users:new Map()};"
assert old in s, 'ctx baseline not found'
s=s.replace(old,new,1)

marker="function getRange(path,from,to){ var c=cfg(),h=hdr(); if(!c||!h) return Promise.reject(new Error('Sessão ausente')); var hh=Object.assign({},h,{'Range':String(from)+'-'+String(to),'Prefer':'count=exact'}); return fetch(c.url+'/rest/v1/'+path,{headers:hh}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }"
insert=marker+"""
function loadAllAssignments(){
  var path='lead_assignments?select=lead_id,user_id,team_id&unassigned_at=is.null&order=lead_id.asc';
  var out=[];
  function page(from){
    return getRange(path,from,from+999).then(function(rows){
      rows=Array.isArray(rows)?rows:[];
      out=out.concat(rows);
      return rows.length===1000?page(from+1000):out;
    });
  }
  return page(0);
}"""
assert marker in s, 'getRange marker not found'
s=s.replace(marker,insert,1)

old="    get('lead_assignments?select=lead_id,user_id,team_id&unassigned_at=is.null&limit=5000')"
assert old in s, 'old assignment load not found'
s=s.replace(old,"    loadAllAssignments()",1)

old="""    ctx.teams=new Map();
    ctx.options.forEach(function(p){ if(p.team_id&&p.team_name) ctx.teams.set(String(p.team_id),p.team_name); });"""
new="""    ctx.teams=new Map();
    ctx.users=new Map();
    ctx.options.forEach(function(p){
      if(p.team_id&&p.team_name) ctx.teams.set(String(p.team_id),p.team_name);
      if(p.user_id&&p.full_name) ctx.users.set(String(p.user_id),p.full_name);
    });"""
assert old in s, 'team map block not found'
s=s.replace(old,new,1)

old="""function annotate(rows){
  return (rows||[]).map(function(l){ var a=ownerOf(l),tid=a&&a.team_id||null; l._owner_id=a&&a.user_id||null; l._team_id=tid; l._team_name=tid?(ctx.teams.get(String(tid))||''):''; l.empresa=l._team_name||''; return l; });
}"""
new="""function annotate(rows){
  return (rows||[]).map(function(l){
    var a=ownerOf(l),tid=a&&a.team_id||null,uid=a&&a.user_id||null;
    l._owner_id=uid;
    l._team_id=tid;
    l._team_name=tid?(ctx.teams.get(String(tid))||''):'';
    l.responsavel=uid?(ctx.users.get(String(uid))||''):'';
    l.empresa=l._team_name||'';
    return l;
  });
}"""
assert old in s, 'annotate block not found'
s=s.replace(old,new,1)
p.write_text(s)

# crm.html: owner column in main lead table + note-search table; search owner too.
p=Path('crm.html')
s=p.read_text()

old="""        <th style=\"width:2.5%;text-align:center\"><input type=\"checkbox\" class=\"cb\" id=\"cb-all\" onclick=\"toggleAll(this)\" title=\"Selecionar todos\"></th>
        <th style=\"width:12.3%\" class=\"sortable\" onclick=\"setSort('nome',this)\">Nome</th>
        <th style=\"width:10.2%\" class=\"sortable\" onclick=\"setSort('empresa',this)\">Equipe</th>
        <th style=\"width:13.5%\">Contato</th>
        <th style=\"width:12.1%\" class=\"sortable\" onclick=\"setSort('status',this)\">Status</th>
        <th style=\"width:8.6%\" class=\"sortable\" onclick=\"setSort('valor',this)\">Valor</th>
        <th style=\"width:7.2%\" class=\"sortable\" onclick=\"setSort('data',this)\">Data</th>
        <th style=\"width:6.9%\" class=\"sortable\" onclick=\"setSort('origem',this)\">Origem</th>
        <th style=\"width:7.5%\" class=\"sortable\" onclick=\"setSort('perfil',this)\">Perfil</th>
        <th style=\"width:7.7%\" class=\"sortable\" onclick=\"setSort('regiao',this)\">Região</th>
        <th style=\"width:6%\">Anotações</th>
        <th style=\"width:5.5%;text-align:center\">Ações</th>"""
new="""        <th style=\"width:2.5%;text-align:center\"><input type=\"checkbox\" class=\"cb\" id=\"cb-all\" onclick=\"toggleAll(this)\" title=\"Selecionar todos\"></th>
        <th style=\"width:11%\" class=\"sortable\" onclick=\"setSort('nome',this)\">Nome</th>
        <th style=\"width:7.5%\" class=\"sortable\" onclick=\"setSort('empresa',this)\">Equipe</th>
        <th style=\"width:9.5%\" class=\"sortable\" onclick=\"setSort('responsavel',this)\">Responsável</th>
        <th style=\"width:12.5%\">Contato</th>
        <th style=\"width:10.5%\" class=\"sortable\" onclick=\"setSort('status',this)\">Status</th>
        <th style=\"width:8%\" class=\"sortable\" onclick=\"setSort('valor',this)\">Valor</th>
        <th style=\"width:7%\" class=\"sortable\" onclick=\"setSort('data',this)\">Data</th>
        <th style=\"width:6.5%\" class=\"sortable\" onclick=\"setSort('origem',this)\">Origem</th>
        <th style=\"width:7%\" class=\"sortable\" onclick=\"setSort('perfil',this)\">Perfil</th>
        <th style=\"width:7%\" class=\"sortable\" onclick=\"setSort('regiao',this)\">Região</th>
        <th style=\"width:5%\">Anotações</th>
        <th style=\"width:5.5%;text-align:center\">Ações</th>"""
assert old in s, 'lead table header block not found'
s=s.replace(old,new,1)

old="const mq=!q||[l.nome,l.empresa,l.email,l.telefone].some(f=>String(f||'').toLowerCase().includes(q));"
new="const mq=!q||[l.nome,l.empresa,l.responsavel,l.email,l.telefone].some(f=>String(f||'').toLowerCase().includes(q));"
assert old in s, 'search fields baseline not found'
s=s.replace(old,new,1)

assert 'colspan="12"' in s, 'empty colspan 12 not found'
s=s.replace('colspan="12"','colspan="13"',1)

old="""    <td style=\"color:var(--text-secondary)\" title=\"${l.empresa||''}\">${l.empresa||'—'}</td>
    <td style=\"font-size:12px;color:var(--text-muted)\">${l.email?`<div>${l.email}</div>`:''} ${l.telefone?`<div class=\"contact-copy\""""
new="""    <td style=\"color:var(--text-secondary)\" title=\"${l.empresa||''}\">${l.empresa||'—'}</td>
    <td style=\"font-size:12px;color:var(--text-secondary)\" title=\"${l.responsavel||''}\">${l.responsavel||'—'}</td>
    <td style=\"font-size:12px;color:var(--text-muted)\">${l.email?`<div>${l.email}</div>`:''} ${l.telefone?`<div class=\"contact-copy\""""
assert old in s, 'main lead row baseline not found'
s=s.replace(old,new,1)

old="""      '<td style=\"color:var(--text-secondary)\">'+escHtml(l.empresa||'—')+'</td>'+\n      '<td style=\"font-size:12px;color:var(--text-muted)\">'+(l.telefone?'<div>'+l.telefone+'</div>':'')+'</td>'+"""
new="""      '<td style=\"color:var(--text-secondary)\">'+escHtml(l.empresa||'—')+'</td>'+\n      '<td style=\"font-size:12px;color:var(--text-secondary)\">'+escHtml(l.responsavel||'—')+'</td>'+\n      '<td style=\"font-size:12px;color:var(--text-muted)\">'+(l.telefone?'<div>'+l.telefone+'</div>':'')+'</td>'+"""
assert old in s, 'notes search row baseline not found'
s=s.replace(old,new,1)

p.write_text(s)
print('PATCH_OK')

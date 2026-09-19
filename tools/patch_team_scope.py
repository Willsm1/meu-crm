from pathlib import Path

scope = Path('scope-admin.js')
s = scope.read_text(encoding='utf-8')
orig = s

s = s.replace("var ctx={me:null,options:[],assignments:new Map()};", "var ctx={me:null,options:[],assignments:new Map(),teams:new Map()};\nvar scopeInitialized=false;")

old_get = "function get(path){ var c=cfg(),h=hdr(); if(!c||!h) return Promise.reject(new Error('Sessão ausente')); return fetch(c.url+'/rest/v1/'+path,{headers:h}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }"
new_get = """function get(path){ var c=cfg(),h=hdr(); if(!c||!h) return Promise.reject(new Error('Sessão ausente')); return fetch(c.url+'/rest/v1/'+path,{headers:h}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
function getRange(path,from,to){ var c=cfg(),h=hdr(); if(!c||!h) return Promise.reject(new Error('Sessão ausente')); var hh=Object.assign({},h,{'Range':String(from)+'-'+String(to),'Prefer':'count=exact'}); return fetch(c.url+'/rest/v1/'+path,{headers:hh}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
function mapLeadRow(l){ return {id:String(l.local_id||l.id),_uuid:l.id,nome:l.nome||'',empresa:l.empresa||'',email:l.email||'',telefone:l.telefone||'',status:l.status||'Novo',valor:(l.valor===null||l.valor===undefined)?'':l.valor,data:l.data_entrada||'',data_entrada:l.data_entrada||'',origem:l.origem||'',perfil:l.perfil||'',regiao:l.regiao||'',ult_meu:l.ult_meu||'',ult_dele:l.ult_dele||'',notas:l.notas||'',proximo_contato:l.proximo_contato||''}; }
function loadAllLeads(){
  var cols='id,local_id,nome,telefone,email,empresa,status,valor,perfil,regiao,origem,data_entrada,ult_meu,ult_dele,notas,proximo_contato';
  var path='leads?select='+cols+'&deleted_at=is.null&order=id.asc';
  var out=[];
  function page(from){ return getRange(path,from,from+999).then(function(rows){ rows=Array.isArray(rows)?rows:[]; out=out.concat(rows); return rows.length===1000?page(from+1000):out; }); }
  return page(0).then(function(rows){ return rows.map(mapLeadRow); });
}"""
if old_get not in s: raise SystemExit('get anchor missing')
s = s.replace(old_get,new_get,1)

old_ctx = """    ctx.options=Array.isArray(r[1])?r[1]:[];
    ctx.assignments=new Map();
    (Array.isArray(r[2])?r[2]:[]).forEach(function(a){ ctx.assignments.set(String(a.lead_id),a); });"""
new_ctx = """    ctx.options=Array.isArray(r[1])?r[1]:[];
    ctx.teams=new Map();
    ctx.options.forEach(function(p){ if(p.team_id&&p.team_name) ctx.teams.set(String(p.team_id),p.team_name); });
    ctx.assignments=new Map();
    (Array.isArray(r[2])?r[2]:[]).forEach(function(a){ ctx.assignments.set(String(a.lead_id),a); });"""
if old_ctx not in s: raise SystemExit('context anchor missing')
s=s.replace(old_ctx,new_ctx,1)

start=s.index('function restoreScope(){')
end=s.index('function saveScope(){',start)
restore="""function restoreScope(){
  var role=ctx.me&&ctx.me.role;
  if(role==='executivo'){ scope={type:'mine',id:null}; scopeInitialized=true; return; }
  if(!scopeInitialized){ scope={type:'mine',id:null}; scopeInitialized=true; return; }
  if(scope.type==='all'&&role!=='admin') scope={type:'mine',id:null};
  if(scope.type==='my_team'&&!(ctx.me&&ctx.me.team_id)) scope={type:'mine',id:null};
}
"""
s=s[:start]+restore+s[end:]
s=s.replace("function saveScope(){ try{ localStorage.setItem('crm_view_scope',JSON.stringify(scope)); }catch(e){} }","function saveScope(){ /* escopo persiste apenas durante a sessão; cada abertura começa em Minha base */ }")

s=s.replace("  if(scope.type==='all') return me.role==='admin';\n  if(scope.type==='team')", "  if(scope.type==='all') return me.role==='admin';\n  if(scope.type==='my_team') return !!a&&String(a.team_id)===String(me.team_id||'');\n  if(scope.type==='team')",1)

old_ann="function annotate(rows){\n  return (rows||[]).map(function(l){ var a=ownerOf(l); l._owner_id=a&&a.user_id||null; l._team_id=a&&a.team_id||null; return l; });\n}"
new_ann="function annotate(rows){\n  return (rows||[]).map(function(l){ var a=ownerOf(l),tid=a&&a.team_id||null; l._owner_id=a&&a.user_id||null; l._team_id=tid; l._team_name=tid?(ctx.teams.get(String(tid))||''):''; l.empresa=l._team_name||''; return l; });\n}"
if old_ann not in s: raise SystemExit('annotate anchor missing')
s=s.replace(old_ann,new_ann,1)

old_reload="""function scopedReload(){
  if(!rawReload) return Promise.resolve([]);
  return Promise.all([rawReload(),loadContext()]).then(function(r){ allRows=annotate(r[0]||[]); return applyScope(); });
}"""
new_reload="""function scopedReload(){
  return loadContext().then(function(){ return loadAllLeads(); }).then(function(rows){ allRows=annotate(rows||[]); return applyScope(); });
}"""
if old_reload not in s: raise SystemExit('reload anchor missing')
s=s.replace(old_reload,new_reload,1)

s=s.replace("  if(scope.type==='all') return me.role==='admin';\n  if(scope.type==='team') return String(x.responsavel_team_id||'')===String(scope.id||'');", "  if(scope.type==='all') return me.role==='admin';\n  if(scope.type==='my_team') return String(x.responsavel_team_id||'')===String(me.team_id||'');\n  if(scope.type==='team') return String(x.responsavel_team_id||'')===String(scope.id||'');",1)

old_opts="""function scopeOptions(){
  var me=ctx.me||{},opts=[{v:'mine',t:'Minha base'}];
  if(me.role==='admin') opts.push({v:'all',t:'Todos'});
  var teams={},users=[];
  ctx.options.forEach(function(p){ if(p.team_id&&p.team_name) teams[p.team_id]=p.team_name; if(p.is_active&&String(p.user_id)!==String(me.id)) users.push(p); });
  if(me.role==='admin'||me.role==='gerente') Object.keys(teams).sort(function(a,b){return teams[a].localeCompare(teams[b]);}).forEach(function(id){ opts.push({v:'team:'+id,t:'Equipe: '+teams[id]}); });
  users.sort(function(a,b){return String(a.full_name).localeCompare(String(b.full_name));}).forEach(function(p){ opts.push({v:'user:'+p.user_id,t:p.full_name}); });
  return opts;
}"""
new_opts="""function scopeOptions(){
  var me=ctx.me||{},opts=[{v:'mine',t:'Minha base'}];
  if(me.team_id) opts.push({v:'my_team',t:'Minha equipe'});
  if(me.role==='admin') opts.push({v:'all',t:'Todos'});
  var teams={},users=[];
  ctx.options.forEach(function(p){
    if(p.team_id&&p.team_name) teams[p.team_id]=p.team_name;
    if(p.is_active&&String(p.user_id)!==String(me.id) && (me.role==='admin'||String(p.team_id||'')===String(me.team_id||''))) users.push(p);
  });
  if(me.role==='admin'||me.role==='gerente') Object.keys(teams).sort(function(a,b){return teams[a].localeCompare(teams[b]);}).forEach(function(id){ opts.push({v:'team:'+id,t:'Equipe: '+teams[id]}); });
  users.sort(function(a,b){return String(a.full_name).localeCompare(String(b.full_name));}).forEach(function(p){ opts.push({v:'user:'+p.user_id,t:p.full_name}); });
  return opts;
}"""
if old_opts not in s: raise SystemExit('scopeOptions anchor missing')
s=s.replace(old_opts,new_opts,1)

s=s.replace("p_empresa:val(l.empresa)||null", "p_empresa:null")

checks=['loadAllLeads','my_team','Minha equipe','ctx.teams','l._team_name','p_empresa:null']
for c in checks:
    if c not in s: raise SystemExit('missing '+c)
if s==orig: raise SystemExit('scope no changes')
scope.write_text(s,encoding='utf-8')

crm=Path('crm.html')
h=crm.read_text(encoding='utf-8')
h0=h
h=h.replace("onclick=\"setSort('empresa',this)\">Empresa</th>", "onclick=\"setSort('empresa',this)\">Equipe</th>",1)
h=h.replace('<th>Nome</th><th>Empresa</th><th>Email</th><th>Telefone</th>','<th>Nome</th><th>Equipe</th><th>Email</th><th>Telefone</th>',1)
h=h.replace("{id:'col-empresa', key:'empresa',  label:'Empresa'}", "{id:'col-empresa', key:'empresa',  label:'Equipe'}",1)
h=h.replace("const headers=['Nome','Empresa','Email','Telefone'", "const headers=['Nome','Equipe','Email','Telefone'",1)
h=h.replace('id=\"col-empresa\"> <span style=\"font-size:13px;color:var(--text-secondary)\">Empresa</span>', 'id=\"col-empresa\"> <span style=\"font-size:13px;color:var(--text-secondary)\">Equipe</span>',1)
h=h.replace('<div class=\"form-row\"><label>Empresa</label><input id=\"f-empresa\" placeholder=\"Nome da empresa\"></div>', '<div class=\"form-row\"><label>Equipe</label><input id=\"f-empresa\" placeholder=\"Definida automaticamente\" disabled></div>',1)
if 'Equipe</th>' not in h: raise SystemExit('team header missing')
if h==h0: raise SystemExit('crm no changes')
crm.write_text(h,encoding='utf-8')
print('PATCH_TEAM_SCOPE_OK')

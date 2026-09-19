/* Taurus Magnum CRM — scoped views + admin console */
(function(){
'use strict';
var allRows=[];
var visibleSnap=new Map();
var ctx={me:null,options:[],assignments:new Map()};
var scope={type:'mine',id:null};
var rawReload=null, rawRefresh=null;
var saveChain=Promise.resolve();

function cfg(){ return window.CRM_SUPABASE&&window.CRM_SUPABASE.config; }
function tok(){
  var c=cfg(); if(!c) return null;
  try{ var s=JSON.parse(localStorage.getItem('sb-'+c.projectRef+'-auth-token')||'null'); return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token)); }catch(e){ return null; }
}
function hdr(){ var c=cfg(),t=tok(); return c&&t?{'apikey':c.publishableKey,'Authorization':'Bearer '+t,'Content-Type':'application/json','Accept-Profile':c.schema||'crm','Content-Profile':c.schema||'crm'}:null; }
function rpc(n,b){ return window.CRM_CANONICAL.rpc(n,b||{}); }
function get(path){ var c=cfg(),h=hdr(); if(!c||!h) return Promise.reject(new Error('Sessão ausente')); return fetch(c.url+'/rest/v1/'+path,{headers:h}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function val(v){ return v==null?'':String(v); }
function canon(l){ return {nome:val(l.nome).trim(),telefone:val(l.telefone).trim(),email:val(l.email).trim().toLowerCase(),empresa:val(l.empresa).trim(),status:val(l.status||'Novo'),valor:val(l.valor),perfil:val(l.perfil),regiao:val(l.regiao).trim(),origem:val(l.origem).trim(),data_entrada:val(l.data||l.data_entrada),ult_meu:val(l.ult_meu),ult_dele:val(l.ult_dele),notas:val(l.notas),proximo_contato:val(l.proximo_contato)}; }
function snap(rows){ visibleSnap=new Map(); (rows||[]).forEach(function(l){ if(l._uuid) visibleSnap.set(String(l._uuid),canon(l)); }); }
function same(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function diff(a,b){ var p={}; Object.keys(b).forEach(function(k){ if(String(a&&a[k]!==undefined?a[k]:'')!==String(b[k]!==undefined?b[k]:'')) p[k]=b[k]; }); return p; }

function loadContext(){
  return Promise.all([
    rpc('current_profile_context',{}),
    rpc('admin_scope_options',{}),
    get('lead_assignments?select=lead_id,user_id,team_id&unassigned_at=is.null&limit=5000')
  ]).then(function(r){
    ctx.me=Array.isArray(r[0])?r[0][0]:r[0];
    ctx.options=Array.isArray(r[1])?r[1]:[];
    ctx.assignments=new Map();
    (Array.isArray(r[2])?r[2]:[]).forEach(function(a){ ctx.assignments.set(String(a.lead_id),a); });
    restoreScope();
    renderScopeBar();
    return ctx;
  });
}
function restoreScope(){
  var saved=null; try{ saved=JSON.parse(localStorage.getItem('crm_view_scope')||'null'); }catch(e){}
  var role=ctx.me&&ctx.me.role;
  if(role==='executivo'){ scope={type:'mine',id:null}; return; }
  if(saved&&['mine','all','team','user'].indexOf(saved.type)>=0){ scope=saved; } else scope={type:'mine',id:null};
  if(role!=='admin'&&scope.type==='all') scope={type:'mine',id:null};
}
function saveScope(){ try{ localStorage.setItem('crm_view_scope',JSON.stringify(scope)); }catch(e){} }
function ownerOf(l){ return ctx.assignments.get(String(l._uuid||''))||null; }
function allowed(l){
  var me=ctx.me,a=ownerOf(l); if(!me) return true;
  if(me.role==='executivo') return !a||String(a.user_id)===String(me.id);
  if(scope.type==='all') return me.role==='admin';
  if(scope.type==='team') return !!a&&String(a.team_id)===String(scope.id);
  if(scope.type==='user') return !!a&&String(a.user_id)===String(scope.id);
  return !!a&&String(a.user_id)===String(me.id);
}
function applyScope(){
  var rows=allRows.filter(allowed);
  window.leads=rows; try{ leads=rows; }catch(e){}
  snap(rows);
  try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
  syncFollowup();
  updateScopeLabel(rows.length);
  return rows;
}
function annotate(rows){
  return (rows||[]).map(function(l){ var a=ownerOf(l); l._owner_id=a&&a.user_id||null; l._team_id=a&&a.team_id||null; return l; });
}
function scopedReload(){
  if(!rawReload) return Promise.resolve([]);
  return Promise.all([rawReload(),loadContext()]).then(function(r){ allRows=annotate(r[0]||[]); return applyScope(); });
}
function setScope(next){ scope=next||{type:'mine',id:null}; saveScope(); renderScopeBar(); return applyScope(); }
function allowFollowup(x){
  var me=ctx.me; if(!me) return true;
  if(me.role==='executivo') return true;
  if(scope.type==='all') return me.role==='admin';
  if(scope.type==='team') return String(x.responsavel_team_id||'')===String(scope.id||'');
  if(scope.type==='user') return String(x.responsavel_id||'')===String(scope.id||'');
  return String(x.responsavel_id||'')===String(me.id||'');
}
function syncFollowup(){ try{ if(window.fuRenderFila) window.fuRenderFila(); }catch(e){} }

function scopeOptions(){
  var me=ctx.me||{},opts=[{v:'mine',t:'Minha base'}];
  if(me.role==='admin') opts.push({v:'all',t:'Todos'});
  var teams={},users=[];
  ctx.options.forEach(function(p){ if(p.team_id&&p.team_name) teams[p.team_id]=p.team_name; if(p.is_active&&String(p.user_id)!==String(me.id)) users.push(p); });
  if(me.role==='admin'||me.role==='gerente') Object.keys(teams).sort(function(a,b){return teams[a].localeCompare(teams[b]);}).forEach(function(id){ opts.push({v:'team:'+id,t:'Equipe: '+teams[id]}); });
  users.sort(function(a,b){return String(a.full_name).localeCompare(String(b.full_name));}).forEach(function(p){ opts.push({v:'user:'+p.user_id,t:p.full_name}); });
  return opts;
}
function scopeValue(){ return scope.type+(scope.id?':'+scope.id:''); }
function parseScope(v){ var p=String(v||'mine').split(':'); return {type:p[0],id:p.slice(1).join(':')||null}; }
function renderScopeBar(){
  var bar=document.querySelector('.actionbar-scr'); if(!bar||!ctx.me) return;
  var wrap=document.getElementById('crm-scope-wrap');
  if(ctx.me.role==='executivo'){ if(wrap) wrap.remove(); return; }
  if(!wrap){ wrap=document.createElement('div'); wrap.id='crm-scope-wrap'; wrap.style.cssText='display:flex;align-items:center;gap:6px;margin-right:4px'; var ref=document.getElementById('refresh-btn'); bar.insertBefore(wrap,ref||bar.firstChild); }
  var options=scopeOptions();
  wrap.innerHTML='<span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Visão</span><select id="crm-scope-select" style="height:32px;min-width:150px">'+options.map(function(o){return '<option value="'+esc(o.v)+'"'+(o.v===scopeValue()?' selected':'')+'>'+esc(o.t)+'</option>';}).join('')+'</select>'+(ctx.me.role==='admin'?'<button class="nav-btn" id="crm-admin-btn" style="height:32px">Administração</button>':'');
  document.getElementById('crm-scope-select').onchange=function(){ setScope(parseScope(this.value)); };
  var ab=document.getElementById('crm-admin-btn'); if(ab) ab.onclick=openAdmin;
}
function updateScopeLabel(n){ var s=document.getElementById('sync-status'); if(s&&ctx.me&&ctx.me.role!=='executivo') s.title='Visão atual: '+n+' lead(s)'; }

function persist(){
  var atuais=Array.isArray(window.leads)?window.leads:[],presentes=new Set(),ops=[];
  atuais.forEach(function(l){
    if(l._uuid){ var id=String(l._uuid),antes=visibleSnap.get(id),agora=canon(l); presentes.add(id); if(antes&&!same(antes,agora)){ var p=diff(antes,agora); if(Object.keys(p).length) ops.push(rpc('update_lead_by_id',{p_lead_id:l._uuid,p_patch:p})); } }
    else{
      ops.push(rpc('create_lead_v2',{p_local_id:String(l.id||Date.now()),p_origem_criacao:'crm',p_nome:val(l.nome).trim(),p_telefone:val(l.telefone)||null,p_email:val(l.email)||null,p_empresa:val(l.empresa)||null,p_status:l.status||'Novo',p_valor:(l.valor==null||l.valor==='')?null:Number(l.valor),p_perfil:(l.perfil==='Moradia'||l.perfil==='Investimento')?l.perfil:null,p_regiao:val(l.regiao)||null,p_origem:val(l.origem)||null,p_data_entrada:l.data||l.data_entrada||null}));
    }
  });
  visibleSnap.forEach(function(v,id){ if(!presentes.has(id)) ops.push(rpc('archive_lead',{p_lead_id:id,p_motivo:'Arquivado pelo CRM'})); });
  if(!ops.length) return Promise.resolve({alterados:0});
  return Promise.all(ops).then(scopedReload).then(function(){return {alterados:ops.length};});
}

function injectStyles(){ if(document.getElementById('crm-admin-style')) return; var st=document.createElement('style'); st.id='crm-admin-style'; st.textContent='#crm-admin-overlay{position:fixed;inset:0;background:rgba(2,6,23,.78);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px}#crm-admin-modal{width:min(980px,96vw);max-height:88vh;overflow:auto;background:#0e1628;border:1px solid rgba(59,130,246,.28);border-radius:16px;padding:20px;color:#e2e8f0;box-shadow:0 24px 80px rgba(0,0,0,.45)}.adm-grid{display:grid;grid-template-columns:1fr 2fr;gap:18px}.adm-card{background:#0a1222;border:1px solid rgba(59,130,246,.18);border-radius:12px;padding:14px}.adm-row{display:grid;grid-template-columns:1.25fr 1.4fr 1fr 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(59,130,246,.09)}.adm-row:last-child{border-bottom:0}@media(max-width:760px){.adm-grid{grid-template-columns:1fr}.adm-row{grid-template-columns:1fr}}'; document.head.appendChild(st); }
function openAdmin(){ injectStyles(); var old=document.getElementById('crm-admin-overlay'); if(old) old.remove(); var ov=document.createElement('div'); ov.id='crm-admin-overlay'; ov.innerHTML='<div id="crm-admin-modal"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div><div style="font-size:18px;font-weight:700">Administração</div><div style="font-size:12px;color:#64748b">Equipes e usuários</div></div><button class="btn" id="adm-close">Fechar</button></div><div class="adm-grid"><div class="adm-card"><div style="font-weight:700;margin-bottom:10px">Equipes</div><div style="display:flex;gap:8px"><input id="adm-team-name" type="text" placeholder="Nova equipe" style="flex:1"><button class="btn btn-primary" id="adm-team-add">Criar</button></div><div id="adm-teams" style="margin-top:12px"></div></div><div class="adm-card"><div style="font-weight:700;margin-bottom:10px">Usuários</div><div style="display:grid;grid-template-columns:1.2fr 1.5fr 1fr 1fr auto;gap:8px;margin-bottom:12px"><input id="adm-name" type="text" placeholder="Nome"><input id="adm-email" type="email" placeholder="E-mail"><select id="adm-role"><option value="executivo">Executivo</option><option value="gerente">Gerente</option><option value="admin">Admin</option></select><select id="adm-team"></select><button class="btn btn-primary" id="adm-user-add">Convidar</button></div><div id="adm-users"></div></div></div><div id="adm-msg" style="font-size:12px;color:#94a3b8;margin-top:12px"></div></div>'; document.body.appendChild(ov); document.getElementById('adm-close').onclick=function(){ov.remove();}; ov.onclick=function(e){if(e.target===ov) ov.remove();}; document.getElementById('adm-team-add').onclick=createTeam; document.getElementById('adm-user-add').onclick=inviteUser; loadAdmin(); }
function msg(t,err){ var e=document.getElementById('adm-msg'); if(e){e.textContent=t||'';e.style.color=err?'#fca5a5':'#86efac';} }
function loadAdmin(){
  Promise.all([get('teams?select=id,name,is_active&order=name.asc'),get('profiles?select=id,full_name,email,role,team_id,is_active&order=full_name.asc')]).then(function(r){ renderAdmin(r[0]||[],r[1]||[]); }).catch(function(e){msg(e.message,true);});
}
function renderAdmin(teams,users){
  var active=teams.filter(function(t){return t.is_active;}); var tm={}; teams.forEach(function(t){tm[t.id]=t;});
  document.getElementById('adm-teams').innerHTML=teams.map(function(t){return '<div style="display:flex;justify-content:space-between;padding:7px 0"><span>'+esc(t.name)+'</span><span style="font-size:11px;color:'+(t.is_active?'#86efac':'#64748b')+'">'+(t.is_active?'Ativa':'Inativa')+'</span></div>';}).join('')||'<span style="color:#64748b">Nenhuma equipe.</span>';
  var opts='<option value="">Sem equipe</option>'+active.map(function(t){return '<option value="'+t.id+'">'+esc(t.name)+'</option>';}).join(''); document.getElementById('adm-team').innerHTML=opts;
  document.getElementById('adm-users').innerHTML=users.map(function(u){return '<div class="adm-row" data-u="'+u.id+'"><div><strong>'+esc(u.full_name)+'</strong><div style="font-size:10px;color:#64748b">'+esc(u.email)+'</div></div><select class="ur"><option value="executivo"'+(u.role==='executivo'?' selected':'')+'>Executivo</option><option value="gerente"'+(u.role==='gerente'?' selected':'')+'>Gerente</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>Admin</option></select><select class="ut">'+opts.replace('value="'+u.team_id+'"','value="'+u.team_id+'" selected')+'</select><label style="font-size:12px"><input class="ua" type="checkbox"'+(u.is_active?' checked':'')+'> Ativo</label><button class="btn btn-sm us">Salvar</button></div>';}).join('');
  document.querySelectorAll('.adm-row .us').forEach(function(b){ b.onclick=function(){ var row=this.closest('.adm-row'),id=row.dataset.u; rpc('admin_update_profile',{p_user_id:id,p_full_name:null,p_team_id:row.querySelector('.ut').value||null,p_role:row.querySelector('.ur').value,p_is_active:row.querySelector('.ua').checked}).then(function(){msg('Usuário atualizado.');return loadContext();}).then(loadAdmin).catch(function(e){msg(e.message,true);}); }; });
}
function createTeam(){ var n=(document.getElementById('adm-team-name').value||'').trim(); if(!n)return; rpc('admin_create_team',{p_name:n}).then(function(){document.getElementById('adm-team-name').value='';msg('Equipe criada.');return loadContext();}).then(loadAdmin).catch(function(e){msg(e.message,true);}); }
function inviteUser(){
  var c=cfg(),h=hdr(),body={action:'invite_user',full_name:(document.getElementById('adm-name').value||'').trim(),email:(document.getElementById('adm-email').value||'').trim(),role:document.getElementById('adm-role').value,team_id:document.getElementById('adm-team').value||null};
  if(!body.full_name||!body.email){msg('Preencha nome e e-mail.',true);return;}
  msg('Enviando convite...'); fetch(c.url+'/functions/v1/admin-users',{method:'POST',headers:{'apikey':c.publishableKey,'Authorization':h.Authorization,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.message||j.error||'Falha ao convidar');return j;});}).then(function(){msg('Usuário criado e convite enviado.');document.getElementById('adm-name').value='';document.getElementById('adm-email').value='';return loadContext();}).then(loadAdmin).catch(function(e){msg(e.message,true);});
}

function boot(){
  if(!window.CRM_CANONICAL){ setTimeout(boot,100); return; }
  rawReload=window.CRM_CANONICAL.reload; rawRefresh=window.refreshCRM;
  window.CRM_SCOPE={get:function(){return scope;},set:setScope,meta:function(){return ctx;},allowFollowup:allowFollowup,reload:scopedReload};
  window.CRM_CANONICAL.reload=scopedReload;
  window.refreshCRM=function(){ try{if(typeof showToast==='function')showToast('Atualizando pelo Supabase...');}catch(e){} return scopedReload().then(function(rows){try{if(typeof showToast==='function')showToast('Atualizado: '+rows.length+' leads nesta visão.');}catch(e){} return rows;}); };
  window.save=function(){ saveChain=saveChain.then(persist).catch(function(e){try{if(typeof showToast==='function')showToast('Não foi possível salvar: '+e.message);}catch(_){} return scopedReload().catch(function(){});}); return saveChain; };
  injectStyles();
  scopedReload();
  window.addEventListener('message',function(ev){ if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED') setTimeout(scopedReload,850); });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,0);
})();

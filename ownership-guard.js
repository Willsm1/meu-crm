/* Taurus Magnum CRM — ownership integrity guard
 * Garante que editar um lead nunca seja interpretado como criacao de outro lead.
 * Responsavel so muda por reassign_lead, de forma explicita e auditavel.
 */
(function(){
'use strict';
var installed=false;
var editIdentity=null;
var originalOpenModal=null;
var originalSave=null;

function rows(){ return Array.isArray(window.leads)?window.leads:[]; }
function rpc(name,body){
  if(!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')
    return Promise.reject(new Error('Camada canonica indisponivel'));
  return window.CRM_CANONICAL.rpc(name,body||{});
}
function toast(msg){ try{ if(typeof window.showToast==='function') window.showToast(msg); }catch(e){} }
function findLocal(id){
  var sid=String(id==null?'':id);
  return rows().find(function(l){ return l&&String(l.id)==sid; })||null;
}
function capture(id){
  editIdentity=null;
  if(id===null||id===undefined||id==='') return null;
  var l=findLocal(id);
  if(!l||!l._uuid) return null;
  editIdentity={
    localId:String(id), uuid:String(l._uuid),
    ownerId:l._owner_id?String(l._owner_id):null,
    teamId:l._team_id?String(l._team_id):null,
    teamName:l._team_name||'', responsavel:l.responsavel||''
  };
  return editIdentity;
}
function restoreIdentity(){
  if(!editIdentity) return null;
  var l=findLocal(editIdentity.localId);
  if(!l) throw new Error('Lead em edicao nao encontrado na visao atual');
  if(l._uuid && String(l._uuid)!==editIdentity.uuid)
    throw new Error('Identidade do lead mudou durante a edicao; atualize a tela');
  l._uuid=editIdentity.uuid;
  l._supabase=true;
  l._owner_id=editIdentity.ownerId;
  l._team_id=editIdentity.teamId;
  l._team_name=editIdentity.teamName;
  l.responsavel=editIdentity.responsavel;
  return l;
}
function meta(){
  try{ return window.CRM_SCOPE&&typeof window.CRM_SCOPE.meta==='function'?window.CRM_SCOPE.meta():null; }
  catch(e){ return null; }
}
function installResponsibleField(){
  var m=meta(), me=m&&m.me;
  if(!editIdentity||!me||(me.role!=='admin'&&me.role!=='gerente')) return;
  var teamInput=document.getElementById('f-empresa');
  if(!teamInput) return;
  var row=teamInput.closest('.form-row');
  if(!row) return;
  var label=row.querySelector('label');
  if(label) label.textContent='Responsavel';
  teamInput.style.display='none';
  var sel=document.getElementById('f-responsavel');
  if(!sel){ sel=document.createElement('select'); sel.id='f-responsavel'; row.appendChild(sel); }
  var opts=(m.options||[]).filter(function(p){
    if(!p||!p.is_active||!p.user_id) return false;
    if(me.role==='admin') return true;
    return String(p.team_id||'')===String(me.team_id||'');
  }).sort(function(a,b){return String(a.full_name||'').localeCompare(String(b.full_name||''),'pt-BR');});
  sel.innerHTML=opts.map(function(p){
    var id=String(p.user_id), name=String(p.full_name||p.email||id);
    return '<option value="'+id.replace(/"/g,'&quot;')+'">'+name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</option>';
  }).join('');
  if(editIdentity.ownerId) sel.value=editIdentity.ownerId;
  sel.disabled=!opts.length;
}
function requestedReassignment(){
  if(!editIdentity) return null;
  var sel=document.getElementById('f-responsavel');
  if(!sel||!sel.value||String(sel.value)===String(editIdentity.ownerId||'')) return null;
  return {leadId:editIdentity.uuid,toUser:String(sel.value),fromUser:editIdentity.ownerId};
}
function wrap(){
  if(installed) return true;
  if(!window.CRM_SCOPE||typeof window.CRM_SCOPE.meta!=='function'||typeof window.openModal!=='function'||typeof window.save!=='function') return false;
  originalOpenModal=window.openModal;
  originalSave=window.save;

  window.openModal=function(id){
    capture(id);
    var out=originalOpenModal.apply(this,arguments);
    setTimeout(installResponsibleField,0);
    return out;
  };

  window.save=function(){
    var reassign=requestedReassignment();
    try{ restoreIdentity(); }
    catch(e){ toast('Edicao bloqueada: '+e.message); return Promise.reject(e); }
    var out;
    try{ out=originalSave.apply(this,arguments); }
    catch(e){ return Promise.reject(e); }
    var job=Promise.resolve(out);
    if(reassign){
      job=job.then(function(){
        return rpc('reassign_lead',{p_lead_id:reassign.leadId,p_to_user:reassign.toUser});
      }).then(function(){
        toast('Responsavel alterado com historico preservado.');
        if(window.CRM_SCOPE&&typeof window.CRM_SCOPE.reload==='function') return window.CRM_SCOPE.reload();
      });
    }
    editIdentity=null;
    return job;
  };
  window.__TM_OWNERSHIP_GUARD__={installed:true};
  installed=true;
  try{console.info('[CRM] ownership guard ativo');}catch(e){}
  return true;
}
function boot(){
  if(wrap()) return;
  setTimeout(boot,100);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();

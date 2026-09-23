/* Taurus Magnum CRM — edit identity guard
 * Prevents an edit from becoming create+archive when the legacy form rebuilds the object.
 * No reassignment UI and no ownership changes: only restores the canonical identity before save.
 */
(function(){
'use strict';
if(window.__TM_EDIT_IDENTITY_GUARD__)return;
var installed=false,editIdentity=null,originalOpen=null,originalSave=null;
function rows(){return Array.isArray(window.leads)?window.leads:[];}
function find(id){var s=String(id==null?'':id);return rows().find(function(l){return l&&String(l.id)===s;})||null;}
function capture(id){
  editIdentity=null;if(id===null||id===undefined||id==='')return;
  var l=find(id);if(!l||!l._uuid)return;
  editIdentity={localId:String(l.id),uuid:String(l._uuid),ownerId:l._owner_id||null,teamId:l._team_id||null,teamName:l._team_name||'',responsavel:l.responsavel||''};
}
function restore(){
  if(!editIdentity)return;
  var l=find(editIdentity.localId);if(!l)throw new Error('Lead em edição não encontrado na visão atual. Atualize a tela.');
  if(l._uuid&&String(l._uuid)!==editIdentity.uuid)throw new Error('Identidade do lead mudou durante a edição. Atualize a tela.');
  l._uuid=editIdentity.uuid;l._supabase=true;
  if(editIdentity.ownerId)l._owner_id=editIdentity.ownerId;
  if(editIdentity.teamId)l._team_id=editIdentity.teamId;
  if(editIdentity.teamName)l._team_name=editIdentity.teamName;
  if(editIdentity.responsavel)l.responsavel=editIdentity.responsavel;
}
function toast(m){try{if(typeof window.showToast==='function')window.showToast(m);}catch(e){}}
function install(){
  if(installed)return true;
  if(!window.CRM_SCOPE||typeof window.openModal!=='function'||typeof window.save!=='function')return false;
  originalOpen=window.openModal;originalSave=window.save;
  window.openModal=function(id){capture(id);return originalOpen.apply(this,arguments);};
  window.save=function(){
    try{restore();}catch(e){toast('Edição bloqueada: '+e.message);return Promise.reject(e);}
    var out;try{out=originalSave.apply(this,arguments);}catch(e){return Promise.reject(e);}
    return Promise.resolve(out).then(function(r){editIdentity=null;return r;},function(e){editIdentity=null;throw e;});
  };
  installed=true;window.__TM_EDIT_IDENTITY_GUARD__={installed:true};
  try{console.info('[CRM] edit identity guard ativo');}catch(e){}
  return true;
}
function boot(){if(install())return;setTimeout(boot,100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

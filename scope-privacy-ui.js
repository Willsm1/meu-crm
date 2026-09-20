/* Taurus Magnum CRM — privacy gate for scope/admin controls */
(function(){
'use strict';
var verifying=false;
function ensureStyle(){
  if(document.getElementById('tm-scope-privacy-style'))return;
  var st=document.createElement('style');
  st.id='tm-scope-privacy-style';
  st.textContent='#crm-scope-wrap{display:none!important}body.tm-scope-admin #crm-scope-wrap{display:flex!important}';
  document.head.appendChild(st);
}
function lock(){
  ensureStyle();
  if(document.body)document.body.classList.remove('tm-scope-admin');
}
function removeResidual(){
  var wrap=document.getElementById('crm-scope-wrap');
  if(wrap)wrap.remove();
}
function verify(){
  if(verifying)return;
  var api=window.CRM_CANONICAL;
  if(!api||typeof api.rpc!=='function'){setTimeout(verify,120);return;}
  verifying=true;
  api.rpc('current_profile_context',{}).then(function(r){
    var me=Array.isArray(r)?r[0]:r;
    if(me&&me.role==='admin'){
      if(document.body)document.body.classList.add('tm-scope-admin');
    }else{
      if(document.body)document.body.classList.remove('tm-scope-admin');
      removeResidual();
    }
  }).catch(function(){
    if(document.body)document.body.classList.remove('tm-scope-admin');
    removeResidual();
  }).finally(function(){verifying=false;});
}
function bindAuth(){
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.auth||typeof cli.auth.onAuthStateChange!=='function'){setTimeout(bindAuth,150);return;}
  if(window.__TM_SCOPE_PRIVACY_AUTH__)return;
  window.__TM_SCOPE_PRIVACY_AUTH__=true;
  cli.auth.onAuthStateChange(function(){
    lock();
    setTimeout(verify,0);
  });
}
function boot(){
  lock();
  bindAuth();
  verify();
}
ensureStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

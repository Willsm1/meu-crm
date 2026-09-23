/* Taurus Magnum CRM — teste de duplicidade por telefone BR
 * Branch-only: redireciona apenas as RPCs de duplicidade para variantes de teste.
 * 10/11 digitos nacionais equivalem a 55 + numero nacional.
 */
(function(){
'use strict';
if(window.__TM_DUP_PHONE_BR_TEST__)return;
window.__TM_DUP_PHONE_BR_TEST__=true;

function install(){
  var c=window.CRM_CANONICAL;
  if(!c||typeof c.rpc!=='function'){setTimeout(install,80);return;}
  if(c.__phoneBrTestWrapped)return;
  var original=c.rpc;
  c.rpc=function(name,body){
    if(name==='duplicate_candidates') name='duplicate_candidates_br_test';
    else if(name==='consolidate_duplicate') name='consolidate_duplicate_br_test';
    return original.call(c,name,body||{});
  };
  c.__phoneBrTestWrapped=true;
  try{console.info('[CRM DUP TEST] comparação BR ativa: 10/11 dígitos nacionais = 55 + número');}catch(e){}
  try{
    if(window.CRM_DUPLICATES_UI&&typeof window.CRM_DUPLICATES_UI.refresh==='function')
      window.CRM_DUPLICATES_UI.refresh();
  }catch(e){}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

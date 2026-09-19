/* Taurus Magnum CRM — realtime sync layer */
(function(){
'use strict';
var ch=null, timer=null, lastReload=0;
function reloadSoon(){
  clearTimeout(timer);
  timer=setTimeout(function(){
    if(!window.CRM_CANONICAL || !window.CRM_CANONICAL.reload) return;
    lastReload=Date.now();
    window.CRM_CANONICAL.reload().catch(function(e){
      try{ console.warn('[CRM REALTIME] reload falhou:',e&&e.message||e); }catch(_){}
    });
  },350);
}
function start(){
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli || !cli.channel){ setTimeout(start,300); return; }
  if(ch) return;
  ch=cli.channel('tm-crm-sync')
    .on('postgres_changes',{event:'*',schema:'crm',table:'leads'},reloadSoon)
    .on('postgres_changes',{event:'*',schema:'crm',table:'lead_assignments'},reloadSoon)
    .subscribe(function(status){
      try{ console.info('[CRM REALTIME]',status); }catch(_){}
    });
}
function fallback(){
  if(document.visibilityState==='visible' && Date.now()-lastReload>5000) reloadSoon();
}
window.addEventListener('focus',fallback);
document.addEventListener('visibilitychange',fallback);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();

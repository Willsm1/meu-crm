/* Taurus Magnum CRM — realtime sync layer */
(function(){
'use strict';
var ch=null, timer=null, lastReload=0;
function loadUiEnhancements(){
  if(!document.querySelector('script[data-tm-period-filters]')){
    var s=document.createElement('script');
    s.src='ui-period-filters.js?v=20260920-0242';
    s.async=false;
    s.dataset.tmPeriodFilters='1';
    document.head.appendChild(s);
  }
  if(!document.querySelector('script[data-tm-sales-date]')){
    var d=document.createElement('script');
    d.src='sales-date.js?v=20260920-0255';
    d.async=false;
    d.dataset.tmSalesDate='1';
    document.head.appendChild(d);
  }
  if(!document.querySelector('script[data-tm-followup-schedule]')){
    var f=document.createElement('script');
    f.src='followup-schedule-ui.js?v=20260920-1103';
    f.async=false;
    f.dataset.tmFollowupSchedule='1';
    document.head.appendChild(f);
  }
  if(!document.querySelector('script[data-tm-ui-labels]')){
    var l=document.createElement('script');
    l.src='ui-labels.js?v=20260920-1038';
    l.async=false;
    l.dataset.tmUiLabels='1';
    document.head.appendChild(l);
  }
  if(!document.querySelector('script[data-tm-notifications]')){
    var n=document.createElement('script');
    n.src='notifications-ui.js?v=20260920-1055';
    n.async=false;
    n.dataset.tmNotifications='1';
    document.head.appendChild(n);
  }
}
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
  loadUiEnhancements();
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

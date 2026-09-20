/* Taurus Magnum CRM — realtime sync layer */
(function(){
'use strict';
var ch=null,timer=null,lastReload=0;
function installFollowup401Retry(){
  if(window.__TM_FOLLOWUP_401_RETRY__)return;
  window.__TM_FOLLOWUP_401_RETRY__=true;
  var originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    var url='';
    try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(e){}
    var isFollowup=url.indexOf('/rest/v1/v_followup')>=0;
    var first=await originalFetch(input,init);
    if(!isFollowup||first.status!==401)return first;
    await new Promise(function(resolve){setTimeout(resolve,700);});
    try{
      var token=null,cli=window.TM_SUPABASE_AUTH_CLIENT;
      if(cli&&cli.auth&&typeof cli.auth.getSession==='function'){
        var sessionResult=await cli.auth.getSession();
        token=sessionResult&&sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.access_token;
      }
      var retryInit=Object.assign({},init||{});
      var baseHeaders=(init&&init.headers)||((typeof Request!=='undefined'&&input instanceof Request)?input.headers:undefined);
      var headers=new Headers(baseHeaders||{});
      if(token)headers.set('Authorization','Bearer '+token);
      retryInit.headers=headers;
      var retryInput=(typeof input==='string')?input:((input&&input.url)||input);
      return await originalFetch(retryInput,retryInit);
    }catch(e){
      return first;
    }
  };
}
function loadUiEnhancements(){
  function add(sel,src,key){if(document.querySelector(sel))return;var s=document.createElement('script');s.src=src;s.async=false;s.dataset[key]='1';document.head.appendChild(s);}
  add('script[data-tm-scope-privacy]','scope-privacy-ui.js?v=20260920-1124','tmScopePrivacy');
  add('script[data-tm-period-filters]','ui-period-filters.js?v=20260920-0242','tmPeriodFilters');
  add('script[data-tm-sales-date]','sales-date.js?v=20260920-0255','tmSalesDate');
  add('script[data-tm-followup-schedule]','followup-schedule-ui.js?v=20260920-1455','tmFollowupSchedule');
  add('script[data-tm-followup-agendar]','followup-agendar-ui.js?v=20260920-1455','tmFollowupAgendar');
  add('script[data-tm-gesture-guard]','gesture-navigation-guard.js?v=20260920-1148','tmGestureGuard');
  add('script[data-tm-ui-labels]','ui-labels.js?v=20260920-1038','tmUiLabels');
  add('script[data-tm-notifications]','notifications-ui.js?v=20260920-1134','tmNotifications');
  add('script[data-tm-duplicates]','duplicates-ui.js?v=20260920-1739','tmDuplicates');
  add('script[data-tm-kanban-scroll]','kanban-scroll-fix.js?v=20260920-2038','tmKanbanScroll');
}
function followupAtivo(){var p=document.getElementById('page-followup');return !!(p&&p.classList.contains('active'));}
function reloadSoon(forceFull){
  clearTimeout(timer);
  timer=setTimeout(function(){
    lastReload=Date.now();
    if(!forceFull&&followupAtivo()&&window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function'){
      Promise.resolve(window.CRM_FOLLOWUP.carregar()).catch(function(e){try{console.warn('[CRM REALTIME] follow-up:',e&&e.message||e);}catch(_){}});
      return;
    }
    if(!window.CRM_CANONICAL||!window.CRM_CANONICAL.reload)return;
    window.CRM_CANONICAL.reload().catch(function(e){try{console.warn('[CRM REALTIME] reload:',e&&e.message||e);}catch(_){}});
  },140);
}
function start(){
  installFollowup401Retry();
  loadUiEnhancements();
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.channel){setTimeout(start,300);return;}
  if(ch)return;
  ch=cli.channel('tm-crm-sync')
    .on('postgres_changes',{event:'*',schema:'crm',table:'leads'},function(){reloadSoon(false);})
    .on('postgres_changes',{event:'*',schema:'crm',table:'lead_assignments'},function(){reloadSoon(true);})
    .subscribe(function(status){try{console.info('[CRM REALTIME]',status);}catch(_){}});
}
function fallback(){if(document.visibilityState==='visible'&&Date.now()-lastReload>5000)reloadSoon(false);}
window.addEventListener('focus',fallback);document.addEventListener('visibilitychange',fallback);
installFollowup401Retry();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

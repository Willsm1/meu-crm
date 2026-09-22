/* Taurus Magnum CRM — realtime sync layer */
(function(){
'use strict';
var ch=null,timer=null,lastReload=0,lastSuccessfulReload=0,authBound=false;

async function refreshedToken(){
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.auth)return null;
  try{
    if(typeof cli.auth.refreshSession==='function')await cli.auth.refreshSession();
  }catch(e){}
  try{
    if(typeof cli.auth.getSession==='function'){
      var s=await cli.auth.getSession();
      return s&&s.data&&s.data.session&&s.data.session.access_token;
    }
  }catch(e){}
  return null;
}

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

    // Preserva o atraso de segurança do fluxo estável antes de renovar/repetir.
    await new Promise(function(resolve){setTimeout(resolve,700);});

    // Uma única recuperação explícita de sessão. Sem loop.
    try{
      var token=await refreshedToken();
      if(!token)return first;
      var retryInit=Object.assign({},init||{});
      var baseHeaders=(init&&init.headers)||((typeof Request!=='undefined'&&input instanceof Request)?input.headers:undefined);
      var headers=new Headers(baseHeaders||{});
      headers.set('Authorization','Bearer '+token);
      retryInit.headers=headers;
      var retryInput=(typeof input==='string')?input:((input&&input.url)||input);
      return await originalFetch(retryInput,retryInit);
    }catch(e){
      return first;
    }
  };
}

function loadUiEnhancements(){
  function add(sel,src,key){
    if(document.querySelector(sel))return;
    var s=document.createElement('script');
    s.src=src;s.async=false;s.dataset[key]='1';
    document.head.appendChild(s);
  }
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
  add('script[data-tm-followup-completed-queue]','followup-completed-queue-fix.js?v=20260920-2326','tmFollowupCompletedQueue');
  add('script[data-tm-estagio-ui]','stage-ui.js?v=20260921-1708','tmEstagioUi');
  add('script[data-tm-regions-ui]','regions-ui.js?v=20260921-1708','tmRegionsUi');
  add('script[data-tm-calls-ui]','calls-supabase-ui.js?v=20260921-2339','tmCallsUi');
  add('script[data-tm-ownership-guard]','ownership-guard.js?v=20260922-0815','tmOwnershipGuard');
  add('script[data-tm-brand-accent]','ui-brand-accent.js?v=20260922-1315','tmBrandAccent');
}

function followupAtivo(){
  var p=document.getElementById('page-followup');
  return !!(p&&p.classList.contains('active'));
}

function reloadSoon(forceFull){
  clearTimeout(timer);
  timer=setTimeout(function(){
    lastReload=Date.now();
    var job=null;
    if(!forceFull&&followupAtivo()&&window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function'){
      job=Promise.resolve(window.CRM_FOLLOWUP.carregar());
    }else if(window.CRM_CANONICAL&&window.CRM_CANONICAL.reload){
      job=Promise.resolve(window.CRM_CANONICAL.reload());
    }
    if(!job)return;
    job.then(function(){lastSuccessfulReload=Date.now();})
      .catch(function(e){try{console.warn('[CRM REALTIME] reload:',e&&e.message||e);}catch(_){}});
  },140);
}

function refreshCalls(){
  try{
    if(window.CRM_CALLS_UI&&typeof window.CRM_CALLS_UI.refresh==='function')window.CRM_CALLS_UI.refresh();
  }catch(e){}
}

function bindAuthRefresh(){
  if(authBound)return;
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.auth||typeof cli.auth.onAuthStateChange!=='function')return;
  authBound=true;
  cli.auth.onAuthStateChange(function(){
    try{if(ch){cli.removeChannel(ch);ch=null;}}catch(e){}
    refreshCalls();
    reloadSoon(true);
    setTimeout(start,120);
  });
}

function start(){
  installFollowup401Retry();
  loadUiEnhancements();
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.channel){setTimeout(start,300);return;}
  bindAuthRefresh();
  if(ch)return;
  ch=cli.channel('tm-crm-sync')
    .on('postgres_changes',{event:'*',schema:'crm',table:'leads'},function(){reloadSoon(false);})
    .on('postgres_changes',{event:'*',schema:'crm',table:'lead_assignments'},function(){reloadSoon(true);})
    .on('postgres_changes',{event:'*',schema:'crm',table:'interactions'},function(){reloadSoon(false);})
    .on('postgres_changes',{event:'*',schema:'crm',table:'calls'},function(){
      refreshCalls();
      reloadSoon(false);
    })
    .on('postgres_changes',{event:'*',schema:'crm',table:'regions'},function(){
      try{
        if(window.CRM_REGIONS_UI&&typeof window.CRM_REGIONS_UI.refresh==='function')window.CRM_REGIONS_UI.refresh();
      }catch(e){}
    })
    .subscribe(function(status){try{console.info('[CRM REALTIME]',status);}catch(_){} });
}

function fallback(){
  if(document.visibilityState!=='visible')return;
  refreshCalls();
  if(Date.now()-lastSuccessfulReload>1200)reloadSoon(true);
}

window.addEventListener('focus',fallback);
document.addEventListener('visibilitychange',fallback);
installFollowup401Retry();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

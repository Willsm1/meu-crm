/* Taurus Magnum CRM — realtime sync layer */
(function(){
'use strict';
var ch=null,timer=null,lastReload=0,lastSuccessfulReload=0,authBound=false,realtimeStatus='',hadSubscribed=false;
var perfInstalled=false,renderWrapped=false;
var perfInflight=new Map(),perfCache=new Map(),leadMeta=new Map(),leadMetaComplete=false;
var perfStats={network:0,coalesced:0,cached:0,syntheticMeta:0,fullReloadRequests:0};

/* Marco Zero legado: neutraliza a CAUSA antes do callback legado de 1200 ms.
   O objeto existente e preservado; apenas passa a ser considerado sincronizado.
   Assim o callback original retorna sem criar UI e nao precisamos observar o DOM inteiro. */
function disableLegacyBaseline(){
  function clearBaselineUi(){
    try{var ov=document.getElementById('bl-overlay');if(ov)ov.remove();}catch(e){}
    try{localStorage.removeItem('crm_baseline_lock');}catch(e){}
  }
  try{
    var raw=localStorage.getItem('crm_baseline'),base=null;
    try{base=raw?JSON.parse(raw):null;}catch(_){base=null;}
    if(!base||base.sincronizado!==true){
      if(!base||typeof base!=='object'||Array.isArray(base))base={};
      base.sincronizado=true;base.desativado=true;base.desativado_em=new Date().toISOString();
      localStorage.setItem('crm_baseline',JSON.stringify(base));
    }
  }catch(e){}
  try{window.verificarBaseline=function(){clearBaselineUi();return null;};}catch(e){}
  try{window.blMostrarPainel=function(){clearBaselineUi();return null;};}catch(e){}
  try{window.blConfirmar=function(){clearBaselineUi();return false;};}catch(e){}
  try{window.blEnviarAoSheets=function(){return Promise.resolve({ok:false,motivo:'Marco Zero desativado'});};}catch(e){}
  try{window.blConsultarSheets=function(){return Promise.resolve({existe:true,total:0,desativado:true});};}catch(e){}
  try{window.blBaixarDoSheets=function(){clearBaselineUi();return null;};}catch(e){}
  try{
    document.addEventListener('click',function(ev){
      var t=ev.target&&ev.target.closest&&ev.target.closest('#bl-confirmar');
      if(!t)return;
      ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();clearBaselineUi();
    },true);
  }catch(e){}
  clearBaselineUi();
}
disableLegacyBaseline();

function requestUrl(input){try{return typeof input==='string'?input:(input&&input.url)||'';}catch(e){return'';}}
function requestMethod(input,init){var m=(init&&init.method)||((input&&input.method)||'GET');return String(m||'GET').toUpperCase();}
function requestHeaders(input,init){try{return new Headers((init&&init.headers)||((typeof Request!=='undefined'&&input instanceof Request)?input.headers:undefined)||{});}catch(e){return new Headers();}}
function requestBody(init){return init&&typeof init.body==='string'?init.body:'';}
function authKey(input,init){var h=requestHeaders(input,init);return h.get('Authorization')||'';}
function cloneResponse(r){try{return r.clone();}catch(e){return r;}}
function jsonResponse(rows){return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json','Content-Range':'0-'+Math.max(0,rows.length-1)+'/'+rows.length}});}
function parseRange(input,init,total){
  var h=requestHeaders(input,init),r=h.get('Range')||'',m=r.match(/^(\d+)-(\d+)$/);
  if(!m)return{from:0,to:Math.max(0,total-1)};
  return{from:Number(m[1])||0,to:Number(m[2])||0};
}
function parseUrl(url){try{return new URL(url,window.location.href);}catch(e){return null;}}
function isCoreLeadRead(u,method){
  if(!u||method!=='GET'||!/\/rest\/v1\/leads$/.test(u.pathname))return false;
  var s=u.searchParams.get('select')||'';
  return s.indexOf('local_id')>=0&&s.indexOf('nome')>=0&&s.indexOf('notas')>=0&&s.indexOf('proximo_contato')>=0;
}
function augmentLeadRead(url){
  var u=parseUrl(url);if(!u||!isCoreLeadRead(u,'GET'))return url;
  var s=u.searchParams.get('select')||'',extra=['perfil_produto','data_fechamento','created_at'];
  extra.forEach(function(k){if((','+s+',').indexOf(','+k+',')<0)s+=','+k;});
  u.searchParams.set('select',s);return u.toString();
}
function captureLeadMeta(rows,input,init,url){
  if(!Array.isArray(rows))return;
  var u=parseUrl(url),range=parseRange(input,init,rows.length),offset=u?Number(u.searchParams.get('offset')||0):0;
  if(range.from===0&&offset===0){leadMeta=new Map();leadMetaComplete=false;}
  rows.forEach(function(x){if(x&&x.id)leadMeta.set(String(x.id),{id:String(x.id),perfil_produto:x.perfil_produto||'',data_fechamento:x.data_fechamento||'',created_at:x.created_at||''});});
  var requested=range.to>=range.from?(range.to-range.from+1):0;
  var limit=u?Number(u.searchParams.get('limit')||0):0;
  if((requested&&rows.length<requested)||(limit&&rows.length<limit))leadMetaComplete=true;
}
function metadataField(u){
  if(!u||!/\/rest\/v1\/leads$/.test(u.pathname))return'';
  var s=u.searchParams.get('select')||'';
  if(s==='id,perfil_produto')return'perfil_produto';
  if(s==='id,data_fechamento')return'data_fechamento';
  if(s==='id,created_at')return'created_at';
  return'';
}
function syntheticMetadata(u,field,input,init){
  if(!leadMetaComplete||!field)return null;
  var rows=Array.from(leadMeta.values());
  var ids=u.searchParams.get('id')||'';
  if(ids.indexOf('in.')===0){
    var raw=ids.slice(3).replace(/^\(|\)$/g,''),wanted=new Set(raw.split(',').filter(Boolean));
    rows=rows.filter(function(x){return wanted.has(String(x.id));});
  }
  rows.sort(function(a,b){return String(a.id).localeCompare(String(b.id));});
  var rg=parseRange(input,init,rows.length);rows=rows.slice(rg.from,rg.to+1);
  perfStats.syntheticMeta++;
  return jsonResponse(rows.map(function(x){var o={id:x.id};o[field]=x[field]||'';return o;}));
}
function isCommitState(u,method){return !!(u&&method==='POST'&&/\/rest\/v1\/rpc\/followup_commitment_state$/.test(u.pathname));}
function isRegionRead(u,method){return !!(u&&method==='GET'&&/\/rest\/v1\/regions$/.test(u.pathname));}
function invalidatesCommitments(u,method){return !!(u&&method!=='GET'&&/\/rest\/v1\/rpc\/(schedule_followup_commitment|marcar_followup_em|request_followup_commitment_cancel|complete_followup_commitment|archive_followup_commitment)/.test(u.pathname));}
function invalidatesRegions(u,method){return !!(u&&method!=='GET'&&/\/rest\/v1\/rpc\/upsert_region$/.test(u.pathname));}
function invalidatesLeadMeta(u,method){return !!(u&&method!=='GET'&&(/\/rest\/v1\/rpc\/(update_lead_by_id|create_lead_v2|archive_lead|close_lead_with_sale_date|set_lead_sale_date)/.test(u.pathname)||/\/rest\/v1\/leads$/.test(u.pathname)));}
function clearCachePrefix(prefix){Array.from(perfCache.keys()).forEach(function(k){if(k.indexOf(prefix)>=0)perfCache.delete(k);});}
function cacheFetch(key,ttl,work){
  var now=Date.now(),cached=perfCache.get(key);
  if(cached&&cached.expires>now){perfStats.cached++;return Promise.resolve(cloneResponse(cached.response));}
  var active=perfInflight.get(key);
  if(active){perfStats.coalesced++;return active.then(cloneResponse);}
  perfStats.network++;
  var p=Promise.resolve().then(work).then(function(r){if(r&&r.ok&&ttl>0)perfCache.set(key,{expires:Date.now()+ttl,response:cloneResponse(r)});return r;});
  perfInflight.set(key,p);
  p.finally(function(){if(perfInflight.get(key)===p)perfInflight.delete(key);});
  return p.then(cloneResponse);
}
function installPerformanceCoordinator(){
  if(perfInstalled)return;perfInstalled=true;
  var originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    var url=requestUrl(input),method=requestMethod(input,init),u=parseUrl(url),field=metadataField(u);
    if(field){var syn=syntheticMetadata(u,field,input,init);if(syn)return Promise.resolve(syn);}
    if(invalidatesCommitments(u,method))clearCachePrefix('commit-state|');
    if(invalidatesRegions(u,method))clearCachePrefix('regions|');
    if(invalidatesLeadMeta(u,method)){leadMetaComplete=false;leadMeta.clear();}
    var nextInput=input,nextUrl=url;
    if(isCoreLeadRead(u,method)){
      nextUrl=augmentLeadRead(url);
      if(typeof input==='string')nextInput=nextUrl;
      else if(typeof Request!=='undefined'&&input instanceof Request)nextInput=new Request(nextUrl,input);
      else nextInput=nextUrl;
    }
    var auth=authKey(input,init),body=requestBody(init);
    if(isCommitState(u,method)){
      var ck='commit-state|'+auth+'|'+body;
      return cacheFetch(ck,10000,function(){return originalFetch(nextInput,init);});
    }
    if(isRegionRead(u,method)){
      var rk='regions|'+auth+'|'+nextUrl;
      return cacheFetch(rk,300000,function(){return originalFetch(nextInput,init);});
    }
    if(method==='GET'){
      var gk='get|'+auth+'|'+nextUrl+'|'+(requestHeaders(input,init).get('Range')||'');
      return cacheFetch(gk,0,function(){
        return originalFetch(nextInput,init).then(function(r){
          if(!isCoreLeadRead(parseUrl(url),method)||!r||!r.ok)return r;
          try{
            return r.clone().json().then(function(rows){captureLeadMeta(rows,input,init,nextUrl);return r;},function(){return r;});
          }catch(e){return r;}
        });
      });
    }
    perfStats.network++;return originalFetch(nextInput,init);
  };
  window.CRM_PERF={stats:function(){return Object.assign({},perfStats,{leadMeta:leadMeta.size,leadMetaComplete:leadMetaComplete,realtimeStatus:realtimeStatus});},clear:function(){perfInflight.clear();perfCache.clear();}};
}
installPerformanceCoordinator();

function installRenderCoordinator(){
  if(renderWrapped||typeof window.renderAll!=='function')return;
  renderWrapped=true;
  var original=window.renderAll;
  window.renderAll=function(){
    var lp=document.getElementById('page-leads');
    if(lp&&lp.classList.contains('active'))return original.apply(this,arguments);
    var k=document.getElementById('page-kanban');if(k&&k.classList.contains('active')&&typeof window.renderKanban==='function')window.renderKanban();
    var d=document.getElementById('page-dashboard');if(d&&d.classList.contains('active')&&typeof window.renderDashboard==='function')window.renderDashboard();
    var q=document.getElementById('page-quentes');if(q&&q.classList.contains('active')&&typeof window.renderQuentes==='function')window.renderQuentes();
    var r=document.getElementById('page-retomar');if(r&&r.classList.contains('active')&&typeof window.renderRetomar==='function')window.renderRetomar();
  };
}
installRenderCoordinator();

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
  add('script[data-tm-followup-render-hub]','followup-render-hub.js?v=20260924-0127','tmFollowupRenderHub');
  add('script[data-tm-followup-commitments]','followup-commitment-ui.js?v=20260924-0127','tmFollowupCommitments');
  add('script[data-tm-followup-schedule]','followup-schedule-ui.js?v=20260924-0012','tmFollowupSchedule');
  add('script[data-tm-followup-agendar]','followup-agendar-ui.js?v=20260920-1455','tmFollowupAgendar');
  add('script[data-tm-followup-refinements]','followup-ux-refinements.js?v=20260924-0127','tmFollowupRefinements');
  add('script[data-tm-followup-search-fastfix]','followup-search-fastfix.js?v=20260924-0127','tmFollowupSearchFastfix');
  add('script[data-tm-gesture-guard]','gesture-navigation-guard.js?v=20260920-1148','tmGestureGuard');
  add('script[data-tm-ui-labels]','ui-labels.js?v=20260920-1038','tmUiLabels');
  add('script[data-tm-notifications]','notifications-ui.js?v=20260920-1134','tmNotifications');
  add('script[data-tm-dup-phone-br-test]','duplicate-phone-br-test.js?v=20260923-1248','tmDupPhoneBrTest');
  add('script[data-tm-duplicates]','duplicates-ui.js?v=20260920-1739','tmDuplicates');
  add('script[data-tm-kanban-scroll]','kanban-scroll-fix.js?v=20260924-0111','tmKanbanScroll');
  add('script[data-tm-followup-completed-queue]','followup-completed-queue-fix.js?v=20260920-2326','tmFollowupCompletedQueue');
  add('script[data-tm-estagio-ui]','stage-ui.js?v=20260922-1540','tmEstagioUi');
  add('script[data-tm-brand-accent]','ui-brand-accent.js?v=20260922-1540','tmBrandAccent');
  add('script[data-tm-modern-glow]','ui-modern-glow.js?v=20260922-1540','tmModernGlow');
  add('script[data-tm-contact-copy-all]','contact-copy-all-ui.js?v=20260924-0048','tmContactCopyAll');
  add('script[data-tm-edit-identity-guard]','edit-identity-guard.js?v=20260923-1234','tmEditIdentityGuard');
  add('script[data-tm-daily-kanban-origins]','daily-kanban-origins-ui.js?v=20260924-0030','tmDailyKanbanOrigins');
  add('script[data-tm-regions-ui]','regions-ui.js?v=20260923-1234','tmRegionsUi');
  add('script[data-tm-actionbar-context]','actionbar-context-ui.js?v=20260923-2357','tmActionbarContext');
}
function followupAtivo(){var p=document.getElementById('page-followup');return !!(p&&p.classList.contains('active'));}
function reloadSoon(forceFull){
  clearTimeout(timer);
  timer=setTimeout(function(){
    lastReload=Date.now();
    var job=null;
    if(!forceFull&&followupAtivo()&&window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function'){
      job=Promise.resolve(window.CRM_FOLLOWUP.carregar());
    }else if(window.CRM_CANONICAL&&window.CRM_CANONICAL.reload){
      perfStats.fullReloadRequests++;job=Promise.resolve(window.CRM_CANONICAL.reload());
    }
    if(!job)return;
    job.then(function(){lastSuccessfulReload=Date.now();}).catch(function(e){try{console.warn('[CRM REALTIME] reload:',e&&e.message||e);}catch(_){}});
  },140);
}
function bindAuthRefresh(){
  if(authBound)return;
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.auth||typeof cli.auth.onAuthStateChange!=='function')return;
  authBound=true;
  cli.auth.onAuthStateChange(function(){
    perfCache.clear();perfInflight.clear();leadMeta.clear();leadMetaComplete=false;
    try{if(ch){cli.removeChannel(ch);ch=null;}}catch(e){}
    realtimeStatus='';hadSubscribed=false;
    reloadSoon(true);
    setTimeout(start,120);
  });
}
function start(){
  installRenderCoordinator();
  installFollowup401Retry();
  loadUiEnhancements();
  var cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli||!cli.channel){setTimeout(start,300);return;}
  bindAuthRefresh();
  if(ch)return;
  ch=cli.channel('tm-crm-sync')
    .on('postgres_changes',{event:'*',schema:'crm',table:'leads'},function(){reloadSoon(false);})
    .on('postgres_changes',{event:'*',schema:'crm',table:'lead_assignments'},function(){reloadSoon(true);})
    .subscribe(function(status){
      var prev=realtimeStatus;realtimeStatus=String(status||'');
      if(realtimeStatus==='SUBSCRIBED'){
        if(hadSubscribed&&prev&&prev!=='SUBSCRIBED')reloadSoon(true);
        hadSubscribed=true;
      }
      try{console.info('[CRM REALTIME]',status);}catch(_){}
    });
}
function fallback(){
  if(document.visibilityState!=='visible')return;
  if(hadSubscribed&&realtimeStatus!=='SUBSCRIBED')reloadSoon(true);
}
window.addEventListener('message',function(ev){if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED')reloadSoon(true);});
window.addEventListener('focus',fallback);document.addEventListener('visibilitychange',fallback);
installFollowup401Retry();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
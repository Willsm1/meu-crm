/* Taurus Magnum CRM — ligações canônicas do Supabase
 * Fonte única para relatórios/cards de ligações: crm.calls sob RLS.
 * Não lê/escreve histórico de ligações local.
 */
(function(){
'use strict';

var cache=[];
var loading=null;
var wrapped=false;
var lastOk=0;

function cfg(){ return window.CRM_SUPABASE&&window.CRM_SUPABASE.config; }

async function token(){
  try{
    var cli=window.TM_SUPABASE_AUTH_CLIENT;
    if(cli&&cli.auth&&typeof cli.auth.getSession==='function'){
      var r=await cli.auth.getSession();
      var t=r&&r.data&&r.data.session&&r.data.session.access_token;
      if(t)return t;
    }
  }catch(e){}
  var c=cfg(); if(!c)return null;
  try{
    var s=JSON.parse(localStorage.getItem('sb-'+c.projectRef+'-auth-token')||'null');
    return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token));
  }catch(e){return null;}
}

function normalize(rows){
  return (Array.isArray(rows)?rows:[]).map(function(c){
    var dt=c.occurred_date||((c.occurred_at||'').slice(0,10));
    return {
      id:c.id,
      leadId:c.lead_id,
      lead_id:c.lead_id,
      result:c.result,
      date:dt,
      timestamp:c.occurred_at,
      occurred_at:c.occurred_at,
      occurred_date:dt,
      interaction_id:c.interaction_id||null,
      source:'supabase'
    };
  });
}

function apply(){
  try{ calls=cache.slice(); }catch(e){
    try{ window.calls=cache.slice(); }catch(_){}
  }
}

async function fetchCalls(force){
  if(loading&&!force)return loading;
  var c=cfg(); if(!c)return [];
  loading=(async function(){
    var t=await token();
    if(!t)throw new Error('Sessão Supabase ausente');
    var h={
      'apikey':c.publishableKey,
      'Authorization':'Bearer '+t,
      'Accept-Profile':c.schema||'crm'
    };
    var url=c.url+'/rest/v1/calls?select=id,lead_id,result,occurred_at,occurred_date,interaction_id&order=occurred_at.desc&limit=3000';
    var r=await fetch(url,{headers:h});
    if(r.status===401){
      try{
        var cli=window.TM_SUPABASE_AUTH_CLIENT;
        if(cli&&cli.auth&&typeof cli.auth.refreshSession==='function')await cli.auth.refreshSession();
        t=await token();
        if(t){
          h.Authorization='Bearer '+t;
          r=await fetch(url,{headers:h});
        }
      }catch(e){}
    }
    if(!r.ok)throw new Error('HTTP '+r.status);
    cache=normalize(await r.json());
    lastOk=Date.now();
    apply();
    return cache;
  })().catch(function(e){
    try{console.warn('[CRM CALLS] leitura:',e&&e.message||e);}catch(_){}
    throw e;
  }).finally(function(){loading=null;});
  return loading;
}

function activeReport(){
  var p=document.getElementById('page-relatorio');
  return !!(p&&p.classList.contains('active'));
}

function rerender(){
  apply();
  try{
    if(activeReport()&&typeof window.renderRelatorio==='function')window.renderRelatorio();
  }catch(e){}
}

function refresh(force){
  return fetchCalls(!!force).then(function(){rerender();return cache.slice();}).catch(function(){return cache.slice();});
}

function wrap(){
  if(wrapped||typeof window.renderRelatorio!=='function')return;
  var original=window.renderRelatorio;
  window.renderRelatorio=function(){
    apply();
    var out=original.apply(this,arguments);
    if(Date.now()-lastOk>15000)refresh(false);
    return out;
  };
  wrapped=true;
}

function start(){
  wrap();
  refresh(false);
  setTimeout(wrap,500);
}

window.addEventListener('focus',function(){if(Date.now()-lastOk>5000)refresh(false);});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&Date.now()-lastOk>5000)refresh(false);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();

window.CRM_CALLS_UI={
  refresh:function(){return refresh(true);},
  rows:function(){return cache.slice();}
};
})();

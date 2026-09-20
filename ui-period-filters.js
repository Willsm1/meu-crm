/* Taurus Magnum CRM — filtros temporais do Dashboard/Kanban + Kanban horizontal */
(function(){
'use strict';

var createdAtMap=new Map();
var createdAtLoading=null;

function hojeISO(){
  var d=new Date();
  var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function localDateFromTimestamp(v){
  if(!v) return '';
  var d=new Date(v);
  if(isNaN(d.getTime())) return String(v).slice(0,10);
  var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function periodo(id){
  var el=document.getElementById(id),p=(el&&el.value)||'mes',today=hojeISO();
  if(p==='hoje') return {start:today,end:today,label:'Hoje'};
  if(p==='semana'){
    var d=new Date(); d.setDate(d.getDate()-6);
    var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return {start:y+'-'+m+'-'+day,end:today,label:'Últimos 7 dias'};
  }
  if(p==='mes') return {start:today.slice(0,7)+'-01',end:today,label:'Este mês'};
  return {start:'2000-01-01',end:today,label:'Todo o período'};
}
function dataTemporal(l){
  var comercial=String((l&&(l.data||l.data_entrada))||'').slice(0,10);
  if(comercial) return comercial;
  var uuid=l&&l._uuid?String(l._uuid):'';
  return uuid&&createdAtMap.has(uuid)?createdAtMap.get(uuid):'';
}
function filtrar(rows,id){
  var p=periodo(id);
  return (rows||[]).filter(function(l){
    var d=dataTemporal(l);
    if(!d) return p.label==='Todo o período';
    return d>=p.start&&d<=p.end;
  });
}
function cfg(){ return window.CRM_SUPABASE&&window.CRM_SUPABASE.config; }
function token(){
  var c=cfg(); if(!c) return null;
  try{
    var s=JSON.parse(localStorage.getItem('sb-'+c.projectRef+'-auth-token')||'null');
    return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token));
  }catch(e){ return null; }
}
function loadCreatedAtMap(){
  if(createdAtLoading) return createdAtLoading;
  var c=cfg(),t=token();
  if(!c||!t) return Promise.resolve(createdAtMap);
  createdAtLoading=new Promise(function(resolve){
    var out=new Map();
    function page(from){
      var h={
        'apikey':c.publishableKey,
        'Authorization':'Bearer '+t,
        'Accept-Profile':c.schema||'crm',
        'Range':String(from)+'-'+String(from+999)
      };
      fetch(c.url+'/rest/v1/leads?select=id,created_at&deleted_at=is.null&order=id.asc',{headers:h})
        .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
        .then(function(rows){
          rows=Array.isArray(rows)?rows:[];
          rows.forEach(function(x){ if(x&&x.id&&x.created_at) out.set(String(x.id),localDateFromTimestamp(x.created_at)); });
          if(rows.length===1000) page(from+1000);
          else { createdAtMap=out; resolve(createdAtMap); }
        })
        .catch(function(){ resolve(createdAtMap); });
    }
    page(0);
  }).finally(function(){ createdAtLoading=null; });
  return createdAtLoading;
}
function rerenderActive(){
  var d=document.getElementById('page-dashboard');
  var k=document.getElementById('page-kanban');
  if(d&&d.classList.contains('active')&&typeof window.renderDashboard==='function') window.renderDashboard();
  if(k&&k.classList.contains('active')&&typeof window.renderKanban==='function') window.renderKanban();
}
function comLeads(rows,fn,preservarStatsLeads){
  var wprev=window.leads,lprev,stats=document.getElementById('stats'),statsHtml=stats&&stats.innerHTML;
  try{ lprev=leads; }catch(e){ lprev=wprev; }
  window.leads=rows;
  try{ leads=rows; }catch(e){}
  try{ return fn(); }
  finally{
    window.leads=wprev;
    try{ leads=lprev; }catch(e){}
    if(preservarStatsLeads&&stats&&statsHtml!==null) stats.innerHTML=statsHtml;
  }
}
function selectHTML(id,handler){
  var s=document.createElement('select');
  s.id=id;
  s.style.height='34px';
  s.innerHTML='<option value="hoje">Hoje</option><option value="semana">Últimos 7 dias</option><option value="mes" selected>Este mês</option><option value="tudo">Todo o período</option>';
  s.addEventListener('change',handler);
  return s;
}
function inserirControle(pageId,selectId,handler){
  var page=document.getElementById(pageId); if(!page||document.getElementById(selectId)) return;
  var cont=page.querySelector(':scope > .container')||page.querySelector('.container');
  var title=cont&&cont.querySelector(':scope > .section-title'); if(!cont||!title) return;
  var head=document.createElement('div');
  head.className='tm-period-head';
  cont.insertBefore(head,title);
  head.appendChild(title);
  head.appendChild(selectHTML(selectId,handler));
}
function css(){
  if(document.getElementById('tm-period-style')) return;
  var st=document.createElement('style'); st.id='tm-period-style';
  st.textContent='.tm-period-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:1rem}.tm-period-head .section-title{margin-bottom:0!important}#page-kanban{padding:1.5rem 16px!important}#page-kanban>.container{max-width:none!important;width:100%!important;margin:0!important}#page-kanban .kanban{display:flex!important;flex-flow:row nowrap!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;gap:10px!important;align-items:flex-start!important;grid-template-columns:none!important;padding-bottom:12px!important;-webkit-overflow-scrolling:touch}#page-kanban .k-col{flex:0 0 280px!important;min-width:280px!important;max-width:280px!important}';
  document.head.appendChild(st);
}
function atualizarNomeMinhaBase(){
  try{
    var api=window.CRM_SCOPE,meta=api&&api.meta&&api.meta(),me=meta&&meta.me;
    var sel=document.getElementById('crm-scope-select');
    if(!me||!sel) return false;
    var opt=Array.prototype.find.call(sel.options,function(o){return o.value==='mine';});
    if(opt&&me.full_name&&opt.textContent!==me.full_name) opt.textContent=me.full_name;
    return !!(opt&&me.full_name);
  }catch(e){ return false; }
}
function manterNomeMinhaBase(){
  atualizarNomeMinhaBase();
  var alvo=document.querySelector('.actionbar')||document.body;
  if(!alvo||window.__TM_SCOPE_NAME_OBSERVER__) return;
  var obs=new MutationObserver(function(){ atualizarNomeMinhaBase(); });
  obs.observe(alvo,{childList:true,subtree:true});
  window.__TM_SCOPE_NAME_OBSERVER__=obs;
}
function boot(){
  if(typeof window.renderDashboard!=='function'||typeof window.renderKanban!=='function'){ setTimeout(boot,100); return; }
  if(window.__TM_PERIOD_FILTERS__) return;
  window.__TM_PERIOD_FILTERS__=true;
  css();
  var rd=window.renderDashboard,rk=window.renderKanban;
  window.renderDashboard=function(){
    var base=Array.isArray(window.leads)?window.leads:[];
    return comLeads(filtrar(base,'dash-periodo'),rd,true);
  };
  window.renderKanban=function(){
    var base=Array.isArray(window.leads)?window.leads:[];
    return comLeads(filtrar(base,'kanban-periodo'),rk,false);
  };
  inserirControle('page-dashboard','dash-periodo',function(){ window.renderDashboard(); });
  inserirControle('page-kanban','kanban-periodo',function(){ window.renderKanban(); });
  manterNomeMinhaBase();
  var tries=0,t=setInterval(function(){ tries++; if(atualizarNomeMinhaBase()||tries>30) clearInterval(t); },200);
  loadCreatedAtMap().then(rerenderActive);
  window.addEventListener('message',function(ev){
    if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED'){
      setTimeout(function(){ loadCreatedAtMap().then(rerenderActive); },900);
    }
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,0);
})();

/* Taurus Magnum CRM — data da venda + receita por data de fechamento */
(function(){
'use strict';

var saleDateMap=new Map();
var loading=null;
var currentModalLocalId=null;
var alerted=false;

function cfg(){ return window.CRM_SUPABASE&&window.CRM_SUPABASE.config; }
function token(){
  var c=cfg(); if(!c) return null;
  try{
    var s=JSON.parse(localStorage.getItem('sb-'+c.projectRef+'-auth-token')||'null');
    return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token));
  }catch(e){ return null; }
}
function headers(){
  var c=cfg(),t=token();
  if(!c||!t) return null;
  return {'apikey':c.publishableKey,'Authorization':'Bearer '+t,'Content-Type':'application/json','Accept-Profile':c.schema||'crm','Content-Profile':c.schema||'crm'};
}
function rpc(name,body){
  var c=cfg(),h=headers();
  if(!c||!h) return Promise.reject(new Error('Sessão ausente'));
  return fetch(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:h,body:JSON.stringify(body||{})})
    .then(function(r){ return r.text().then(function(t){ if(!r.ok){var m='HTTP '+r.status;try{var j=JSON.parse(t);m=j.message||j.hint||m;}catch(e){}throw new Error(m);}try{return JSON.parse(t);}catch(e){return t;} }); });
}
function loadSaleDates(){
  if(loading) return loading;
  var c=cfg(),h=headers();
  if(!c||!h) return Promise.resolve(saleDateMap);
  loading=new Promise(function(resolve){
    var out=new Map();
    function page(from){
      var hh=Object.assign({},h,{'Range':String(from)+'-'+String(from+999),'Prefer':'count=exact'});
      fetch(c.url+'/rest/v1/leads?select=id,data_fechamento&deleted_at=is.null&order=id.asc',{headers:hh})
        .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
        .then(function(rows){
          rows=Array.isArray(rows)?rows:[];
          rows.forEach(function(x){ if(x&&x.id) out.set(String(x.id),x.data_fechamento||''); });
          if(rows.length===1000) page(from+1000); else { saleDateMap=out; resolve(out); }
        }).catch(function(){ resolve(saleDateMap); });
    }
    page(0);
  }).finally(function(){ loading=null; });
  return loading;
}
function saleDateOf(l){ return l&&l._uuid ? (saleDateMap.get(String(l._uuid))||'') : ''; }
function pad(n){return String(n).padStart(2,'0');}
function todayISO(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function periodRange(selectId){
  var el=document.getElementById(selectId),p=(el&&el.value)||'tudo',today=todayISO();
  if(p==='hoje') return {start:today,end:today};
  if(p==='semana'){var d=new Date();d.setDate(d.getDate()-6);return {start:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),end:today};}
  if(p==='mes') return {start:today.slice(0,7)+'-01',end:today};
  return {start:'0001-01-01',end:'9999-12-31'};
}
function revenueFor(rows,selectId){
  var p=periodRange(selectId),sum=0;
  (rows||[]).forEach(function(l){
    if(!l||l.status!=='Fechado') return;
    var d=saleDateOf(l); if(!d||d<p.start||d>p.end) return;
    var v=Number(l.valor); if(Number.isFinite(v)) sum+=v;
  });
  return sum;
}
function pendingFor(rows){
  return (rows||[]).filter(function(l){return l&&l.status==='Fechado'&&!saleDateOf(l);}).length;
}
function brl(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);}
function patchRevenue(containerId,rows,periodId){
  var root=document.getElementById(containerId); if(!root) return;
  var cards=root.querySelectorAll('.stat');
  Array.prototype.forEach.call(cards,function(card){
    var lab=card.querySelector('.stat-label');
    if(!lab||String(lab.textContent||'').trim().toLowerCase()!=='receita') return;
    var val=card.querySelector('.stat-value'),sub=card.querySelector('.stat-sub');
    if(val) val.textContent=brl(revenueFor(rows,periodId));
    var pend=pendingFor(rows);
    if(sub) sub.textContent=pend ? (pend+' fechado'+(pend===1?'':'s')+' sem data da venda') : 'por data da venda';
  });
}
function refreshRevenue(){
  var base=Array.isArray(window.leads)?window.leads:[];
  patchRevenue('stats',base,'leads-periodo');
  patchRevenue('dash-stats',base,'dash-periodo');
}
function ensureField(){
  if(document.getElementById('tm-sale-date')) return;
  var data=document.getElementById('f-data'); if(!data) return;
  var baseGrid=data.closest('.form-grid'); if(!baseGrid||!baseGrid.parentNode) return;
  var grid=document.createElement('div');
  grid.className='form-grid'; grid.id='tm-sale-date-grid'; grid.style.display='none';
  grid.innerHTML='<div class="form-row" id="tm-sale-date-row"><label>Data da venda</label><input id="tm-sale-date" type="date"></div><div></div>';
  baseGrid.parentNode.insertBefore(grid,baseGrid.nextSibling);
  var st=document.getElementById('f-status');
  if(st) st.addEventListener('change',syncFieldVisibility);
}
function syncFieldVisibility(){
  ensureField();
  var grid=document.getElementById('tm-sale-date-grid'),st=document.getElementById('f-status');
  if(grid&&st) grid.style.display=st.value==='Fechado'?'grid':'none';
}
function populateField(localId){
  ensureField();
  currentModalLocalId=localId||null;
  var l=localId&&Array.isArray(window.leads)?window.leads.find(function(x){return String(x.id)===String(localId);}):null;
  var inp=document.getElementById('tm-sale-date');
  if(inp) inp.value=l?saleDateOf(l):'';
  syncFieldVisibility();
}
function findTargetAfterSave(localId,beforeIds,nome,tel){
  var rows=Array.isArray(window.leads)?window.leads:[];
  if(localId){
    var existing=rows.find(function(x){return String(x.id)===String(localId);});
    if(existing) return existing;
  }
  var fresh=rows.find(function(x){return x&&x.id&&!beforeIds.has(String(x.id))&&String(x.nome||'').trim()===nome&&String(x.telefone||'').replace(/\D/g,'')===tel;});
  return fresh||null;
}
function saveSaleDateForLead(lead,date){
  if(!lead) return Promise.resolve(false);
  var closing=!!date;
  var method=closing?'close_lead_with_sale_date':'set_lead_sale_date';
  var body={
    p_lead_id:lead._uuid||null,
    p_local_id:lead._uuid?null:String(lead.id||''),
    p_data_fechamento:date||null,
    p_source:'crm'
  };
  return rpc(method,body).then(function(r){
    if(closing){
      var x=Array.isArray(r)?r[0]:r;
      if(!x||x.resultado!=='atualizado'||String(x.status||'')!=='Fechado') throw new Error('Fechamento não confirmado');
    }
    if(lead._uuid) saleDateMap.set(String(lead._uuid),date||'');
    var reload=window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function'
      ? Promise.resolve(window.CRM_CANONICAL.reload()) : Promise.resolve();
    return reload.then(function(){ return loadSaleDates(); }).then(function(){
      refreshRevenue();
      if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function') return window.CRM_FOLLOWUP.carregar();
    }).then(function(){
      try{ if(typeof showToast==='function') showToast(date?'Venda fechada e data salva.':'Data da venda removida.'); }catch(e){}
      return true;
    });
  }).catch(function(e){
    try{ if(typeof showToast==='function') showToast('Não foi possível salvar a venda: '+e.message); }catch(_){}
    return false;
  });
}
function installModalHooks(){
  if(window.__TM_SALE_MODAL_HOOKS__) return true;
  if(typeof window.openModal!=='function'||typeof window.saveLead!=='function') return false;
  window.__TM_SALE_MODAL_HOOKS__=true;
  var originalOpen=window.openModal,originalSaveLead=window.saveLead;
  window.openModal=function(id){
    var r=originalOpen.apply(this,arguments);
    populateField(id||null);
    return r;
  };
  window.saveLead=function(){
    ensureField();
    var st=document.getElementById('f-status'),inp=document.getElementById('tm-sale-date');
    var shouldPersist=!!(st&&st.value==='Fechado');
    var date=inp?inp.value:'';
    var localId=currentModalLocalId;
    var nome=String((document.getElementById('f-nome')||{}).value||'').trim();
    var tel=String((document.getElementById('f-tel')||{}).value||'').replace(/\D/g,'');
    var beforeIds=new Set((Array.isArray(window.leads)?window.leads:[]).map(function(x){return String(x.id);}));
    var captured=null,origSave=window.save;
    if(typeof origSave==='function'){
      window.save=function(){captured=origSave.apply(this,arguments);return captured;};
    }
    var r;
    try{ r=originalSaveLead.apply(this,arguments); }
    finally{ if(typeof origSave==='function') window.save=origSave; }
    if(shouldPersist){
      Promise.resolve(captured).catch(function(){}).then(function(){
        setTimeout(function(){
          var target=findTargetAfterSave(localId,beforeIds,nome,tel);
          if(target) saveSaleDateForLead(target,date);
        },120);
      });
    }
    currentModalLocalId=null;
    return r;
  };
  ensureField();
  return true;
}
function alertPendingOnce(){
  if(alerted) return;
  var rows=Array.isArray(window.leads)?window.leads:[];
  if(!rows.length) return;
  var n=pendingFor(rows); if(!n){alerted=true;return;}
  alerted=true;
  var el=document.createElement('div');
  el.id='tm-sale-date-alert';
  el.style.cssText='position:fixed;right:22px;top:118px;z-index:6000;max-width:360px;background:#2a1119;border:1px solid rgba(248,113,113,.55);color:#fecaca;border-radius:10px;padding:12px 38px 12px 14px;box-shadow:0 14px 40px rgba(0,0,0,.35);font-size:12px;line-height:1.45';
  el.innerHTML='<strong>'+n+' venda'+(n===1?'':'s')+' fechada'+(n===1?'':'s')+' sem data da venda.</strong><br><span style="color:#fca5a5">Preencha no cadastro do lead para contabilizar a Receita.</span><button aria-label="Fechar" style="position:absolute;right:10px;top:8px;background:none;border:0;color:#fca5a5;font-size:18px;cursor:pointer">×</button>';
  var b=el.querySelector('button'); if(b) b.onclick=function(){el.remove();};
  document.body.appendChild(el);
  setTimeout(function(){if(el&&el.parentNode)el.remove();},12000);
}
function installRenderHooks(){
  if(window.__TM_SALE_RENDER_HOOKS__) return true;
  if(typeof window.renderStats!=='function'||typeof window.renderDashboard!=='function') return false;
  window.__TM_SALE_RENDER_HOOKS__=true;
  var rs=window.renderStats,rd=window.renderDashboard;
  window.renderStats=function(){var base=Array.isArray(window.leads)?window.leads.slice():[];var r=rs.apply(this,arguments);patchRevenue('stats',base,'leads-periodo');return r;};
  window.renderDashboard=function(){var base=Array.isArray(window.leads)?window.leads.slice():[];var r=rd.apply(this,arguments);patchRevenue('dash-stats',base,'dash-periodo');return r;};
  return true;
}
function boot(){
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    var ok1=installModalHooks(),ok2=installRenderHooks();
    if(ok1&&ok2){clearInterval(timer);loadSaleDates().then(function(){refreshRevenue();setTimeout(alertPendingOnce,900);});}
    if(tries>80) clearInterval(timer);
  },100);
  window.addEventListener('message',function(ev){
    if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED') setTimeout(function(){loadSaleDates().then(refreshRevenue);},900);
  });
  window.addEventListener('focus',function(){loadSaleDates().then(refreshRevenue);});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();

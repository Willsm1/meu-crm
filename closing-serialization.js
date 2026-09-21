/* Taurus Magnum CRM — serialize existing-lead close before legacy save/reload */
(function(){
'use strict';
if(window.__TM_CLOSING_SERIALIZATION__)return;
window.__TM_CLOSING_SERIALIZATION__=true;

var trackedId=null;
var installed=false;

function install(){
  if(installed)return true;
  /* Wait until sales-date.js has installed its own modal/save hooks. */
  if(!window.__TM_SALE_MODAL_HOOKS__||typeof window.openModal!=='function'||typeof window.saveLead!=='function')return false;
  installed=true;

  var priorOpen=window.openModal;
  var priorSave=window.saveLead;

  window.openModal=function(id){
    trackedId=id||null;
    return priorOpen.apply(this,arguments);
  };

  window.saveLead=function(){
    var st=document.getElementById('f-status');
    var dateEl=document.getElementById('tm-sale-date');
    var closing=!!(st&&st.value==='Fechado'&&dateEl&&dateEl.value);
    var localId=trackedId;

    /* New leads still need the normal create-then-close path. */
    if(!closing||!localId)return priorSave.apply(this,arguments);

    var rows=Array.isArray(window.leads)?window.leads:[];
    var lead=rows.find(function(x){return String(x.id)===String(localId);});
    if(!lead||!lead._uuid||!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')
      return priorSave.apply(this,arguments);

    var btn=document.getElementById('save-btn');
    var oldText=btn?btn.textContent:'';
    if(btn){btn.disabled=true;btn.textContent='Salvando...';}

    /* Close first in Supabase. Only after the database is already Fechado do we
       let the legacy save pipeline run. Its intermediate reload therefore can no
       longer render the previous status. */
    return window.CRM_CANONICAL.rpc('close_lead_with_sale_date',{
      p_lead_id:lead._uuid,
      p_local_id:null,
      p_data_fechamento:dateEl.value,
      p_source:'crm'
    }).then(function(r){
      var x=Array.isArray(r)?r[0]:r;
      if(!x||x.resultado!=='atualizado'||String(x.status||'')!=='Fechado')
        throw new Error('Fechamento não confirmado');
      /* Keep in-memory row coherent before the legacy diff is calculated. */
      lead.status='Fechado';
      return priorSave.apply(window,[]);
    }).catch(function(e){
      try{if(typeof showToast==='function')showToast('Não foi possível fechar a venda: '+(e&&e.message||e));}catch(_){}
      throw e;
    }).finally(function(){
      trackedId=null;
      if(btn){btn.disabled=false;btn.textContent=oldText||'Salvar';}
    });
  };
  return true;
}

function boot(){
  var n=0,t=setInterval(function(){
    n++;
    if(install()||n>120)clearInterval(t);
  },100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

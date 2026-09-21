/* Taurus Magnum CRM — atomic existing-lead close without legacy intermediate reload */
(function(){
'use strict';
if(window.__TM_CLOSING_SERIALIZATION__)return;
window.__TM_CLOSING_SERIALIZATION__=true;

var trackedId=null;
var installed=false;

function el(id){return document.getElementById(id);}
function sval(id){var e=el(id);return e?String(e.value||''):'';}
function trimmed(id){return sval(id).trim();}
function nval(id){
  var raw=sval(id);
  if(raw==='')return null;
  try{if(typeof valorNum==='function')return Number(valorNum(raw));}catch(e){}
  var n=Number(String(raw).replace(/\./g,'').replace(',','.'));return isFinite(n)?n:null;
}
function buildPatch(lead){
  var patch={};
  function put(k,v,old){if(String(v==null?'':v)!==String(old==null?'':old))patch[k]=v;}
  put('nome',trimmed('f-nome'),lead.nome);
  put('empresa',trimmed('f-empresa'),lead.empresa);
  put('email',trimmed('f-email').toLowerCase(),String(lead.email||'').toLowerCase());
  put('telefone',trimmed('f-tel'),lead.telefone);
  put('valor',nval('f-valor'),lead.valor===''?null:lead.valor);
  put('data_entrada',sval('f-data')||null,lead.data||lead.data_entrada||null);
  put('origem',trimmed('f-origem')||null,lead.origem||null);
  put('perfil',sval('f-perfil')||null,lead.perfil||null);
  put('regiao',trimmed('f-regiao')||null,lead.regiao||null);
  put('notas',sval('f-notas'),lead.notas||'');
  return patch;
}

function install(){
  if(installed)return true;
  if(!window.__TM_SALE_MODAL_HOOKS__||typeof window.openModal!=='function'||typeof window.saveLead!=='function')return false;
  installed=true;

  var priorOpen=window.openModal;
  var priorSave=window.saveLead;

  window.openModal=function(id){
    trackedId=id||null;
    return priorOpen.apply(this,arguments);
  };

  window.saveLead=function(){
    var st=el('f-status'),dateEl=el('tm-sale-date');
    var closing=!!(st&&st.value==='Fechado'&&dateEl&&dateEl.value);
    var localId=trackedId;

    if(!closing||!localId)return priorSave.apply(this,arguments);

    var rows=Array.isArray(window.leads)?window.leads:[];
    var lead=rows.find(function(x){return String(x.id)===String(localId);});
    if(!lead||!lead._uuid||!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')
      return priorSave.apply(this,arguments);

    var nome=trimmed('f-nome');
    if(!nome){alert('Nome é obrigatório.');return;}

    var btn=el('save-btn'),oldText=btn?btn.textContent:'';
    if(btn){btn.disabled=true;btn.textContent='Salvando...';}

    var patch=buildPatch(lead);
    var p=Promise.resolve();
    if(Object.keys(patch).length){
      p=p.then(function(){
        return window.CRM_CANONICAL.rpc('update_lead_by_id',{p_lead_id:lead._uuid,p_patch:patch});
      });
    }

    /* Existing close bypasses the legacy save wrapper entirely. That wrapper
       performs an intermediate reload and was the source of the visual/status
       bounce. We persist ordinary field edits first, then close atomically, and
       reload exactly once from Supabase. */
    return p.then(function(){
      return window.CRM_CANONICAL.rpc('close_lead_with_sale_date',{
        p_lead_id:lead._uuid,
        p_local_id:null,
        p_data_fechamento:dateEl.value,
        p_source:'crm'
      });
    }).then(function(r){
      var x=Array.isArray(r)?r[0]:r;
      if(!x||x.resultado!=='atualizado'||String(x.status||'')!=='Fechado')
        throw new Error('Fechamento não confirmado');
      lead.status='Fechado';
      try{if(typeof closeModal==='function')closeModal();}catch(e){}
      var reload=(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function')
        ? Promise.resolve(window.CRM_CANONICAL.reload()) : Promise.resolve();
      return reload.then(function(){
        if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function')
          return window.CRM_FOLLOWUP.carregar();
      });
    }).then(function(){
      try{if(typeof showToast==='function')showToast('Venda fechada e data salva.');}catch(e){}
      return true;
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

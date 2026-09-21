/* Taurus Magnum CRM — cache-safe atomic close v2 */
(function(){
'use strict';
if(window.__TM_CLOSING_V2__)return;
window.__TM_CLOSING_V2__=true;

var currentId=null, installed=false;
function el(id){return document.getElementById(id);}
function txt(id){var e=el(id);return e?String(e.value||''):'';}
function trim(id){return txt(id).trim();}
function num(id){var raw=txt(id);if(raw==='')return null;try{if(typeof valorNum==='function')return Number(valorNum(raw));}catch(e){}var n=Number(String(raw).replace(/\./g,'').replace(',','.'));return isFinite(n)?n:null;}
function patchFor(lead){
  var p={};
  function put(k,v,old){if(String(v==null?'':v)!==String(old==null?'':old))p[k]=v;}
  put('nome',trim('f-nome'),lead.nome);
  put('empresa',trim('f-empresa'),lead.empresa);
  put('email',trim('f-email').toLowerCase(),String(lead.email||'').toLowerCase());
  put('telefone',trim('f-tel'),lead.telefone);
  put('valor',num('f-valor'),lead.valor===''?null:lead.valor);
  put('data_entrada',txt('f-data')||null,lead.data||lead.data_entrada||null);
  put('origem',trim('f-origem')||null,lead.origem||null);
  put('perfil',txt('f-perfil')||null,lead.perfil||null);
  put('regiao',trim('f-regiao')||null,lead.regiao||null);
  put('notas',txt('f-notas'),lead.notas||'');
  return p;
}
function install(){
  if(installed)return true;
  if(!window.__TM_SALE_MODAL_HOOKS__||typeof window.openModal!=='function'||typeof window.saveLead!=='function')return false;
  installed=true;
  var oldOpen=window.openModal, oldSave=window.saveLead;
  window.openModal=function(id){currentId=id||null;return oldOpen.apply(this,arguments);};
  window.saveLead=function(){
    var st=el('f-status'), dateEl=el('tm-sale-date');
    var closing=!!(st&&st.value==='Fechado'&&dateEl&&dateEl.value);
    if(!closing||!currentId)return oldSave.apply(this,arguments);

    var rows=Array.isArray(window.leads)?window.leads:[];
    var lead=rows.find(function(x){return String(x.id)===String(currentId);});
    if(!lead||!lead._uuid||!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')return oldSave.apply(this,arguments);
    if(!trim('f-nome')){alert('Nome é obrigatório.');return false;}

    var btn=el('save-btn'), oldLabel=btn?btn.textContent:'';
    if(btn){btn.disabled=true;btn.textContent='Salvando...';}
    var patch=patchFor(lead);
    var work=Promise.resolve();
    if(Object.keys(patch).length){
      work=work.then(function(){return window.CRM_CANONICAL.rpc('update_lead_by_id',{p_lead_id:lead._uuid,p_patch:patch});});
    }
    return work.then(function(){
      return window.CRM_CANONICAL.rpc('close_lead_with_sale_date',{
        p_lead_id:lead._uuid,
        p_local_id:null,
        p_data_fechamento:dateEl.value,
        p_source:'crm'
      });
    }).then(function(r){
      var x=Array.isArray(r)?r[0]:r;
      if(!x||x.resultado!=='atualizado'||String(x.status||'')!=='Fechado')throw new Error('Fechamento não confirmado');
      lead.status='Fechado';
      try{if(typeof closeModal==='function')closeModal();}catch(e){}
      if(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function')return Promise.resolve(window.CRM_CANONICAL.reload());
    }).then(function(){
      if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function')return window.CRM_FOLLOWUP.carregar();
    }).then(function(){
      try{if(typeof showToast==='function')showToast('Venda fechada e data salva.');}catch(e){}
      return true;
    }).catch(function(e){
      try{if(typeof showToast==='function')showToast('Não foi possível fechar a venda: '+(e&&e.message||e));}catch(_){}
      return false;
    }).finally(function(){
      currentId=null;
      if(btn){btn.disabled=false;btn.textContent=oldLabel||'Salvar';}
    });
  };
  return true;
}
function boot(){var tries=0,t=setInterval(function(){tries++;if(install()||tries>120)clearInterval(t);},100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

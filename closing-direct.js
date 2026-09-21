/* Taurus Magnum CRM — direct closed-sale save at button boundary */
(function(){
'use strict';
if(window.__TM_CLOSING_DIRECT__)return;
window.__TM_CLOSING_DIRECT__=true;

var currentId=null,busy=false;
function el(id){return document.getElementById(id);}
function val(id){var e=el(id);return e?String(e.value||''):'';}
function trim(id){return val(id).trim();}
function num(id){var raw=val(id);if(raw==='')return null;try{if(typeof valorNum==='function')return Number(valorNum(raw));}catch(e){}var n=Number(String(raw).replace(/\./g,'').replace(',','.'));return isFinite(n)?n:null;}
function patchFor(lead){
  var p={};
  function put(k,v,old){if(String(v==null?'':v)!==String(old==null?'':old))p[k]=v;}
  put('nome',trim('f-nome'),lead.nome);
  put('empresa',trim('f-empresa'),lead.empresa);
  put('email',trim('f-email').toLowerCase(),String(lead.email||'').toLowerCase());
  put('telefone',trim('f-tel'),lead.telefone);
  put('valor',num('f-valor'),lead.valor===''?null:lead.valor);
  put('data_entrada',val('f-data')||null,lead.data||lead.data_entrada||null);
  put('origem',trim('f-origem')||null,lead.origem||null);
  put('perfil',val('f-perfil')||null,lead.perfil||null);
  put('regiao',trim('f-regiao')||null,lead.regiao||null);
  put('notas',val('f-notas'),lead.notas||'');
  return p;
}
function trackOpen(){
  if(typeof window.openModal!=='function'||window.__TM_CLOSING_DIRECT_OPEN__)return false;
  window.__TM_CLOSING_DIRECT_OPEN__=true;
  var old=window.openModal;
  window.openModal=function(id){currentId=id||null;return old.apply(this,arguments);};
  return true;
}
function saveClosed(){
  if(busy)return;
  var st=el('f-status'),dateEl=el('tm-sale-date');
  if(!st||st.value!=='Fechado'||!dateEl||!dateEl.value||!currentId)return;
  var rows=Array.isArray(window.leads)?window.leads:[];
  var lead=rows.find(function(x){return String(x.id)===String(currentId);});
  if(!lead||!lead._uuid||!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')return;
  if(!trim('f-nome')){alert('Nome é obrigatório.');return;}
  busy=true;
  var btn=el('save-btn'),old=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  var patch=patchFor(lead);
  var work=Promise.resolve();
  if(Object.keys(patch).length){
    work=work.then(function(){return window.CRM_CANONICAL.rpc('update_lead_by_id',{p_lead_id:lead._uuid,p_patch:patch});});
  }
  work.then(function(){
    return window.CRM_CANONICAL.rpc('close_lead_with_sale_date',{
      p_lead_id:lead._uuid,p_local_id:null,p_data_fechamento:dateEl.value,p_source:'crm'
    });
  }).then(function(r){
    var x=Array.isArray(r)?r[0]:r;
    if(!x||x.resultado!=='atualizado'||String(x.status||'')!=='Fechado')throw new Error('Fechamento não confirmado');
    lead.status='Fechado';
    try{if(typeof closeModal==='function')closeModal();}catch(e){}
    currentId=null;
    return window.CRM_CANONICAL.reload();
  }).then(function(){
    if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function')return window.CRM_FOLLOWUP.carregar();
  }).then(function(){try{if(typeof showToast==='function')showToast('Venda fechada e data salva.');}catch(e){}})
    .catch(function(e){try{if(typeof showToast==='function')showToast('Não foi possível fechar a venda: '+(e&&e.message||e));}catch(_){};})
    .finally(function(){busy=false;if(btn){btn.disabled=false;btn.textContent=old||'Salvar';}});
}
/* Capture phase runs before inline onclick/saveLead and before wrapper listeners. */
document.addEventListener('click',function(ev){
  var t=ev.target&&ev.target.closest?ev.target.closest('#save-btn'):null;
  if(!t)return;
  var st=el('f-status'),dateEl=el('tm-sale-date');
  if(!(st&&st.value==='Fechado'&&dateEl&&dateEl.value&&currentId))return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  saveClosed();
},true);
function boot(){var n=0,t=setInterval(function(){n++;if(trackOpen()||n>120)clearInterval(t);},100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

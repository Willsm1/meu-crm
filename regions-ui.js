/* Taurus Magnum CRM — regiões centralizadas no Supabase
 * Autocomplete pesquisável para Região e cadastro central via crm.upsert_region.
 * Fonte única: crm.regions. Sem lista local paralela.
 */
(function(){
'use strict';

var regions=[];
var normalized=new Map();
var loaded=false;
var loading=null;
var modalWrapped=false;
var saveWrapped=false;

function cfg(){return window.CRM_SUPABASE&&window.CRM_SUPABASE.config;}
function token(){
  var c=cfg();if(!c)return null;
  try{var s=JSON.parse(localStorage.getItem('sb-'+c.projectRef+'-auth-token')||'null');return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token));}catch(e){return null;}
}
function headers(){var c=cfg(),t=token();return c&&t?{'apikey':c.publishableKey,'Authorization':'Bearer '+t,'Accept-Profile':c.schema||'crm','Content-Profile':c.schema||'crm','Content-Type':'application/json'}:null;}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();}
function role(){try{return typeof papelAtual==='function'?papelAtual():'';}catch(e){return '';}}
function canManage(){var r=role();return r==='admin'||r==='gerente';}
function rebuild(){normalized=new Map();regions.forEach(function(r){normalized.set(norm(r.name),r.name);});}
function listUrl(){var c=cfg();return c.url+'/rest/v1/regions?select=id,name,normalized_name&is_active=eq.true&order=name.asc';}
function loadRegions(force){
  if(loading&&!force)return loading;
  if(loaded&&!force)return Promise.resolve(regions);
  var c=cfg(),h=headers();
  if(!c||!h)return Promise.reject(new Error('Sessão Supabase ausente'));
  loading=fetch(listUrl(),{headers:{'apikey':c.publishableKey,'Authorization':h.Authorization,'Accept-Profile':c.schema||'crm'}})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(rows){regions=Array.isArray(rows)?rows:[];rebuild();loaded=true;renderDatalist();return regions;})
    .finally(function(){loading=null;});
  return loading;
}
function renderDatalist(){
  var dl=document.getElementById('tm-regions-list');
  if(!dl){dl=document.createElement('datalist');dl.id='tm-regions-list';document.body.appendChild(dl);}
  dl.innerHTML=regions.map(function(r){return '<option value="'+String(r.name).replace(/"/g,'&quot;')+'"></option>';}).join('');
  var main=document.getElementById('f-regiao');if(main)main.setAttribute('list','tm-regions-list');
  var filter=document.getElementById('search-regiao');if(filter)filter.setAttribute('list','tm-regions-list');
}
function canonical(v){return normalized.get(norm(v))||'';}
function validateMain(){
  var inp=document.getElementById('f-regiao');if(!inp)return true;
  var raw=inp.value.trim();if(!raw){inp.setCustomValidity('');return true;}
  var c=canonical(raw);
  if(c){inp.value=c;inp.setCustomValidity('');return true;}
  inp.setCustomValidity('Escolha uma região cadastrada.');
  if(typeof inp.reportValidity==='function')inp.reportValidity();
  return false;
}
function rpcUpsert(name){
  if(!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')return Promise.reject(new Error('Camada canônica indisponível'));
  return window.CRM_CANONICAL.rpc('upsert_region',{p_nome:name}).then(function(r){
    var x=Array.isArray(r)?r[0]:r;
    if(!x||!x.name)throw new Error('Cadastro não confirmado pelo Supabase');
    return x;
  });
}
function ensureManager(){
  var inp=document.getElementById('f-regiao');if(!inp)return;
  inp.setAttribute('list','tm-regions-list');
  inp.setAttribute('autocomplete','off');
  inp.placeholder='Digite para buscar uma região';
  var row=inp.closest('.form-row');if(!row)return;
  var btn=document.getElementById('tm-region-add');
  if(!btn){
    var wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:6px;align-items:center';
    inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
    btn=document.createElement('button');btn.type='button';btn.id='tm-region-add';btn.className='btn btn-sm';btn.textContent='+ Região';btn.title='Cadastrar nova região no Supabase';wrap.appendChild(btn);
    btn.onclick=function(ev){
      ev.preventDefault();ev.stopPropagation();
      var initial=(inp.value||'').trim();
      var name=window.prompt('Nova região:',initial);
      if(name===null)return;
      name=String(name).trim();if(!name)return;
      btn.disabled=true;btn.textContent='Salvando...';
      rpcUpsert(name).then(function(x){
        loaded=false;return loadRegions(true).then(function(){inp.value=x.name;inp.setCustomValidity('');if(typeof showToast==='function')showToast('Região disponível para CRM e extensão: '+x.name);});
      }).catch(function(e){if(typeof showToast==='function')showToast('Não foi possível cadastrar região: '+e.message);})
        .finally(function(){btn.disabled=false;btn.textContent='+ Região';});
    };
  }
  btn.style.display=canManage()?'inline-flex':'none';
}
function wireInput(){
  var inp=document.getElementById('f-regiao');if(!inp)return;
  inp.oninput=function(){this.setCustomValidity('');};
  inp.onchange=function(){
    var c=canonical(this.value);if(c){this.value=c;this.setCustomValidity('');}
  };
}
function wrapOnce(){
  if(!modalWrapped&&typeof window.openModal==='function'){
    var originalModal=window.openModal;
    window.openModal=function(){
      var r=originalModal.apply(this,arguments);
      loadRegions(false).catch(function(){}).then(function(){ensureManager();wireInput();});
      return r;
    };
    modalWrapped=true;
  }
  if(!saveWrapped&&typeof window.saveLead==='function'){
    var originalSave=window.saveLead;
    window.saveLead=function(){
      if(!validateMain())return;
      return originalSave.apply(this,arguments);
    };
    saveWrapped=true;
  }
}
function start(){
  wrapOnce();
  loadRegions(false).catch(function(e){try{console.warn('[CRM REGIOES]',e&&e.message||e);}catch(_){};});
  setTimeout(function(){wrapOnce();renderDatalist();},500);
}
window.addEventListener('message',function(ev){
  if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED')setTimeout(function(){loaded=false;loadRegions(true).catch(function(){});},250);
});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){loaded=false;loadRegions(true).catch(function(){});}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.CRM_REGIONS_UI={refresh:function(){loaded=false;return loadRegions(true);},list:function(){return regions.slice();}};
})();

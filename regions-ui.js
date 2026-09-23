/* Taurus Magnum CRM — regiões centralizadas no Supabase
 * Autocomplete pesquisável para Região e cadastro central via crm.upsert_region.
 * Fonte única: crm.regions. Cadastro protegido no backend para admin.
 */
(function(){
'use strict';
var regions=[],normalized=new Map(),loaded=false,loading=null,modalWrapped=false,saveWrapped=false;
function cfg(){return window.CRM_SUPABASE&&window.CRM_SUPABASE.config;}
function token(){var c=cfg();if(!c)return null;try{var s=JSON.parse(localStorage.getItem('sb-'+c.projectRef+'-auth-token')||'null');return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token));}catch(e){return null;}}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();}
function role(){try{var m=window.CRM_SCOPE&&typeof window.CRM_SCOPE.meta==='function'?window.CRM_SCOPE.meta():null;if(m&&m.me&&m.me.role)return m.me.role;return typeof papelAtual==='function'?papelAtual():'';}catch(e){return '';}}
function canManage(){return role()==='admin';}
function rebuild(){normalized=new Map();regions.forEach(function(r){normalized.set(norm(r.name),r.name);});}
function loadRegions(force){
  if(loading&&!force)return loading;if(loaded&&!force)return Promise.resolve(regions);
  var c=cfg(),t=token();if(!c||!t)return Promise.reject(new Error('Sessão Supabase ausente'));
  loading=fetch(c.url+'/rest/v1/regions?select=id,name,normalized_name&is_active=eq.true&order=name.asc',{headers:{'apikey':c.publishableKey,'Authorization':'Bearer '+t,'Accept-Profile':c.schema||'crm'}})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(rows){regions=Array.isArray(rows)?rows:[];rebuild();loaded=true;renderDatalist();return regions;})
    .finally(function(){loading=null;});return loading;
}
function renderDatalist(){
  var dl=document.getElementById('tm-regions-list');if(!dl){dl=document.createElement('datalist');dl.id='tm-regions-list';document.body.appendChild(dl);}
  dl.innerHTML=regions.map(function(r){return '<option value="'+String(r.name).replace(/"/g,'&quot;')+'"></option>';}).join('');
  var main=document.getElementById('f-regiao');if(main)main.setAttribute('list','tm-regions-list');
  var filter=document.getElementById('search-regiao');if(filter)filter.setAttribute('list','tm-regions-list');
}
function canonical(v){return normalized.get(norm(v))||'';}
function validateMain(){var inp=document.getElementById('f-regiao');if(!inp)return true;var raw=inp.value.trim();if(!raw){inp.setCustomValidity('');return true;}var c=canonical(raw);if(c){inp.value=c;inp.setCustomValidity('');return true;}inp.setCustomValidity('Escolha uma região cadastrada.');if(typeof inp.reportValidity==='function')inp.reportValidity();return false;}
function rpcUpsert(name){if(!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')return Promise.reject(new Error('Camada canônica indisponível'));return window.CRM_CANONICAL.rpc('upsert_region',{p_nome:name}).then(function(r){var x=Array.isArray(r)?r[0]:r;if(!x||!x.name)throw new Error('Cadastro não confirmado pelo Supabase');return x;});}
function ensureManager(){
  var inp=document.getElementById('f-regiao');if(!inp)return;inp.setAttribute('list','tm-regions-list');inp.setAttribute('autocomplete','off');inp.placeholder='Digite para buscar uma região';
  var btn=document.getElementById('tm-region-add');
  if(!btn){var wrap=document.createElement('div');wrap.style.cssText='display:flex;gap:6px;align-items:center';inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);btn=document.createElement('button');btn.type='button';btn.id='tm-region-add';btn.className='btn btn-sm';btn.textContent='+ Região';btn.title='Cadastrar nova região no Supabase';wrap.appendChild(btn);btn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();if(!canManage()){if(typeof showToast==='function')showToast('Somente administrador pode cadastrar região.');return;}var name=window.prompt('Nova região:',String(inp.value||'').trim());if(name===null)return;name=String(name).trim();if(!name)return;btn.disabled=true;btn.textContent='Salvando...';rpcUpsert(name).then(function(x){loaded=false;return loadRegions(true).then(function(){inp.value=x.name;inp.setCustomValidity('');if(typeof showToast==='function')showToast('Região cadastrada: '+x.name);});}).catch(function(e){if(typeof showToast==='function')showToast('Não foi possível cadastrar região: '+e.message);}).finally(function(){btn.disabled=false;btn.textContent='+ Região';});};}
  btn.style.display=canManage()?'inline-flex':'none';
}
function wireInput(){var inp=document.getElementById('f-regiao');if(!inp)return;inp.oninput=function(){this.setCustomValidity('');};inp.onchange=function(){var c=canonical(this.value);if(c){this.value=c;this.setCustomValidity('');}};}
function wrapOnce(){
  if(!modalWrapped&&typeof window.openModal==='function'){var om=window.openModal;window.openModal=function(){var r=om.apply(this,arguments);loadRegions(false).catch(function(){}).then(function(){ensureManager();wireInput();});return r;};modalWrapped=true;}
  if(!saveWrapped&&typeof window.saveLead==='function'){var os=window.saveLead;window.saveLead=function(){if(!validateMain())return;return os.apply(this,arguments);};saveWrapped=true;}
}
function start(){wrapOnce();loadRegions(false).catch(function(e){try{console.warn('[CRM REGIOES]',e&&e.message||e);}catch(_){};});setTimeout(function(){wrapOnce();renderDatalist();},500);}
window.addEventListener('message',function(ev){if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED')setTimeout(function(){loaded=false;loadRegions(true).catch(function(){});},250);});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){loaded=false;loadRegions(true).catch(function(){});}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.CRM_REGIONS_UI={refresh:function(){loaded=false;return loadRegions(true);},list:function(){return regions.slice();}};
})();

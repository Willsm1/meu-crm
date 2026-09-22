/* Taurus Magnum CRM — Estágio (perfil_produto) UI
 * Exibe o campo canônico crm.leads.perfil_produto como "Estágio" no CRM.
 * Somente leitura: nunca injeta perfil_produto em window.leads e nunca grava.
 */
(function(){
'use strict';

var cache=new Map();
var inflight=false;
var rerun=false;
var renderWrapped=false;
var modalWrapped=false;

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
  return c&&t?{'apikey':c.publishableKey,'Authorization':'Bearer '+t,'Accept-Profile':c.schema||'crm'}:null;
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function allVisible(){
  var arr=Array.isArray(window.leads)?window.leads:[];
  return arr.filter(function(l){return l&&l._uuid;});
}
function fetchStages(){
  if(inflight){rerun=true;return Promise.resolve();}
  var c=cfg(),h=headers(),rows=allVisible();
  if(!c||!h||!rows.length){decorate();return Promise.resolve();}
  var ids=rows.map(function(l){return String(l._uuid);});
  inflight=true;
  var chunks=[];
  for(var i=0;i<ids.length;i+=150)chunks.push(ids.slice(i,i+150));
  return Promise.all(chunks.map(function(chunk){
    var filter='('+chunk.join(',')+')';
    var url=c.url+'/rest/v1/leads?select=id,perfil_produto&id=in.'+encodeURIComponent(filter);
    return fetch(url,{headers:h}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});
  })).then(function(parts){
    cache.clear();
    parts.forEach(function(part){(part||[]).forEach(function(r){cache.set(String(r.id),r.perfil_produto||'');});});
  }).catch(function(e){try{console.warn('[CRM ESTAGIO] leitura:',e&&e.message||e);}catch(_){};})
    .then(function(){inflight=false;decorate();if(rerun){rerun=false;setTimeout(fetchStages,0);}});
}
function profileHeaderIndex(){
  var ths=Array.prototype.slice.call(document.querySelectorAll('#leads-thead th'));
  for(var i=0;i<ths.length;i++)if((ths[i].textContent||'').trim()==='Perfil')return i;
  return -1;
}
function rebalanceWidths(tr){
  var widths={Nome:'10%',Equipe:'7.5%',Responsável:'8.5%',Contato:'11%',Status:'9.5%',Valor:'7.5%',Data:'7%',Origem:'6%',Perfil:'6%',Estágio:'6.5%',Região:'6%','Anotações':'5%',Ações:'5.5%'};
  Array.prototype.forEach.call(tr.children,function(th){
    var t=(th.textContent||'').trim();
    if(widths[t])th.style.width=widths[t];
  });
}
function ensureHeader(){
  var tr=document.getElementById('leads-thead'); if(!tr)return -1;
  var existing=tr.querySelector('th[data-tm-estagio-col]');
  if(existing){rebalanceWidths(tr);return Array.prototype.indexOf.call(tr.children,existing);}
  var idx=profileHeaderIndex(); if(idx<0)return -1;
  var th=document.createElement('th');
  th.dataset.tmEstagioCol='1';
  th.textContent='Estágio';
  var perfil=tr.children[idx];
  tr.insertBefore(th,perfil.nextSibling);
  rebalanceWidths(tr);
  return idx+1;
}
function badge(v){
  if(!v)return '<span style="color:var(--text-muted)">—</span>';
  return '<span class="badge" style="background:rgba(59,130,246,.12);color:#93c5fd;border:.5px solid rgba(59,130,246,.28)">'+esc(v)+'</span>';
}
function fixEmptyColspan(){
  var thCount=document.querySelectorAll('#leads-thead th').length;
  if(!thCount)return;
  document.querySelectorAll('#tbody tr td[colspan]').forEach(function(td){td.colSpan=thCount;});
}
function decorateTable(){
  var idx=ensureHeader(); if(idx<0)return;
  var tbody=document.getElementById('tbody'); if(!tbody)return;
  fixEmptyColspan();
  var list=Array.isArray(window._currentList)?window._currentList:[];
  Array.prototype.slice.call(tbody.querySelectorAll('tr')).forEach(function(tr,rowIndex){
    if(tr.querySelector('.empty')||tr.children.length===1)return;
    var lead=list[rowIndex];
    if(!lead)return;
    var td=tr.querySelector('td[data-tm-estagio-col]');
    if(!td){td=document.createElement('td');td.dataset.tmEstagioCol='1';var ref=tr.children[idx];tr.insertBefore(td,ref||null);}
    var v=cache.get(String(lead._uuid||''))||'';
    td.innerHTML=badge(v);
    td.title=v||'Sem estágio definido';
  });
}
function ensureModalField(lead){
  var perfil=document.getElementById('f-perfil'); if(!perfil)return;
  var row=perfil.closest('.form-row'); if(!row)return;
  var host=document.getElementById('tm-estagio-modal-row');
  if(!host){
    host=document.createElement('div');host.className='form-row';host.id='tm-estagio-modal-row';
    host.innerHTML='<label>Estágio</label><div id="tm-estagio-modal-value" style="min-height:34px;display:flex;align-items:center"></div>';
    row.parentNode.insertBefore(host,row.nextSibling);
  }
  var value=document.getElementById('tm-estagio-modal-value');
  var v=lead?cache.get(String(lead._uuid||''))||'':'';
  if(value)value.innerHTML=badge(v)+(lead?'<span style="font-size:11px;color:var(--text-muted);margin-left:8px">sincronizado do Supabase</span>':'');
  host.style.display=lead?'block':'none';
}
function decorate(){decorateTable();}
function wrapOnce(){
  if(!renderWrapped&&typeof window.renderLeads==='function'){
    var originalRender=window.renderLeads;
    window.renderLeads=function(){
      var r=originalRender.apply(this,arguments);
      setTimeout(function(){decorateTable();fetchStages();},0);
      return r;
    };
    renderWrapped=true;
  }
  if(!modalWrapped&&typeof window.openModal==='function'){
    var originalModal=window.openModal;
    window.openModal=function(id){
      var r=originalModal.apply(this,arguments);
      var lead=id&&Array.isArray(window.leads)?window.leads.find(function(x){return String(x.id)===String(id);}):null;
      ensureModalField(lead);
      if(lead&&lead._uuid&&!cache.has(String(lead._uuid))){
        fetchStages().then(function(){ensureModalField(lead);});
      }
      return r;
    };
    modalWrapped=true;
  }
}
function start(){
  wrapOnce();
  fetchStages();
  setTimeout(function(){wrapOnce();decorate();},500);
}
window.addEventListener('message',function(ev){if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED')setTimeout(fetchStages,250);});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')setTimeout(fetchStages,100);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.CRM_ESTAGIO_UI={refresh:fetchStages,cache:cache};
})();

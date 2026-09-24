/* Taurus Magnum CRM — busca rápida e robusta no Follow-up (TEST BRANCH ONLY) */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_SEARCH_FASTFIX__)return;
window.__TM_FOLLOWUP_SEARCH_FASTFIX__=true;
var frame=null,boundInput=null;
function norm(v){
  var s=String(v==null?'':v).toLowerCase();
  try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
  return s;
}
function linhas(){try{var a=window.CRM_FOLLOWUP;return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];}catch(e){return[];}}
function byId(){var m=new Map();linhas().forEach(function(x){m.set(String(x.lead_id),x);});return m;}
function input(){return document.getElementById('fu-busca');}
function tbody(){return document.getElementById('fu-tbody');}
function leadId(tr){var b=tr.querySelector('.tm-agendar-btn[data-lead-id]');return b?String(b.dataset.leadId||''):'';}
function rowKey(tr,map){
  var id=leadId(tr),x=id&&map.get(id),signature=id+'|'+String(tr.cells&&tr.cells[0]?tr.cells[0].textContent:'');
  if(tr.dataset.tmSearchSignature===signature&&tr.dataset.tmSearchKey)return tr.dataset.tmSearchKey;
  var parts=[tr.textContent];
  if(x)parts.push(x.nome,x.telefone,x.empresa,x.responsavel,x.email,x.regiao,x.status);
  var key=norm(parts.join(' '));
  tr.dataset.tmSearchSignature=signature;
  tr.dataset.tmSearchKey=key;
  return key;
}
function updateCounter(n){
  var e=document.getElementById('fu-estado');if(!e)return;
  var t=String(e.textContent||''),m=t.match(/\s·\s(atualizado\s.+)$/i);
  e.textContent=n+' lead(s) na fila'+(m?' · '+m[1]:'');
}
function applyNow(){
  frame=null;
  var q=input(),tb=tbody();if(!q||!tb)return;
  var term=norm(q.value).trim(),map=byId(),n=0;
  var rows=tb.querySelectorAll('tr');
  for(var i=0;i<rows.length;i++){
    var tr=rows[i],id=leadId(tr);if(!id)continue;
    var ok=!term||rowKey(tr,map).indexOf(term)>=0;
    var d=ok?'':'none';if(tr.style.display!==d)tr.style.display=d;
    if(ok)n++;
  }
  updateCounter(n);
}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(applyNow);}
function replaceAndBindInput(){
  var q=input();if(!q)return false;
  if(boundInput===q)return true;
  var clone=q.cloneNode(true);clone.removeAttribute('oninput');clone.oninput=null;
  clone.placeholder='Buscar nome, empresa, executivo, email ou telefone...';
  q.parentNode.replaceChild(clone,q);boundInput=clone;
  clone.addEventListener('input',schedule,{passive:true});
  return true;
}
function boot(){
  var tries=0,t=setInterval(function(){tries++;replaceAndBindInput();if(boundInput||tries>80)clearInterval(t);},100);
  replaceAndBindInput();schedule();
  document.addEventListener('tm:followup-rendered',schedule);
  document.addEventListener('change',function(e){if(e.target&&/^(fu-prio|fu-resp)$/.test(e.target.id||''))setTimeout(schedule,0);},true);
  window.addEventListener('focus',schedule);
  window.addEventListener('message',function(ev){if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED')setTimeout(schedule,120);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

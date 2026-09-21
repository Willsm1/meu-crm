/* Taurus Magnum CRM — completed follow-up task must not remove eligible lead from queue */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_COMPLETED_QUEUE_FIX__)return;
window.__TM_FOLLOWUP_COMPLETED_QUEUE_FIX__=true;

var ELIGIBLE={'Interações':1,'Em negociação':1,'Proposta enviada':1,'Gold ⭐':1};
var obs=null,busy=false;

function loadClosingDirect(){
  if(document.querySelector('script[data-tm-closing-direct]'))return;
  var c=document.createElement('script');
  c.src='closing-direct.js?v=20260921-0024';
  c.async=false;
  c.dataset.tmClosingDirect='1';
  document.head.appendChild(c);
}
function lines(){
  try{var a=window.CRM_FOLLOWUP;return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];}catch(e){return[];}
}
function mapById(){var m={};lines().forEach(function(x){m[String(x.lead_id)]=x;});return m;}
function rowLeadId(row){
  var b=row&&row.querySelector('.tm-agendar-btn');
  if(b&&b.dataset&&b.dataset.leadId)return String(b.dataset.leadId);
  var old=row&&row.querySelector('input[id^="fu-d-"]');
  return old?String(old.id).slice(5):'';
}
function activeSort(){return !!document.querySelector('.tm-fu-head-sort.on,#tm-age-sort button.on');}
function goldEnabled(){var b=document.getElementById('tm-fu-gold-toggle');return !!(b&&b.getAttribute('aria-pressed')==='true');}
function statusEligible(x){if(!x)return false;var st=String(x.status||'');if(st==='Gold ⭐')return goldEnabled();return !!ELIGIBLE[st];}
function isCompleted(x){return !!(x&&(x.tarefa_concluida||x.prioridade==='concluido'));}
function apply(){
  if(busy)return;
  var tb=document.getElementById('fu-tbody');if(!tb)return;
  busy=true;if(obs)obs.disconnect();
  try{
    var byId=mapById(),rows=Array.prototype.slice.call(tb.querySelectorAll('tr'));
    var completed=[];
    rows.forEach(function(row){
      var id=rowLeadId(row),x=id&&byId[id];
      if(!x||!statusEligible(x)||!isCompleted(x))return;
      row.style.display='';
      row.dataset.tmCompletedStillEligible='1';
      completed.push(row);
    });
    var prio=(document.getElementById('fu-prio')||{}).value||'';
    if(!prio&&!activeSort()&&completed.length){
      var current=Array.prototype.slice.call(tb.querySelectorAll('tr'));
      var firstSemContato=null;
      for(var i=0;i<current.length;i++){
        var id2=rowLeadId(current[i]),x2=id2&&byId[id2];
        if(x2&&x2.prioridade==='sem_contato'){firstSemContato=current[i];break;}
      }
      completed.forEach(function(row){
        if(firstSemContato&&row!==firstSemContato)tb.insertBefore(row,firstSemContato);
        else tb.appendChild(row);
      });
    }
  }finally{
    busy=false;
    if(obs&&tb.isConnected)obs.observe(tb,{childList:true,subtree:false});
  }
}
function boot(){
  loadClosingDirect();
  var tb=document.getElementById('fu-tbody');
  if(!tb){setTimeout(boot,150);return;}
  if(obs)obs.disconnect();
  obs=new MutationObserver(function(){if(!busy)queueMicrotask(apply);});
  obs.observe(tb,{childList:true,subtree:false});
  apply();
  window.TM_FOLLOWUP_COMPLETED_QUEUE_FIX_REFRESH=apply;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

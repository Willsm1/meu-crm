/* Taurus Magnum CRM — tradução visual dos compromissos para pt-BR */
(function(){
'use strict';
if(window.__TM_COMMITMENT_PTBR__)return;
window.__TM_COMMITMENT_PTBR__=true;

var EVENTOS={
  scheduled:'Agendado',
  rescheduled:'Reagendado',
  completed_on_time:'Realizado no horário',
  completed_early:'Realizado antecipadamente',
  completed_late:'Realizado com atraso',
  completed:'Realizado',
  cancel_requested:'Cancelamento solicitado',
  cancel_requested_again:'Cancelamento solicitado novamente',
  admin_archived:'Arquivado pelo Admin',
  admin_kept:'Mantido pelo Admin',
  admin_rescheduled:'Reagendado pelo Admin',
  archived:'Arquivado',
  legacy_adopted:'Agendamento antigo incorporado ao histórico',
  extension_followup:'Follow-up realizado pela extensão',
  extension_call:'Ligação registrada pela extensão'
};
var STATUS={
  scheduled:'Agendado',
  cancel_requested:'Aguardando análise do Admin',
  completed:'Realizado',
  archived:'Arquivado'
};

function traduzEvento(txt){
  var s=String(txt||'');
  Object.keys(EVENTOS).forEach(function(k){
    if(s.indexOf(k)>=0)s=s.split(k).join(EVENTOS[k]);
  });
  return s;
}
function traduzStatus(txt){
  var s=String(txt||'');
  Object.keys(STATUS).forEach(function(k){
    var re=new RegExp('(^|\\s|·)'+k+'(?=\\s|$|·)','g');
    s=s.replace(re,function(m,p){return p+STATUS[k];});
  });
  return s;
}
function aplicar(root){
  var scope=root&&root.querySelectorAll?root:document;
  scope.querySelectorAll('.tm-event b').forEach(function(el){
    var novo=traduzEvento(el.textContent);
    if(novo!==el.textContent)el.textContent=novo;
  });
  scope.querySelectorAll('.tm-history-row').forEach(function(row){
    row.querySelectorAll('div').forEach(function(el){
      var novo=traduzStatus(el.textContent);
      if(novo!==el.textContent)el.textContent=novo;
    });
  });
}
function boot(){
  aplicar(document);
  var alvo=document.body;
  if(!alvo)return;
  var timer=null;
  new MutationObserver(function(muts){
    var relevante=false;
    for(var i=0;i<muts.length;i++){
      var n=muts[i].target;
      if(n&&n.closest&&(n.closest('.tm-commit-modal')||n.closest('.tm-event')||n.closest('.tm-history-row'))){relevante=true;break;}
      for(var j=0;j<muts[i].addedNodes.length;j++){
        var a=muts[i].addedNodes[j];
        if(a.nodeType===1&&(a.matches('.tm-commit-modal,.tm-event,.tm-history-row')||a.querySelector('.tm-event,.tm-history-row'))){relevante=true;break;}
      }
      if(relevante)break;
    }
    if(!relevante)return;
    clearTimeout(timer);
    timer=setTimeout(function(){aplicar(document);},30);
  }).observe(alvo,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

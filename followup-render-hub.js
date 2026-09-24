/* Taurus Magnum CRM — single post-render signal for Follow-up consumers */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_RENDER_HUB__)return;
window.__TM_FOLLOWUP_RENDER_HUB__=true;
var wrapped=false,retries=0,queued=false,obs=null,observedTb=null;
function emit(){
  if(queued)return;
  queued=true;
  queueMicrotask(function(){
    queued=false;
    try{document.dispatchEvent(new CustomEvent('tm:followup-rendered'));}catch(e){}
  });
}
function hasLegacyRender(tb){
  try{return !!(tb&&tb.querySelector&&tb.querySelector('input[id^="fu-d-"]'));}catch(e){return false;}
}
function observeTable(){
  if(typeof document==='undefined'||typeof document.getElementById!=='function'||typeof MutationObserver==='undefined')return false;
  var tb=document.getElementById('fu-tbody');
  if(!tb)return false;
  if(observedTb===tb&&obs)return true;
  if(obs)try{obs.disconnect();}catch(e){}
  observedTb=tb;
  obs=new MutationObserver(function(muts){
    /* Só sinaliza quando o render legado reapareceu. Reordenação, filtros e
       decorações da tabela não podem disparar um novo ciclo de pós-render. */
    if(!hasLegacyRender(tb))return;
    for(var i=0;i<muts.length;i++){
      if(muts[i].type==='childList'){emit();break;}
    }
  });
  obs.observe(tb,{childList:true});
  return true;
}
function install(){
  observeTable();
  if(!wrapped&&typeof window.fuRenderFila==='function'){
    var original=window.fuRenderFila;
    window.fuRenderFila=function(){
      var out=original.apply(this,arguments);
      emit();
      return out;
    };
    wrapped=true;
  }
  if((!wrapped||!observedTb)&&typeof document!=='undefined'&&typeof document.getElementById==='function'){
    if(retries++<80)setTimeout(install,100);
  }
  emit();
  return wrapped||!!observedTb;
}
window.TM_FOLLOWUP_POST_RENDER={schedule:emit,install:install};
if(typeof document!=='undefined'&&document.readyState==='loading'&&typeof document.addEventListener==='function')document.addEventListener('DOMContentLoaded',install);else install();
})();

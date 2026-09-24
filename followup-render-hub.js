/* Taurus Magnum CRM — single post-render signal for Follow-up consumers */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_RENDER_HUB__)return;
window.__TM_FOLLOWUP_RENDER_HUB__=true;
var wrapped=false,frame=null,retries=0;
function emit(){
  if(frame)cancelAnimationFrame(frame);
  frame=requestAnimationFrame(function(){
    frame=null;
    try{document.dispatchEvent(new CustomEvent('tm:followup-rendered'));}catch(e){}
  });
}
function install(){
  if(wrapped)return true;
  if(typeof window.fuRenderFila!=='function'){
    if(retries++<80)setTimeout(install,100);
    return false;
  }
  var original=window.fuRenderFila;
  window.fuRenderFila=function(){
    var out=original.apply(this,arguments);
    emit();
    return out;
  };
  wrapped=true;
  emit();
  return true;
}
window.TM_FOLLOWUP_POST_RENDER={schedule:emit,install:install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
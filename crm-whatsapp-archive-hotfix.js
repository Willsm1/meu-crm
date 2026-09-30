/* Taurus Magnum CRM — archive bar reinjection hotfix — TEST BRANCH ONLY */
(function(){
'use strict';
if(window.__TM_WA_ARCHIVE_HOTFIX__) return;
window.__TM_WA_ARCHIVE_HOTFIX__=true;
function repair(){
  const body=document.querySelector('#tm-wa-lead-history');
  if(!body) return;
  const bar=body.querySelector('.tm-wa-archive-bar');
  if(!bar && body.dataset.archiveUi){
    delete body.dataset.archiveUi;
  }
}
function boot(){
  repair();
  new MutationObserver(repair).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(repair,250);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
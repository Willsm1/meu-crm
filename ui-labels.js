/* Taurus Magnum CRM — rótulos de interface */
(function(){
'use strict';
function aplicar(){
  var tab=document.querySelector('.nav-tab[data-tab="leads"]');
  if(!tab) return false;
  var icon=tab.querySelector('i');
  tab.innerHTML='';
  if(icon) tab.appendChild(icon);
  tab.appendChild(document.createTextNode(' Carteira'));
  return true;
}
function boot(){
  if(aplicar()) return;
  var tries=0,t=setInterval(function(){ if(aplicar()||++tries>30) clearInterval(t); },100);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();

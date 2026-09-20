/* Taurus Magnum CRM — bloqueia swipe lateral do navegador sem impedir scroll interno */
(function(){
'use strict';
function apply(){
  if(document.getElementById('tm-gesture-nav-guard')) return;
  var st=document.createElement('style');
  st.id='tm-gesture-nav-guard';
  st.textContent='html,body{overscroll-behavior-x:none!important}#page-kanban{overscroll-behavior-x:none!important}#page-kanban *{overscroll-behavior-x:contain}.nav-tabs,.actionbar-scr{overscroll-behavior-x:contain!important}';
  document.head.appendChild(st);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();

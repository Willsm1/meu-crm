/* Taurus Magnum CRM — visibilidade contextual da barra de ações (TEST BRANCH ONLY) */
(function(){
'use strict';
if(window.__TM_ACTIONBAR_CONTEXT_UI__)return;
window.__TM_ACTIONBAR_CONTEXT_UI__=true;
var observers=[];
function carteiraAtiva(){var p=document.getElementById('page-leads');return !!(p&&p.classList.contains('active'));}
function novoLeadBtn(){
  var a=document.querySelector('.actionbar');
  if(!a)return null;
  var bs=a.querySelectorAll('button');
  for(var i=0;i<bs.length;i++){
    var oc=String(bs[i].getAttribute('onclick')||'').replace(/\s/g,'');
    if(oc==='openModal()'&&/novo\s*lead/i.test(String(bs[i].textContent||'')))return bs[i];
  }
  return null;
}
function sync(){
  var st=document.getElementById('sync-status');
  if(st){st.hidden=true;st.setAttribute('aria-hidden','true');st.style.setProperty('display','none','important');}
  var b=novoLeadBtn(),show=carteiraAtiva();
  if(b){
    b.hidden=!show;
    if(show){b.style.removeProperty('display');b.removeAttribute('aria-hidden');}
    else{b.style.setProperty('display','none','important');b.setAttribute('aria-hidden','true');}
  }
}
function boot(){
  var s=document.createElement('style');s.id='tm-actionbar-context-style';s.textContent='#sync-status{display:none!important}';document.head.appendChild(s);
  sync();
  document.querySelectorAll('.page').forEach(function(p){var o=new MutationObserver(sync);o.observe(p,{attributes:true,attributeFilter:['class']});observers.push(o);});
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('.nav-tab'))setTimeout(sync,0);},true);
  window.addEventListener('focus',sync);
  var n=0,t=setInterval(function(){sync();if(++n>=30)clearInterval(t);},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

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
function loadWhatsAppProduction(){
  if(document.querySelector('script[data-tm-whatsapp-production]'))return;
  var s=document.createElement('script');
  s.src='whatsapp-production-loader.js?v=20261104-full-history6';
  s.async=false;
  s.dataset.tmWhatsappProduction='1';
  document.head.appendChild(s);
}
function loadRegressionPanel(){
  if(document.querySelector('script[data-tm-regression-core]'))return;
  var core=document.createElement('script');
  core.src='taurus-regression-core.js?v='+Date.now();
  core.async=false;
  core.dataset.tmRegressionCore='1';
  core.onload=function(){
    if(document.querySelector('script[data-tm-regression-panel]'))return;
    var panel=document.createElement('script');
    panel.src='taurus-regression-panel.js?v='+Date.now();
    panel.async=false;
    panel.dataset.tmRegressionPanel='1';
    document.head.appendChild(panel);
  };
  document.head.appendChild(core);
}
function boot(){
  var s=document.createElement('style');s.id='tm-actionbar-context-style';s.textContent='#sync-status{display:none!important}';document.head.appendChild(s);
  sync();
  document.querySelectorAll('.page').forEach(function(p){var o=new MutationObserver(sync);o.observe(p,{attributes:true,attributeFilter:['class']});observers.push(o);});
  document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('.nav-tab'))setTimeout(sync,0);},true);
  window.addEventListener('focus',sync);
  var n=0,t=setInterval(function(){sync();if(++n>=30)clearInterval(t);},100);
  loadWhatsAppProduction();
  loadRegressionPanel();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

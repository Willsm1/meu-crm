/* Taurus Magnum CRM — WhatsApp production loader on current MAIN */
(function(){
'use strict';
if(window.__TM_WHATSAPP_PRODUCTION_LOADER__)return;
window.__TM_WHATSAPP_PRODUCTION_LOADER__=true;

var files=[
  ['tm-wa-runtime','crm-whatsapp-runtime.js?v=20261001-final1'],
  ['tm-wa-followup','crm-whatsapp-followup-visual.js?v=20261001-final1'],
  ['tm-wa-matching','crm-whatsapp-matching-visual.js?v=20261001-final1'],
  ['tm-wa-gpt','crm-whatsapp-gpt-briefing.js?v=20261001-final1'],
  ['tm-wa-history-range','crm-whatsapp-history-range.js?v=20261001-final1'],
  ['tm-wa-archive','crm-whatsapp-archive-ui.js?v=20261001-final1'],
  ['tm-wa-storage','crm-whatsapp-storage-gate.js?v=20261001-final1'],
  ['tm-wa-media','crm-whatsapp-media-preview.js?v=20261001-final1'],
  ['tm-wa-archive-hotfix','crm-whatsapp-archive-hotfix.js?v=20261001-final1'],
  ['tm-wa-ai-direct','crm-whatsapp-ai-direct.js?v=20261001-final1'],
  ['tm-wa-bridge-hosted','whatsapp-followup-bridge-hosted.js?v=20261001-final1'],
  ['tm-wa-followup-hosted','crm-whatsapp-followup-hosted-adapter.js?v=20261001-final2'],
  ['tm-wa-connections','crm-whatsapp-connections.js?v=20261001-final1']
];

function load(id,src){
  return new Promise(function(resolve,reject){
    if(document.getElementById(id))return resolve();
    var s=document.createElement('script');
    s.id=id;s.src=src;s.async=false;
    s.onload=resolve;
    s.onerror=function(){reject(new Error('Falha ao carregar '+src));};
    document.head.appendChild(s);
  });
}

function boot(){
  var p=Promise.resolve();
  files.forEach(function(x){p=p.then(function(){return load(x[0],x[1]);});});
  p.then(function(){
    window.__TM_WHATSAPP_PRODUCTION_READY__=true;
    try{document.dispatchEvent(new CustomEvent('tm:whatsapp-production-ready'));}catch(_e){}
    try{console.info('[Taurus] WhatsApp production modules ready');}catch(_e){}
  }).catch(function(err){
    window.__TM_WHATSAPP_PRODUCTION_ERROR__=err&&err.message||String(err);
    try{console.error('[Taurus] WhatsApp production loader:',err);}catch(_e){}
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

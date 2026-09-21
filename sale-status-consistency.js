/* Taurus Magnum CRM — keep sale date and Fechado status consistent */
(function(){
'use strict';
if(window.__TM_SALE_STATUS_CONSISTENCY__)return;
window.__TM_SALE_STATUS_CONSISTENCY__=true;

var originalFetch=window.fetch.bind(window);

function findByLocalId(localId){
  if(!localId)return null;
  var rows=Array.isArray(window.leads)?window.leads:[];
  for(var i=0;i<rows.length;i++) if(String(rows[i].id||'')===String(localId)) return rows[i];
  return null;
}
function ensureClosed(payload){
  if(!payload)return Promise.resolve();
  function patch(uuid){
    if(!uuid||!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')return Promise.resolve();
    return window.CRM_CANONICAL.rpc('update_lead_by_id',{p_lead_id:uuid,p_patch:{status:'Fechado'}})
      .then(function(){
        if(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function')return window.CRM_CANONICAL.reload();
      })
      .then(function(){
        if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function')return window.CRM_FOLLOWUP.carregar();
      })
      .catch(function(e){try{console.warn('[SALE STATUS] não foi possível confirmar Fechado',e&&e.message||e);}catch(_){} });
  }
  if(payload.p_lead_id)return patch(payload.p_lead_id);
  if(payload.p_local_id){
    if(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function'){
      return Promise.resolve(window.CRM_CANONICAL.reload()).then(function(){var l=findByLocalId(payload.p_local_id);return patch(l&&l._uuid);});
    }
    var l=findByLocalId(payload.p_local_id);return patch(l&&l._uuid);
  }
  return Promise.resolve();
}

window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(e){}
  var saleRpc=url.indexOf('/rest/v1/rpc/set_lead_sale_date')>=0;
  var payload=null;
  if(saleRpc){
    try{payload=JSON.parse((init&&init.body)||'{}');}catch(e){payload=null;}
  }
  var response=await originalFetch(input,init);
  if(saleRpc&&response&&response.ok&&payload){
    /* set_lead_sale_date is only called by the CRM when the form status is Fechado.
       Confirm Fechado after the sale-date RPC, so a late refresh cannot restore the old status. */
    setTimeout(function(){ensureClosed(payload);},40);
  }
  return response;
};
})();

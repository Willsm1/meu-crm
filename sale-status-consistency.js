/* Taurus Magnum CRM — keep sale date and Fechado status consistent */
(function(){
'use strict';
if(window.__TM_SALE_STATUS_CONSISTENCY__)return;
window.__TM_SALE_STATUS_CONSISTENCY__=true;

var originalFetch=window.fetch.bind(window);
var closingLocks=new Map();

function findByLocalId(localId){
  if(!localId)return null;
  var rows=Array.isArray(window.leads)?window.leads:[];
  for(var i=0;i<rows.length;i++) if(String(rows[i].id||'')===String(localId)) return rows[i];
  return null;
}
function lock(uuid){if(uuid)closingLocks.set(String(uuid),Date.now()+3500);}
function unlockLater(uuid){if(!uuid)return;setTimeout(function(){closingLocks.delete(String(uuid));},500);}
function locked(uuid){
  if(!uuid)return false;
  var until=closingLocks.get(String(uuid));
  if(!until)return false;
  if(until<Date.now()){closingLocks.delete(String(uuid));return false;}
  return true;
}
function uuidFromPayload(payload){
  if(payload&&payload.p_lead_id)return String(payload.p_lead_id);
  if(payload&&payload.p_local_id){var l=findByLocalId(payload.p_local_id);return l&&l._uuid?String(l._uuid):null;}
  return null;
}
function ensureClosed(payload){
  if(!payload)return Promise.resolve();
  function patch(uuid){
    if(!uuid||!window.CRM_CANONICAL||typeof window.CRM_CANONICAL.rpc!=='function')return Promise.resolve();
    lock(uuid);
    return window.CRM_CANONICAL.rpc('update_lead_by_id',{p_lead_id:uuid,p_patch:{status:'Fechado'}})
      .then(function(){
        if(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function')return window.CRM_CANONICAL.reload();
      })
      .then(function(){
        if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function')return window.CRM_FOLLOWUP.carregar();
      })
      .then(function(){unlockLater(uuid);})
      .catch(function(e){unlockLater(uuid);try{console.warn('[SALE STATUS] não foi possível confirmar Fechado',e&&e.message||e);}catch(_){} });
  }
  var direct=uuidFromPayload(payload);
  if(direct)return patch(direct);
  if(payload.p_local_id&&window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function'){
    return Promise.resolve(window.CRM_CANONICAL.reload()).then(function(){var l=findByLocalId(payload.p_local_id);return patch(l&&l._uuid);});
  }
  return Promise.resolve();
}

window.fetch=async function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(e){}
  var saleRpc=url.indexOf('/rest/v1/rpc/set_lead_sale_date')>=0;
  var updateRpc=url.indexOf('/rest/v1/rpc/update_lead_by_id')>=0;
  var payload=null;
  if(saleRpc||updateRpc){
    try{payload=JSON.parse((init&&init.body)||'{}');}catch(e){payload=null;}
  }

  /* While a close operation is being finalized, reject stale in-memory status by
     rewriting only the conflicting status field. Other edits in the same patch survive. */
  if(updateRpc&&payload&&payload.p_lead_id&&locked(payload.p_lead_id)&&payload.p_patch&&payload.p_patch.status&&payload.p_patch.status!=='Fechado'){
    payload.p_patch=Object.assign({},payload.p_patch,{status:'Fechado'});
    init=Object.assign({},init||{},{body:JSON.stringify(payload)});
  }

  if(saleRpc&&payload&&payload.p_data_fechamento){
    var preUuid=uuidFromPayload(payload);
    if(preUuid)lock(preUuid);
  }

  var response=await originalFetch(input,init);
  if(saleRpc&&response&&response.ok&&payload&&payload.p_data_fechamento){
    /* Finalize in a single serialized client flow: sale date succeeded, then Fechado is
       confirmed, then canonical CRM + Follow-up reload from Supabase. During that window,
       any stale status write for the same lead is forced to Fechado. */
    Promise.resolve().then(function(){return ensureClosed(payload);});
  }
  return response;
};
})();

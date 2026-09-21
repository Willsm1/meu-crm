/* Taurus Magnum CRM — guard against legacy edit objects losing Supabase UUID */
(function(){
'use strict';
if(window.__TM_CANONICAL_EDIT_GUARD__)return;
window.__TM_CANONICAL_EDIT_GUARD__=true;

var idToUuid=new Map();

function rowsNow(){
  try{
    if(typeof leads!=='undefined'&&Array.isArray(leads))return leads;
  }catch(e){}
  return Array.isArray(window.leads)?window.leads:[];
}

function indexRows(){
  rowsNow().forEach(function(l){
    if(!l||!l._uuid||l.id===undefined||l.id===null)return;
    idToUuid.set(String(l.id),String(l._uuid));
  });
}

function repairRows(){
  var repaired=0;
  rowsNow().forEach(function(l){
    if(!l||l._uuid||l.id===undefined||l.id===null)return;
    var uuid=idToUuid.get(String(l.id));
    if(!uuid)return;
    l._uuid=uuid;
    l._supabase=true;
    repaired++;
  });
  return repaired;
}

/* Capture the canonical identity before the legacy edit modal rebuilds the row object. */
if(typeof window.openModal==='function'){
  var originalOpenModal=window.openModal;
  window.openModal=function(){
    indexRows();
    return originalOpenModal.apply(this,arguments);
  };
}

/* Canonical save runs after the legacy form replaced leads[i]. Repair identity first. */
if(typeof window.save==='function'){
  var originalSave=window.save;
  window.save=function(){
    repairRows();
    return originalSave.apply(this,arguments);
  };
}

/* Keep the identity index fresh after canonical/realtime reloads. */
if(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function'){
  var originalReload=window.CRM_CANONICAL.reload;
  window.CRM_CANONICAL.reload=function(){
    var out=originalReload.apply(this,arguments);
    return Promise.resolve(out).then(function(v){indexRows();return v;});
  };
}

indexRows();
setTimeout(indexRows,250);
setTimeout(indexRows,1000);
})();

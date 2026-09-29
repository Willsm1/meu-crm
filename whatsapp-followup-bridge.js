/* Taurus Magnum CRM — WhatsApp Follow-up Bridge — TEST BRANCH ONLY */
(function(){
'use strict';
if(window.__TM_WA_BRIDGE__)return;
window.__TM_WA_BRIDGE__=true;
var BASE='http://127.0.0.1:8787';
function rpc(name,args){
  var c=window.CRM_CANONICAL;
  if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));
  return c.rpc(name,args||{});
}
async function syncOnce(){
  var r=await fetch(BASE+'/followup/candidates?limit=200',{cache:'no-store'});
  var j=await r.json();
  var rows=Array.isArray(j.candidates)?j.candidates:[];
  var stats={matched:0,ambiguous:0,notFound:0,errors:0};
  for(var i=0;i<rows.length;i++){
    var e=rows[i];
    if(!e.contactPhone||!e.messageId)continue;
    try{
      var out=await rpc('whatsapp_ingest_event',{
        p_session_id:e.sessionId,
        p_message_id:e.messageId,
        p_direction:e.direction,
        p_contact_phone:e.contactPhone,
        p_message_type:e.messageType||null,
        p_message_text:e.messageText||null,
        p_message_timestamp:new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()).toISOString()
      });
      var x=Array.isArray(out)?out[0]:out;
      if(x&&x.status==='matched')stats.matched++;
      else if(x&&x.status==='ambiguous')stats.ambiguous++;
      else if(x&&x.status==='not_found')stats.notFound++;
    }catch(err){stats.errors++;}
  }
  try{document.dispatchEvent(new CustomEvent('tm:whatsapp-sync',{detail:stats}));}catch(_e){}
  return stats;
}
window.CRM_WHATSAPP_BRIDGE={syncOnce:syncOnce};
})();

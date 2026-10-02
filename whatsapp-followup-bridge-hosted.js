/* Taurus Magnum — WhatsApp Follow-up Bridge — HOSTED */
(function(){
'use strict';
if(window.__TM_WA_BRIDGE_HOSTED__)return;window.__TM_WA_BRIDGE_HOSTED__=true;
function rpc(name,args){var c=window.CRM_CANONICAL;if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return c.rpc(name,args||{});}
function cfg(){return window.CRM_SUPABASE&&window.CRM_SUPABASE.config||null;}
function safeId(v){return String(v||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}
function encPath(p){return String(p).split('/').map(encodeURIComponent).join('/');}
function extFor(mime,kind){var m=String(mime||'').toLowerCase();if(m.includes('jpeg'))return'jpg';if(m.includes('png'))return'png';if(m.includes('webp'))return'webp';if(m.includes('gif'))return'gif';if(m.includes('ogg'))return'ogg';if(m.includes('opus'))return'opus';if(m.includes('mpeg'))return'mp3';if(m.includes('aac'))return'aac';if(m.includes('wav'))return'wav';if(m.includes('webm'))return'webm';if(m.includes('quicktime'))return'mov';if(m.includes('mp4'))return'mp4';if(m.includes('pdf'))return'pdf';return kind==='audio'?'bin':kind==='image'?'img':kind==='video'?'vid':'bin';}
function authHeaders(extra){var c=cfg(),t=window.TM_WA_RUNTIME&&window.TM_WA_RUNTIME.token&&window.TM_WA_RUNTIME.token();if(!c||!t)throw new Error('Sessão Supabase ausente');return Object.assign({'apikey':c.publishableKey,'Authorization':'Bearer '+t},extra||{});}
async function candidates(){if(!window.TM_WA_RUNTIME)throw new Error('Runtime WhatsApp indisponível');return window.TM_WA_RUNTIME.api('/api/whatsapp/followup/candidates?limit=500');}
var persistedMedia=new Set();
async function mediaAlreadyStored(leadId,e){var k=String(e.sessionId)+':'+String(e.messageId);if(persistedMedia.has(k))return true;try{var rows=await rpc('whatsapp_media_for_lead',{p_lead_id:leadId});var found=(Array.isArray(rows)?rows:[]).some(function(a){return String(a.session_id)+':'+String(a.message_id)===k;});if(found)persistedMedia.add(k);return found;}catch(_e){return false;}}
async function persistMedia(leadId,e){
  if(!leadId||!e||!e.media||e.media.status!=='stored_gateway'||!e.slot||!e.messageId)return false;
  var k=String(e.sessionId)+':'+String(e.messageId);if(await mediaAlreadyStored(leadId,e))return true;
  var c=cfg();if(!c)throw new Error('Config Supabase ausente');
  var mediaUrl=window.TM_WA_RUNTIME.gateway()+'/api/whatsapp/media/'+encodeURIComponent(e.slot)+'/'+encodeURIComponent(e.messageId);
  var rr=await fetch(mediaUrl,{method:'GET',headers:window.TM_WA_RUNTIME.headers({}),cache:'no-store'});if(!rr.ok)throw new Error('gateway mídia '+rr.status);
  var blob=await rr.blob();
  var ctxRaw=await rpc('whatsapp_media_context',{}),ctx=Array.isArray(ctxRaw)?(ctxRaw[0]||{}):(ctxRaw||{});
  if(!ctx.organization_id||!ctx.user_id)throw new Error('Contexto de mídia incompleto');
  var when=new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()),yyyy=String(when.getFullYear()),mm=String(when.getMonth()+1).padStart(2,'0');
  var kind=e.media.kind||'file',ext=extFor(e.media.mimeType||blob.type,kind);
  var path=[ctx.organization_id,ctx.user_id,e.sessionId,leadId,yyyy,mm,safeId(e.messageId)+'.'+ext].join('/');
  var up=await fetch(c.url+'/storage/v1/object/whatsapp-media/'+encPath(path),{method:'POST',headers:authHeaders({'Content-Type':e.media.mimeType||blob.type||'application/octet-stream','x-upsert':'true'}),body:blob});
  if(!up.ok)throw new Error('upload Storage '+up.status+': '+(await up.text()).slice(0,160));
  await rpc('whatsapp_media_register',{p_lead_id:leadId,p_event_id:null,p_session_id:e.sessionId,p_message_id:e.messageId,p_media_kind:kind,p_mime_type:e.media.mimeType||blob.type||'application/octet-stream',p_storage_path:path,p_original_filename:e.media.fileName||null,p_byte_size:blob.size,p_duration_seconds:e.media.durationSeconds||null,p_caption:e.media.caption||null});
  persistedMedia.add(k);return true;
}
async function syncOnce(){
  var j=await candidates(),rows=Array.isArray(j.candidates)?j.candidates:[],stats={matched:0,ambiguous:0,notFound:0,errors:0,mediaStored:0,mediaErrors:0,total:rows.length};
  for(var i=0;i<rows.length;i++){
    var e=rows[i];if(!e.contactPhone||!e.messageId)continue;
    try{
      var out=await rpc('whatsapp_ingest_event',{p_session_id:e.sessionId,p_message_id:e.messageId,p_direction:e.direction,p_contact_phone:e.contactPhone,p_message_type:e.messageType||null,p_message_text:e.messageText||null,p_message_timestamp:new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()).toISOString()});
      var x=Array.isArray(out)?out[0]:out;
      if(x&&x.status==='matched'){
        stats.matched++;
        if(e.media&&e.media.status==='stored_gateway')try{if(await persistMedia(x.lead_id,e))stats.mediaStored++;}catch(mediaErr){stats.mediaErrors++;try{console.warn('[Taurus WA media persist]',e.messageId,mediaErr);}catch(_e){}}
      }else if(x&&x.status==='ambiguous')stats.ambiguous++;else if(x&&x.status==='not_found')stats.notFound++;
    }catch(err){stats.errors++;}
  }
  try{document.dispatchEvent(new CustomEvent('tm:whatsapp-sync',{detail:stats}));}catch(_e){}return stats;
}
window.CRM_WHATSAPP_BRIDGE={syncOnce:syncOnce};
setTimeout(syncOnce,1200);setInterval(syncOnce,3000);
})();

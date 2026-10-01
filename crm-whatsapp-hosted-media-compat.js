/* Taurus Magnum — hosted media compatibility adapter
   Additive bridge: keeps the validated storage/media modules untouched while
   translating their old localhost observer/media reads to the hosted gateway. */
(function(){
'use strict';
if(window.__TM_WA_HOSTED_MEDIA_COMPAT__)return;
window.__TM_WA_HOSTED_MEDIA_COMPAT__=true;

var nativeFetch=window.fetch.bind(window);
var candidateCache=[];
var candidateCacheAt=0;
var activeLeadId=null;
var objectUrls=new Map();

function safeId(v){return String(v||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}
function rpc(name,args){var c=window.CRM_CANONICAL;if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return c.rpc(name,args||{});}
function jsonResponse(data){return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
function isLegacyCandidates(url){return /^http:\/\/127\.0\.0\.1:8787\/followup\/candidates(?:\?|$)/.test(String(url||''))}
function isLegacyMedia(url){return /^http:\/\/127\.0\.0\.1:8788\/media\//.test(String(url||''))}
function keyOf(x){return String(x&&x.sessionId||x&&x.session_id||'')+':'+String(x&&x.messageId||x&&x.message_id||'')}

async function hostedCandidates(force){
  if(!force&&candidateCache.length&&Date.now()-candidateCacheAt<1200)return candidateCache;
  if(!window.TM_WA_RUNTIME)throw new Error('Runtime WhatsApp indisponível');
  var d=await window.TM_WA_RUNTIME.api('/api/whatsapp/followup/candidates?limit=500');
  candidateCache=Array.isArray(d&&d.candidates)?d.candidates:[];
  candidateCacheAt=Date.now();
  return candidateCache;
}

async function fetchHostedMedia(c){
  if(!c||!c.slot||!c.messageId||!window.TM_WA_RUNTIME)throw new Error('Mídia hospedada sem referência');
  var headers=window.TM_WA_RUNTIME.headers({});
  var target=window.TM_WA_RUNTIME.gateway()+'/api/whatsapp/media/'+encodeURIComponent(c.slot)+'/'+encodeURIComponent(c.messageId);
  var r=await nativeFetch(target,{method:'GET',headers:headers,cache:'no-store'});
  if(!r.ok)throw new Error('gateway mídia '+r.status);
  return r;
}

async function legacyMediaFetch(url,init){
  var u=new URL(String(url));
  var parts=u.pathname.split('/').filter(Boolean);
  var sessionId=decodeURIComponent(parts[1]||'');
  var file=decodeURIComponent(parts.slice(2).join('/')||'');
  var stem=file.replace(/\.[^.]+$/,'');
  var rows=await hostedCandidates(false);
  var c=rows.find(function(x){return String(x.sessionId||'')===sessionId&&safeId(x.messageId)===stem;});
  if(!c){rows=await hostedCandidates(true);c=rows.find(function(x){return String(x.sessionId||'')===sessionId&&safeId(x.messageId)===stem;});}
  if(!c)return new Response('Hosted media not found',{status:404});
  try{return await fetchHostedMedia(c);}catch(e){return new Response(String(e&&e.message||e),{status:502});}
}

window.fetch=async function(input,init){
  var url='';try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_e){}
  if(isLegacyCandidates(url)){
    try{var rows=await hostedCandidates(true);return jsonResponse({mode:'hosted-compat',count:rows.length,candidates:rows});}
    catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e),candidates:[]}),{status:503,headers:{'Content-Type':'application/json'}})}
  }
  if(isLegacyMedia(url)){
    try{return await legacyMediaFetch(url,init);}catch(e){return new Response(String(e&&e.message||e),{status:502});}
  }
  return nativeFetch(input,init);
};

function mediaNodeFromUrl(kind,url,fileName){
  if(!url)return null;
  var k=String(kind||'');
  if(k==='image'||k==='sticker'){
    var link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';
    var img=document.createElement('img');img.className='tm-wa-media-img';img.src=url;img.alt='Imagem WhatsApp';link.appendChild(img);return link;
  }
  if(k==='audio'){
    var au=document.createElement('audio');au.className='tm-wa-media-audio';au.controls=true;au.preload='metadata';au.src=url;return au;
  }
  if(k==='video'){
    var vi=document.createElement('video');vi.className='tm-wa-media-video';vi.controls=true;vi.preload='metadata';vi.src=url;return vi;
  }
  var doc=document.createElement('a');doc.className='tm-wa-media-doc';doc.href=url;doc.target='_blank';doc.rel='noopener';doc.textContent='📎 '+(fileName||'Abrir documento');return doc;
}
function mediaNode(a){return a&&a.signed_url?mediaNodeFromUrl(a.media_kind,a.signed_url,a.original_filename):null}
function isPlaceholder(t){return /^\[(imagem|áudio|audio|vídeo|video|documento|figurinha)\]$/i.test(String(t||'').trim())}
function kindFromCandidate(c){return c&&c.media&&c.media.kind?c.media.kind:(c&&c.messageType==='imageMessage'?'image':c&&c.messageType==='audioMessage'?'audio':c&&c.messageType==='videoMessage'?'video':c&&c.messageType==='documentMessage'?'document':c&&c.messageType==='stickerMessage'?'sticker':'')}
function ensurePlaceholder(node,text){
  if(!node||node.querySelector('.tm-wa-media-img,.tm-wa-media-audio,.tm-wa-media-video,.tm-wa-media-doc'))return;
  var hasBody=Array.from(node.children).some(function(ch){return ch.tagName==='DIV'&&!ch.classList.contains('tm-wa-msg-meta')&&!ch.classList.contains('tm-wa-media-source')&&!ch.classList.contains('tm-wa-media-note')&&String(ch.textContent||'').trim();});
  if(hasBody)return;
  var d=document.createElement('div');d.textContent=text||'[mídia]';var meta=node.querySelector('.tm-wa-msg-meta');meta?node.insertBefore(d,meta):node.appendChild(d);
}
async function liveObjectUrl(c){
  var k=keyOf(c);if(objectUrls.has(k))return objectUrls.get(k);
  var r=await fetchHostedMedia(c),blob=await r.blob(),u=URL.createObjectURL(blob);objectUrls.set(k,u);return u;
}
async function hydrateOpenHistory(){
  var body=document.getElementById('tm-wa-lead-history');
  if(!body||!activeLeadId||!window.TM_WA_STORAGE||typeof window.TM_WA_STORAGE.getLeadAssets!=='function')return;
  try{
    var both=await Promise.all([rpc('whatsapp_lead_briefing',{p_lead_id:activeLeadId,p_limit:300}),window.TM_WA_STORAGE.getLeadAssets(activeLeadId),hostedCandidates(false).catch(function(){return[];})]);
    var raw=Array.isArray(both[0])?(both[0][0]||{}):(both[0]||{}),events=Array.isArray(raw.whatsapp_events)?raw.whatsapp_events:[],assets=Array.isArray(both[1])?both[1]:[],live=Array.isArray(both[2])?both[2]:[];
    var amap=new Map(assets.map(function(a){return [keyOf(a),a]}));
    var lmap=new Map(live.map(function(c){return [keyOf(c),c]}));
    var nodes=Array.from(body.querySelectorAll('.tm-wa-chat .tm-wa-msg'));
    for(var i=0;i<nodes.length;i++){
      var node=nodes[i],ev=events[i];if(!ev)continue;
      var k=keyOf(ev),a=amap.get(k),c=lmap.get(k),media=null,source='';
      if(!node.querySelector('.tm-wa-media-img,.tm-wa-media-audio,.tm-wa-media-video,.tm-wa-media-doc')){
        if(a){media=mediaNode(a);source='✓ armazenado no Supabase';}
        else if(c&&c.media&&c.media.status==='stored_gateway'){
          try{var u=await liveObjectUrl(c);media=mediaNodeFromUrl(kindFromCandidate(c),u,c.media.fileName);source='✓ mídia ao vivo do gateway';}catch(_liveErr){}
        }
        if(media){
          node.insertBefore(media,node.firstChild);
          Array.from(node.children).forEach(function(ch){if(ch===media||ch.classList.contains('tm-wa-msg-meta'))return;if(ch.tagName==='DIV'&&isPlaceholder(ch.textContent))ch.remove();});
          if(source&&!node.querySelector('.tm-wa-media-source')){var src=document.createElement('div');src.className='tm-wa-media-source';src.textContent=source;var meta=node.querySelector('.tm-wa-msg-meta');meta?node.insertBefore(src,meta):node.appendChild(src);}
        }
      }
      if(!media&&!a&&c&&c.media)ensurePlaceholder(node,ev.text||c.messageText||'[mídia]');
    }
  }catch(_e){}
}

document.addEventListener('click',function(e){
  var h=e.target&&e.target.closest&&e.target.closest('.tm-wa-history-icon');
  if(h){var tr=h.closest('tr'),a=tr&&tr.querySelector('.tm-agendar-btn[data-lead-id]');if(a&&a.dataset&&a.dataset.leadId)activeLeadId=a.dataset.leadId;}
  var r=e.target&&e.target.closest&&e.target.closest('[data-hlead]');if(r&&r.dataset&&r.dataset.hlead)activeLeadId=r.dataset.hlead;
  if(h||r)setTimeout(function(){try{window.TM_WA_STORAGE&&window.TM_WA_STORAGE.syncLead&&window.TM_WA_STORAGE.syncLead();}catch(_e){}hydrateOpenHistory();},900);
},true);
setInterval(function(){if(document.getElementById('tm-wa-lead-history'))hydrateOpenHistory();},1800);
})();

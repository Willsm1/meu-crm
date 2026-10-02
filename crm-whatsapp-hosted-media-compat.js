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
var rendering=false;

function safeId(v){return String(v||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}
function rpc(name,args){var c=window.CRM_CANONICAL;if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return c.rpc(name,args||{});}
function jsonResponse(data){return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
function isLegacyCandidates(url){return /^http:\/\/127\.0\.0\.1:8787\/followup\/candidates(?:\?|$)/.test(String(url||''))}
function isLegacyMedia(url){return /^http:\/\/127\.0\.0\.1:8788\/media\//.test(String(url||''))}
function keyOf(x){return String(x&&x.sessionId||x&&x.session_id||'')+':'+String(x&&x.messageId||x&&x.message_id||'')}
function isPlaceholder(t){return /^\[(imagem|áudio|audio|vídeo|video|documento|figurinha)\]$/i.test(String(t||'').trim())}
function kindFromType(t){return t==='imageMessage'?'image':t==='audioMessage'?'audio':t==='videoMessage'?'video':t==='documentMessage'?'document':t==='stickerMessage'?'sticker':''}
function kindFromCandidate(c){return c&&c.media&&c.media.kind?c.media.kind:kindFromType(c&&c.messageType)}
function dt(v){try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_e){return String(v||'—')}}

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

async function liveObjectUrl(c){
  var k=keyOf(c);if(objectUrls.has(k))return objectUrls.get(k);
  var r=await fetchHostedMedia(c),blob=await r.blob(),u=URL.createObjectURL(blob);objectUrls.set(k,u);return u;
}

function appendText(node,text){var d=document.createElement('div');d.textContent=text||'[mensagem sem texto]';node.appendChild(d)}
function appendSource(node,text){var s=document.createElement('div');s.className='tm-wa-media-source';s.textContent=text;node.appendChild(s)}
function appendMeta(node,ev){var m=document.createElement('div');m.className='tm-wa-msg-meta';m.textContent=(ev.direction==='inbound'?'Cliente':'Corretor')+' · '+dt(ev.at)+' · '+String(ev.type||'mensagem');node.appendChild(m)}

async function rebuildHistory(body,events,assets,live){
  var chat=body.querySelector('.tm-wa-chat');if(!chat)return;
  var amap=new Map((assets||[]).map(function(a){return[keyOf(a),a]}));
  var lmap=new Map((live||[]).map(function(c){return[keyOf(c),c]}));
  var frag=document.createDocumentFragment();
  for(var i=0;i<events.length;i++){
    var ev=events[i],k=keyOf(ev),a=amap.get(k),c=lmap.get(k),node=document.createElement('div');
    node.className='tm-wa-msg '+(ev.direction==='inbound'?'in':'out');
    var media=null,source='';
    if(a&&a.signed_url){media=mediaNodeFromUrl(a.media_kind,a.signed_url,a.original_filename);source='✓ armazenado no Supabase';}
    if(!media&&c&&c.media&&c.media.status==='stored_gateway'){
      try{var u=await liveObjectUrl(c);media=mediaNodeFromUrl(kindFromCandidate(c),u,c.media.fileName);source='✓ mídia ao vivo do gateway';}catch(_e){}
    }
    if(media)node.appendChild(media);
    var text=String(ev.text||c&&c.messageText||'');
    if(!media||!isPlaceholder(text))appendText(node,text||((c&&c.media)?'[mídia]':'[mensagem sem texto]'));
    if(media&&c&&c.media&&c.media.durationSeconds){var n=document.createElement('div');n.className='tm-wa-media-note';n.textContent='Duração: '+c.media.durationSeconds+'s';node.appendChild(n)}
    if(source)appendSource(node,source);
    appendMeta(node,ev);
    frag.appendChild(node);
  }
  chat.replaceChildren(frag);
}

async function hydrateOpenHistory(){
  var body=document.getElementById('tm-wa-lead-history');
  if(rendering||!body||!activeLeadId||!window.TM_WA_STORAGE||typeof window.TM_WA_STORAGE.getLeadAssets!=='function')return;
  rendering=true;
  try{
    var both=await Promise.all([rpc('whatsapp_lead_briefing',{p_lead_id:activeLeadId,p_limit:300}),window.TM_WA_STORAGE.getLeadAssets(activeLeadId),hostedCandidates(false).catch(function(){return[];})]);
    var raw=Array.isArray(both[0])?(both[0][0]||{}):(both[0]||{}),events=Array.isArray(raw.whatsapp_events)?raw.whatsapp_events:[],assets=Array.isArray(both[1])?both[1]:[],live=Array.isArray(both[2])?both[2]:[];
    await rebuildHistory(body,events,assets,live);
  }catch(_e){}finally{rendering=false;}
}

document.addEventListener('click',function(e){
  var h=e.target&&e.target.closest&&e.target.closest('.tm-wa-history-icon');
  if(h){var tr=h.closest('tr'),a=tr&&tr.querySelector('.tm-agendar-btn[data-lead-id]');if(a&&a.dataset&&a.dataset.leadId)activeLeadId=a.dataset.leadId;}
  var r=e.target&&e.target.closest&&e.target.closest('[data-hlead]');if(r&&r.dataset&&r.dataset.hlead)activeLeadId=r.dataset.hlead;
  if(h||r)setTimeout(function(){try{window.TM_WA_STORAGE&&window.TM_WA_STORAGE.syncLead&&window.TM_WA_STORAGE.syncLead();}catch(_e){}hydrateOpenHistory();},900);
},true);
setInterval(function(){if(document.getElementById('tm-wa-lead-history'))hydrateOpenHistory();},1800);
})();

/* Taurus Magnum — hosted media compatibility adapter
   Keeps the validated media preview/storage modules unchanged and reproduces
   the exact legacy observer contract they already know how to consume. */
(function(){
'use strict';
if(window.__TM_WA_HOSTED_MEDIA_COMPAT__)return;
window.__TM_WA_HOSTED_MEDIA_COMPAT__=true;

var nativeFetch=window.fetch.bind(window);
var candidateCache=[];
var candidateCacheAt=0;
var objectUrls=new Map();

function safeId(v){return String(v||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}
function isLegacyCandidates(url){return /^http:\/\/127\.0\.0\.1:8787\/followup\/candidates(?:\?|$)/.test(String(url||''))}
function isLegacyMedia(url){return /^http:\/\/127\.0\.0\.1:8788\/media\//.test(String(url||''))}
function jsonResponse(data){return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
function candidateKey(c){return String(c&&c.sessionId||'')+':'+String(c&&c.messageId||'')}

async function rawHostedCandidates(force){
  if(!force&&candidateCache.length&&Date.now()-candidateCacheAt<1200)return candidateCache;
  if(!window.TM_WA_RUNTIME)throw new Error('Runtime WhatsApp indisponível');
  var d=await window.TM_WA_RUNTIME.api('/api/whatsapp/followup/candidates?limit=500');
  candidateCache=Array.isArray(d&&d.candidates)?d.candidates:[];
  candidateCacheAt=Date.now();
  return candidateCache;
}

async function fetchHostedMedia(c){
  if(!c||!c.slot||!c.messageId||!window.TM_WA_RUNTIME)throw new Error('Mídia hospedada sem referência');
  var target=window.TM_WA_RUNTIME.gateway()+'/api/whatsapp/media/'+encodeURIComponent(c.slot)+'/'+encodeURIComponent(c.messageId);
  var r=await nativeFetch(target,{method:'GET',headers:window.TM_WA_RUNTIME.headers({}),cache:'no-store'});
  if(!r.ok)throw new Error('gateway mídia '+r.status);
  return r;
}

async function objectUrlFor(c){
  var k=candidateKey(c);
  if(objectUrls.has(k))return objectUrls.get(k);
  var r=await fetchHostedMedia(c),blob=await r.blob(),url=URL.createObjectURL(blob);
  objectUrls.set(k,url);
  return url;
}

async function legacyCandidateView(c){
  var out=Object.assign({},c);
  if(c&&c.media){
    out.media=Object.assign({},c.media);
    if(c.media.status==='stored_gateway'){
      try{out.media.url=await objectUrlFor(c);}catch(_e){out.media.url=null;}
    }
  }
  return out;
}

async function legacyCandidatesResponse(){
  var rows=await rawHostedCandidates(true);
  var enriched=await Promise.all(rows.map(legacyCandidateView));
  return jsonResponse({mode:'hosted-compat',count:enriched.length,candidates:enriched});
}

async function legacyMediaFetch(url){
  var u=new URL(String(url));
  var parts=u.pathname.split('/').filter(Boolean);
  var sessionId=decodeURIComponent(parts[1]||'');
  var file=decodeURIComponent(parts.slice(2).join('/')||'');
  var stem=file.replace(/\.[^.]+$/,'');
  var rows=await rawHostedCandidates(false);
  var c=rows.find(function(x){return String(x.sessionId||'')===sessionId&&safeId(x.messageId)===stem;});
  if(!c){rows=await rawHostedCandidates(true);c=rows.find(function(x){return String(x.sessionId||'')===sessionId&&safeId(x.messageId)===stem;});}
  if(!c)return new Response('Hosted media not found',{status:404});
  try{return await fetchHostedMedia(c);}catch(e){return new Response(String(e&&e.message||e),{status:502});}
}

window.fetch=async function(input,init){
  var url='';try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_e){}
  if(isLegacyCandidates(url)){
    try{return await legacyCandidatesResponse();}
    catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e),candidates:[]}),{status:503,headers:{'Content-Type':'application/json'}})}
  }
  if(isLegacyMedia(url)){
    try{return await legacyMediaFetch(url);}catch(e){return new Response(String(e&&e.message||e),{status:502});}
  }
  return nativeFetch(input,init);
};

/* Persistent hydration stays with the validated storage gate via getLeadAssets. */
})();

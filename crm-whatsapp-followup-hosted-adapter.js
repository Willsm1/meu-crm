/* Taurus Magnum — hosted Follow-up KPI adapter */
(function(){
'use strict';
if(window.__TM_WA_HOSTED_KPI__)return;window.__TM_WA_HOSTED_KPI__=true;
let lastData=null,lastOk=0,inFlight=false;
function age(ms){if(!ms)return'—';const sec=Math.max(0,Math.floor((Date.now()-ms)/1000));if(sec<60)return sec+'s';const min=Math.floor(sec/60);if(min<60)return min+'min';const h=Math.floor(min/60),m=min%60;return h+'h '+m+'min'}
function stats(events){const valid=(events||[]).filter(e=>e.contactPhone);const latest=new Map(),inbound=new Set();for(const e of valid){const k=e.sessionId+'|'+e.contactPhone,t=e.messageTimestampMs||e.receivedAtMs||0;if(e.direction==='inbound')inbound.add(k);const p=latest.get(k);if(!p||t>(p.messageTimestampMs||p.receivedAtMs||0))latest.set(k,e)}const waiting=[...latest.values()].filter(e=>e.direction==='inbound').sort((a,b)=>(a.messageTimestampMs||0)-(b.messageTimestampMs||0));const answered=[...latest.values()].filter(e=>e.direction==='outbound'&&inbound.has(e.sessionId+'|'+e.contactPhone));return{received:inbound.size,waiting,answered:answered.length}}
function paint(d){if(!d)return;const s=stats(d.candidates||[]),root=document.getElementById('tm-wa-fu-summary');if(!root)return;const set=(k,v)=>{const el=root.querySelector('[data-k='+k+']');if(el&&el.textContent!==String(v))el.textContent=v};set('received',s.received);set('waiting',s.waiting.length);set('answered',s.answered);set('oldest',s.waiting.length?age(s.waiting[0].messageTimestampMs||s.waiting[0].receivedAtMs):'—');root.dataset.source='hosted';root.dataset.hostedUpdatedAt=String(lastOk)}
async function refresh(){if(inFlight)return;try{if(!window.TM_WA_RUNTIME)return;inFlight=true;const d=await window.TM_WA_RUNTIME.api('/api/whatsapp/followup/candidates?limit=500');lastData=d;lastOk=Date.now();paint(d);}catch(_e){}finally{inFlight=false}}
const mo=new MutationObserver(function(){if(lastData)paint(lastData)});
function observe(){const root=document.getElementById('tm-wa-fu-summary');if(root&&!root.__tmHostedObserved){root.__tmHostedObserved=true;mo.observe(root,{subtree:true,childList:true,characterData:true});if(lastData)paint(lastData)}}
setTimeout(function(){observe();refresh()},700);
setInterval(function(){observe();refresh();if(lastData)paint(lastData)},900);
})();

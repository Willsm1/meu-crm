/* Taurus Magnum — hosted Follow-up KPI adapter */
(function(){
'use strict';
if(window.__TM_WA_HOSTED_KPI__)return;window.__TM_WA_HOSTED_KPI__=true;
function age(ms){if(!ms)return'—';const sec=Math.max(0,Math.floor((Date.now()-ms)/1000));if(sec<60)return sec+'s';const min=Math.floor(sec/60);if(min<60)return min+'min';const h=Math.floor(min/60),m=min%60;return h+'h '+m+'min'}
function stats(events){const valid=(events||[]).filter(e=>e.contactPhone);const latest=new Map(),inbound=new Set();for(const e of valid){const k=e.sessionId+'|'+e.contactPhone,t=e.messageTimestampMs||e.receivedAtMs||0;if(e.direction==='inbound')inbound.add(k);const p=latest.get(k);if(!p||t>(p.messageTimestampMs||p.receivedAtMs||0))latest.set(k,e)}const waiting=[...latest.values()].filter(e=>e.direction==='inbound').sort((a,b)=>(a.messageTimestampMs||0)-(b.messageTimestampMs||0));const answered=[...latest.values()].filter(e=>e.direction==='outbound'&&inbound.has(e.sessionId+'|'+e.contactPhone));return{received:inbound.size,waiting,answered:answered.length}}
async function refresh(){try{if(!window.TM_WA_RUNTIME)return;const d=await window.TM_WA_RUNTIME.api('/api/whatsapp/followup/candidates?limit=500');const s=stats(d.candidates||[]);const root=document.getElementById('tm-wa-fu-summary');if(root){const set=(k,v)=>{const el=root.querySelector('[data-k='+k+']');if(el)el.textContent=v};set('received',s.received);set('waiting',s.waiting.length);set('answered',s.answered);set('oldest',s.waiting.length?age(s.waiting[0].messageTimestampMs||s.waiting[0].receivedAtMs):'—');}}
catch(_e){}}
setTimeout(refresh,1800);setInterval(refresh,1800);
})();

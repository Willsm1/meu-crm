/* Taurus Magnum CRM — análise IA direta no CRM — TEST BRANCH ONLY */
(function(){
'use strict';
if(window.__TM_WA_AI_DIRECT__) return;
window.__TM_WA_AI_DIRECT__=true;
const $=(s,r=document)=>r.querySelector(s);
let activeLeadId=null;
function cfg(){return window.CRM_SUPABASE&&window.CRM_SUPABASE.config||null}
function token(){const c=cfg();if(!c)return null;try{const raw=localStorage.getItem('sb-'+c.projectRef+'-auth-token');if(!raw)return null;const s=JSON.parse(raw);return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token))||null}catch(_e){return null}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function analyze(){
 const c=cfg(),t=token(),mode=$('#tm-wa-gpt-mode')?.value||'next',btn=$('#tm-wa-ai-direct-btn'),box=$('#tm-wa-ai-direct-result'),st=$('#tm-wa-ai-direct-status');
 if(!activeLeadId||!c||!t){if(st)st.textContent='Sessão/lead indisponível.';return}
 btn.disabled=true;btn.textContent='Analisando...';st.textContent='CRM + WhatsApp + memória TXT + Base Taurus → IA';box.innerHTML='';
 try{
  const r=await fetch(c.url+'/functions/v1/taurus-ai-analyze',{method:'POST',headers:{'apikey':c.publishableKey,'Authorization':'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({lead_id:activeLeadId,mode})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
  box.innerHTML=`<div style="white-space:pre-wrap;line-height:1.6;color:#dbeafe;font-size:13px">${esc(data.analysis||'Sem resposta.')}</div>`;
  st.textContent=`✓ Análise gerada no CRM · ${data.model||'modelo IA'} · ${data.knowledge_sources||0} fonte(s) Taurus`;
 }catch(err){st.textContent='Falha na análise: '+String(err?.message||err);box.innerHTML=''}
 finally{btn.disabled=false;btn.textContent='Gerar análise no CRM'}
}
function inject(){
 const body=$('#tm-wa-gpt-body');if(!body||$('#tm-wa-ai-direct-wrap',body))return;
 const status=$('#tm-wa-gpt-status',body);if(!status)return;
 const wrap=document.createElement('div');wrap.id='tm-wa-ai-direct-wrap';wrap.style.cssText='margin:10px 0 12px;border:1px solid rgba(59,130,246,.28);background:#08111f;border-radius:10px;padding:10px';
 wrap.innerHTML='<div style="display:flex;gap:8px;align-items:center"><button class="btn btn-primary" id="tm-wa-ai-direct-btn" style="flex:1">Gerar análise no CRM</button><span id="tm-wa-ai-direct-status" style="font-size:10px;color:#93c5fd"></span></div><div id="tm-wa-ai-direct-result" style="margin-top:10px"></div>';
 status.after(wrap);$('#tm-wa-ai-direct-btn',wrap).onclick=analyze;
 const mode=$('#tm-wa-gpt-mode',body);if(mode)mode.addEventListener('change',()=>{const b=$('#tm-wa-ai-direct-result',body),s=$('#tm-wa-ai-direct-status',body);if(b)b.innerHTML='';if(s)s.textContent='Modo alterado — gere uma nova análise.'});
}
document.addEventListener('tm:wa-gpt-analyze',e=>{if(e?.detail?.leadId)activeLeadId=e.detail.leadId});
function boot(){new MutationObserver(()=>setTimeout(inject,0)).observe(document.documentElement,{childList:true,subtree:true});setInterval(inject,400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

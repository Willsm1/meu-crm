/* Taurus Magnum CRM — handoff IA sem custo de API — TEST BRANCH ONLY */
(function(){
'use strict';
if(window.__TM_WA_AI_DIRECT__) return;
window.__TM_WA_AI_DIRECT__=true;
const $=(s,r=document)=>r.querySelector(s);

async function copyPrompt(text){
  if(!text) throw new Error('Briefing vazio');
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
}

async function openWithChatGPT(){
  const prompt=$('#tm-wa-gpt-prompt')?.value||'';
  const st=$('#tm-wa-ai-direct-status');
  if(!prompt){if(st)st.textContent='Briefing ainda não carregado.';return}
  // Abre a aba imediatamente para não ser bloqueada pelo navegador; depois copia o briefing.
  const tab=window.open('about:blank','_blank');
  try{
    await copyPrompt(prompt);
    if(tab) tab.location.href='https://chatgpt.com/'; else window.open('https://chatgpt.com/','_blank','noopener');
    if(st)st.textContent='✓ Briefing copiado. No ChatGPT, cole com Cmd+V e envie.';
  }catch(err){
    if(tab) tab.close();
    if(st)st.textContent='Não consegui copiar automaticamente. Use “Copiar briefing” e depois abra o ChatGPT.';
  }
}

function inject(){
 const body=$('#tm-wa-gpt-body');if(!body||$('#tm-wa-ai-direct-wrap',body))return;
 const status=$('#tm-wa-gpt-status',body);if(!status)return;
 const wrap=document.createElement('div');wrap.id='tm-wa-ai-direct-wrap';wrap.style.cssText='margin:10px 0 12px;border:1px solid rgba(59,130,246,.28);background:#08111f;border-radius:10px;padding:10px';
 wrap.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn btn-primary" id="tm-wa-ai-chatgpt-btn" style="flex:1;min-width:220px">Analisar com meu ChatGPT</button><span id="tm-wa-ai-direct-status" style="font-size:10px;color:#93c5fd;flex:2;min-width:260px">Sem custo de API Taurus: usa a conta ChatGPT aberta neste navegador.</span></div><div style="margin-top:7px;font-size:10px;color:#64748b">O CRM já monta o briefing com CRM + WhatsApp + memória TXT + Base Taurus. Por segurança do navegador, o último passo é colar o briefing no ChatGPT.</div>`;
 status.after(wrap);$('#tm-wa-ai-chatgpt-btn',wrap).onclick=openWithChatGPT;
 const mode=$('#tm-wa-gpt-mode',body);if(mode)mode.addEventListener('change',()=>{const s=$('#tm-wa-ai-direct-status',body);if(s)s.textContent='Modo alterado — o briefing foi atualizado. Clique para analisar no ChatGPT.'});
}
function boot(){new MutationObserver(()=>setTimeout(inject,0)).observe(document.documentElement,{childList:true,subtree:true});setInterval(inject,400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

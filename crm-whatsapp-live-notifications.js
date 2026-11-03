/* Taurus Magnum — realtime WhatsApp inbound notifications */
(function(){
'use strict';
if(window.__TM_WA_LIVE_NOTIFICATIONS__)return;
window.__TM_WA_LIVE_NOTIFICATIONS__=true;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function css(){
  if($('#tm-wa-live-notify-style'))return;
  const st=document.createElement('style');st.id='tm-wa-live-notify-style';st.textContent=`
#tm-wa-live-stack{position:fixed;right:18px;bottom:18px;z-index:12050;display:flex;flex-direction:column;gap:9px;width:min(360px,calc(100vw - 28px));pointer-events:none}
.tm-wa-live-toast{pointer-events:auto;background:#202c33;border:1px solid rgba(83,189,235,.22);border-radius:12px;box-shadow:0 12px 35px rgba(0,0,0,.38);padding:11px 12px;display:flex;gap:10px;align-items:flex-start;cursor:pointer;animation:tmWaIn .16s ease-out}
.tm-wa-live-toast:hover{background:#26343b}.tm-wa-live-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#00a884;color:#fff;flex:none}.tm-wa-live-copy{min-width:0;flex:1}.tm-wa-live-copy b{display:block;color:#e9edef;font-size:12px;margin-bottom:2px}.tm-wa-live-copy span{display:block;color:#aebac1;font-size:11px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-wa-live-time{font-size:9px;color:#8696a0;white-space:nowrap}.tm-wa-live-close{border:0;background:transparent;color:#8696a0;cursor:pointer;padding:2px;font-size:15px}
@keyframes tmWaIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;document.head.appendChild(st);
}
function stack(){let s=$('#tm-wa-live-stack');if(!s){s=document.createElement('div');s.id='tm-wa-live-stack';document.body.appendChild(s)}return s}
function label(d){if(d.messageType==='imageMessage')return d.messageText&&d.messageText!=='[imagem]'?d.messageText:'Imagem recebida';if(d.messageType==='audioMessage')return'Áudio recebido';if(d.messageType==='videoMessage')return d.messageText&&d.messageText!=='[vídeo]'?d.messageText:'Vídeo recebido';if(d.messageType==='documentMessage')return d.messageText||'Documento recebido';return d.messageText||'Nova mensagem'}
function show(d){
  if(!d||d.direction!=='inbound')return;
  css();const host=stack(),el=document.createElement('div');el.className='tm-wa-live-toast';el.innerHTML=`<div class="tm-wa-live-icon"><i class="ti ti-brand-whatsapp"></i></div><div class="tm-wa-live-copy"><b>Nova mensagem no WhatsApp</b><span>${esc(label(d))}</span></div><div class="tm-wa-live-time">${new Date(d.messageTimestampMs||Date.now()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div><button class="tm-wa-live-close" aria-label="Fechar">×</button>`;
  const close=()=>{if(el.parentNode)el.remove()};$('.tm-wa-live-close',el).onclick=e=>{e.stopPropagation();close()};
  el.onclick=()=>{if(d.leadId&&window.TM_WA_HISTORY_UI?.openLeadHistory)window.TM_WA_HISTORY_UI.openLeadHistory(d.leadId);close()};
  host.appendChild(el);while(host.children.length>4)host.firstElementChild.remove();setTimeout(close,9000);
}
document.addEventListener('tm:whatsapp-live-message',e=>show(e.detail||{}));
window.TM_WA_LIVE_NOTIFICATIONS={show};
})();

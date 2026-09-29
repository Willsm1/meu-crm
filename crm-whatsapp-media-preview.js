/* Taurus Magnum CRM — WhatsApp media visual preview — TEST BRANCH ONLY */
(function(){
'use strict';
if(window.__TM_WA_MEDIA_PREVIEW__) return;
window.__TM_WA_MEDIA_PREVIEW__=true;
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function rpc(name,args){const c=window.CRM_CANONICAL;if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return c.rpc(name,args||{});}
function dt(v){try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_e){return String(v||'—')}}
function css(){if($('#tm-wa-media-preview-style'))return;const s=document.createElement('style');s.id='tm-wa-media-preview-style';s.textContent=`
.tm-wa-media-img{display:block;max-width:320px;max-height:300px;border-radius:10px;margin-bottom:7px;object-fit:cover;background:#020617}.tm-wa-media-audio{width:280px;max-width:100%;display:block;margin-bottom:6px}.tm-wa-media-video{display:block;width:320px;max-width:100%;border-radius:10px;margin-bottom:7px;background:#000}.tm-wa-media-doc{display:inline-flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);color:#bfdbfe;text-decoration:none;margin-bottom:6px}.tm-wa-media-note{font-size:10px;color:#64748b;margin-top:4px}.tm-wa-media-failed{font-size:10px;color:#fca5a5;border:1px dashed rgba(239,68,68,.35);border-radius:7px;padding:6px 8px;margin-bottom:6px}
`;document.head.appendChild(s)}
function mediaHtml(m){if(!m)return'';if(m.status==='failed')return `<div class="tm-wa-media-failed">Mídia detectada, mas a captura falhou: ${esc(m.error||'erro desconhecido')}</div>`;if(!m.url)return'';if(m.kind==='image'||m.kind==='sticker')return `<a href="${esc(m.url)}" target="_blank" rel="noopener"><img class="tm-wa-media-img" src="${esc(m.url)}" alt="Imagem WhatsApp"></a>`;if(m.kind==='audio')return `<audio class="tm-wa-media-audio" controls preload="metadata" src="${esc(m.url)}"></audio>`;if(m.kind==='video')return `<video class="tm-wa-media-video" controls preload="metadata" src="${esc(m.url)}"></video>`;if(m.kind==='document')return `<a class="tm-wa-media-doc" href="${esc(m.url)}" target="_blank" rel="noopener">📎 ${esc(m.fileName||'Abrir documento')}</a>`;return `<a class="tm-wa-media-doc" href="${esc(m.url)}" target="_blank" rel="noopener">Abrir mídia</a>`}
async function liveMap(){try{const r=await fetch('http://127.0.0.1:8787/followup/candidates?limit=500',{cache:'no-store'});if(!r.ok)throw new Error('observer '+r.status);const d=await r.json(),map=new Map();for(const x of d.candidates||[])map.set(`${x.sessionId}:${x.messageId}`,x);return map}catch(_e){return new Map()}}
async function renderLeadMedia(leadId){
  const body=$('#tm-wa-lead-history'); if(!body)return;
  try{
    const [d,map]=await Promise.all([rpc('whatsapp_lead_briefing',{p_lead_id:leadId,p_limit:300}),liveMap()]);
    const data=Array.isArray(d)?(d[0]||{}):(d||{}), ev=Array.isArray(data.whatsapp_events)?data.whatsapp_events:[];
    body.innerHTML=`<div style="font-size:12px;color:#94a3b8"><b style="color:#e2e8f0">${esc(data?.lead?.nome||'—')}</b> · ${ev.length} mensagem(ns) registradas</div><div class="tm-wa-chat">${ev.length?ev.map(x=>{const live=map.get(`${x.session_id}:${x.message_id}`),media=live?.media||null;const text=String(x.text||'');const placeholder=/^\[(imagem|áudio|vídeo|documento|figurinha)\]$/i.test(text);return `<div class="tm-wa-msg ${x.direction==='inbound'?'in':'out'}">${mediaHtml(media)}${placeholder&&media?'':`<div>${esc(text||'[mensagem sem texto]')}</div>`}${media?.durationSeconds?`<div class="tm-wa-media-note">Duração: ${esc(media.durationSeconds)}s</div>`:''}<div class="tm-wa-msg-meta">${x.direction==='inbound'?'Cliente':'Corretor'} · ${esc(dt(x.at))} · ${esc(x.type||'mensagem')}</div></div>`}).join(''):'<div class="empty">Nenhuma mensagem registrada.</div>'}</div><div class="tm-wa-media-note" style="margin-top:10px">Teste Gate 3.2: mídia é servida localmente pelo observer. Após reiniciar o observer, apenas o registro textual permanece; persistência em Storage será o próximo gate.</div>`;
  }catch(err){body.insertAdjacentHTML('beforeend',`<div class="tm-wa-media-failed">Falha ao enriquecer mídia: ${esc(err?.message||err)}</div>`)}
}
function bind(){ $$('.tm-wa-history-icon').forEach(btn=>{if(btn.dataset.mediaBound)return;btn.dataset.mediaBound='1';const tr=btn.closest('tr'),a=tr?.querySelector('.tm-agendar-btn[data-lead-id]');const id=a?.dataset?.leadId;if(!id)return;btn.addEventListener('click',()=>setTimeout(()=>renderLeadMedia(id),250),false)}) }
function boot(){css();bind();new MutationObserver(bind).observe(document.documentElement,{subtree:true,childList:true});setInterval(bind,1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

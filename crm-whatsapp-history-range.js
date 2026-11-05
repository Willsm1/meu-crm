/* Taurus Magnum CRM — WhatsApp history + date range — TEST BRANCH ONLY */
(function(){
'use strict';
const __TM_HIST_DIAG=[];
function histDiag(type,extra){
  try{
    const row={at:new Date().toISOString(),type,extra:extra||null,stack:(new Error()).stack||null};
    __TM_HIST_DIAG.push(row);if(__TM_HIST_DIAG.length>100)__TM_HIST_DIAG.shift();
    window.__TM_WA_HISTORY_DIAG__=__TM_HIST_DIAG;
    console.warn('[Taurus HistoryDiag]',row);
    try{
      const api=window.TM_WA_RUNTIME&&window.TM_WA_RUNTIME.api;
      if(typeof api==='function')api('/api/whatsapp/diagnostics/history-ui',{method:'POST',body:JSON.stringify({
        type:row.type,
        buttonText:row.extra&&row.extra.buttonText,
        modalText:row.extra&&(row.extra.modalText||row.extra.text||row.extra.prevText),
        historyShell:row.extra&&row.extra.historyShell,
        href:location.href
      })}).catch(()=>{});
    }catch(_e){}
  }catch(_e){}
}
function installHistoryDiagObserver(){
  if(window.__TM_WA_HISTORY_DIAG_OBSERVER__)return;
  window.__TM_WA_HISTORY_DIAG_OBSERVER__=true;
  let prev=document.getElementById('tm-wa-modal');
  const mo=new MutationObserver(()=>{
    const cur=document.getElementById('tm-wa-modal');
    if(prev&&!cur)histDiag('modal-removed',{prevText:String(prev.textContent||'').slice(0,180)});
    if(cur&&cur!==prev)histDiag('modal-replaced-or-created',{text:String(cur.textContent||'').slice(0,180),html:String(cur.innerHTML||'').slice(0,300)});
    prev=cur;
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{
    const b=document.getElementById('tm-wa-events-btn');
    const m=document.getElementById('tm-wa-modal');
    histDiag('heartbeat',{buttonText:b?b.textContent:null,modalText:m?String(m.textContent||'').slice(0,120):null,historyShell:!!document.querySelector('.tm-wa-wa-shell')});
  },1000);
}

if(window.__TM_WA_HISTORY_RANGE__) return;
window.__TM_WA_HISTORY_RANGE__=true;
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function rpc(name,args){const c=window.CRM_CANONICAL;if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return c.rpc(name,args||{});}
function startDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0)}
function endDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999)}
function sameDay(a,b){return !!a&&!!b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function key(d){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''}
function br(d){return d?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'—'}
function dt(v){try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_e){return String(v||'—')}}
function normalize(v){return Array.isArray(v)?(v[0]||{}):(v||{})}
let from=startDay(new Date()), to=endDay(new Date()), view=new Date(new Date().getFullYear(),new Date().getMonth(),1), pickA=null, pickB=null, pop=null, anchor=null;
function css(){if($('#tm-wa-history-range-style'))return;const s=document.createElement('style');s.id='tm-wa-history-range-style';s.textContent=`
.tm-wa-range-btn{height:34px;min-width:154px;justify-content:center}.tm-wa-range-pop{position:fixed;z-index:10020;width:330px;background:#0e1628;border:1px solid rgba(59,130,246,.35);border-radius:14px;box-shadow:0 18px 55px rgba(0,0,0,.55);padding:12px}.tm-wa-range-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.tm-wa-range-title{font-size:13px;font-weight:800;color:#e2e8f0}.tm-wa-range-nav{width:30px;height:30px;border:1px solid rgba(148,163,184,.22);background:#111b2d;color:#94a3b8;border-radius:8px;cursor:pointer}.tm-wa-range-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.tm-wa-range-week{font-size:9px;color:#64748b;text-align:center;padding:2px 0 4px}.tm-wa-range-day{height:34px;border-radius:8px;border:1px solid rgba(59,130,246,.12);background:#111d31;color:#cbd5e1;font-size:11px;font-weight:700;cursor:pointer}.tm-wa-range-day:hover{background:#173b74}.tm-wa-range-day.inrange{background:rgba(29,78,216,.28);border-color:rgba(96,165,250,.35);color:#bfdbfe}.tm-wa-range-day.edge{background:#1d4ed8;color:#fff;border-color:#60a5fa}.tm-wa-range-empty{height:34px}.tm-wa-range-note{font-size:10px;color:#64748b;text-align:center;margin-top:10px}.tm-wa-range-presets{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.tm-wa-range-presets button{height:29px;padding:0 9px;border-radius:8px;border:1px solid rgba(96,165,250,.2);background:#101b2e;color:#94a3b8;font-size:10px;cursor:pointer}.tm-wa-range-actions{display:flex;gap:8px;margin-top:10px}.tm-wa-range-actions button{flex:1}.tm-wa-history-icon{width:30px;height:28px;padding:0;display:inline-flex;align-items:center;justify-content:center;margin-left:5px;border-radius:7px;border:1px solid rgba(16,185,129,.35);background:rgba(6,78,59,.2);color:#6ee7b7;cursor:pointer}.tm-wa-chat{display:flex;flex-direction:column;gap:8px;margin-top:12px}.tm-wa-msg{max-width:78%;padding:9px 11px;border-radius:11px;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-word}.tm-wa-msg.in{align-self:flex-start;background:#111d31;border:1px solid rgba(96,165,250,.16)}.tm-wa-msg.out{align-self:flex-end;background:rgba(29,78,216,.24);border:1px solid rgba(96,165,250,.25)}.tm-wa-msg-meta{font-size:9px;color:#64748b;margin-top:5px}.tm-wa-history-lead{cursor:pointer}.tm-wa-history-lead:hover td{background:#182540}.tm-wa-hist-search{width:100%;height:34px;margin-bottom:10px}
#tm-wa-modal .tm-wa-card{width:min(1120px,96vw);max-width:1120px;height:min(760px,90vh);display:flex;flex-direction:column;overflow:hidden}
.tm-wa-wa-shell{display:grid;grid-template-columns:340px 1fr;min-height:0;flex:1;border:1px solid rgba(148,163,184,.16);border-radius:14px;overflow:hidden;background:#0b141a}
.tm-wa-wa-list{min-width:0;border-right:1px solid rgba(148,163,184,.14);background:#111b21;display:flex;flex-direction:column}
.tm-wa-wa-list-head{padding:12px;border-bottom:1px solid rgba(148,163,184,.12)}
.tm-wa-wa-conversations{overflow:auto;min-height:0;flex:1}
.tm-wa-wa-item{width:100%;border:0;border-bottom:1px solid rgba(148,163,184,.08);background:transparent;color:#e9edef;padding:11px 12px;display:grid;grid-template-columns:42px 1fr auto;gap:10px;text-align:left;cursor:pointer}
.tm-wa-wa-item:hover,.tm-wa-wa-item.active{background:#202c33}
.tm-wa-wa-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#2a3942;color:#aebac1;font-weight:800;font-size:14px}
.tm-wa-wa-name{font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-wa-wa-preview{font-size:11px;color:#8696a0;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-wa-wa-time{font-size:10px;color:#8696a0;white-space:nowrap}
.tm-wa-wa-pane{min-width:0;display:flex;flex-direction:column;background:#0b141a;position:relative}
.tm-wa-wa-chat-head{height:60px;display:flex;align-items:center;gap:10px;padding:0 15px;background:#202c33;border-bottom:1px solid rgba(148,163,184,.12)}
.tm-wa-wa-chat-title{font-weight:800;color:#e9edef;font-size:14px}.tm-wa-wa-chat-sub{font-size:10px;color:#8696a0;margin-top:2px}
.tm-wa-wa-chat-body{flex:1;overflow:auto;padding:18px 7%;display:flex;flex-direction:column;gap:7px;background:linear-gradient(rgba(11,20,26,.94),rgba(11,20,26,.94))}
.tm-wa-wa-empty{margin:auto;color:#8696a0;text-align:center;font-size:12px;padding:30px}
.tm-wa-wa-bubble{max-width:min(72%,620px);padding:7px 9px 5px;border-radius:8px;color:#e9edef;font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 1px rgba(0,0,0,.18)}
.tm-wa-wa-bubble.in{align-self:flex-start;background:#202c33;border-top-left-radius:2px}.tm-wa-wa-bubble.out{align-self:flex-end;background:#005c4b;border-top-right-radius:2px}
.tm-wa-wa-meta{display:flex;gap:6px;justify-content:flex-end;align-items:center;font-size:9px;color:#aebac1;margin-top:4px;white-space:nowrap}
.tm-wa-wa-day{align-self:center;background:#182229;color:#aebac1;font-size:9px;border-radius:7px;padding:4px 8px;margin:4px 0}
.tm-wa-media-card{margin-bottom:6px}.tm-wa-media-open{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#d9fdd3;border-radius:7px;padding:7px 9px;font-size:10px;cursor:pointer}
.tm-wa-media-card img,.tm-wa-media-card video{display:block;max-width:320px;max-height:320px;border-radius:7px}.tm-wa-media-card audio{width:min(300px,60vw);height:38px}
.tm-wa-wa-status{display:inline-flex;margin-left:6px;padding:2px 6px;border-radius:999px;background:rgba(37,211,102,.12);color:#6ee7a8;font-size:9px}
@media(max-width:780px){.tm-wa-wa-shell{grid-template-columns:42% 58%}.tm-wa-wa-item{grid-template-columns:36px 1fr}.tm-wa-wa-avatar{width:36px;height:36px}.tm-wa-wa-time{display:none}.tm-wa-wa-chat-body{padding:12px}.tm-wa-wa-bubble{max-width:88%}}
`;document.head.appendChild(s)}
function closePop(){if(pop){pop.remove();pop=null;}anchor=null;pickA=null;pickB=null}
function pos(){if(!pop||!anchor)return;const r=anchor.getBoundingClientRect(),w=330,h=485;pop.style.left=Math.max(12,Math.min(innerWidth-w-12,r.left))+'px';pop.style.top=Math.max(12,Math.min(innerHeight-h-12,r.bottom+7))+'px'}
function between(d,a,b){if(!a)return false;const t=d.getTime(),x=startDay(a).getTime(),y=startDay(b||a).getTime();return t>=Math.min(x,y)&&t<=Math.max(x,y)}
function renderCal(){if(!pop)return;const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=first.getDay();let h=`<div class="tm-wa-range-head"><button class="tm-wa-range-nav" data-rnav="-1">‹</button><div class="tm-wa-range-title">${MONTHS[m]} ${y}</div><button class="tm-wa-range-nav" data-rnav="1">›</button></div><div class="tm-wa-range-grid">`;['D','S','T','Q','Q','S','S'].forEach(x=>h+=`<div class="tm-wa-range-week">${x}</div>`);for(let i=0;i<start;i++)h+='<div class="tm-wa-range-empty"></div>';for(let d=1;d<=days;d++){const x=new Date(y,m,d),edge=sameDay(x,pickA)||sameDay(x,pickB),rng=between(x,pickA,pickB);h+=`<button class="tm-wa-range-day${rng?' inrange':''}${edge?' edge':''}" data-rday="${d}">${d}</button>`}h+=`</div><div class="tm-wa-range-note">Clique na data inicial e depois na data final.</div><div class="tm-wa-range-presets"><button data-preset="today">Hoje</button><button data-preset="yesterday">Ontem</button><button data-preset="7">Últimos 7 dias</button><button data-preset="month">Este mês</button></div><div class="tm-wa-range-actions"><button class="btn" data-cancel="1">Cancelar</button><button class="btn btn-primary" data-apply="1">Aplicar período</button></div>`;pop.innerHTML=h;pos()}
function openRange(btn){closePop();anchor=btn;pickA=startDay(from);pickB=startDay(to);view=new Date(pickA.getFullYear(),pickA.getMonth(),1);pop=document.createElement('div');pop.className='tm-wa-range-pop';document.body.appendChild(pop);renderCal()}
function label(){const b=$('#tm-wa-range-btn');if(!b)return;if(sameDay(from,to))b.innerHTML=`<i class="ti ti-calendar"></i> ${br(from)}`;else b.innerHTML=`<i class="ti ti-calendar"></i> ${br(from)} → ${br(to)}`}
async function refreshSummary(){try{const out=normalize(await rpc('whatsapp_followup_summary',{p_from:from.toISOString(),p_to:to.toISOString()}));const root=$('#tm-wa-fu-summary');if(!root)return;$('[data-k=received]',root).textContent=out.contacts_received??0;$('[data-k=waiting]',root).textContent=out.awaiting_response??0;$('[data-k=answered]',root).textContent=out.responded??0;const old=$('[data-k=oldest]',root);if(old){if(!out.oldest_waiting_since)old.textContent='—';else{const ms=Date.now()-new Date(out.oldest_waiting_since).getTime(),min=Math.max(0,Math.floor(ms/60000));old.textContent=min<60?min+'min':Math.floor(min/60)+'h '+(min%60)+'min'}}}catch(_e){}}
function ensureRange(){const old=$('#tm-wa-date'),actions=$('#tm-wa-fu-summary .tm-wa-actions');if(!old||!actions)return;if(!$('#tm-wa-range-btn')){old.style.display='none';const b=document.createElement('button');b.type='button';b.className='btn tm-wa-range-btn';b.id='tm-wa-range-btn';old.parentNode.insertBefore(b,old);b.onclick=e=>{e.preventDefault();e.stopPropagation();openRange(b)};label();refreshSummary()}const ev=$('#tm-wa-events-btn');if(ev&&!ev.dataset.historyOverride){ev.dataset.historyOverride='1';ev.textContent='Histórico WhatsApp';ev.onclick=openGlobalHistory}}
function cleanText(e){const t=e?.text;return t==null||t===''?'[mensagem sem texto / mídia]':String(t)}
function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?'}
function waDay(v){try{return new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return''}}
function waTime(v){try{return new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
function mediaLabel(m){const k=String(m?.media_kind||'').toLowerCase();if(k==='image')return'📷 Abrir imagem';if(k==='video')return'🎥 Abrir vídeo';if(k==='audio')return'🎧 Reproduzir áudio';if(k==='document')return'📎 Abrir documento';if(k==='sticker')return'🖼️ Abrir figurinha';return'📎 Abrir mídia'}
function encStoragePath(p){return String(p||'').split('/').map(encodeURIComponent).join('/')}
async function loadMediaAsset(btn,m){
  if(btn.dataset.loaded==='1')return;
  btn.disabled=true;
  try{
    const cfg=window.CRM_SUPABASE?.config,t=window.TM_WA_RUNTIME?.token?.();
    if(!cfg?.url||!cfg?.publishableKey||!t)throw new Error('Sessão de mídia indisponível');
    const bucket=m.storage_bucket||'whatsapp-media',url=cfg.url+'/storage/v1/object/authenticated/'+encodeURIComponent(bucket)+'/'+encStoragePath(m.storage_path);
    const r=await fetch(url,{headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+t}});
    if(!r.ok)throw new Error('mídia '+r.status);
    const blob=await r.blob(),src=URL.createObjectURL(blob),k=String(m.media_kind||'').toLowerCase(),box=btn.closest('.tm-wa-media-card');
    let el;
    if(k==='image'||k==='sticker'){el=document.createElement('img');el.src=src;el.alt=m.caption||'Imagem do WhatsApp'}
    else if(k==='video'){el=document.createElement('video');el.src=src;el.controls=true;el.preload='metadata'}
    else if(k==='audio'){el=document.createElement('audio');el.src=src;el.controls=true;el.preload='metadata'}
    else{el=document.createElement('a');el.href=src;el.target='_blank';el.rel='noopener';el.textContent=m.original_filename||'Abrir arquivo';el.style.color='#d9fdd3'}
    box.innerHTML='';box.appendChild(el);btn.dataset.loaded='1';
  }catch(err){btn.disabled=false;btn.textContent='Falha ao abrir · tentar novamente'}
}
function bindMedia(root,mediaById){$$('[data-wa-media]',root).forEach(btn=>{const m=mediaById.get(btn.dataset.waMedia);if(m)btn.onclick=()=>loadMediaAsset(btn,m)})}
function renderMessages(events,media){
  const mediaById=new Map((media||[]).map(m=>[String(m.message_id),m]));
  let lastDay='';
  const html=[];
  for(const x of events){
    const day=waDay(x.at);if(day&&day!==lastDay){html.push('<div class="tm-wa-wa-day">'+esc(day)+'</div>');lastDay=day}
    const m=mediaById.get(String(x.message_id||'')),mediaHtml=m?'<div class="tm-wa-media-card"><button type="button" class="tm-wa-media-open" data-wa-media="'+esc(String(x.message_id||''))+'">'+esc(mediaLabel(m))+'</button></div>':'';
    const text=cleanText(x),hidePlaceholder=m&&/^\[(imagem|vídeo|áudio|figurinha|documento)\]$/i.test(text.trim());
    html.push('<div class="tm-wa-wa-bubble '+(x.direction==='inbound'?'in':'out')+'">'+mediaHtml+(hidePlaceholder?'':'<div>'+esc(text)+'</div>')+'<div class="tm-wa-wa-meta"><span>'+esc(waTime(x.at))+'</span><span>'+esc(x.direction==='inbound'?'Cliente':'Executivo')+'</span></div></div>');
  }
  return{html:html.join(''),mediaById};
}
async function loadLeadChat(leadId,root){
  root.innerHTML='<div class="tm-wa-wa-empty">Carregando conversa...</div>';
  try{
    const [d0,media0]=await Promise.all([rpc('whatsapp_lead_briefing',{p_lead_id:leadId,p_limit:500}),rpc('whatsapp_media_for_lead',{p_lead_id:leadId}).catch(()=>[])]);
    const d=normalize(d0),ev=Array.isArray(d.whatsapp_events)?d.whatsapp_events:[],f=ev.filter(x=>{const a=new Date(x.at);return a>=from&&a<=to}).sort((a,b)=>new Date(a.at)-new Date(b.at)),media=Array.isArray(media0)?media0:[];
    const rendered=renderMessages(f,media),lead=d?.lead||{};
    root.innerHTML='<div class="tm-wa-wa-chat-head"><div class="tm-wa-wa-avatar">'+esc(initials(lead.nome))+'</div><div><div class="tm-wa-wa-chat-title">'+esc(lead.nome||'Lead')+' <span class="tm-wa-wa-status">Histórico</span></div><div class="tm-wa-wa-chat-sub">'+esc(lead.telefone||'')+' · '+f.length+' mensagem(ns) · '+esc(br(from))+' → '+esc(br(to))+' · Somente histórico</div></div></div><div class="tm-wa-wa-chat-body">'+(rendered.html||'<div class="tm-wa-wa-empty">Nenhuma mensagem registrada nesse período.</div>')+'</div>';
    bindMedia(root,rendered.mediaById);
    const body=$('.tm-wa-wa-chat-body',root);if(body)body.scrollTop=body.scrollHeight;
  }catch(err){root.innerHTML='<div class="tm-wa-wa-empty">Falha ao carregar histórico: '+esc(String(err?.message||err))+'</div>'}
}
async function openLeadHistory(leadId){const m=openModal('Conversa WhatsApp','<div id="tm-wa-lead-history" class="tm-wa-wa-pane" style="min-height:0;flex:1"></div>');await loadLeadChat(leadId,$('#tm-wa-lead-history',m))}
function openModal(title,body){$('#tm-wa-modal')?.remove();const m=document.createElement('div');m.id='tm-wa-modal';m.className='tm-wa-modal';m.innerHTML=`<div class="tm-wa-card"><div class="tm-wa-head"><h3>${esc(title)}</h3><button class="tm-wa-close">×</button></div>${body}</div>`;document.body.appendChild(m);$('.tm-wa-close',m).onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};return m}
async function openGlobalHistory(){histDiag('openGlobalHistory-called');
  const m=openModal('Histórico WhatsApp','<div id="tm-wa-global-history" style="min-height:0;flex:1;display:flex">Carregando conversas...</div>');
  try{
    const rows=await rpc('whatsapp_followup_events',{p_from:from.toISOString(),p_to:to.toISOString(),p_limit:1000}),ev=Array.isArray(rows)?rows:[],by=new Map();
    for(const x of ev){const k=String(x.lead_id||'');if(!k)continue;if(!by.has(k))by.set(k,{lead_id:k,nome:x.nome||'Sem nome',phone:x.contact_phone||'',count:0,last:x.message_timestamp,preview:x.message_text||x.message_type||'mensagem'});const a=by.get(k);a.count++;if(new Date(x.message_timestamp)>new Date(a.last)){a.last=x.message_timestamp;a.preview=x.message_text||x.message_type||'mensagem';a.phone=x.contact_phone||a.phone}}
    const data=[...by.values()].sort((a,b)=>new Date(b.last)-new Date(a.last)),el=$('#tm-wa-global-history',m);
    el.innerHTML='<div class="tm-wa-wa-shell"><div class="tm-wa-wa-list"><div class="tm-wa-wa-list-head"><input id="tm-wa-hist-search" class="tm-wa-hist-search" type="text" placeholder="Buscar lead ou telefone"><div style="font-size:10px;color:#8696a0">'+data.length+' conversa(s) · '+esc(br(from))+' → '+esc(br(to))+'</div></div><div class="tm-wa-wa-conversations" id="tm-wa-wa-conversations"></div></div><div class="tm-wa-wa-pane" id="tm-wa-wa-pane"><div class="tm-wa-wa-empty">Selecione uma conversa.</div></div></div>';
    const list=$('#tm-wa-wa-conversations',m),pane=$('#tm-wa-wa-pane',m);
    function draw(arr){
      list.innerHTML=arr.length?arr.map(x=>'<button type="button" class="tm-wa-wa-item" data-hlead="'+esc(x.lead_id)+'"><span class="tm-wa-wa-avatar">'+esc(initials(x.nome))+'</span><span><div class="tm-wa-wa-name">'+esc(x.nome)+'</div><div class="tm-wa-wa-preview">'+esc(x.preview||'')+'</div></span><span class="tm-wa-wa-time">'+esc(waTime(x.last))+'</span></button>').join(''):'<div class="tm-wa-wa-empty">Nenhuma conversa.</div>';
      $$('[data-hlead]',list).forEach(btn=>btn.onclick=async()=>{$$('.tm-wa-wa-item',list).forEach(x=>x.classList.remove('active'));btn.classList.add('active');await loadLeadChat(btn.dataset.hlead,pane)});
    }
    draw(data);
    const input=$('#tm-wa-hist-search',m);input.oninput=()=>draw(data.filter(x=>(x.nome+' '+x.phone).toLowerCase().includes(input.value.toLowerCase())));
    if(data[0]){const first=$('[data-hlead]',list);if(first){first.classList.add('active');await loadLeadChat(data[0].lead_id,pane)}}
  }catch(err){const el=$('#tm-wa-global-history',m);if(el)el.innerHTML='<div class="tm-wa-wa-empty">Falha ao carregar histórico: '+esc(String(err?.message||err))+'</div>'}
}
window.TM_WA_HISTORY_OPEN=openGlobalHistory;installHistoryDiagObserver();
function showRaw(m,ev){const el=$('#tm-wa-global-history',m);el.innerHTML=`<button class="btn" id="tm-wa-back-history" style="margin-bottom:10px">← Conversas por lead</button><table class="tm-wa-table"><thead><tr><th>Quando</th><th>Lead</th><th>Direção</th><th>Telefone</th><th>Tipo</th><th>Conteúdo</th></tr></thead><tbody>${ev.length?ev.map(x=>`<tr><td>${esc(dt(x.message_timestamp))}</td><td>${esc(x.nome||'—')}</td><td>${esc(x.direction)}</td><td>${esc(x.contact_phone)}</td><td>${esc(x.message_type||'—')}</td><td>${esc(x.message_text||'—')}</td></tr>`).join(''):'<tr><td colspan="6">Sem eventos.</td></tr>'}</tbody></table>`;$('#tm-wa-back-history',m).onclick=()=>{m.remove();openGlobalHistory()}}
function decorateRows(){ $$('#fu-tbody tr').forEach(tr=>{const a=$('.tm-agendar-btn[data-lead-id]',tr);if(!a)return;const id=a.dataset.leadId,td=tr.lastElementChild;if(!td)return;let h=$('.tm-wa-history-icon',tr);if(!h){h=document.createElement('button');h.type='button';h.className='tm-wa-history-icon';h.title='Histórico WhatsApp';h.setAttribute('aria-label','Histórico WhatsApp');h.innerHTML='<i class="ti ti-brand-whatsapp"></i>';const g=$('.tm-wa-gpt',tr);g?td.insertBefore(h,g):td.appendChild(h);h.onclick=e=>{e.preventDefault();e.stopPropagation();openLeadHistory(id)}}const g=$('.tm-wa-gpt',tr);if(g&&!g.dataset.realGpt){g.dataset.realGpt='1';g.onclick=e=>{e.preventDefault();e.stopPropagation();document.dispatchEvent(new CustomEvent('tm:wa-gpt-analyze',{detail:{leadId:g.dataset.leadId}}))}} })}
function applyPreset(v){const now=new Date();if(v==='today'){pickA=startDay(now);pickB=startDay(now)}else if(v==='yesterday'){const x=new Date(now);x.setDate(x.getDate()-1);pickA=startDay(x);pickB=startDay(x)}else if(v==='7'){const x=new Date(now);x.setDate(x.getDate()-6);pickA=startDay(x);pickB=startDay(now)}else if(v==='month'){pickA=new Date(now.getFullYear(),now.getMonth(),1);pickB=startDay(now)}view=new Date(pickA.getFullYear(),pickA.getMonth(),1);renderCal()}
document.addEventListener('click',e=>{
  const historyBtn=e.target?.closest?.('#tm-wa-events-btn');
  if(historyBtn){
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    historyBtn.textContent='Histórico WhatsApp';
    openGlobalHistory();
    return;
  }
  if(!pop)return;const nav=e.target.closest?.('[data-rnav]');if(nav&&pop.contains(nav)){e.preventDefault();view.setMonth(view.getMonth()+Number(nav.dataset.rnav));renderCal();return}const day=e.target.closest?.('[data-rday]');if(day&&pop.contains(day)){e.preventDefault();const d=startDay(new Date(view.getFullYear(),view.getMonth(),Number(day.dataset.rday)));if(!pickA||pickB){pickA=d;pickB=null}else if(d<pickA){pickB=pickA;pickA=d}else pickB=d;renderCal();return}const preset=e.target.closest?.('[data-preset]');if(preset&&pop.contains(preset)){e.preventDefault();applyPreset(preset.dataset.preset);return}if(e.target.closest?.('[data-cancel]')&&pop.contains(e.target)){e.preventDefault();closePop();return}if(e.target.closest?.('[data-apply]')&&pop.contains(e.target)){e.preventDefault();if(!pickA)return;from=startDay(pickA);to=endDay(pickB||pickA);closePop();label();refreshSummary();return}if(!pop.contains(e.target)&&e.target!==anchor)closePop()},true);
function boot(){css();ensureRange();decorateRows();const mo=new MutationObserver(()=>{ensureRange();decorateRows()},true);mo.observe(document.documentElement,{childList:true,subtree:true});setInterval(()=>{ensureRange();decorateRows()},2000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
/* Taurus Magnum CRM — WhatsApp lead briefing + GPT — TEST BRANCH ONLY */
(function(){
'use strict';
if(window.__TM_WA_GPT_BRIEFING__) return;
window.__TM_WA_GPT_BRIEFING__=true;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function rpc(name,args){const c=window.CRM_CANONICAL;if(!c||typeof c.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return c.rpc(name,args||{});}
function fmt(v){return v==null||v===''?'não informado':String(v)}
function brDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('pt-BR')}catch(_e){return String(v)}}
function buildPrompt(d){
  const l=d.lead||{};
  const ev=Array.isArray(d.whatsapp_events)?d.whatsapp_events:[];
  const lines=ev.map(x=>`[${brDate(x.at)}] ${x.direction==='inbound'?'CLIENTE':'CORRETOR'} (${fmt(x.type)}): ${fmt(x.text)}`);
  return `Sou corretor de imóveis. Analise esta negociação e me diga qual o melhor próximo passo.\n\nCLIENTE: ${fmt(l.nome)}\nTELEFONE: ${fmt(l.telefone)}\nRESPONSÁVEL: ${fmt(l.responsavel)}\nPERFIL: ${fmt(l.perfil)}\nREGIÃO DE INTERESSE: ${fmt(l.regiao)}\nSTATUS: ${fmt(l.status)}\nVALOR: ${fmt(l.valor)}\nORIGEM: ${fmt(l.origem)}\nÚLTIMA VEZ QUE EU FALEI: ${fmt(l.ult_meu)}\nÚLTIMA VEZ QUE ELE FALOU: ${fmt(l.ult_dele)}\nPRÓXIMO CONTATO: ${fmt(l.proximo_contato)}\nNOTAS DO CRM: ${fmt(l.notas)}\n\nHISTÓRICO WHATSAPP CAPTURADO:\n${lines.length?lines.join('\n'):'Nenhuma mensagem WhatsApp registrada ainda.'}\n\nQuero uma resposta curta e prática em 4 partes:\n1. Em que pé está a negociação e qual o principal risco de perder\n2. O que o cliente parece valorizar, quais objeções estão abertas e quais sinais de compra existem\n3. Qual deve ser o próximo passo comercial\n4. Uma mensagem pronta para eu enviar agora no WhatsApp\n\nNão invente fatos que não estejam no histórico. Se faltar informação, diga exatamente o que precisa ser descoberto.`;
}
async function copy(txt,status){try{await navigator.clipboard.writeText(txt);if(status)status.textContent='✓ Briefing copiado. Abra o ChatGPT e cole.';}catch(_e){if(status)status.textContent='Selecione o texto e copie manualmente.'}}
function openModal(title,body){document.getElementById('tm-wa-modal')?.remove();const m=document.createElement('div');m.id='tm-wa-modal';m.className='tm-wa-modal';m.innerHTML=`<div class="tm-wa-card"><div class="tm-wa-head"><h3>${esc(title)}</h3><button class="tm-wa-close">×</button></div>${body}</div>`;document.body.appendChild(m);$('.tm-wa-close',m).onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};return m;}
async function analyze(leadId){
  const m=openModal('Analisar negociação com GPT','<div id="tm-wa-gpt-body">Carregando histórico real do lead...</div>');
  try{
    const d=await rpc('whatsapp_lead_briefing',{p_lead_id:leadId,p_limit:120});
    const prompt=buildPrompt(d||{});
    const ev=Array.isArray(d?.whatsapp_events)?d.whatsapp_events:[];
    const inbound=ev.filter(x=>x.direction==='inbound').length, outbound=ev.filter(x=>x.direction==='outbound').length;
    const body=$('#tm-wa-gpt-body',m);
    body.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px"><div class="tm-wa-kpi"><span>Mensagens capturadas</span><b>${ev.length}</b></div><div class="tm-wa-kpi"><span>Cliente</span><b>${inbound}</b></div><div class="tm-wa-kpi"><span>Corretor</span><b>${outbound}</b></div></div><div style="font-size:12px;color:#94a3b8;margin-bottom:8px">Lead: <b style="color:#e2e8f0">${esc(d?.lead?.nome||'—')}</b> · responsável: ${esc(d?.lead?.responsavel||'—')}</div><textarea id="tm-wa-gpt-prompt" readonly style="width:100%;height:330px;background:#060c18;border:1px solid rgba(59,130,246,.22);border-radius:9px;color:#94a3b8;font-size:11px;padding:10px;outline:none;resize:vertical;box-sizing:border-box;font-family:ui-monospace,monospace;line-height:1.5">${esc(prompt)}</textarea><div id="tm-wa-gpt-status" style="min-height:18px;margin:8px 0;color:#6ee7b7;font-size:11px"></div><div style="display:flex;gap:8px"><button class="btn" id="tm-wa-gpt-copy" style="flex:1">Copiar briefing</button><a href="https://chatgpt.com/" target="_blank" rel="noopener" class="btn btn-primary" style="flex:1;justify-content:center;text-decoration:none">Abrir ChatGPT ↗</a></div>`;
    const st=$('#tm-wa-gpt-status',m);$('#tm-wa-gpt-copy',m).onclick=()=>copy(prompt,st);copy(prompt,st);
  }catch(err){const body=$('#tm-wa-gpt-body',m);if(body)body.textContent='Falha ao carregar briefing: '+String(err&&err.message||err);}
}
document.addEventListener('tm:wa-gpt-analyze',e=>{const id=e?.detail?.leadId;if(id)analyze(id)});
})();

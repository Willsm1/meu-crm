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
const MODES={
  next:{label:'Próximo passo',instruction:'Determine a ação comercial de maior impacto que deve acontecer agora. Evite listas genéricas; escolha uma prioridade.'},
  close:{label:'Fechamento',instruction:'Procure o caminho mais curto e plausível para avançar para compromisso, proposta, visita ou fechamento, sem pressionar de forma artificial.'},
  objection:{label:'Objeções',instruction:'Identifique objeções explícitas e implícitas, separe objeção real de falta de informação e proponha como tratar cada uma.'},
  reactivate:{label:'Reativação',instruction:'Avalie por que a conversa esfriou e construa a reabertura mais natural possível, usando o contexto real do cliente.'}
};
function buildPrompt(d,modeKey){
  const l=d.lead||{}, mode=MODES[modeKey]||MODES.next;
  const ev=Array.isArray(d.whatsapp_events)?d.whatsapp_events:[];
  const lines=ev.map(x=>`[${brDate(x.at)}] ${x.direction==='inbound'?'CLIENTE':'CORRETOR'} (${fmt(x.type)}): ${fmt(x.text)}`);
  return `Você é um consultor comercial sênior de vendas imobiliárias. Analise a negociação abaixo usando somente os fatos disponíveis no CRM e na conversa.\n\nFOCO DESTA ANÁLISE: ${mode.label}\n${mode.instruction}\n\nCLIENTE: ${fmt(l.nome)}\nTELEFONE: ${fmt(l.telefone)}\nRESPONSÁVEL: ${fmt(l.responsavel)}\nPERFIL: ${fmt(l.perfil)}\nREGIÃO DE INTERESSE: ${fmt(l.regiao)}\nSTATUS: ${fmt(l.status)}\nVALOR: ${fmt(l.valor)}\nORIGEM: ${fmt(l.origem)}\nÚLTIMA VEZ QUE EU FALEI: ${fmt(l.ult_meu)}\nÚLTIMA VEZ QUE ELE FALOU: ${fmt(l.ult_dele)}\nPRÓXIMO CONTATO: ${fmt(l.proximo_contato)}\nNOTAS DO CRM: ${fmt(l.notas)}\n\nHISTÓRICO WHATSAPP CAPTURADO:\n${lines.length?lines.join('\n'):'Nenhuma mensagem WhatsApp registrada ainda.'}\n\nResponda de forma curta, comercial e específica em 5 blocos:\n1. DIAGNÓSTICO — em que pé está a negociação e qual é o risco principal de perder\n2. LEITURA DO CLIENTE — o que ele demonstra valorizar, sinais de compra, hesitações e objeções abertas\n3. LACUNA — qual informação importante ainda falta descobrir antes de avançar\n4. PRÓXIMO PASSO — uma única ação prioritária, explicando rapidamente por que ela é a melhor agora\n5. MENSAGEM — texto pronto para WhatsApp, natural, curto e coerente com o histórico\n\nRegras:\n- Não invente fatos, orçamento, urgência, preferência ou objeções.\n- Diferencie fato do histórico de inferência comercial.\n- Não repita perguntas que o cliente já respondeu.\n- Não recomende simplesmente “fazer follow-up”; diga o que fazer e com qual objetivo.\n- Use a linguagem do cliente quando isso ajudar a manter continuidade.\n- Se a conversa não tiver informação suficiente para uma conclusão, diga qual pergunta deve ser feita agora.`;
}
async function copy(txt,status){try{await navigator.clipboard.writeText(txt);if(status)status.textContent='✓ Briefing copiado. Abra o ChatGPT e cole.';}catch(_e){if(status)status.textContent='Selecione o texto e copie manualmente.'}}
function openModal(title,body){document.getElementById('tm-wa-modal')?.remove();const m=document.createElement('div');m.id='tm-wa-modal';m.className='tm-wa-modal';m.innerHTML=`<div class="tm-wa-card"><div class="tm-wa-head"><h3>${esc(title)}</h3><button class="tm-wa-close">×</button></div>${body}</div>`;document.body.appendChild(m);$('.tm-wa-close',m).onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove()};return m;}
async function analyze(leadId){
  const m=openModal('Analisar negociação com GPT','<div id="tm-wa-gpt-body">Carregando histórico real do lead...</div>');
  try{
    const d=await rpc('whatsapp_lead_briefing',{p_lead_id:leadId,p_limit:200});
    const ev=Array.isArray(d?.whatsapp_events)?d.whatsapp_events:[];
    const inbound=ev.filter(x=>x.direction==='inbound').length, outbound=ev.filter(x=>x.direction==='outbound').length;
    const body=$('#tm-wa-gpt-body',m);
    body.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px"><div class="tm-wa-kpi"><span>Mensagens capturadas</span><b>${ev.length}</b></div><div class="tm-wa-kpi"><span>Cliente</span><b>${inbound}</b></div><div class="tm-wa-kpi"><span>Corretor</span><b>${outbound}</b></div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div style="font-size:12px;color:#94a3b8;flex:1">Lead: <b style="color:#e2e8f0">${esc(d?.lead?.nome||'—')}</b> · responsável: ${esc(d?.lead?.responsavel||'—')}</div><select id="tm-wa-gpt-mode" style="height:34px"><option value="next">Próximo passo</option><option value="close">Fechamento</option><option value="objection">Objeções</option><option value="reactivate">Reativação</option></select></div><textarea id="tm-wa-gpt-prompt" readonly style="width:100%;height:330px;background:#060c18;border:1px solid rgba(59,130,246,.22);border-radius:9px;color:#94a3b8;font-size:11px;padding:10px;outline:none;resize:vertical;box-sizing:border-box;font-family:ui-monospace,monospace;line-height:1.5"></textarea><div id="tm-wa-gpt-status" style="min-height:18px;margin:8px 0;color:#6ee7b7;font-size:11px"></div><div style="display:flex;gap:8px"><button class="btn" id="tm-wa-gpt-copy" style="flex:1">Copiar briefing</button><a href="https://chatgpt.com/" target="_blank" rel="noopener" class="btn btn-primary" style="flex:1;justify-content:center;text-decoration:none">Abrir ChatGPT ↗</a></div>`;
    const st=$('#tm-wa-gpt-status',m), ta=$('#tm-wa-gpt-prompt',m), mode=$('#tm-wa-gpt-mode',m);
    const rebuild=()=>{const prompt=buildPrompt(d||{},mode.value);ta.value=prompt;st.textContent='';return prompt};
    mode.onchange=()=>{rebuild();copy(ta.value,st)};
    $('#tm-wa-gpt-copy',m).onclick=()=>copy(ta.value,st);
    rebuild();copy(ta.value,st);
  }catch(err){const body=$('#tm-wa-gpt-body',m);if(body)body.textContent='Falha ao carregar briefing: '+String(err&&err.message||err);}
}
document.addEventListener('tm:wa-gpt-analyze',e=>{const id=e?.detail?.leadId;if(id)analyze(id)});
})();

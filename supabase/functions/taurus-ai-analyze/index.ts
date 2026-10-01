import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json'
};

const MODES:Record<string,{label:string;instruction:string}>={
  next:{label:'Próximo passo',instruction:'Determine a ação comercial de maior impacto que deve acontecer agora. Evite listas genéricas; escolha uma prioridade.'},
  close:{label:'Fechamento',instruction:'Procure o caminho mais curto e plausível para avançar para compromisso, proposta, visita ou fechamento, sem pressionar de forma artificial.'},
  objection:{label:'Objeções',instruction:'Identifique objeções explícitas e implícitas, separe objeção real de falta de informação e proponha como tratar cada uma.'},
  reactivate:{label:'Reativação',instruction:'Avalie por que a conversa esfriou e construa a reabertura mais natural possível, usando o contexto real do cliente.'}
};

function fmt(v:unknown){return v===null||v===undefined||v===''?'não informado':String(v)}
function brDate(v:unknown){if(!v)return '—';try{return new Date(String(v)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}catch{return String(v)}}
async function rpc(base:string,key:string,auth:string,name:string,args:Record<string,unknown>){
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const txt=await r.text();if(!r.ok)throw new Error(`${name}: ${r.status} ${txt.slice(0,240)}`);return txt?JSON.parse(txt):null;
}
function queryFor(d:any,modeKey:string){const l=d?.lead||{},ev=Array.isArray(d?.whatsapp_events)?d.whatsapp_events:[];const recent=ev.slice(-8).map((x:any)=>x.text||'').join(' ');return [MODES[modeKey]?.label,l.status,l.perfil,l.regiao,l.notas,recent].filter(Boolean).join(' ').slice(0,3500)}
function knowledgeBlock(rows:any[]){if(!rows?.length)return 'Nenhuma fonte Taurus central retornada. Use somente CRM e histórico WhatsApp.';return rows.map((x:any,i:number)=>`[FONTE ${i+1}] ${fmt(x.title)} | categoria: ${fmt(x.category)} | origem: ${fmt(x.source_type)}\n${fmt(x.content)}`).join('\n\n')}
function buildPrompt(d:any,modeKey:string,knowledge:any[]){
  const l=d?.lead||{},mode=MODES[modeKey]||MODES.next,ev=Array.isArray(d?.whatsapp_events)?d.whatsapp_events:[],archives=Array.isArray(d?.conversation_archives)?d.conversation_archives:[];
  const lines=ev.map((x:any)=>`[${brDate(x.at)}] ${x.direction==='inbound'?'CLIENTE':'CORRETOR'} (${fmt(x.type)}): ${fmt(x.text)}`);
  const archived=archives.map((a:any)=>`--- ${fmt(a.title)} | ${brDate(a.period_from)} até ${brDate(a.period_to)} ---\n${fmt(a.transcript_text)}`);
  return `Você é o Copiloto Comercial Taurus Magnum. Oriente o executivo usando conversa real, CRM e BASE DE CONHECIMENTO TAURUS.\n\nFOCO: ${mode.label}\n${mode.instruction}\n\nBASE TAURUS:\n${knowledgeBlock(knowledge)}\n\nCLIENTE: ${fmt(l.nome)}\nTELEFONE: ${fmt(l.telefone)}\nRESPONSÁVEL: ${fmt(l.responsavel)}\nPERFIL: ${fmt(l.perfil)}\nREGIÃO: ${fmt(l.regiao)}\nSTATUS: ${fmt(l.status)}\nVALOR: ${fmt(l.valor)}\nORIGEM: ${fmt(l.origem)}\nÚLTIMA VEZ QUE EU FALEI: ${fmt(l.ult_meu)}\nÚLTIMA VEZ QUE ELE FALOU: ${fmt(l.ult_dele)}\nPRÓXIMO CONTATO: ${fmt(l.proximo_contato)}\nNOTAS: ${fmt(l.notas)}\n\nMEMÓRIA TXT:\n${archived.length?archived.join('\n\n'):'Nenhuma memória compactada.'}\n\nHISTÓRICO RECENTE:\n${lines.length?lines.join('\n'):'Nenhuma mensagem registrada.'}\n\nHIERARQUIA: 1) fatos da conversa/CRM; 2) conhecimento Taurus aplicável; 3) inferências marcadas como inferência. Se houver conflito, a conversa real prevalece. Não conte duplicidades entre TXT e histórico recente.\n\nResponda curto e específico em 6 blocos:\n1. DIAGNÓSTICO\n2. SINAIS DO CLIENTE\n3. LEITURA TAURUS\n4. LACUNA\n5. PRÓXIMO PASSO\n6. MENSAGEM pronta para WhatsApp\n\nNão invente orçamento, urgência, preferência, objeção ou intenção. Não repita perguntas já respondidas. Não diga apenas “fazer follow-up”; diga o movimento concreto.`;
}
function outputText(data:any){
  const out=Array.isArray(data?.output)?data.output:[];
  for(const item of out){for(const c of (Array.isArray(item?.content)?item.content:[])){if(c?.type==='output_text'&&c?.text)return String(c.text)}}
  return data?.output_text?String(data.output_text):'';
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'method not allowed'}),{status:405,headers:cors});
  try{
    const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))throw new Error('authentication required');
    const body=await req.json();const leadId=String(body?.lead_id||'');const modeKey=String(body?.mode||'next');if(!leadId)throw new Error('lead_id required');
    const sbUrl=Deno.env.get('SUPABASE_URL')||'';const sbKey=Deno.env.get('SUPABASE_ANON_KEY')||'';if(!sbUrl||!sbKey)throw new Error('Supabase env unavailable');
    const brief=await rpc(sbUrl,sbKey,auth,'whatsapp_lead_briefing',{p_lead_id:leadId,p_limit:200});
    const knowledge=await rpc(sbUrl,sbKey,auth,'ai_knowledge_context',{p_lead_id:leadId,p_query:queryFor(brief,modeKey),p_limit:6});
    const prompt=buildPrompt(brief,modeKey,Array.isArray(knowledge)?knowledge:[]);
    const openaiKey=Deno.env.get('OPENAI_API_KEY');if(!openaiKey)return new Response(JSON.stringify({error:'OPENAI_API_KEY não configurada no Supabase Edge Functions'}),{status:503,headers:cors});
    const model=Deno.env.get('OPENAI_MODEL')||'gpt-5.6-terra';
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt,store:false,max_output_tokens:1600})});
    const data=await ai.json();if(!ai.ok)throw new Error(`OpenAI ${ai.status}: ${data?.error?.message||'erro'}`);
    const analysis=outputText(data);if(!analysis)throw new Error('modelo retornou resposta vazia');
    return new Response(JSON.stringify({analysis,model:data?.model||model,knowledge_sources:Array.isArray(knowledge)?knowledge.length:0,usage:data?.usage||null}),{headers:cors});
  }catch(err){return new Response(JSON.stringify({error:String((err as Error)?.message||err)}),{status:400,headers:cors});}
});

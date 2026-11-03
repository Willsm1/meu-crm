/* Taurus Magnum — extensible anti-regression registry */
(function(){
'use strict';
if(window.TAURUS_REGRESSION)return;

const cells=new Map();
const tests=[];
const runtimeErrors=[];
const VERSION='2026-11-03.1';

function now(){return Date.now()}
function safeString(v){try{return typeof v==='string'?v:JSON.stringify(v)}catch(_e){return String(v)}}
function errMsg(e){return String(e&&e.message||e||'erro desconhecido')}
function registerCell(cell){
  if(!cell||!cell.id)throw new Error('regression cell id obrigatório');
  cells.set(cell.id,Object.assign({label:cell.id,description:'',owner:''},cell));
}
function registerTest(cellId,test){
  if(!cells.has(cellId))registerCell({id:cellId,label:cellId});
  if(!test||!test.id||typeof test.run!=='function')throw new Error('teste inválido em '+cellId);
  const key=cellId+':'+test.id;
  const idx=tests.findIndex(x=>x.key===key);
  const row=Object.assign({severity:'critical',timeoutMs:7000,destructive:false,source:null},test,{cellId,key});
  if(idx>=0)tests[idx]=row;else tests.push(row);
}
function assert(ok,message,details){
  if(!ok){const e=new Error(message||'assertion failed');e.details=details;throw e}
  return true;
}
function exists(sel){return !!document.querySelector(sel)}
function script(id){return !!document.getElementById(id)}
function withTimeout(p,ms,label){
  return Promise.race([
    Promise.resolve(p),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout '+(label||'')+' após '+ms+'ms')),ms))
  ]);
}
async function supaRead(table,select='*'){
  const cli=window.TM_SUPABASE_AUTH_CLIENT;
  if(!cli)throw new Error('cliente Supabase indisponível');
  const q=cli.from(table).select(select).limit(1);
  const out=await q;
  if(out.error)throw out.error;
  return out.data||[];
}
async function wa(path){
  if(!window.TM_WA_RUNTIME||typeof window.TM_WA_RUNTIME.api!=='function')throw new Error('runtime WhatsApp indisponível');
  return window.TM_WA_RUNTIME.api(path);
}
function captureRuntimeError(e){
  runtimeErrors.push({
    at:new Date().toISOString(),
    message:String(e&&e.message||e&&e.reason&&e.reason.message||e&&e.reason||'erro runtime'),
    source:e&&e.filename||null,
    line:e&&e.lineno||null,
    col:e&&e.colno||null
  });
  if(runtimeErrors.length>50)runtimeErrors.shift();
}
window.addEventListener('error',captureRuntimeError);
window.addEventListener('unhandledrejection',captureRuntimeError);

async function runOne(t,mode){
  const started=now();
  if(t.destructive&&mode!=='full')return {key:t.key,cellId:t.cellId,id:t.id,label:t.label,status:'skipped',severity:t.severity,durationMs:0,source:t.source,details:'modo seguro'};
  try{
    const value=await withTimeout(t.run({assert,exists,script,supaRead,wa,mode,runtimeErrors}),t.timeoutMs,t.key);
    const normalized=value&&typeof value==='object'&&('status' in value||'details' in value)?value:{details:value===undefined?'ok':value};
    return {key:t.key,cellId:t.cellId,id:t.id,label:t.label,status:normalized.status||'passed',severity:t.severity,durationMs:now()-started,source:t.source,details:normalized.details||'ok'};
  }catch(e){
    return {key:t.key,cellId:t.cellId,id:t.id,label:t.label,status:'failed',severity:t.severity,durationMs:now()-started,source:t.source,error:errMsg(e),details:e&&e.details||null,stack:e&&e.stack||null};
  }
}
async function persist(report){
  try{
    const cli=window.TM_SUPABASE_AUTH_CLIENT;
    if(!cli)return {ok:false,error:'Supabase indisponível'};
    const payload={
      source:'crm_panel',
      status:report.failed>0?'failed':(report.skipped>0?'partial':'passed'),
      passed:report.passed,
      failed:report.failed,
      skipped:report.skipped,
      duration_ms:report.durationMs,
      app_version:VERSION,
      results:report.results,
      context:report.context
    };
    const out=await cli.from('regression_runs').insert(payload).select('id,created_at').single();
    if(out.error)throw out.error;
    return {ok:true,id:out.data.id,createdAt:out.data.created_at};
  }catch(e){return {ok:false,error:errMsg(e)}}
}
async function runAll(options){
  const o=Object.assign({mode:'safe',cellId:null,onProgress:null,persist:true},options||{});
  const selected=o.cellId?tests.filter(t=>t.cellId===o.cellId):tests.slice();
  const started=now(),results=[];
  for(let i=0;i<selected.length;i++){
    const t=selected[i];
    if(o.onProgress)try{o.onProgress({phase:'start',index:i,total:selected.length,test:t})}catch(_e){}
    const r=await runOne(t,o.mode);
    results.push(r);
    if(o.onProgress)try{o.onProgress({phase:'done',index:i,total:selected.length,test:t,result:r})}catch(_e){}
  }
  const passed=results.filter(r=>r.status==='passed').length;
  const failed=results.filter(r=>r.status==='failed').length;
  const skipped=results.filter(r=>r.status==='skipped').length;
  const report={
    version:VERSION,
    runAt:new Date().toISOString(),
    mode:o.mode,
    cellId:o.cellId,
    passed,failed,skipped,total:results.length,
    durationMs:now()-started,
    results,
    context:{
      href:location.href,
      userAgent:navigator.userAgent,
      online:navigator.onLine,
      gateway:window.TM_WA_RUNTIME&&window.TM_WA_RUNTIME.gateway?window.TM_WA_RUNTIME.gateway():null,
      runtimeErrors:runtimeErrors.slice(-20)
    }
  };
  try{localStorage.setItem('tm_regression_last_report',JSON.stringify(report))}catch(_e){}
  if(o.persist){
    report.persistence=await persist(report);
    try{localStorage.setItem('tm_regression_last_report',JSON.stringify(report))}catch(_e){}
  }
  window.__TAURUS_LAST_REGRESSION_REPORT__=report;
  document.dispatchEvent(new CustomEvent('taurus:regression-complete',{detail:report}));
  return report;
}
function resetTestState(){
  const removed=[];
  for(let i=localStorage.length-1;i>=0;i--){
    const k=localStorage.key(i);
    if(k&&k.startsWith('tm_regression_fixture_')){localStorage.removeItem(k);removed.push(k)}
  }
  runtimeErrors.length=0;
  return {ok:true,removed};
}

window.TAURUS_REGRESSION={
  version:VERSION,
  registerCell,registerTest,runAll,runCell:(id,o)=>runAll(Object.assign({},o||{},{cellId:id})),
  list:()=>tests.map(t=>Object.assign({},t,{run:undefined})),
  cells:()=>Array.from(cells.values()),
  last:()=>window.__TAURUS_LAST_REGRESSION_REPORT__||null,
  resetTestState,
  runtimeErrors
};

/* CELLS */
[
 ['shell','CRM Shell','Estrutura base, JS e integridade do documento'],
 ['navigation','Navegação','Abas e roteamento visual'],
 ['leads','Leads','Carteira, busca, filtros e modal'],
 ['followup','Follow-up','Fila, filtros e dados de follow-up'],
 ['supabase','Supabase','Configuração, sessão e leitura segura'],
 ['whatsapp','WhatsApp','Runtime, gateway, sessões e captura'],
 ['media','Mídia','Storage/media modules e persistência'],
 ['safety','Segurança','Travas contra ações destrutivas e erros runtime']
].forEach(x=>registerCell({id:x[0],label:x[1],description:x[2]}));

function domTest(cell,id,label,selector){
  registerTest(cell,{id,label,source:selector,run:({assert})=>assert(!!document.querySelector(selector),'elemento ausente: '+selector)});
}
function globalFn(id){
  try{return typeof window[id]==='function'||typeof window.eval('typeof '+id+'==="function"&&'+id)==='function'}catch(_e){return false}
}

/* Shell */
domTest('shell','body','Documento carregado','body');
domTest('shell','nav','Barra principal','.nav');
domTest('shell','actionbar','Barra de ações','.actionbar');
domTest('shell','progress','Barra de progresso','#crm-progress-bar');
registerTest('shell',{id:'unique-dom-ids',label:'IDs DOM sem duplicidade',run:({assert})=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);assert(!dup.length,'IDs duplicados no DOM',dup);return {details:ids.length+' IDs verificados'}}});
['showPage','renderAll','refreshCRM','openModal','closeModal','saveLead','showToast'].forEach(fn=>registerTest('shell',{id:'fn-'+fn,label:'Função '+fn+' disponível',source:fn,run:({assert})=>assert(globalFn(fn),'função ausente: '+fn)}));

/* Navigation */
['leads','kanban','dashboard','import','exportar','quentes','retomar','followup','relatorio','script'].forEach(p=>{
  domTest('navigation','page-'+p,'Página '+p+' existe','#page-'+p);
});
registerTest('navigation',{id:'tabs-target-pages',label:'Todas as abas apontam para páginas existentes',run:({assert})=>{const missing=[];document.querySelectorAll('.nav-tab[data-tab]').forEach(b=>{if(!document.getElementById('page-'+b.dataset.tab))missing.push(b.dataset.tab)});assert(!missing.length,'aba sem página correspondente',missing);return {details:document.querySelectorAll('.nav-tab[data-tab]').length+' abas verificadas'}}});

/* Leads */
[
 ['tbody','Tabela de leads','#tbody'],
 ['search','Busca de leads','#search-leads'],
 ['notes-search','Busca em anotações','#search-notas'],
 ['status-filter','Filtro de status','#filterStatus'],
 ['profile-filter','Filtro de perfil','#filterPerfil'],
 ['origin-filter','Filtro de origem','#filterOrigem'],
 ['region-filter','Filtro de região','#search-regiao'],
 ['lead-modal','Modal de lead','#overlay'],
 ['lead-name','Campo nome','#f-nome'],
 ['lead-phone','Campo telefone','#f-tel'],
 ['lead-status','Campo status','#f-status'],
 ['save-button','Botão salvar lead','#save-btn']
].forEach(x=>domTest('leads',x[0],x[1],x[2]));
registerTest('leads',{id:'lead-table-header',label:'Tabela de leads mantém colunas críticas',run:({assert})=>{const txt=(document.getElementById('leads-thead')||{}).innerText||'';['Nome','Responsável','Contato','Status','Valor','Origem','Perfil','Região','Ações'].forEach(k=>assert(txt.includes(k),'coluna ausente: '+k));return {details:'colunas críticas presentes'}}});

/* Follow-up */
domTest('followup','page','Página Follow-up','#page-followup');
domTest('followup','tbody','Tabela Follow-up','#fu-tbody');
domTest('followup','search','Busca Follow-up','#fu-busca');
domTest('followup','owner-filter','Filtro responsável','#fu-resp');
domTest('followup','priority-filter','Filtro prioridade','#fu-prio');
registerTest('followup',{id:'api-object',label:'CRM_FOLLOWUP disponível',severity:'major',run:()=>({status:window.CRM_FOLLOWUP?'passed':'failed',details:window.CRM_FOLLOWUP?'API carregada':'API não carregada'})});
registerTest('followup',{id:'view-readable',label:'View v_followup legível no Supabase',source:'crm.v_followup',run:async({supaRead})=>{const rows=await supaRead('v_followup','lead_id');return {details:'leitura ok · '+rows.length+' amostra(s)'}}});

/* Supabase */
registerTest('supabase',{id:'config',label:'Configuração Supabase presente',source:'CRM_SUPABASE.config',run:({assert})=>{const c=window.CRM_SUPABASE&&window.CRM_SUPABASE.config;assert(c&&c.url&&c.projectRef&&c.schema,'configuração Supabase incompleta');return {details:c.projectRef+' · schema '+c.schema}}});
registerTest('supabase',{id:'auth-client',label:'Cliente autenticado disponível',run:({assert})=>assert(!!window.TM_SUPABASE_AUTH_CLIENT,'TM_SUPABASE_AUTH_CLIENT ausente')});
registerTest('supabase',{id:'session',label:'Sessão Supabase válida',run:async({assert})=>{const c=window.TM_SUPABASE_AUTH_CLIENT;assert(c&&c.auth,'cliente auth ausente');const out=await c.auth.getSession();if(out.error)throw out.error;assert(out.data&&out.data.session&&out.data.session.user,'sessão ausente');return {details:'user '+out.data.session.user.id}}});
registerTest('supabase',{id:'leads-read',label:'Tabela leads legível',source:'crm.leads',run:async({supaRead})=>({details:'leitura ok · '+(await supaRead('leads','id')).length+' amostra(s)'})});
registerTest('supabase',{id:'interactions-read',label:'Tabela interactions legível',source:'crm.interactions',run:async({supaRead})=>({details:'leitura ok · '+(await supaRead('interactions','id')).length+' amostra(s)'})});
registerTest('supabase',{id:'regression-runs-read',label:'Canal de relatórios legível',source:'crm.regression_runs',run:async({supaRead})=>({details:'leitura ok · '+(await supaRead('regression_runs','id')).length+' amostra(s)'})});

/* WhatsApp */
registerTest('whatsapp',{id:'production-loader',label:'Loader WhatsApp pronto',run:({assert})=>assert(window.__TM_WHATSAPP_PRODUCTION_READY__===true,'loader WhatsApp ainda não pronto: '+String(window.__TM_WHATSAPP_PRODUCTION_ERROR__||''))});
registerTest('whatsapp',{id:'runtime',label:'Runtime WhatsApp disponível',run:({assert})=>assert(!!window.TM_WA_RUNTIME,'TM_WA_RUNTIME ausente')});
registerTest('whatsapp',{id:'gateway-url',label:'Gateway configurado em HTTPS',run:({assert})=>{const u=window.TM_WA_RUNTIME&&window.TM_WA_RUNTIME.gateway&&window.TM_WA_RUNTIME.gateway();assert(/^https:\/\//.test(String(u||'')),'gateway não HTTPS: '+u);return {details:u}}});
registerTest('whatsapp',{id:'auth-token',label:'Token disponível para gateway',run:({assert})=>assert(!!(window.TM_WA_RUNTIME&&window.TM_WA_RUNTIME.token&&window.TM_WA_RUNTIME.token()),'token Taurus ausente')});
registerTest('whatsapp',{id:'sessions-endpoint',label:'Endpoint de sessões responde',source:'/api/whatsapp/sessions',run:async({wa})=>{const d=await wa('/api/whatsapp/sessions');return {details:(d.sessions||[]).length+' sessão(ões)'}}});
registerTest('whatsapp',{id:'candidates-endpoint',label:'Endpoint de captura/follow-up responde',source:'/api/whatsapp/followup/candidates',run:async({wa,assert})=>{const d=await wa('/api/whatsapp/followup/candidates?limit=5');assert(d&&d.mode==='hosted','gateway fora do modo hosted',d);return {details:'eventos '+Number(d.count||0)+' · persistência '+String(d.mediaPersistence||'n/a')}}});
['tm-wa-runtime','tm-wa-followup','tm-wa-matching','tm-wa-history-range','tm-wa-archive','tm-wa-bridge-hosted','tm-wa-followup-hosted','tm-wa-connections'].forEach(id=>registerTest('whatsapp',{id:'script-'+id,label:'Módulo '+id+' carregado',source:'#'+id,run:({assert,script})=>assert(script(id),'script ausente: '+id)}));

/* Media */
['tm-wa-hosted-media-compat','tm-wa-storage','tm-wa-media','tm-wa-archive-hotfix'].forEach(id=>registerTest('media',{id:'script-'+id,label:'Módulo '+id+' carregado',source:'#'+id,run:({assert,script})=>assert(script(id),'script ausente: '+id)}));
registerTest('media',{id:'assets-read',label:'Tabela de mídia legível',source:'crm.whatsapp_media_assets',run:async({supaRead})=>({details:'leitura ok · '+(await supaRead('whatsapp_media_assets','id')).length+' amostra(s)'})});
registerTest('media',{id:'candidate-persistence',label:'Gateway declara persistência de mídia',source:'/api/whatsapp/followup/candidates',run:async({wa,assert})=>{const d=await wa('/api/whatsapp/followup/candidates?limit=1');assert(d.mediaPersistence,'mediaPersistence ausente');assert(d.directPersistence===true,'persistência direta do gateway não está ativa',d);return {details:d.mediaPersistence}}});

/* Safety */
registerTest('safety',{id:'no-runtime-errors',label:'Nenhum erro JS capturado durante a sessão do painel',severity:'major',run:({assert,runtimeErrors})=>{assert(runtimeErrors.length===0,'erros JS capturados',runtimeErrors);return {details:'0 erros runtime'}}});
registerTest('safety',{id:'no-test-prod-reset',label:'Painel não expõe reset global de produção',run:({assert})=>{const s=String(window.TAURUS_REGRESSION.resetTestState);assert(!/whatsapp.*remove|auth.*reset|leads\s*=\s*\[\]/i.test(s),'reset de teste contém ação destrutiva');return {details:'reset limitado a fixtures tm_regression_fixture_*'}}});
registerTest('safety',{id:'report-table',label:'Relatórios persistem fora dos dados comerciais',source:'crm.regression_runs',run:async({supaRead})=>{await supaRead('regression_runs','id');return {details:'canal isolado disponível'}}});

document.dispatchEvent(new CustomEvent('taurus:regression-ready'));
})();
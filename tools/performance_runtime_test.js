'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

async function testRealtimeCoordinator(){
  const listeners = new Map();
  const pages = {
    'page-leads': {classList:{contains:()=>false}},
    'page-kanban': {classList:{contains:()=>false}},
    'page-dashboard': {classList:{contains:()=>false}},
    'page-quentes': {classList:{contains:()=>false}},
    'page-retomar': {classList:{contains:()=>false}},
    'page-followup': {classList:{contains:()=>false}},
  };
  global.window = global;
  global.location = {href:'https://example.test/crm.html'};
  global.document = {
    readyState:'loading', visibilityState:'visible',
    getElementById:(id)=>pages[id]||null,
    querySelector:()=>null,
    addEventListener:(name,fn)=>listeners.set('document:'+name,fn),
    head:{appendChild:()=>{}},
  };
  global.localStorage = {
    data:new Map(),
    getItem(k){return this.data.has(k)?this.data.get(k):null;},
    setItem(k,v){this.data.set(k,String(v));},
    removeItem(k){this.data.delete(k);},
  };
  global.addEventListener = (name,fn)=>listeners.set('window:'+name,fn);
  global.renderAll = ()=>{ throw new Error('hidden Carteira render must not call legacy renderAll'); };
  global.renderKanban = ()=>{};
  global.renderDashboard = ()=>{};
  global.renderQuentes = ()=>{};
  global.renderRetomar = ()=>{};

  const calls=[];
  const nativeFetch=async (input,init={})=>{
    const url=typeof input==='string'?input:input.url;
    calls.push({url,method:String(init.method||'GET').toUpperCase(),body:init.body||''});
    if(url.includes('/rest/v1/leads?')){
      return new Response(JSON.stringify([{id:'lead-1',perfil_produto:'Lançamento',data_fechamento:'2026-09-20',created_at:'2026-09-01T10:00:00Z'}]),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.endsWith('/rest/v1/rpc/followup_commitment_state')){
      return new Response(JSON.stringify([{lead_id:'lead-1',status:'scheduled'}]),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.includes('/rest/v1/regions?')){
      return new Response(JSON.stringify([{id:'r1',name:'Brooklin'}]),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
  };
  global.fetch=nativeFetch;

  vm.runInThisContext(fs.readFileSync('supabase-realtime.js','utf8'),{filename:'supabase-realtime.js'});

  const baseline=JSON.parse(localStorage.getItem('crm_baseline'));
  assert.equal(baseline.sincronizado,true,'Marco Zero sentinel must be synchronized');

  const core='https://example.test/rest/v1/leads?select=id,local_id,nome,notas,proximo_contato&deleted_at=is.null';
  const coreResp=await fetch(core,{headers:{Authorization:'Bearer test','Range':'0-999'}});
  await coreResp.json();
  assert.equal(calls.length,1,'core leads should use one network request');
  const coreUrl=new URL(calls[0].url);
  const select=coreUrl.searchParams.get('select');
  for(const f of ['perfil_produto','data_fechamento','created_at']) assert(select.includes(f),`core select missing ${f}`);

  const metaBefore=calls.length;
  const stage=await fetch('https://example.test/rest/v1/leads?select=id,perfil_produto&id=in.(lead-1)',{headers:{Authorization:'Bearer test'}}).then(r=>r.json());
  assert.equal(calls.length,metaBefore,'stage metadata should be served from shared metadata cache');
  assert.equal(stage[0].perfil_produto,'Lançamento');

  const sales=await fetch('https://example.test/rest/v1/leads?select=id,data_fechamento&deleted_at=is.null&order=id.asc',{headers:{Authorization:'Bearer test','Range':'0-999'}}).then(r=>r.json());
  assert.equal(calls.length,metaBefore,'sale dates should be served from shared metadata cache');
  assert.equal(sales[0].data_fechamento,'2026-09-20');

  const created=await fetch('https://example.test/rest/v1/leads?select=id,created_at&deleted_at=is.null&order=id.asc',{headers:{Authorization:'Bearer test','Range':'0-999'}}).then(r=>r.json());
  assert.equal(calls.length,metaBefore,'created_at should be served from shared metadata cache');
  assert.equal(created[0].created_at,'2026-09-01T10:00:00Z');

  const commitUrl='https://example.test/rest/v1/rpc/followup_commitment_state';
  const c0=calls.length;
  await fetch(commitUrl,{method:'POST',headers:{Authorization:'Bearer test'},body:'{}'}).then(r=>r.json());
  await fetch(commitUrl,{method:'POST',headers:{Authorization:'Bearer test'},body:'{}'}).then(r=>r.json());
  assert.equal(calls.length,c0+1,'commitment state should share the cached network response');

  const regionUrl='https://example.test/rest/v1/regions?select=id,name&is_active=eq.true&order=name.asc';
  const r0=calls.length;
  await fetch(regionUrl,{headers:{Authorization:'Bearer test'}}).then(r=>r.json());
  await fetch(regionUrl,{headers:{Authorization:'Bearer test'}}).then(r=>r.json());
  assert.equal(calls.length,r0+1,'regions should be cached between equivalent reads');

  assert(global.CRM_PERF && typeof global.CRM_PERF.stats==='function','performance stats API missing');
}

async function testFollowupHub(){
  let rendered=0,events=0;
  const listeners={};
  global.window=global;
  global.document={
    readyState:'complete',
    addEventListener:(name,fn)=>{listeners[name]=fn;},
    dispatchEvent:(ev)=>{if(ev.type==='tm:followup-rendered')events++;return true;},
  };
  global.requestAnimationFrame=(fn)=>{setImmediate(fn);return 1;};
  global.cancelAnimationFrame=()=>{};
  global.CustomEvent=class CustomEvent{constructor(type,opts={}){this.type=type;this.detail=opts.detail;}};
  global.fuRenderFila=()=>{rendered++;return 'ok';};
  delete global.__TM_FOLLOWUP_RENDER_HUB__;
  vm.runInThisContext(fs.readFileSync('followup-render-hub.js','utf8'),{filename:'followup-render-hub.js'});
  assert.equal(fuRenderFila(),'ok');
  await new Promise(r=>setImmediate(r));
  assert.equal(rendered,1,'hub must preserve original render');
  assert(events>=1,'hub must emit coordinated post-render event');
}

(async()=>{
  await testRealtimeCoordinator();
  await testFollowupHub();
  console.log('PERFORMANCE_RUNTIME_TEST OK');
})().catch(err=>{console.error(err);process.exit(1);});

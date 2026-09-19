/* Taurus Magnum CRM — Supabase-first canonical layer
 * Carregado por ultimo. Mantem o codigo legado intacto como rollback,
 * mas assume a fonte canonica dos leads: Supabase.
 */
(function(){
'use strict';

var _snap = new Map();
var _saveChain = Promise.resolve();
var _refreshTimer = null;

function cfg(){ return (window.CRM_SUPABASE && window.CRM_SUPABASE.config) || null; }
function token(){
  var c=cfg(); if(!c) return null;
  try{
    var b=localStorage.getItem('sb-'+c.projectRef+'-auth-token');
    if(!b) return null;
    var s=JSON.parse(b);
    return s && (s.access_token || (s.currentSession && s.currentSession.access_token));
  }catch(e){ return null; }
}
function headers(){
  var c=cfg(), t=token();
  if(!c || !t) return null;
  return {
    'apikey':c.publishableKey,
    'Authorization':'Bearer '+t,
    'Content-Type':'application/json',
    'Accept-Profile':c.schema||'crm',
    'Content-Profile':c.schema||'crm'
  };
}
function rpc(nome, body){
  var c=cfg(), h=headers();
  if(!c || !h) return Promise.reject(new Error('Sessao Supabase ausente. Faca login novamente.'));
  var ctl=(typeof AbortController!=='undefined')?new AbortController():null;
  var tm=setTimeout(function(){ if(ctl) ctl.abort(); },15000);
  return fetch(c.url+'/rest/v1/rpc/'+nome,{
    method:'POST', headers:h, body:JSON.stringify(body||{}), signal:ctl?ctl.signal:undefined
  }).then(function(r){
    clearTimeout(tm);
    return r.text().then(function(txt){
      if(!r.ok){
        var msg='http '+r.status;
        try{ var j=JSON.parse(txt); msg=j.message||j.hint||msg; }catch(e){}
        throw new Error(msg);
      }
      if(!txt) return null;
      try{ return JSON.parse(txt); }catch(e){ return txt; }
    });
  }).catch(function(e){ clearTimeout(tm); throw e; });
}

function val(v){ return v===undefined||v===null?'':String(v); }
function num(v){
  if(v===undefined||v===null||v==='') return '';
  if(typeof valorNum==='function'){
    var n=valorNum(v); return n===0 && String(v).trim()==='' ? '' : String(n);
  }
  var n2=Number(v); return isFinite(n2)?String(n2):'';
}
function canon(l){
  return {
    nome:val(l.nome).trim(), telefone:val(l.telefone).trim(), email:val(l.email).trim().toLowerCase(),
    empresa:val(l.empresa).trim(), status:val(l.status||'Novo'), valor:num(l.valor),
    perfil:val(l.perfil), regiao:val(l.regiao).trim(), origem:val(l.origem).trim(),
    data_entrada:val(l.data||l.data_entrada), ult_meu:val(l.ult_meu), ult_dele:val(l.ult_dele),
    notas:val(l.notas), proximo_contato:val(l.proximo_contato)
  };
}
function snapshot(rows){
  _snap=new Map();
  (rows||[]).forEach(function(l){ if(l._uuid) _snap.set(String(l._uuid),canon(l)); });
}
function same(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function diff(a,b){
  var p={};
  Object.keys(b).forEach(function(k){ if(String(a&&a[k]!==undefined?a[k]:'')!==String(b[k]!==undefined?b[k]:'')) p[k]=b[k]; });
  return p;
}

function carregarCanonico(){
  var c=cfg(), h=headers();
  if(!c || !h) return Promise.resolve([]);
  var cols='id,legacy_id,local_id,nome,empresa,email,telefone,status,valor,data_entrada,origem,perfil,regiao,ult_meu,ult_dele,notas,proximo_contato';
  var pageSize=1000;
  function buscarPagina(offset, acumulado){
    var url=c.url+'/rest/v1/leads?select='+encodeURIComponent(cols)
      +'&deleted_at=is.null&order=created_at.desc,id.desc&limit='+pageSize+'&offset='+offset;
    return fetch(url,{
      headers:{'apikey':c.publishableKey,'Authorization':h.Authorization,'Accept-Profile':c.schema||'crm'}
    }).then(function(r){
      if(!r.ok) throw new Error('Falha ao carregar leads do Supabase: http '+r.status);
      return r.json();
    }).then(function(rows){
      rows=Array.isArray(rows)?rows:[];
      Array.prototype.push.apply(acumulado,rows);
      return rows.length===pageSize ? buscarPagina(offset+pageSize,acumulado) : acumulado;
    });
  }
  return buscarPagina(0,[]).then(function(rows){
    var out=(rows||[]).map(function(l){
      return {
        id:String(l.local_id||l.id), _uuid:l.id, _supabase:true,
        nome:l.nome||'', empresa:l.empresa||'', email:l.email||'', telefone:l.telefone||'',
        status:l.status||'Novo', valor:(l.valor===null||l.valor===undefined)?'':l.valor,
        data:l.data_entrada||'', origem:l.origem||'', perfil:l.perfil||'', regiao:l.regiao||'',
        ult_meu:l.ult_meu||'', ult_dele:l.ult_dele||'', notas:l.notas||'',
        proximo_contato:l.proximo_contato||''
      };
    });
    snapshot(out);
    return out;
  });
}

function aplicarRows(rows){
  window.leads=rows;
  try{ leads=rows; }catch(e){}
  try{ calls=[]; }catch(e){}
  try{ if(typeof renderAll==='function') renderAll(); }catch(e){}
}
function carregarNaTela(){
  return carregarCanonico().then(function(rows){ aplicarRows(rows); return rows; })
    .catch(function(e){
      try{ console.error('[CRM CANONICO]',e); }catch(_){}
      try{ if(typeof showToast==='function') showToast('Falha ao carregar Supabase: '+e.message); }catch(_){}
      throw e;
    });
}

function papelValido(){
  var p=(typeof papelAtual==='function')?papelAtual():null;
  return p==='admin'||p==='gerente'||p==='executivo';
}

/* Fonte local nunca mais e canonica para leads. Preferencias continuam locais. */
window.fonteLocalPermitida=function(){ return false; };
window.carregarLeadsSupabase=carregarCanonico;
window.load=function(){
  if(typeof papelAtual==='function' && papelAtual()==='bloqueado'){
    try{ leads=[]; calls=[]; renderAll(); }catch(e){}
    return;
  }
  if(!papelValido()){
    if(typeof resolverPapel==='function') resolverPapel().then(function(){ if(papelValido()) carregarNaTela(); });
    return;
  }
  if(window.CRM_CTX && window.CRM_CTX.haConflito && window.CRM_CTX.haConflito()){
    try{ leads=[]; calls=[]; renderAll(); window.CRM_CTX.abrirConflito(); }catch(e){}
    return;
  }
  carregarNaTela();
};
window.refreshCRM=function(){
  try{ if(typeof showToast==='function') showToast('Atualizando pelo Supabase...'); }catch(e){}
  return carregarNaTela().then(function(rows){
    try{ if(typeof showToast==='function') showToast('Atualizado: '+rows.length+' leads.'); }catch(e){}
    return rows;
  });
};

function criar(l){
  var status=l.status||'Novo';
  if(status==='Crítico') return Promise.reject(new Error('Crítico não é status comercial. Escolha uma etapa válida.'));
  var d=l.data||l.data_entrada||null;
  return rpc('create_lead_v2',{
    p_local_id:String(l.id||Date.now()), p_origem_criacao:'crm', p_nome:val(l.nome).trim(),
    p_telefone:val(l.telefone)||null, p_email:val(l.email)||null, p_empresa:val(l.empresa)||null,
    p_status:status, p_valor:(l.valor===null||l.valor===undefined||l.valor==='')?null:Number(typeof valorNum==='function'?valorNum(l.valor):l.valor),
    p_perfil:(l.perfil==='Moradia'||l.perfil==='Investimento')?l.perfil:null,
    p_regiao:val(l.regiao)||null, p_origem:val(l.origem)||null, p_data_entrada:d||null
  }).then(function(r){
    var x=Array.isArray(r)?r[0]:r;
    if(!x || ['criado','existente'].indexOf(x.resultado)<0) throw new Error('Criação não confirmada: '+(x&&x.resultado||'resposta inválida'));
    return x;
  });
}
function atualizar(l, patch){
  return rpc('update_lead_by_id',{p_lead_id:l._uuid,p_patch:patch}).then(function(r){
    var x=Array.isArray(r)?r[0]:r;
    if(!x || x.resultado!=='atualizado') throw new Error('Atualização não confirmada');
    return x;
  });
}
function arquivar(uuid){
  return rpc('archive_lead',{p_lead_id:uuid,p_motivo:'Arquivado pelo CRM'}).then(function(r){
    var x=Array.isArray(r)?r[0]:r;
    if(!x || ['arquivado','ja_arquivado'].indexOf(x.resultado)<0) throw new Error('Arquivamento não confirmado');
    return x;
  });
}

function persistirMudancas(){
  var atuais=Array.isArray(window.leads)?window.leads:(typeof leads!=='undefined'?leads:[]);
  var presentes=new Set();
  var ops=[];

  atuais.forEach(function(l){
    if(l._uuid){
      var id=String(l._uuid); presentes.add(id);
      var antes=_snap.get(id), agora=canon(l);
      if(antes && !same(antes,agora)){
        var p=diff(antes,agora);
        if(Object.keys(p).length) ops.push(atualizar(l,p));
      }
    }else{
      ops.push(criar(l));
    }
  });
  _snap.forEach(function(v,id){ if(!presentes.has(id)) ops.push(arquivar(id)); });

  if(!ops.length) return Promise.resolve({alterados:0});
  return Promise.all(ops).then(function(){
    return carregarNaTela().then(function(){ return {alterados:ops.length}; });
  });
}
window.save=function(){
  _saveChain=_saveChain.then(function(){ return persistirMudancas(); }).catch(function(e){
    try{ console.error('[CRM CANONICO] falha ao salvar',e); }catch(_){}
    try{ if(typeof showToast==='function') showToast('Não foi possível salvar: '+e.message); }catch(_){}
    return carregarNaTela().catch(function(){});
  });
  return _saveChain;
};

/* Operacoes legadas que poderiam substituir/colapsar a base ficam inertes. */
window.removerDuplicatas=function(){ if(typeof showToast==='function') showToast('Deduplicação automática desativada: Supabase preserva duplicatas legítimas.'); };
window.loadFromSheets=function(){ if(typeof showToast==='function') showToast('Sheets é apenas legado. A fonte atual é o Supabase.'); return Promise.resolve(); };
window.syncToSheets=function(){ return Promise.resolve({ok:false,motivo:'Supabase é a fonte canônica'}); };
window.agendarSyncExtensao=function(){};

function esconderLegado(){
  try{
    document.querySelectorAll('button').forEach(function(b){
      var t=(b.textContent||'').trim().toLowerCase();
      if(t.indexOf('remover duplic')>=0 || t.indexOf('carregar do sheets')>=0 || t.indexOf('salvar no sheets')>=0 || t.indexOf('importar')>=0){
        b.style.display='none'; b.disabled=true; b.title='Desativado no modo Supabase-first';
      }
    });
    var s=document.getElementById('sync-status'); if(s){ s.innerHTML='<span style="color:#86efac">● Supabase canônico</span>'; s.onclick=null; }
  }catch(e){}
}

window.addEventListener('message',function(ev){
  if(ev.source!==window || !ev.data || ev.data.type!=='CRM_UPDATED') return;
  clearTimeout(_refreshTimer);
  _refreshTimer=setTimeout(function(){ if(papelValido()) carregarNaTela(); },500);
});

function bootstrap(){
  esconderLegado();
  if(typeof resolverPapel==='function'){
    resolverPapel().then(function(){ if(papelValido()) carregarNaTela(); });
  }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap);
else setTimeout(bootstrap,0);

window.CRM_CANONICAL={reload:carregarNaTela,snapshot:function(){return _snap.size;},rpc:rpc};
try{ console.info('[CRM] Supabase-first canonical layer ativa'); }catch(e){}
})();

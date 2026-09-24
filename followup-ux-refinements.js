/* Taurus Magnum CRM — refinamentos leves da aba Follow-up (TEST BRANCH ONLY) */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_UX_REFINEMENTS__)return;
window.__TM_FOLLOWUP_UX_REFINEMENTS__=true;
var originalRender=null,wrapped=false,searchBound=false,refreshUiWrapped=false,refineTimer=null,pageObserver=null,commitTimer=null,searchFrame=null;
var commitments=new Map(),searchIndex=new Map();
function rpc(name,args){var a=window.CRM_CANONICAL;if(!a||typeof a.rpc!=='function')return Promise.reject(new Error('CRM_CANONICAL indisponível'));return a.rpc(name,args||{});}
function linhas(){try{var a=window.CRM_FOLLOWUP;return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];}catch(e){return[];}}
function mapa(){var m=new Map();linhas().forEach(function(x){m.set(String(x.lead_id),x);});return m;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function dataBR(v){if(!v)return'—';var p=String(v).slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]:'—';}
function dtBR(v){if(!v)return'—';var d=new Date(v);if(isNaN(d))return'—';return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function toast(t){try{if(typeof window.showToast==='function')window.showToast(t);}catch(e){}}
function instalarCadencia(){
  window._fuCadencia=function(v){
    var a=Array.isArray(v)?v:[];
    if(!a.length)return '<span style="color:#ef4444;font-weight:800">—</span>';
    return '<div style="display:flex;align-items:flex-end;gap:4px;height:18px;min-width:74px">'+a.map(function(x,i){
      var ok=!!(x&&x.falou),h=7+(i*1.5);
      if(ok)return '<span title="'+esc(dataBR(x&&x.data))+' · contato feito" style="display:inline-block;width:7px;height:'+h+'px;border-radius:3px 3px 1px 1px;background:#22c55e;border:.5px solid rgba(134,239,172,.55)"></span>';
      return '<span title="'+esc(dataBR(x&&x.data))+' · sem contato" style="display:inline-flex;align-items:center;justify-content:center;width:9px;height:14px;color:#ef4444;font-size:12px;font-weight:900;line-height:1">−</span>';
    }).join('')+'</div>';
  };
}
function filaAtiva(){var p=document.getElementById('page-followup');return !!(p&&p.classList.contains('active'));}
function syncAtualizar(){
  var b=document.getElementById('refresh-btn'),active=filaAtiva();
  if(b){b.hidden=active;if(active)b.style.setProperty('display','none','important');else{b.hidden=false;b.style.removeProperty('display');}}
  var q=document.getElementById('fu-busca');if(q)q.placeholder='Buscar nome, empresa, executivo, email ou telefone...';
}
function atualizarCommitments(){
  clearTimeout(commitTimer);
  rpc('followup_commitment_state',{}).then(function(rows){commitments=new Map();(Array.isArray(rows)?rows:[]).forEach(function(c){commitments.set(String(c.lead_id),c);});queueRefine();}).catch(function(){}).finally(function(){commitTimer=setTimeout(atualizarCommitments,12000);});
}
function refinarLinhas(){
  var tb=document.getElementById('fu-tbody');if(!tb)return;var m=mapa();
  tb.querySelectorAll('tr').forEach(function(tr){
    var btn=tr.querySelector('.tm-agendar-btn[data-lead-id]');if(!btn)return;
    var id=String(btn.dataset.leadId),x=m.get(id),c=commitments.get(id);if(!x)return;
    if(c&&c.status==='scheduled'&&c.is_overdue){btn.textContent='Cancelar';btn.dataset.tmCommitCancel='1';}
    else if(btn.dataset.tmCommitCancel){delete btn.dataset.tmCommitCancel;btn.textContent=x.proximo_contato?'Reagendar':'Agendar';}
    if(/^Solicitar cancelamento$/i.test(String(btn.textContent||'').trim()))btn.textContent='Cancelar';
  });
}
function contarVisiveis(){
  var tb=document.getElementById('fu-tbody');if(!tb)return 0;
  var n=0;tb.querySelectorAll('tr').forEach(function(tr){if(tr.style.display==='none')return;if(tr.querySelector('.tm-agendar-btn[data-lead-id]'))n++;});return n;
}
function syncContador(){
  var e=document.getElementById('fu-estado');if(!e)return;
  var n=contarVisiveis(),t=String(e.textContent||''),suf='';
  var m=t.match(/\s·\s(atualizado\s.+)$/i);if(m)suf=' · '+m[1];
  e.textContent=n+' lead(s) na fila'+suf;
}
function rebuildSearchIndex(){
  var next=new Map();
  linhas().forEach(function(x){
    next.set(String(x.lead_id),[x.nome,x.empresa,x.responsavel,x.email,x.telefone].map(function(f){return String(f||'').toLowerCase();}).join('\u001f'));
  });
  searchIndex=next;
}
function aplicarBuscaCarteira(q){
  var termo=String(q||'').trim().toLowerCase(),tb=document.getElementById('fu-tbody');if(!tb)return;
  var n=0;
  tb.querySelectorAll('tr').forEach(function(tr){
    var btn=tr.querySelector('.tm-agendar-btn[data-lead-id]');if(!btn)return;
    var hay=searchIndex.get(String(btn.dataset.leadId))||'',ok=!termo||hay.indexOf(termo)>=0;
    var novo=ok?'':'none';if(tr.style.display!==novo)tr.style.display=novo;if(ok)n++;
  });
  var e=document.getElementById('fu-estado');if(e){var t=String(e.textContent||''),m=t.match(/\s·\s(atualizado\s.+)$/i);e.textContent=n+' lead(s) na fila'+(m?' · '+m[1]:'');}
}
function onSearchInput(){
  var input=document.getElementById('fu-busca');if(!input)return;
  if(searchFrame)cancelAnimationFrame(searchFrame);
  searchFrame=requestAnimationFrame(function(){searchFrame=null;aplicarBuscaCarteira(input.value);});
}
function instalarBusca(){
  var input=document.getElementById('fu-busca');
  if(input&&!searchBound){
    input.removeAttribute('oninput');input.oninput=null;input.addEventListener('input',onSearchInput,{passive:true});searchBound=true;
  }
  if(wrapped||typeof window.fuRenderFila!=='function')return !!wrapped;
  originalRender=window.fuRenderFila;wrapped=true;
  window.fuRenderFila=function(){
    var inp=document.getElementById('fu-busca'),raw=String(inp&&inp.value||'');
    if(inp)inp.value='';
    var out=originalRender.apply(this,arguments);
    if(inp)inp.value=raw;
    rebuildSearchIndex();
    aplicarBuscaCarteira(raw);
    queueRefine();
    return out;
  };
  rebuildSearchIndex();
  aplicarBuscaCarteira(input&&input.value||'');
  return true;
}
function instalarRefreshUi(){
  if(refreshUiWrapped||typeof window.TM_FOLLOWUP_REFRESH_UI!=='function')return false;
  var old=window.TM_FOLLOWUP_REFRESH_UI;refreshUiWrapped=true;
  window.TM_FOLLOWUP_REFRESH_UI=function(){var r=old.apply(this,arguments);queueRefine();return r;};
  return true;
}
function motivos(){return '<option value="">Selecione o motivo...</option><option>Cliente Cancelou</option><option>Cliente Sumiu</option><option>Remarcamos</option><option>Realizado S/ Follow Up</option>';}
function abrirCancelar(c){
  if(!c)return;var old=document.getElementById('tm-direct-cancel-modal');if(old)old.remove();
  var d=document.createElement('div');d.id='tm-direct-cancel-modal';d.className='tm-commit-modal';d.innerHTML='<div class="tm-commit-card" style="max-width:500px"><button class="tm-commit-close" data-close>×</button><h3>Cancelar</h3><p style="color:#94a3b8;font-size:12px;margin-bottom:10px">Compromisso de '+dtBR(c.scheduled_at)+'</p><select id="tm-direct-cancel-reason" style="width:100%">'+motivos()+'</select><div class="tm-commit-actions"><button class="tm-red-btn" data-confirm>Confirmar cancelamento</button></div></div>';document.body.appendChild(d);
  d.querySelector('[data-close]').onclick=function(){d.remove();};
  d.querySelector('[data-confirm]').onclick=function(){var r=d.querySelector('#tm-direct-cancel-reason').value;if(!r){toast('Selecione o motivo.');return;}var b=d.querySelector('[data-confirm]');b.disabled=true;rpc('request_followup_commitment_cancel',{p_commitment_id:c.commitment_id,p_reason:r}).then(function(){d.remove();toast('Agendamento cancelado. O Admin será notificado.');return window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function'?window.CRM_FOLLOWUP.carregar():null;}).then(function(){return atualizarCommitments();}).catch(function(e){b.disabled=false;toast(String(e&&e.message||e));});};
}
function queueRefine(){clearTimeout(refineTimer);refineTimer=setTimeout(function(){refinarLinhas();syncAtualizar();syncContador();},80);}
function css(){if(document.getElementById('tm-followup-refine-style'))return;var s=document.createElement('style');s.id='tm-followup-refine-style';s.textContent='body:has(#page-followup.active) #refresh-btn{display:none!important}.tm-agendar-btn[data-tm-commit-cancel="1"]{min-width:72px!important;width:72px!important;padding:0 8px!important}.tm-action-cell{gap:6px!important}';document.head.appendChild(s);}
function boot(){
  css();instalarCadencia();syncAtualizar();instalarBusca();instalarRefreshUi();atualizarCommitments();queueRefine();
  var p=document.getElementById('page-followup');if(p){pageObserver=new MutationObserver(function(){syncAtualizar();if(filaAtiva())queueRefine();});pageObserver.observe(p,{attributes:true,attributeFilter:['class']});}
  var tries=0,t=setInterval(function(){tries++;instalarBusca();instalarRefreshUi();syncAtualizar();if((wrapped&&searchBound&&refreshUiWrapped)||tries>80)clearInterval(t);},100);
  window.addEventListener('focus',function(){syncAtualizar();atualizarCommitments();queueRefine();});
  window.addEventListener('click',function(e){var btn=e.target&&e.target.closest&&e.target.closest('.tm-agendar-btn[data-tm-commit-cancel="1"]');if(!btn)return;var c=commitments.get(String(btn.dataset.leadId));if(!c)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();abrirCancelar(c);},true);
  window.addEventListener('message',function(ev){if(ev.source===window&&ev.data&&ev.data.type==='CRM_UPDATED'){setTimeout(function(){rebuildSearchIndex();atualizarCommitments();queueRefine();},250);}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

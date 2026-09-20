/* Taurus Magnum CRM — Follow-up UI congelada (checkpoint 20/09/2026) */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_FROZEN__) return;
window.__TM_FOLLOWUP_FROZEN__=true;

var obs=null, busy=false;
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function linhas(){try{var a=window.CRM_FOLLOWUP;return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];}catch(e){return[];}}
function itemPorId(id){var a=linhas();for(var i=0;i<a.length;i++)if(String(a[i].lead_id)===String(id))return a[i];return null;}
function hoje(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0);}
function diasAte(iso){if(!iso)return null;var d=new Date(String(iso).slice(0,10)+'T12:00:00');return isNaN(d.getTime())?null:Math.round((d-hoje())/86400000);}
function dataBR(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]:'—';}
function concluida(x){return !!(x&&(x.tarefa_concluida||x.prioridade==='concluido'));}
function chip(x){
  if(concluida(x)) return '<span class="tm-fu-chip done">Concluído</span>';
  var p=x&&x.prioridade||'';
  if(p==='hoje') return '<span class="tm-fu-chip today">Vence hoje</span>';
  if(p==='agendado') return '<span class="tm-fu-chip scheduled">Agendado</span>';
  if(p==='vencido') return '<span class="tm-fu-chip late">Vencido</span>';
  if(p==='sem_contato') return '<span class="tm-fu-chip none">Sem contato</span>';
  if(p==='em_dia') return '<span class="tm-fu-chip ok">Em dia</span>';
  return '<span class="tm-fu-chip stopped">Parado</span>';
}
function proximo(x,dias){
  if(!x||!x.proximo_contato)return '—';
  var sub='';
  if(concluida(x)) sub='<div class="tm-fu-next done">Concluído ✓</div>';
  else if(dias===0) sub='<div class="tm-fu-next today">Hoje</div>';
  else if(dias>0) sub='<div class="tm-fu-next future">Faltam '+dias+'d</div>';
  else if(dias<0) sub='<div class="tm-fu-next late">Vencido há '+Math.abs(dias)+'d</div>';
  return '<span>'+dataBR(x.proximo_contato)+'</span>'+sub;
}
function acao(id,x,dias){
  var scheduled=!!(x&&x.proximo_contato), done=concluida(x);
  var value=scheduled?String(x.proximo_contato).slice(0,10):'';
  var h='<input type="date" id="fu-d-'+esc(id)+'" value="'+esc(value)+'" class="tm-fu-hidden-date" tabindex="-1" aria-hidden="true">';
  h+='<button type="button" class="btn tm-agendar-btn" data-lead-id="'+esc(id)+'">'+(scheduled?'Reagendar':'Agendar')+'</button>';
  if(scheduled&&!done){var txt=dias===0?'Hoje':(dias>0?dias+'d':'Venc.');var st=dias<0?'late':(dias===0?'today':'future');h+='<span class="tm-countdown-badge '+st+'">'+txt+'</span>';}
  if(scheduled){var state=done?'done':(dias<0?'late':'pending');var txt2=done?'✓':(dias<0?'!':'○');var title=done?'Tarefa concluída automaticamente por atividade registrada':(dias<0?'Tarefa vencida sem atividade registrada':'Aguardando atividade na data agendada');h+='<span class="tm-task-state '+state+'" title="'+title+'">'+txt2+'</span>';}
  return h;
}
function css(){if(document.getElementById('tm-followup-frozen-style'))return;var s=document.createElement('style');s.id='tm-followup-frozen-style';s.textContent='.tm-fu-hidden-date{display:none!important}.tm-action-cell{overflow:visible!important;white-space:nowrap!important;display:flex!important;align-items:center!important;gap:8px!important}.tm-agendar-btn{height:30px!important;min-width:92px!important;padding:0 12px!important;font-size:11px!important}.tm-countdown-badge{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:30px;padding:0 8px;border-radius:6px;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.46);color:#fca5a5;font-size:10px;font-weight:800;line-height:1;flex:none}.tm-countdown-badge.today{background:rgba(239,68,68,.22);border-color:rgba(248,113,113,.58);color:#fecaca}.tm-countdown-badge.late{background:rgba(127,29,29,.34);border-color:rgba(248,113,113,.58)}.tm-task-state{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;border:1px solid rgba(148,163,184,.28);background:#111b2d;color:#94a3b8;flex:none}.tm-task-state.done{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.45);color:#86efac}.tm-task-state.late{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.48);color:#fca5a5}.tm-fu-chip{display:inline-flex;align-items:center;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap}.tm-fu-chip.today{background:rgba(252,211,77,.15);color:#fcd34d}.tm-fu-chip.scheduled{background:rgba(59,130,246,.15);color:#93c5fd}.tm-fu-chip.late{background:rgba(248,113,113,.15);color:#fca5a5}.tm-fu-chip.stopped{background:rgba(253,186,116,.15);color:#fdba74}.tm-fu-chip.none{background:rgba(196,181,253,.15);color:#c4b5fd}.tm-fu-chip.ok,.tm-fu-chip.done{background:rgba(34,197,94,.15);color:#86efac}.tm-fu-next{font-size:10px;margin-top:1px}.tm-fu-next.today{color:#fcd34d}.tm-fu-next.future{color:#93c5fd}.tm-fu-next.late{color:#fca5a5}.tm-fu-next.done{color:#86efac;font-weight:700}';document.head.appendChild(s);}
function apply(){
  if(busy)return;var tb=document.getElementById('fu-tbody');if(!tb)return;
  busy=true;if(obs)obs.disconnect();
  try{
    var inputs=Array.prototype.slice.call(tb.querySelectorAll('input[id^="fu-d-"]'));
    inputs.forEach(function(input){
      var id=input.id.slice(5),x=itemPorId(id),td=input.closest('td');if(!td||!x)return;
      var prio=td.previousElementSibling,prox=prio&&prio.previousElementSibling,d=diasAte(x.proximo_contato);
      if(prox)prox.innerHTML=proximo(x,d);
      if(prio)prio.innerHTML=chip(x);
      td.classList.add('tm-action-cell');td.innerHTML=acao(id,x,d);
    });
  }finally{busy=false;if(obs&&tb.isConnected)obs.observe(tb,{childList:true});}
}
function observe(){css();var tb=document.getElementById('fu-tbody');if(!tb){setTimeout(observe,120);return;}if(obs)obs.disconnect();obs=new MutationObserver(function(){if(!busy)queueMicrotask(apply);});obs.observe(tb,{childList:true});apply();window.TM_FOLLOWUP_REFRESH_UI=apply;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();

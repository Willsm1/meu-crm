/* Taurus Magnum CRM — agendamento + conclusão automática por atividade real */
(function(){
'use strict';

function diasAte(dataIso){
  if(!dataIso)return null;
  var alvo=new Date(dataIso+'T12:00:00');
  if(isNaN(alvo.getTime()))return null;
  var agora=new Date();
  var hoje=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate(),12,0,0);
  return Math.round((alvo-hoje)/86400000);
}
function hojeIso(){
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function linhas(){
  try{var api=window.CRM_FOLLOWUP;return api&&typeof api.linhas==='function'?(api.linhas()||[]):[];}catch(e){return[];}
}
function linhaPorId(id){
  var ls=linhas();
  for(var i=0;i<ls.length;i++)if(String(ls[i].lead_id)===String(id))return ls[i];
  return null;
}
function atualizarPendentesHoje(){
  var hoje=hojeIso(), set=new Set();
  linhas().forEach(function(item){
    if(!item)return;
    var concluida=!!(item.tarefa_concluida||item.prioridade==='concluido');
    if(!concluida&&String(item.proximo_contato||'').slice(0,10)===hoje)set.add(String(item.lead_id));
  });
  window.TM_FOLLOWUP_PENDING_TODAY=set;
  return set;
}
function badgeTexto(dias){if(dias===null)return'';if(dias>0)return dias+'d';if(dias===0)return'Hoje';return'Venc.';}
function setPrioridade(td,item){
  if(!td||!item)return;
  if(item.tarefa_concluida||item.prioridade==='concluido'){
    if(!td.querySelector('.tm-priority-completed'))td.innerHTML='<span class="tm-priority-completed">Concluído</span>';
    return;
  }
  if(item.prioridade==='hoje'){
    var els=td.querySelectorAll('*');
    for(var i=0;i<els.length;i++){
      if(String(els[i].textContent||'').trim()==='Hoje'){els[i].textContent='Vence hoje';return;}
    }
    if(String(td.textContent||'').trim()==='Hoje')td.textContent='Vence hoje';
  }
}
function setProximo(td,item){
  if(!td||!item)return;
  var old=td.querySelector('.tm-completed-note');
  if(item.tarefa_concluida||item.prioridade==='concluido'){
    if(!old){old=document.createElement('div');old.className='tm-completed-note';td.appendChild(old);}
    if(old.textContent!=='Concluído ✓')old.textContent='Concluído ✓';
  }else if(old)old.remove();
}
function removeFeito(td){
  if(!td)return;
  Array.prototype.forEach.call(td.querySelectorAll('button'),function(b){
    if(String(b.textContent||'').trim().toLowerCase()==='feito')b.remove();
  });
}
function setEstado(td,item,dias){
  if(!td)return;
  var old=td.querySelector('.tm-task-state');
  if(!item||!item.proximo_contato){if(old)old.remove();return;}
  var completed=!!(item.tarefa_concluida||item.prioridade==='concluido');
  var state=completed?'done':(dias<0?'late':'pending');
  var text=completed?'✓':(dias<0?'!':'○');
  var title=completed?'Tarefa concluída automaticamente por atividade registrada':(dias<0?'Tarefa vencida sem atividade registrada':'Aguardando atividade na data agendada');
  if(!old){old=document.createElement('span');old.className='tm-task-state';td.appendChild(old);}
  if(old.dataset.state!==state)old.dataset.state=state;
  if(old.textContent!==text)old.textContent=text;
  if(old.title!==title)old.title=title;
}
function aplicar(){
  atualizarPendentesHoje();
  var inputs=document.querySelectorAll('input[id^="fu-d-"]');
  inputs.forEach(function(input){
    var id=input.id.slice(5), item=linhaPorId(id);
    if(item&&item.proximo_contato&&!input.value)input.value=String(item.proximo_contato).slice(0,10);
    var actionTd=input.closest('td');if(!actionTd)return;
    var priorityTd=actionTd.previousElementSibling;
    var proximoTd=priorityTd&&priorityTd.previousElementSibling;
    setPrioridade(priorityTd,item);setProximo(proximoTd,item);removeFeito(actionTd);
    actionTd.classList.add('tm-action-cell');input.classList.add('tm-action-date');
    var old=actionTd.querySelector('.tm-countdown-badge');
    if(!(item&&item.proximo_contato)){if(old)old.remove();setEstado(actionTd,item,null);return;}
    var dias=diasAte(String(item.proximo_contato).slice(0,10));
    var completed=!!(item.tarefa_concluida||item.prioridade==='concluido');
    if(completed){if(old)old.remove();setEstado(actionTd,item,dias);return;}
    var texto=badgeTexto(dias);
    var titulo=dias>0?'Faltam '+dias+' dia(s) para o próximo contato':(dias===0?'Contato agendado para hoje':'Data de contato vencida');
    var state=dias<0?'late':(dias===0?'today':'future');
    if(!old){old=document.createElement('span');old.className='tm-countdown-badge';actionTd.appendChild(old);}
    if(old.textContent!==texto)old.textContent=texto;
    if(old.title!==titulo)old.title=titulo;
    if(old.dataset.state!==state)old.dataset.state=state;
    setEstado(actionTd,item,dias);
  });
}
function css(){
  if(document.getElementById('tm-followup-schedule-style'))return;
  var st=document.createElement('style');st.id='tm-followup-schedule-style';
  st.textContent='.tm-action-cell{position:relative!important;overflow:visible!important;padding-right:90px!important}.tm-action-date{position:relative;z-index:1}.tm-countdown-badge{position:absolute;top:50%;right:48px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:30px;padding:0 7px;border-radius:5px 11px 11px 5px;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.46);color:#fca5a5;font-size:10px;font-weight:800;line-height:1;z-index:3;box-shadow:-3px 0 10px rgba(0,0,0,.18)}.tm-countdown-badge:before{content:"";position:absolute;left:-5px;top:6px;bottom:6px;width:5px;border-radius:4px 0 0 4px;background:inherit;border-left:1px solid currentColor;opacity:.85}.tm-countdown-badge[data-state="future"]{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.42);color:#fca5a5}.tm-countdown-badge[data-state="today"]{background:rgba(239,68,68,.22);border-color:rgba(248,113,113,.58);color:#fecaca}.tm-countdown-badge[data-state="late"]{background:rgba(127,29,29,.34);border-color:rgba(248,113,113,.58);color:#fca5a5}.tm-task-state{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;border:1px solid rgba(148,163,184,.28);background:#111b2d;color:#94a3b8;z-index:4}.tm-task-state[data-state="done"]{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.45);color:#86efac}.tm-task-state[data-state="late"]{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.48);color:#fca5a5}.tm-completed-note{font-size:10px;color:#86efac;margin-top:2px;font-weight:700}.tm-priority-completed{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.30);color:#86efac;font-size:11px;font-weight:700}';
  document.head.appendChild(st);
}
function wrapRender(){
  if(window.__TM_FOLLOWUP_SCHEDULE__)return;
  if(typeof window.fuRenderFila!=='function'||!window.CRM_FOLLOWUP){setTimeout(wrapRender,120);return;}
  window.__TM_FOLLOWUP_SCHEDULE__=true;css();
  var original=window.fuRenderFila;
  window.fuRenderFila=function(){var out=original.apply(this,arguments);setTimeout(aplicar,0);return out;};
  window.TM_FOLLOWUP_REFRESH_UI=function(){try{aplicar();}catch(e){}};
  try{aplicar();}catch(e){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wrapRender);else setTimeout(wrapRender,0);
})();

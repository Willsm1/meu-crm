/* Taurus Magnum CRM — Kanban horizontal scroll + Follow-up responsive layout/eligibility */
(function(){
'use strict';
if(window.__TM_KANBAN_SCROLL_FIX__)return;
window.__TM_KANBAN_SCROLL_FIX__=true;

var FU_BASE_STATUS={'Interações':1,'Em negociação':1,'Proposta enviada':1};
var FU_GOLD_STATUS='Gold ⭐';
var fuGold=false,fuEligibilityObs=null;
try{fuGold=localStorage.getItem('tm_followup_include_gold')==='1';}catch(e){}

function normalizeWheel(el,flag){
  if(!el||el.dataset[flag]==='1')return;
  el.dataset[flag]='1';
  el.addEventListener('wheel',function(ev){
    var dx=Number(ev.deltaX)||0;
    var dy=Number(ev.deltaY)||0;
    var horizontalIntent=Math.abs(dx)>Math.abs(dy);
    var shiftIntent=ev.shiftKey&&Math.abs(dy)>0;
    if(!horizontalIntent&&!shiftIntent)return;
    var amount=horizontalIntent?dx:dy;
    if(!amount)return;
    var before=el.scrollLeft;
    el.scrollLeft+=amount;
    if(el.scrollLeft!==before){
      ev.preventDefault();
      ev.stopPropagation();
    }
  },{passive:false,capture:true});
}

function fuLines(){
  try{
    var a=window.CRM_FOLLOWUP;
    return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];
  }catch(e){return[];}
}
function fuEligible(x){
  if(!x)return false;
  return !!FU_BASE_STATUS[String(x.status||'')] || (fuGold&&String(x.status||'')===FU_GOLD_STATUS);
}
function fuIdFromRow(row){
  var btn=row&&row.querySelector('.tm-agendar-btn');
  if(btn&&btn.dataset&&btn.dataset.leadId)return String(btn.dataset.leadId);
  var old=row&&row.querySelector('input[id^="fu-d-"]');
  return old?String(old.id).slice(5):'';
}
function ensureGoldToggle(goldCount){
  var p=document.getElementById('fu-prio');
  if(!p||!p.parentNode)return;
  var b=document.getElementById('tm-fu-gold-toggle');
  if(!b){
    b=document.createElement('button');
    b.type='button';
    b.id='tm-fu-gold-toggle';
    b.className='btn tm-fu-gold-toggle';
    p.parentNode.insertBefore(b,p.nextSibling);
    b.addEventListener('click',function(){
      fuGold=!fuGold;
      try{localStorage.setItem('tm_followup_include_gold',fuGold?'1':'0');}catch(e){}
      applyFollowupEligibility();
    });
  }
  b.setAttribute('aria-pressed',fuGold?'true':'false');
  b.classList.toggle('on',fuGold);
  b.textContent=fuGold?'Gold incluído ('+goldCount+')':'Incluir Gold ('+goldCount+')';
}
function updateFollowupCount(total){
  var el=document.getElementById('fu-estado');
  if(!el)return;
  var txt=String(el.textContent||'');
  if(txt.indexOf('lead(s) na fila')<0)return;
  var m=txt.match(/·\s*atualizado\s+.+$/i);
  el.textContent=total+' lead(s) na fila'+(m?' · '+m[0].replace(/^·\s*/, ''):'');
}
function applyFollowupEligibility(){
  var tb=document.getElementById('fu-tbody');
  if(!tb)return;
  var lines=fuLines(),byId={},eligibleTotal=0,goldCount=0;
  lines.forEach(function(x){
    byId[String(x.lead_id)]=x;
    if(String(x.status||'')===FU_GOLD_STATUS)goldCount++;
    if(fuEligible(x))eligibleTotal++;
  });
  ensureGoldToggle(goldCount);
  Array.prototype.forEach.call(tb.querySelectorAll('tr'),function(row){
    var id=fuIdFromRow(row),x=id&&byId[id];
    if(!id||!x)return;
    row.style.display=fuEligible(x)?'':'none';
  });
  updateFollowupCount(eligibleTotal);
}
function watchFollowupEligibility(){
  var tb=document.getElementById('fu-tbody');
  if(!tb){setTimeout(watchFollowupEligibility,150);return;}
  if(fuEligibilityObs)fuEligibilityObs.disconnect();
  fuEligibilityObs=new MutationObserver(function(){queueMicrotask(applyFollowupEligibility);});
  fuEligibilityObs.observe(tb,{childList:true});
  applyFollowupEligibility();
}

function installFollowupLayout(){
  if(!document.getElementById('tm-followup-wide-style')){
    var st=document.createElement('style');
    st.id='tm-followup-wide-style';
    st.textContent=[
      '#page-followup{padding-left:8px!important;padding-right:8px!important}',
      '#page-followup>.container{max-width:none!important;width:100%!important;margin:0!important}',
      '#page-followup .tm-followup-scroll{overflow:visible!important;padding-right:0!important}',
      '#page-followup .tm-followup-scroll>table{width:100%!important;min-width:0!important;table-layout:fixed!important}',
      '#page-followup .tm-followup-scroll th:nth-child(1){width:18%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(2){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(3){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(4){width:7%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(5){width:7%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(6){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(7){width:6%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(8){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(9){width:9%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(10){width:13%!important}',
      '#page-followup .tm-followup-scroll td{padding-left:10px!important;padding-right:10px!important}',
      '#page-followup .tm-followup-scroll th{padding-left:10px!important;padding-right:10px!important}',
      '#page-followup .tm-followup-scroll td:nth-child(10){min-width:0!important;padding-right:8px!important}',
      '#page-followup .tm-action-cell{overflow:visible!important;gap:5px!important}',
      '#page-followup .tm-agendar-btn{min-width:76px!important;height:28px!important;padding:0 8px!important;font-size:10px!important}',
      '#page-followup .tm-countdown-badge{min-width:34px!important;height:28px!important;padding:0 6px!important;font-size:9px!important}',
      '#page-followup .tm-task-state{width:27px!important;height:27px!important;font-size:14px!important;border-radius:8px!important}',
      '#page-followup .tm-fu-gold-toggle{height:34px!important;color:#d8b84b!important;border-color:rgba(234,179,8,.35)!important;background:rgba(234,179,8,.08)!important}',
      '#page-followup .tm-fu-gold-toggle.on{color:#fde047!important;border-color:rgba(234,179,8,.65)!important;background:rgba(234,179,8,.17)!important;box-shadow:0 0 0 2px rgba(234,179,8,.06)}',
      '@media(max-width:1200px){#page-followup .tm-followup-scroll td,#page-followup .tm-followup-scroll th{padding-left:8px!important;padding-right:8px!important}#page-followup .tm-followup-scroll th:nth-child(1){width:19%!important}#page-followup .tm-followup-scroll th:nth-child(2){width:9%!important}#page-followup .tm-followup-scroll th:nth-child(3){width:10%!important}#page-followup .tm-followup-scroll th:nth-child(6){width:9%!important}#page-followup .tm-followup-scroll th:nth-child(10){width:14%!important}#page-followup .tm-agendar-btn{min-width:70px!important;padding:0 6px!important}#page-followup .tm-action-cell{gap:4px!important}}',
      '@media(max-width:900px){#page-followup{padding-left:6px!important;padding-right:6px!important}#page-followup .tm-followup-scroll td,#page-followup .tm-followup-scroll th{font-size:11px!important;padding-left:6px!important;padding-right:6px!important}#page-followup .tm-fu-chip{padding-left:7px!important;padding-right:7px!important;font-size:10px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  var tb=document.getElementById('fu-tbody');
  var table=tb&&tb.closest('table');
  var wrap=table&&table.parentElement;
  if(wrap){
    wrap.classList.add('tm-followup-scroll');
    try{wrap.style.overflowX='visible';}catch(e){}
  }
}

function bind(){
  var kanban=document.getElementById('kanban');
  if(kanban)normalizeWheel(kanban,'tmScrollFix');
  installFollowupLayout();
  if(!fuEligibilityObs)watchFollowupEligibility();
  if(!kanban||!document.getElementById('fu-tbody'))setTimeout(bind,150);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

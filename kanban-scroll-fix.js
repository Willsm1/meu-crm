/* Taurus Magnum CRM — Kanban horizontal scroll + Follow-up responsive layout/eligibility/sorting */
(function(){
'use strict';
if(window.__TM_KANBAN_SCROLL_FIX__)return;
window.__TM_KANBAN_SCROLL_FIX__=true;

var FU_BASE_STATUS={'Interações':1,'Em negociação':1,'Proposta enviada':1};
var FU_GOLD_STATUS='Gold ⭐';
var FU_STATUS_ORDER={'Interações':0,'Em negociação':1,'Proposta enviada':2,'Gold ⭐':3};
var fuGold=false,fuEligibilityObs=null,fuBusy=false;
var fuSortKey='',fuSortDir=0;
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
    if(el.scrollLeft!==before){ev.preventDefault();ev.stopPropagation();}
  },{passive:false,capture:true});
}

function fuLines(){
  try{var a=window.CRM_FOLLOWUP;return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];}catch(e){return[];}
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
function fuMap(){var m={};fuLines().forEach(function(x){m[String(x.lead_id)]=x;});return m;}

function ensureGoldToggle(goldCount){
  var p=document.getElementById('fu-prio');
  if(!p||!p.parentNode)return;
  var b=document.getElementById('tm-fu-gold-toggle');
  if(!b){
    b=document.createElement('button');b.type='button';b.id='tm-fu-gold-toggle';b.className='btn tm-fu-gold-toggle';
    p.parentNode.insertBefore(b,p.nextSibling);
    b.addEventListener('click',function(){
      fuGold=!fuGold;
      try{localStorage.setItem('tm_followup_include_gold',fuGold?'1':'0');}catch(e){}
      applyFollowupEligibility();
    });
  }
  b.setAttribute('aria-pressed',fuGold?'true':'false');b.classList.toggle('on',fuGold);
  b.textContent=fuGold?'Gold incluído ('+goldCount+')':'Incluir Gold ('+goldCount+')';
}
function updateFollowupCount(total){
  var el=document.getElementById('fu-estado');if(!el)return;
  var txt=String(el.textContent||'');if(txt.indexOf('lead(s) na fila')<0)return;
  var m=txt.match(/·\s*atualizado\s+.+$/i);
  el.textContent=total+' lead(s) na fila'+(m?' · '+m[0].replace(/^·\s*/, ''):'');
}

function clearInteractionSort(){
  var on=document.querySelector('#tm-age-sort button.on');
  if(on)try{on.click();}catch(e){}
}
function sortArrow(btn,active,dir){
  if(!btn)return;
  btn.classList.toggle('on',active);
  btn.textContent=!active?'↕':(dir>0?'↑':'↓');
}
function refreshHeaderSortUI(){
  var s=document.querySelector('[data-tm-fu-sort="status"]');
  var p=document.querySelector('[data-tm-fu-sort="parado"]');
  sortArrow(s,fuSortKey==='status',fuSortDir);
  sortArrow(p,fuSortKey==='parado',fuSortDir);
}
function cycleSort(key){
  clearInteractionSort();
  if(fuSortKey!==key){fuSortKey=key;fuSortDir=(key==='parado'?-1:1);}
  else if(key==='parado'&&fuSortDir===-1)fuSortDir=1;
  else if(key==='status'&&fuSortDir===1)fuSortDir=-1;
  else {fuSortKey='';fuSortDir=0;}
  refreshHeaderSortUI();
  applyFollowupOrder();
}
function ensureHeaderSort(){
  var tb=document.getElementById('fu-tbody'),table=tb&&tb.closest('table');
  if(!table)return;
  var hs=table.querySelectorAll('thead th');
  function add(th,key,title){
    if(!th||th.querySelector('[data-tm-fu-sort="'+key+'"]'))return;
    var b=document.createElement('button');
    b.type='button';b.className='tm-fu-head-sort';b.setAttribute('data-tm-fu-sort',key);b.title=title;b.textContent='↕';
    th.appendChild(b);b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();cycleSort(key);});
  }
  add(hs[2],'status','Agrupar por status / inverter ordem / limpar');
  add(hs[6],'parado','Mais tempo parado / menos tempo parado / limpar');
  refreshHeaderSortUI();
}
function applyFollowupOrder(){
  if(!fuSortKey)return;
  var tb=document.getElementById('fu-tbody');if(!tb)return;
  var byId=fuMap(),rows=Array.prototype.slice.call(tb.querySelectorAll('tr'));
  rows.forEach(function(r,i){if(r.dataset.tmFuBaseOrder==null)r.dataset.tmFuBaseOrder=String(i);});
  rows.sort(function(a,b){
    var xa=byId[fuIdFromRow(a)]||{},xb=byId[fuIdFromRow(b)]||{};
    var va,vb;
    if(fuSortKey==='status'){
      va=Object.prototype.hasOwnProperty.call(FU_STATUS_ORDER,String(xa.status||''))?FU_STATUS_ORDER[String(xa.status||'')]:99;
      vb=Object.prototype.hasOwnProperty.call(FU_STATUS_ORDER,String(xb.status||''))?FU_STATUS_ORDER[String(xb.status||'')]:99;
    }else{
      va=Number(xa.dias_parado);vb=Number(xb.dias_parado);
      if(!isFinite(va))va=-1;if(!isFinite(vb))vb=-1;
    }
    if(va===vb)return Number(a.dataset.tmFuBaseOrder||0)-Number(b.dataset.tmFuBaseOrder||0);
    return fuSortDir*(va-vb);
  });
  rows.forEach(function(r){tb.appendChild(r);});
}

function applyFollowupEligibility(){
  var tb=document.getElementById('fu-tbody');if(!tb||fuBusy)return;
  fuBusy=true;
  if(fuEligibilityObs)fuEligibilityObs.disconnect();
  try{
    var lines=fuLines(),byId={},eligibleTotal=0,goldCount=0;
    lines.forEach(function(x){byId[String(x.lead_id)]=x;if(String(x.status||'')===FU_GOLD_STATUS)goldCount++;if(fuEligible(x))eligibleTotal++;});
    ensureGoldToggle(goldCount);ensureHeaderSort();
    Array.prototype.forEach.call(tb.querySelectorAll('tr'),function(row){var id=fuIdFromRow(row),x=id&&byId[id];if(!id||!x)return;row.style.display=fuEligible(x)?'':'none';});
    updateFollowupCount(eligibleTotal);applyFollowupOrder();
  }finally{
    fuBusy=false;
    if(fuEligibilityObs&&tb.isConnected)fuEligibilityObs.observe(tb,{childList:true});
  }
}
function watchFollowupEligibility(){
  var tb=document.getElementById('fu-tbody');
  if(!tb){setTimeout(watchFollowupEligibility,150);return;}
  if(fuEligibilityObs)fuEligibilityObs.disconnect();
  fuEligibilityObs=new MutationObserver(function(){if(!fuBusy)queueMicrotask(applyFollowupEligibility);});
  fuEligibilityObs.observe(tb,{childList:true});applyFollowupEligibility();
}

function installFollowupLayout(){
  if(!document.getElementById('tm-followup-wide-style')){
    var st=document.createElement('style');st.id='tm-followup-wide-style';
    st.textContent=[
      '#page-followup{padding-left:8px!important;padding-right:8px!important}',
      '#page-followup>.container{max-width:none!important;width:100%!important;margin:0!important}',
      '#page-followup .tm-followup-scroll{overflow:visible!important;padding-right:0!important}',
      '#page-followup .tm-followup-scroll>table{width:100%!important;min-width:0!important;table-layout:fixed!important}',
      '#page-followup .tm-followup-scroll th:nth-child(1){width:18%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(2){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(3){width:10%!important;white-space:nowrap!important}',
      '#page-followup .tm-followup-scroll th:nth-child(4){width:7%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(5){width:7%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(6){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(7){width:6%!important;white-space:nowrap!important}',
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
      '#page-followup .tm-fu-head-sort{display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-left:3px!important;padding:0!important;width:14px!important;height:18px!important;border:0;background:transparent;color:#4b5e78;font-size:11px;font-weight:800;line-height:18px;cursor:pointer;vertical-align:middle;border-radius:4px;white-space:nowrap!important}',
      '#page-followup .tm-fu-head-sort:hover{color:#93c5fd;background:rgba(59,130,246,.10)}',
      '#page-followup .tm-fu-head-sort.on{color:#60a5fa;background:rgba(59,130,246,.14)}',
      '@media(max-width:1200px){#page-followup .tm-followup-scroll td,#page-followup .tm-followup-scroll th{padding-left:8px!important;padding-right:8px!important}#page-followup .tm-followup-scroll th:nth-child(1){width:19%!important}#page-followup .tm-followup-scroll th:nth-child(2){width:9%!important}#page-followup .tm-followup-scroll th:nth-child(3){width:10%!important}#page-followup .tm-followup-scroll th:nth-child(6){width:9%!important}#page-followup .tm-followup-scroll th:nth-child(10){width:14%!important}#page-followup .tm-agendar-btn{min-width:70px!important;padding:0 6px!important}#page-followup .tm-action-cell{gap:4px!important}}',
      '@media(max-width:900px){#page-followup{padding-left:6px!important;padding-right:6px!important}#page-followup .tm-followup-scroll td,#page-followup .tm-followup-scroll th{font-size:11px!important;padding-left:6px!important;padding-right:6px!important}#page-followup .tm-fu-chip{padding-left:7px!important;padding-right:7px!important;font-size:10px!important}}'
    ].join('\n');document.head.appendChild(st);
  }
  var tb=document.getElementById('fu-tbody'),table=tb&&tb.closest('table'),wrap=table&&table.parentElement;
  if(wrap){wrap.classList.add('tm-followup-scroll');try{wrap.style.overflowX='visible';}catch(e){}}
  ensureHeaderSort();
}

function bind(){
  var kanban=document.getElementById('kanban');if(kanban)normalizeWheel(kanban,'tmScrollFix');
  installFollowupLayout();if(!fuEligibilityObs)watchFollowupEligibility();
  if(!kanban||!document.getElementById('fu-tbody'))setTimeout(bind,150);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

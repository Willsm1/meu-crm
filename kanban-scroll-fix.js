/* Taurus Magnum CRM — Kanban horizontal scroll + Follow-up responsive layout */
(function(){
'use strict';
if(window.__TM_KANBAN_SCROLL_FIX__)return;
window.__TM_KANBAN_SCROLL_FIX__=true;

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
      '#page-followup .tm-action-cell{overflow:visible!important}',
      '@media(max-width:1200px){#page-followup .tm-followup-scroll td,#page-followup .tm-followup-scroll th{padding-left:8px!important;padding-right:8px!important}#page-followup .tm-followup-scroll th:nth-child(1){width:19%!important}#page-followup .tm-followup-scroll th:nth-child(2){width:9%!important}#page-followup .tm-followup-scroll th:nth-child(3){width:10%!important}#page-followup .tm-followup-scroll th:nth-child(6){width:9%!important}#page-followup .tm-followup-scroll th:nth-child(10){width:14%!important}}',
      '@media(max-width:900px){#page-followup{padding-left:6px!important;padding-right:6px!important}#page-followup .tm-followup-scroll td,#page-followup .tm-followup-scroll th{font-size:11px!important;padding-left:6px!important;padding-right:6px!important}}'
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
  if(!kanban||!document.getElementById('fu-tbody'))setTimeout(bind,150);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

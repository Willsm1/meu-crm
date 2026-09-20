/* Taurus Magnum CRM — horizontal scroll normalization + Follow-up wide layout */
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
      '#page-followup .tm-followup-scroll{overflow-x:auto!important;overflow-y:visible!important;overscroll-behavior-x:contain;scrollbar-gutter:stable;padding-right:2px}',
      '#page-followup .tm-followup-scroll>table{width:100%!important;min-width:1280px!important;table-layout:fixed!important}',
      '#page-followup .tm-followup-scroll th:nth-child(1){width:17%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(2){width:10%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(3){width:9%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(4){width:7%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(5){width:7%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(6){width:9%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(7){width:6%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(8){width:9%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(9){width:9%!important}',
      '#page-followup .tm-followup-scroll th:nth-child(10){width:17%!important}',
      '#page-followup .tm-followup-scroll td:nth-child(10){min-width:210px!important;padding-right:14px!important}',
      '#page-followup .tm-action-cell{overflow:visible!important}',
      '@media(max-width:1100px){#page-followup .tm-followup-scroll>table{min-width:1280px!important}}',
      '@media(max-width:900px){#page-followup{padding-left:6px!important;padding-right:6px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  var tb=document.getElementById('fu-tbody');
  var table=tb&&tb.closest('table');
  var wrap=table&&table.parentElement;
  if(wrap){
    wrap.classList.add('tm-followup-scroll');
    normalizeWheel(wrap,'tmFollowupScroll');
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

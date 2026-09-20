/* Taurus Magnum CRM — Follow-up wide layout + horizontal scroll */
(function(){
'use strict';

function ensureStyle(){
  if(document.getElementById('tm-followup-layout-style')) return;
  var st=document.createElement('style');
  st.id='tm-followup-layout-style';
  st.textContent=[
    '#page-followup{padding-left:8px!important;padding-right:8px!important}',
    '#page-followup>.container{max-width:none!important;width:100%!important;margin:0!important}',
    '#page-followup .tm-followup-scroll{overflow-x:auto!important;overscroll-behavior-x:contain;scrollbar-gutter:stable}',
    '#page-followup .tm-followup-scroll>table{width:100%!important;min-width:1120px!important;table-layout:fixed!important}',
    '#page-followup .tm-followup-scroll th:nth-child(1){width:18%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(2){width:11%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(3){width:10%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(4){width:7%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(5){width:7%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(6){width:10%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(7){width:6%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(8){width:10%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(9){width:9%!important}',
    '#page-followup .tm-followup-scroll th:nth-child(10){width:12%!important}',
    '@media(max-width:900px){#page-followup{padding-left:6px!important;padding-right:6px!important}#page-followup .tm-followup-scroll>table{min-width:1120px!important}}'
  ].join('\n');
  document.head.appendChild(st);
}

function bindScroll(){
  var page=document.getElementById('page-followup');
  if(!page) return;
  var tb=document.getElementById('fu-tbody');
  var table=tb&&tb.closest('table');
  var wrap=table&&table.parentElement;
  if(!wrap) return;
  wrap.classList.add('tm-followup-scroll');
  if(wrap.dataset.tmHorizontalScroll==='1') return;
  wrap.dataset.tmHorizontalScroll='1';
  wrap.addEventListener('wheel',function(e){
    var dx=e.deltaX||0;
    var dy=e.deltaY||0;
    var horizontal=Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>0;
    var shifted=e.shiftKey&&Math.abs(dy)>0;
    if(!horizontal&&!shifted) return;
    var delta=horizontal?dx:dy;
    if(!delta) return;
    wrap.scrollLeft+=delta;
    e.preventDefault();
  },{passive:false});
}

function install(){
  ensureStyle();
  bindScroll();
  var page=document.getElementById('page-followup');
  if(page&&window.MutationObserver){
    var obs=new MutationObserver(function(){bindScroll();});
    obs.observe(page,{childList:true,subtree:true});
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();

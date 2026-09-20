/* Taurus Magnum CRM — Kanban horizontal scroll normalization */
(function(){
'use strict';
if(window.__TM_KANBAN_SCROLL_FIX__)return;
window.__TM_KANBAN_SCROLL_FIX__=true;

function bind(){
  var el=document.getElementById('kanban');
  if(!el){setTimeout(bind,150);return;}
  if(el.dataset.tmScrollFix==='1')return;
  el.dataset.tmScrollFix='1';

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

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

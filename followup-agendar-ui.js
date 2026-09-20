/* Taurus Magnum CRM — calendário de Agendar/Reagendar, sem re-render próprio */
(function(){
'use strict';
if(window.__TM_AGENDAR_POPOVER_STABLE__)return;
window.__TM_AGENDAR_POPOVER_STABLE__=true;
var MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var pop=null,activeId=null,viewYear=null,viewMonth=null,anchor=null;
function pad(n){return String(n).padStart(2,'0');}
function iso(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
function today(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function lineById(id){try{var a=window.CRM_FOLLOWUP,ls=a&&typeof a.linhas==='function'?(a.linhas()||[]):[];for(var i=0;i<ls.length;i++)if(String(ls[i].lead_id)===String(id))return ls[i];}catch(e){}return null;}
function css(){if(document.getElementById('tm-agendar-stable-style'))return;var s=document.createElement('style');s.id='tm-agendar-stable-style';s.textContent='.tm-date-pop{position:fixed;z-index:9000;width:286px;background:#0e1628;border:1px solid rgba(59,130,246,.35);border-radius:14px;box-shadow:0 18px 55px rgba(0,0,0,.55);padding:12px}.tm-date-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.tm-date-title{font-size:13px;font-weight:800;color:#e2e8f0}.tm-date-nav{width:28px;height:28px;border:1px solid rgba(148,163,184,.22);background:#111b2d;color:#94a3b8;border-radius:8px;cursor:pointer}.tm-date-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.tm-date-week{font-size:9px;color:#64748b;text-align:center;padding:2px 0 4px}.tm-date-day{height:32px;border-radius:8px;border:1px solid rgba(59,130,246,.12);background:#111d31;color:#cbd5e1;font-size:11px;font-weight:700;cursor:pointer}.tm-date-day:hover{background:#1d4ed8;color:#fff}.tm-date-day[disabled]{opacity:.25;cursor:not-allowed}.tm-date-empty{height:32px}.tm-date-foot{font-size:10px;color:#64748b;margin-top:9px;text-align:center}';document.head.appendChild(s);}
function closePop(){if(pop&&pop.parentNode)pop.remove();pop=null;activeId=null;anchor=null;}
function position(){if(!pop||!anchor)return;var r=anchor.getBoundingClientRect(),w=286,h=350;pop.style.left=Math.max(12,Math.min(window.innerWidth-w-12,r.left))+'px';pop.style.top=Math.max(12,Math.min(window.innerHeight-h-12,r.bottom+8))+'px';}
function render(){if(!pop)return;var y=viewYear,m=viewMonth,first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=first.getDay(),h='<div class="tm-date-head"><button type="button" class="tm-date-nav" data-nav="-1">‹</button><div class="tm-date-title">'+MONTHS[m]+' '+y+'</div><button type="button" class="tm-date-nav" data-nav="1">›</button></div><div class="tm-date-grid">';['D','S','T','Q','Q','S','S'].forEach(function(x){h+='<div class="tm-date-week">'+x+'</div>';});for(var i=0;i<start;i++)h+='<div class="tm-date-empty"></div>';var td=today();for(var d=1;d<=days;d++){var dt=new Date(y,m,d),disabled=dt<td;h+='<button type="button" class="tm-date-day" data-day="'+d+'"'+(disabled?' disabled':'')+'>'+d+'</button>';}h+='</div><div class="tm-date-foot">Selecione o dia — salva automaticamente.</div>';pop.innerHTML=h;position();}
function openPop(btn,id){closePop();css();activeId=String(id);anchor=btn;var item=lineById(id),base=item&&item.proximo_contato?new Date(String(item.proximo_contato).slice(0,10)+'T12:00:00'):today();viewYear=base.getFullYear();viewMonth=base.getMonth();pop=document.createElement('div');pop.className='tm-date-pop';document.body.appendChild(pop);render();}
document.addEventListener('click',function(e){
  var btn=e.target&&e.target.closest?e.target.closest('.tm-agendar-btn'):null;
  if(btn){e.preventDefault();e.stopPropagation();openPop(btn,btn.getAttribute('data-lead-id'));return;}
  if(!pop)return;
  var nav=e.target.closest&&e.target.closest('[data-nav]');if(nav&&pop.contains(nav)){e.preventDefault();viewMonth+=Number(nav.getAttribute('data-nav'));if(viewMonth<0){viewMonth=11;viewYear--;}if(viewMonth>11){viewMonth=0;viewYear++;}render();return;}
  var day=e.target.closest&&e.target.closest('[data-day]');if(day&&pop.contains(day)){e.preventDefault();var id=activeId,input=document.getElementById('fu-d-'+id);if(!input)return;input.value=iso(viewYear,viewMonth,Number(day.getAttribute('data-day')));closePop();try{if(typeof window.fuAgendar==='function')window.fuAgendar(id);}catch(err){try{console.warn('[TM agendar]',err);}catch(_){} }return;}
  if(!pop.contains(e.target))closePop();
},true);
window.addEventListener('resize',function(){if(pop)position();});
window.addEventListener('scroll',function(){if(pop)position();},true);
css();
})();

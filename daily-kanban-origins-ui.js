/* Taurus Magnum CRM — Daily/Kanban + expanded origins
 * Adds responsible executive beside team in Kanban, VGV totals per column and extends origin options.
 * UI only: does not alter existing lead values automatically.
 */
(function(){
'use strict';
if(window.__TM_DAILY_KANBAN_ORIGINS__)return;
window.__TM_DAILY_KANBAN_ORIGINS__=true;
var EXTRA_ORIGINS=['Campanha Gerentes','Midrah','Campanha pessoal'];
var renderWrapped=false,timer=null;
function esc(v){return String(v==null?'':v);}
function addOriginOptions(){
  document.querySelectorAll('select').forEach(function(sel){
    var id=String(sel.id||'').toLowerCase();if(id!=='f-origem'&&id!=='filterorigem'&&id.indexOf('origem')<0)return;
    var existing=new Set(Array.prototype.map.call(sel.options,function(o){return String(o.value||o.textContent||'').trim().toLowerCase();}));
    var outros=Array.prototype.find.call(sel.options,function(o){return String(o.value||o.textContent||'').trim().toLowerCase()==='outros';});
    EXTRA_ORIGINS.forEach(function(name){
      if(existing.has(name.toLowerCase()))return;
      var o=document.createElement('option');o.value=name;o.textContent=name;
      if(outros)sel.insertBefore(o,outros);else sel.appendChild(o);
      existing.add(name.toLowerCase());
    });
  });
}
function leadByCard(card){
  var oc=String(card.getAttribute('onclick')||'');var m=oc.match(/openModal\(['\"]([^'\"]+)['\"]\)/);var id=m&&m[1];
  var rows=Array.isArray(window.leads)?window.leads:[];
  if(id)return rows.find(function(l){return l&&String(l.id)===String(id);})||null;
  var name=(card.querySelector('.k-name')||{}).textContent||'';
  var matches=rows.filter(function(l){return l&&String(l.nome||'')===String(name||'');});return matches.length===1?matches[0]:null;
}
function valorNumero(v){
  if(v===null||v===undefined||v==='')return 0;
  try{if(typeof window.valorNum==='function'){var n=Number(window.valorNum(v));if(isFinite(n))return n;}}catch(e){}
  if(typeof v==='number')return isFinite(v)?v:0;
  var s=String(v).trim().replace(/R\$/gi,'').replace(/\s/g,'');
  if(!s)return 0;
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/[^0-9.-]/g,'');
  var x=Number(s);return isFinite(x)?x:0;
}
function fmtVgv(v){
  try{if(typeof window.fmt==='function')return window.fmt(v);}catch(e){}
  try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0,maximumFractionDigits:0}).format(v);}catch(e){return 'R$ '+Math.round(v);}
}
function ensureCss(){
  if(document.getElementById('tm-kanban-vgv-style'))return;
  var s=document.createElement('style');s.id='tm-kanban-vgv-style';
  s.textContent='.tm-k-vgv{margin:-2px 0 9px;padding:6px 8px;border-radius:7px;background:rgba(59,130,246,.08);border:1px solid rgba(96,165,250,.18);font-size:10px;color:#93c5fd;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm-k-vgv span{color:#64748b;font-weight:600;margin-right:4px}';
  document.head.appendChild(s);
}
function decorateKanban(){
  var root=document.getElementById('kanban');if(!root)return;
  ensureCss();
  var rows=Array.isArray(window.leads)?window.leads:[];
  root.querySelectorAll('.k-card').forEach(function(card){
    var l=leadByCard(card);if(!l)return;
    var sub=card.querySelector('.k-company');if(!sub)return;
    var team=String(l.empresa||l._team_name||'—').trim()||'—';
    var resp=String(l.responsavel||'').trim();
    var txt=team+(resp?' · '+resp:'');
    sub.textContent=txt;sub.title=txt;
  });
  root.querySelectorAll('.k-col').forEach(function(col){
    var title=col.querySelector('.k-title'),header=col.querySelector('.k-header');if(!title||!header)return;
    var status=String(title.textContent||'').trim();
    var total=rows.reduce(function(sum,l){return sum+(l&&String(l.status||'')===status?valorNumero(l.valor):0);},0);
    var box=col.querySelector('.tm-k-vgv');
    if(!box){box=document.createElement('div');box.className='tm-k-vgv';header.insertAdjacentElement('afterend',box);}
    box.innerHTML='<span>VGV</span>'+esc(fmtVgv(total));
    box.title='VGV total de '+status+': '+fmtVgv(total);
  });
}
function decorate(){addOriginOptions();decorateKanban();}
function wrap(){
  if(renderWrapped||typeof window.renderKanban!=='function')return;
  var original=window.renderKanban;
  window.renderKanban=function(){var r=original.apply(this,arguments);setTimeout(decorateKanban,0);return r;};
  renderWrapped=true;
}
function schedule(){clearTimeout(timer);timer=setTimeout(function(){wrap();decorate();},60);}
function boot(){wrap();decorate();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

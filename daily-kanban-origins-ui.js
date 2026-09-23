/* Taurus Magnum CRM — Daily/Kanban + expanded origins
 * Adds responsible executive beside team in Kanban and extends origin options.
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
function decorateKanban(){
  var root=document.getElementById('kanban');if(!root)return;
  root.querySelectorAll('.k-card').forEach(function(card){
    var l=leadByCard(card);if(!l)return;
    var sub=card.querySelector('.k-company');if(!sub)return;
    var team=String(l.empresa||l._team_name||'—').trim()||'—';
    var resp=String(l.responsavel||'').trim();
    var txt=team+(resp?' · '+resp:'');
    sub.textContent=txt;sub.title=txt;
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

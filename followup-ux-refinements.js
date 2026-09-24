/* Taurus Magnum CRM — refinamentos leves da aba Follow-up (TEST BRANCH ONLY) */
(function(){
'use strict';
if(window.__TM_FOLLOWUP_UX_REFINEMENTS__)return;
window.__TM_FOLLOWUP_UX_REFINEMENTS__=true;
var originalRender=null,wrapped=false,refreshUiWrapped=false,refineTimer=null,pageObserver=null;
function digits(v){return String(v||'').replace(/\D/g,'');}
function localKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function linhas(){try{var a=window.CRM_FOLLOWUP;return a&&typeof a.linhas==='function'?(a.linhas()||[]):[];}catch(e){return[];}}
function mapa(){var m=new Map();linhas().forEach(function(x){m.set(String(x.lead_id),x);});return m;}
function falouHoje(x){var a=Array.isArray(x&&x.cadencia_7d)?x.cadencia_7d:[],h=localKey(new Date());for(var i=0;i<a.length;i++){if(String(a[i]&&a[i].data||'').slice(0,10)===h)return !!a[i].falou;}return false;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function dataBR(v){if(!v)return'—';var p=String(v).slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]:'—';}
function instalarCadencia(){
  window._fuCadencia=function(v){
    var a=Array.isArray(v)?v:[];
    if(!a.length)return '<span style="color:#4b5e78">—</span>';
    return '<div style="display:flex;align-items:flex-end;gap:3px;height:18px;min-width:74px">'+a.map(function(x,i){
      var ok=!!(x&&x.falou),h=7+(i*1.5);
      if(ok)return '<span title="'+esc(dataBR(x&&x.data))+' · contato feito" style="display:inline-block;width:7px;height:'+h+'px;border-radius:3px 3px 1px 1px;background:#22c55e;border:.5px solid rgba(134,239,172,.55)"></span>';
      return '<span title="'+esc(dataBR(x&&x.data))+' · sem contato" style="display:inline-block;width:7px;height:2px;margin-bottom:1px;border-radius:2px;background:#ef4444;box-shadow:0 0 0 .5px rgba(248,113,113,.45)"></span>';
    }).join('')+'</div>';
  };
}
function filaAtiva(){var p=document.getElementById('page-followup');return !!(p&&p.classList.contains('active'));}
function syncAtualizar(){var b=document.getElementById('refresh-btn');if(b)b.style.display=filaAtiva()?'none':'';var q=document.getElementById('fu-busca');if(q)q.placeholder='Buscar nome ou telefone...';}
function refinarLinhas(){
  var tb=document.getElementById('fu-tbody');if(!tb)return;var m=mapa();
  tb.querySelectorAll('tr').forEach(function(tr){
    var btn=tr.querySelector('.tm-agendar-btn[data-lead-id]');if(!btn)return;
    var x=m.get(String(btn.dataset.leadId));if(!x)return;
    var td=btn.closest('td'),prio=td&&td.previousElementSibling;
    if(prio){var chip=prio.querySelector('.tm-fu-chip.ok');if(chip&&String(chip.textContent||'').trim()==='Em dia'&&!falouHoje(x)){prio.innerHTML='<span class="tm-fu-chip tm-fu-missed">—</span>';}}
    if(/^Solicitar cancelamento$/i.test(String(btn.textContent||'').trim()))btn.textContent='Cancelar';
  });
}
function queueRefine(){clearTimeout(refineTimer);refineTimer=setTimeout(function(){refinarLinhas();syncAtualizar();},60);}
function telefoneDaLinha(tr){var cell=tr&&tr.cells&&tr.cells[0];if(!cell)return'';var div=cell.querySelector('div');return digits(div?div.textContent:cell.textContent);}
function corrigirContador(visiveis){var e=document.getElementById('fu-estado');if(!e)return;var t=String(e.textContent||'');if(/^\d+\s+lead\(s\)/.test(t))e.textContent=t.replace(/^\d+\s+lead\(s\)/,visiveis+' lead(s)');}
function instalarBusca(){
  if(wrapped||typeof window.fuRenderFila!=='function')return false;
  originalRender=window.fuRenderFila;wrapped=true;
  window.fuRenderFila=function(){
    var input=document.getElementById('fu-busca'),q=String(input&&input.value||'').trim(),qd=digits(q);
    var phoneMode=qd.length>=4 && /^[\d\s()+.\-]+$/.test(q);
    if(!phoneMode){var out=originalRender.apply(this,arguments);queueRefine();return out;}
    input.value='';
    var out2=originalRender.apply(this,arguments);
    input.value=q;
    var tb=document.getElementById('fu-tbody'),n=0;
    if(tb)tb.querySelectorAll('tr').forEach(function(tr){var ok=telefoneDaLinha(tr).indexOf(qd)>=0;tr.style.display=ok?'':'none';if(ok)n++;});
    corrigirContador(n);queueRefine();return out2;
  };
  return true;
}
function instalarRefreshUi(){
  if(refreshUiWrapped||typeof window.TM_FOLLOWUP_REFRESH_UI!=='function')return false;
  var old=window.TM_FOLLOWUP_REFRESH_UI;refreshUiWrapped=true;
  window.TM_FOLLOWUP_REFRESH_UI=function(){var r=old.apply(this,arguments);queueRefine();return r;};
  return true;
}
function css(){if(document.getElementById('tm-followup-refine-style'))return;var s=document.createElement('style');s.id='tm-followup-refine-style';s.textContent='.tm-fu-chip.tm-fu-missed{background:rgba(239,68,68,.14)!important;color:#f87171!important;min-width:34px;text-align:center;justify-content:center}.tm-agendar-btn[data-tm-commit-cancel="1"]{min-width:72px!important;width:72px!important;padding:0 8px!important}.tm-action-cell{gap:6px!important}';document.head.appendChild(s);}
function boot(){
  css();instalarCadencia();syncAtualizar();instalarBusca();instalarRefreshUi();queueRefine();
  var p=document.getElementById('page-followup');if(p){pageObserver=new MutationObserver(function(){syncAtualizar();if(filaAtiva())queueRefine();});pageObserver.observe(p,{attributes:true,attributeFilter:['class']});}
  var tries=0,t=setInterval(function(){tries++;instalarBusca();instalarRefreshUi();syncAtualizar();if(wrapped&&refreshUiWrapped||tries>80)clearInterval(t);},100);
  window.addEventListener('focus',function(){syncAtualizar();queueRefine();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

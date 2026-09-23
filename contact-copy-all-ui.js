/* Taurus Magnum CRM — copy contact across all CRM views
 * Reuses the same interaction already approved in Carteira without changing data.
 */
(function(){
'use strict';
if(window.__TM_CONTACT_COPY_ALL__)return;
window.__TM_CONTACT_COPY_ALL__=true;
var timer=null;
function digits(v){return String(v||'').replace(/\D/g,'');}
function phoneMap(){
  var m=new Map();
  (Array.isArray(window.leads)?window.leads:[]).forEach(function(l){
    var d=digits(l&&l.telefone);if(d.length>=8&&!m.has(d))m.set(d,String(l.telefone||d));
  });
  return m;
}
function excluded(el){
  if(!el||!el.closest)return true;
  return !!el.closest('script,style,input,textarea,select,button,a,.contact-copy,.tm-contact-copy,[contenteditable="true"]');
}
function decorate(root){
  root=root||document;
  var map=phoneMap();if(!map.size)return;
  var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
    if(!n||!n.parentElement||excluded(n.parentElement))return NodeFilter.FILTER_REJECT;
    var raw=String(n.nodeValue||'').trim();if(!raw)return NodeFilter.FILTER_REJECT;
    var d=digits(raw);return d.length>=8&&map.has(d)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  var nodes=[],n;while((n=walker.nextNode()))nodes.push(n);
  nodes.forEach(function(t){
    if(!t.parentNode)return;
    var raw=String(t.nodeValue||'').trim(),d=digits(raw),phone=map.get(d);if(!phone)return;
    var span=document.createElement('span');span.className='tm-contact-copy';span.dataset.phone=encodeURIComponent(phone);
    span.title='Clique para copiar';span.textContent=raw;
    span.style.cssText='cursor:pointer;display:inline-block;transition:color .15s,text-shadow .15s;color:inherit';
    t.parentNode.replaceChild(span,t);
  });
}
function copy(el,ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  var p='';try{p=decodeURIComponent(el.dataset.phone||'');}catch(e){p=el.dataset.phone||'';}p=String(p||'').trim();if(!p)return;
  if(typeof window.copiarContato==='function')return window.copiarContato(el,ev);
  function done(){var old=el.textContent;el.textContent='Copiado';el.style.color='#86efac';setTimeout(function(){el.textContent=old;el.style.color='';},1100);}
  function fallback(){var ta=document.createElement('textarea');ta.value=p;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}finally{ta.remove();}done();}
  try{if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(p).then(done).catch(fallback);else fallback();}catch(e){fallback();}
}
function schedule(){clearTimeout(timer);timer=setTimeout(function(){decorate(document);},80);}
document.addEventListener('click',function(ev){var el=ev.target&&ev.target.closest&&ev.target.closest('.tm-contact-copy');if(el)copy(el,ev);},true);
var st=document.createElement('style');st.textContent='.tm-contact-copy:hover{color:#86efac!important;text-shadow:0 0 12px rgba(134,239,172,.18)}';document.head.appendChild(st);
function boot(){decorate(document);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('CRM_UPDATED',schedule);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* Taurus Magnum CRM — copy visible lead phones across all CRM views
 * Branch test: robust delegated click. Does not alter lead data.
 */
(function(){
'use strict';
if(window.__TM_CONTACT_COPY_ALL_V2__)return;
window.__TM_CONTACT_COPY_ALL_V2__=true;

function digits(v){return String(v||'').replace(/\D/g,'');}
function brKey(v){
  var d=digits(v);
  if(d.length===10||d.length===11)return '55'+d;
  if((d.length===12||d.length===13)&&d.indexOf('55')===0)return d;
  return d;
}
function phoneIndex(){
  var exact=new Map(),canon=new Map();
  (Array.isArray(window.leads)?window.leads:[]).forEach(function(l){
    var raw=String(l&&l.telefone||'').trim(),d=digits(raw);if(d.length<8)return;
    exact.set(d,raw||d);
    var k=brKey(d);if(k)canon.set(k,raw||d);
  });
  return {exact:exact,canon:canon};
}
function isUiControl(el){return !!(el&&el.closest&&el.closest('input,textarea,select,button,a,[contenteditable="true"]'));}
function candidatesFromText(txt){
  txt=String(txt||'');
  var out=[],m,re=/(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/g;
  while((m=re.exec(txt))!==null){var d=digits(m[0]);if(d.length>=8&&d.length<=13)out.push({raw:m[0],digits:d});}
  return out;
}
function resolvePhone(el){
  var idx=phoneIndex();
  var cur=el;
  for(var depth=0;cur&&depth<5;depth++,cur=cur.parentElement){
    if(cur===document.body)break;
    var txt=String(cur.innerText||cur.textContent||'').trim();
    if(!txt)continue;
    var cs=candidatesFromText(txt);
    for(var i=0;i<cs.length;i++){
      var d=cs[i].digits;
      if(idx.exact.has(d))return {phone:idx.exact.get(d),display:cs[i].raw,node:cur};
      var k=brKey(d);
      if(k&&idx.canon.has(k))return {phone:idx.canon.get(k),display:cs[i].raw,node:cur};
    }
  }
  return null;
}
function fallbackCopy(txt){
  var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');
  ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}finally{ta.remove();}
}
function flash(node){
  if(!node)return;
  var oldTitle=node.getAttribute('title'),oldColor=node.style.color;
  node.setAttribute('title','Copiado');node.style.color='#86efac';
  node.classList.add('tm-contact-copied');
  setTimeout(function(){node.classList.remove('tm-contact-copied');node.style.color=oldColor||'';if(oldTitle===null)node.removeAttribute('title');else node.setAttribute('title',oldTitle);},900);
}
function copyResolved(r){
  var txt=String(r&&r.phone||'').trim();if(!txt)return;
  function ok(){flash(r.node);try{if(typeof showToast==='function')showToast('Contato copiado');}catch(e){}}
  try{
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(txt).then(ok).catch(function(){fallbackCopy(txt);ok();});
    else{fallbackCopy(txt);ok();}
  }catch(e){fallbackCopy(txt);ok();}
}
function markVisible(){
  var idx=phoneIndex();if(!idx.exact.size&&!idx.canon.size)return;
  document.querySelectorAll('td, .k-card, #page-followup tr, #page-quentes [class], #page-retomar [class]').forEach(function(el){
    if(isUiControl(el))return;
    var cs=candidatesFromText(el.innerText||el.textContent||'');
    var hit=cs.some(function(c){return idx.exact.has(c.digits)||idx.canon.has(brKey(c.digits));});
    if(hit){el.classList.add('tm-phone-copy-zone');el.title=el.title||'Clique no telefone para copiar';}
  });
}
var markTimer=null;
function scheduleMark(){clearTimeout(markTimer);markTimer=setTimeout(markVisible,100);}
document.addEventListener('click',function(ev){
  if(isUiControl(ev.target))return;
  var r=resolvePhone(ev.target);if(!r)return;
  ev.preventDefault();ev.stopPropagation();copyResolved(r);
},true);
var st=document.createElement('style');
st.textContent='.tm-phone-copy-zone{cursor:pointer}.tm-phone-copy-zone:hover{color:#dbeafe}.tm-contact-copied{color:#86efac!important;text-shadow:0 0 12px rgba(134,239,172,.18)}';
document.head.appendChild(st);
function boot(){markVisible();new MutationObserver(scheduleMark).observe(document.body,{childList:true,subtree:true,characterData:true});window.addEventListener('focus',scheduleMark);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

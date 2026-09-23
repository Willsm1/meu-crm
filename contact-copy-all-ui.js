/* Taurus Magnum CRM — copy visible lead phones across CRM views
 * Branch test. Does not alter lead data.
 * Follow-up and Retomar are explicit because they render from their own data sets.
 */
(function(){
'use strict';
if(window.__TM_CONTACT_COPY_ALL_V3__)return;
window.__TM_CONTACT_COPY_ALL_V3__=true;

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
function fallbackCopy(txt){
  var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');
  ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');}finally{ta.remove();}
}
function flash(node){
  if(!node)return;
  var oldTitle=node.getAttribute('title'),oldColor=node.style.color;
  node.setAttribute('title','Copiado');node.style.color='#86efac';node.classList.add('tm-contact-copied');
  setTimeout(function(){node.classList.remove('tm-contact-copied');node.style.color=oldColor||'';if(oldTitle===null)node.removeAttribute('title');else node.setAttribute('title',oldTitle);},900);
}
function copyPhone(phone,node){
  phone=String(phone||'').trim();if(!phone)return;
  function ok(){flash(node);try{if(typeof showToast==='function')showToast('Contato copiado');}catch(e){}}
  try{
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(phone).then(ok).catch(function(){fallbackCopy(phone);ok();});
    else{fallbackCopy(phone);ok();}
  }catch(e){fallbackCopy(phone);ok();}
}
function markDirect(el){
  if(!el||el.dataset.tmDirectPhone==='1')return;
  var d=digits(el.textContent||'');
  if(d.length<8||d.length>13)return;
  el.dataset.tmDirectPhone='1';
  el.dataset.phone=d;
  el.classList.add('tm-direct-phone-copy');
  el.title='Clique para copiar';
}
function markKnownFields(){
  /* Follow-up: telefone fica no DIV abaixo do nome. */
  document.querySelectorAll('#fu-tbody tr td:first-child > div').forEach(markDirect);
  /* Retomar: telefone e a segunda coluna da tabela. */
  document.querySelectorAll('#page-retomar table tbody tr td:nth-child(2)').forEach(markDirect);
}
function resolveGeneric(el){
  var idx=phoneIndex(),cur=el;
  for(var depth=0;cur&&depth<5;depth++,cur=cur.parentElement){
    if(cur===document.body)break;
    var cs=candidatesFromText(cur.innerText||cur.textContent||'');
    for(var i=0;i<cs.length;i++){
      var d=cs[i].digits;
      if(idx.exact.has(d))return {phone:idx.exact.get(d),node:cur};
      var k=brKey(d);if(k&&idx.canon.has(k))return {phone:idx.canon.get(k),node:cur};
    }
  }
  return null;
}
function markGeneric(){
  var idx=phoneIndex();if(!idx.exact.size&&!idx.canon.size)return;
  document.querySelectorAll('td,.k-card,#page-quentes [class]').forEach(function(el){
    if(isUiControl(el)||el.classList.contains('tm-direct-phone-copy'))return;
    var cs=candidatesFromText(el.innerText||el.textContent||'');
    var hit=cs.some(function(c){return idx.exact.has(c.digits)||idx.canon.has(brKey(c.digits));});
    if(hit){el.classList.add('tm-phone-copy-zone');el.title=el.title||'Clique no telefone para copiar';}
  });
}
function decorate(){markKnownFields();markGeneric();}
var timer=null;
function schedule(){clearTimeout(timer);timer=setTimeout(decorate,80);}

document.addEventListener('click',function(ev){
  var direct=ev.target&&ev.target.closest&&ev.target.closest('.tm-direct-phone-copy');
  if(direct){
    ev.preventDefault();ev.stopPropagation();
    copyPhone(direct.dataset.phone||digits(direct.textContent),direct);
    return;
  }
  if(isUiControl(ev.target))return;
  var r=resolveGeneric(ev.target);if(!r)return;
  ev.preventDefault();ev.stopPropagation();copyPhone(r.phone,r.node);
},true);

var st=document.createElement('style');
st.textContent='.tm-direct-phone-copy,.tm-phone-copy-zone{cursor:pointer}.tm-direct-phone-copy:hover{color:#86efac!important;text-decoration:underline;text-decoration-color:rgba(134,239,172,.4);text-underline-offset:2px}.tm-phone-copy-zone:hover{color:#dbeafe}.tm-contact-copied{color:#86efac!important;text-shadow:0 0 12px rgba(134,239,172,.18)}';
document.head.appendChild(st);

function boot(){decorate();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});window.addEventListener('focus',schedule);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

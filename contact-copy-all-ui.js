/* Taurus Magnum CRM — copy ONLY visible phone numbers across CRM views
 * Branch test. No DOM scans, no MutationObserver, no generic numeric zones.
 * A click is eligible only when the clicked visual element itself is a phone.
 */
(function(){
'use strict';
if(window.__TM_CONTACT_COPY_PHONE_ONLY_V4__)return;
window.__TM_CONTACT_COPY_PHONE_ONLY_V4__=true;

function digits(v){return String(v||'').replace(/\D/g,'');}
function inLeadView(el){return !!(el&&el.closest&&el.closest('#page-leads,#page-followup,#page-retomar,#page-quentes,#page-kanban'));}
function isUiControl(el){return !!(el&&el.closest&&el.closest('input,textarea,select,button,a,[contenteditable="true"]'));}
function visible(el){if(!el||!el.getClientRects||!el.getClientRects().length)return false;var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';}
function exactPhone(el){
  if(!el||!inLeadView(el)||isUiControl(el)||!visible(el))return null;
  var txt=String(el.textContent||'').trim();
  if(!txt||!/^[+\d\s().-]+$/.test(txt))return null;
  var d=digits(txt);
  if(d.length<8||d.length>13)return null;
  return d;
}
function phoneTarget(start){
  var cur=start;
  for(var i=0;cur&&i<2;i++,cur=cur.parentElement){
    var p=exactPhone(cur);if(p)return {node:cur,phone:p};
    if(cur&&cur.matches&&cur.matches('td,.k-card'))break;
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
  node.setAttribute('title','Copiado');node.style.color='#86efac';node.classList.add('tm-contact-copied');
  setTimeout(function(){node.classList.remove('tm-contact-copied');node.style.color=oldColor||'';if(oldTitle===null)node.removeAttribute('title');else node.setAttribute('title',oldTitle);},700);
}
function copyPhone(phone,node){
  function ok(){flash(node);try{if(typeof showToast==='function')showToast('Contato copiado');}catch(e){}}
  try{
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(phone).then(ok).catch(function(){fallbackCopy(phone);ok();});
    else{fallbackCopy(phone);ok();}
  }catch(e){fallbackCopy(phone);ok();}
}

document.addEventListener('click',function(ev){
  var hit=phoneTarget(ev.target);if(!hit)return;
  ev.preventDefault();ev.stopPropagation();copyPhone(hit.phone,hit.node);
},true);

/* Hover is evaluated only for the element under the pointer; there is no page scan. */
document.addEventListener('pointerover',function(ev){
  var hit=phoneTarget(ev.target);if(!hit)return;
  hit.node.classList.add('tm-visible-phone-copy');
},{passive:true});
document.addEventListener('pointerout',function(ev){
  var el=ev.target&&ev.target.closest&&ev.target.closest('.tm-visible-phone-copy');if(el)el.classList.remove('tm-visible-phone-copy');
},{passive:true});

var st=document.createElement('style');
st.textContent='.tm-visible-phone-copy{cursor:pointer;color:#86efac!important;text-decoration:underline;text-decoration-color:rgba(134,239,172,.4);text-underline-offset:2px}.tm-contact-copied{color:#86efac!important;text-shadow:0 0 12px rgba(134,239,172,.18)}';
document.head.appendChild(st);
})();

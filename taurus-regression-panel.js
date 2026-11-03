/* Taurus Magnum — Anti-Regressão command panel */
(function(){
'use strict';
if(window.__TM_REGRESSION_PANEL__)return;
window.__TM_REGRESSION_PANEL__=true;

const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let current=null,running=false;

function css(){
  if($('#tm-reg-style'))return;
  const s=document.createElement('style');s.id='tm-reg-style';s.textContent=`
#tm-reg-btn{border-color:rgba(52,211,153,.45)!important;color:#86efac!important}
#tm-reg-btn[data-state="failed"]{color:#fca5a5!important;border-color:rgba(248,113,113,.55)!important}
#tm-reg-btn[data-state="running"]{color:#93c5fd!important;border-color:rgba(96,165,250,.55)!important}
#tm-reg-overlay{position:fixed;inset:0;z-index:10050;background:rgba(2,6,23,.78);display:flex;align-items:center;justify-content:center;padding:24px}
#tm-reg-overlay.hidden{display:none}
.tm-reg-modal{width:min(1120px,96vw);max-height:92vh;background:#07111f;border:1px solid rgba(96,165,250,.28);border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.65);display:flex;flex-direction:column;overflow:hidden}
.tm-reg-head{padding:16px 18px;border-bottom:1px solid rgba(96,165,250,.16);display:flex;align-items:center;gap:12px}
.tm-reg-head h2{font-size:15px;margin:0;color:#e5eefc}.tm-reg-head p{font-size:11px;color:#7890ad;margin:2px 0 0}
.tm-reg-close{margin-left:auto;background:transparent;border:0;color:#7890ad;font-size:20px;cursor:pointer}
.tm-reg-actions{padding:12px 18px;border-bottom:1px solid rgba(96,165,250,.12);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tm-reg-action{height:34px;padding:0 12px;border-radius:8px;border:1px solid rgba(96,165,250,.26);background:#0d1b30;color:#d9e8ff;cursor:pointer;font-family:inherit}
.tm-reg-action.primary{background:#166534;border-color:#22c55e;color:#fff;font-weight:700}.tm-reg-action:disabled{opacity:.45;cursor:not-allowed}
.tm-reg-summary{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:8px;padding:12px 18px}
.tm-reg-stat{background:#0a1628;border:1px solid rgba(96,165,250,.12);border-radius:10px;padding:10px}.tm-reg-stat b{display:block;font-size:19px;color:#e5eefc}.tm-reg-stat span{font-size:10px;color:#7890ad}
.tm-reg-progress{height:4px;background:#10213a;margin:0 18px 10px;border-radius:4px;overflow:hidden}.tm-reg-progress i{display:block;height:100%;width:0;background:#60a5fa;transition:width .18s}
.tm-reg-body{overflow:auto;padding:0 18px 18px}
.tm-reg-cell{margin-top:10px;border:1px solid rgba(96,165,250,.12);border-radius:11px;overflow:hidden}.tm-reg-cell-h{background:#0b1729;padding:9px 11px;display:flex;align-items:center;gap:8px}.tm-reg-cell-h b{font-size:12px;color:#cfe3ff}.tm-reg-cell-h span{font-size:10px;color:#7890ad}.tm-reg-cell-h button{margin-left:auto}
.tm-reg-test{display:grid;grid-template-columns:24px minmax(220px,1fr) 90px minmax(180px,1fr);gap:8px;padding:7px 10px;border-top:1px solid rgba(96,165,250,.08);align-items:start;font-size:11px}
.tm-reg-test .name{color:#dbeafe}.tm-reg-test .meta,.tm-reg-test .detail{color:#7890ad;word-break:break-word}.tm-reg-pass{color:#86efac}.tm-reg-fail{color:#fca5a5}.tm-reg-skip{color:#fcd34d}.tm-reg-wait{color:#64748b}
.tm-reg-foot{padding:10px 18px;border-top:1px solid rgba(96,165,250,.12);font-size:10px;color:#7890ad;display:flex;justify-content:space-between;gap:10px}
@media(max-width:760px){.tm-reg-summary{grid-template-columns:repeat(2,1fr)}.tm-reg-test{grid-template-columns:22px 1fr}.tm-reg-test .meta,.tm-reg-test .detail{grid-column:2}}
`;document.head.appendChild(s);
}
function button(){
  const nav=$('.nav');if(!nav)return;
  if($('#tm-reg-btn'))return;
  const b=document.createElement('button');
  b.className='nav-btn';
  b.id='tm-reg-btn';
  b.title='Executar suíte completa Anti-Regressão';
  b.setAttribute('aria-label','Anti-Regressão');
  b.innerHTML='<i class="ti ti-shield-check"></i> Anti-Regressão';
  b.onclick=open;
  const anchor=$('#cfg-abas',nav)||$('#sessao-box',nav);
  if(anchor)nav.insertBefore(b,anchor);else nav.appendChild(b);
}
function ensure(){
  if($('#tm-reg-overlay'))return;
  const ov=document.createElement('div');ov.id='tm-reg-overlay';ov.className='hidden';ov.innerHTML=`
  <div class="tm-reg-modal">
    <div class="tm-reg-head"><i class="ti ti-shield-check" style="font-size:24px;color:#86efac"></i><div><h2>TAURUS · Anti-Regressão</h2><p>Cada pilar é uma célula isolada. Um clique valida o sistema inteiro e grava o relatório técnico.</p></div><button class="tm-reg-close" id="tm-reg-close">×</button></div>
    <div class="tm-reg-actions"><button class="tm-reg-action primary" id="tm-reg-run">▶ RODAR TODOS OS TESTES</button><button class="tm-reg-action" id="tm-reg-reset">Resetar ambiente de teste</button><button class="tm-reg-action" id="tm-reg-copy">Copiar relatório</button><span id="tm-reg-state" style="font-size:11px;color:#7890ad;margin-left:auto">pronto</span></div>
    <div class="tm-reg-summary"><div class="tm-reg-stat"><b id="tm-reg-total">0</b><span>testes</span></div><div class="tm-reg-stat"><b id="tm-reg-pass">0</b><span>passaram</span></div><div class="tm-reg-stat"><b id="tm-reg-fail">0</b><span>falharam</span></div><div class="tm-reg-stat"><b id="tm-reg-skip">0</b><span>ignorados</span></div><div class="tm-reg-stat"><b id="tm-reg-time">0s</b><span>duração</span></div></div>
    <div class="tm-reg-progress"><i id="tm-reg-progress"></i></div>
    <div class="tm-reg-body" id="tm-reg-body"></div>
    <div class="tm-reg-foot"><span>Modo padrão: seguro e não destrutivo.</span><span id="tm-reg-report-id">Relatório ainda não gravado</span></div>
  </div>`;
  document.body.appendChild(ov);
  $('#tm-reg-close').onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close()});
  $('#tm-reg-run').onclick=runAll;
  $('#tm-reg-reset').onclick=reset;
  $('#tm-reg-copy').onclick=copy;
  renderCatalog();
}
function api(){return window.TAURUS_REGRESSION}
function icon(status){return status==='passed'?'<span class="tm-reg-pass">●</span>':status==='failed'?'<span class="tm-reg-fail">●</span>':status==='skipped'?'<span class="tm-reg-skip">●</span>':'<span class="tm-reg-wait">○</span>'}
function renderCatalog(){
  const A=api();if(!A)return;
  const by={};A.list().forEach(t=>(by[t.cellId]||(by[t.cellId]=[])).push(t));
  $('#tm-reg-total').textContent=A.list().length;
  $('#tm-reg-body').innerHTML=A.cells().map(c=>`<section class="tm-reg-cell" data-cell="${esc(c.id)}"><div class="tm-reg-cell-h"><b>${esc(c.label)}</b><span>${esc(c.description||'')}</span><button class="tm-reg-action" data-run-cell="${esc(c.id)}">Rodar célula</button></div><div class="tm-reg-tests">${(by[c.id]||[]).map(t=>`<div class="tm-reg-test" data-key="${esc(t.key)}"><div data-icon>${icon('waiting')}</div><div class="name">${esc(t.label)}</div><div class="meta">${esc(t.severity||'critical')}</div><div class="detail">${esc(t.source||'aguardando')}</div></div>`).join('')}</div></section>`).join('');
  document.querySelectorAll('[data-run-cell]').forEach(b=>b.onclick=()=>runCell(b.dataset.runCell));
}
function setResult(r){
  const row=document.querySelector('[data-key="'+CSS.escape(r.key)+'"]');if(!row)return;
  row.querySelector('[data-icon]').innerHTML=icon(r.status);
  row.querySelector('.meta').textContent=(r.durationMs||0)+'ms · '+(r.severity||'');
  row.querySelector('.detail').textContent=r.status==='failed'?(r.error||'falhou'):(r.details||r.status);
}
function resetRows(cellId){
  document.querySelectorAll('.tm-reg-test').forEach(row=>{if(cellId&&row.closest('[data-cell]').dataset.cell!==cellId)return;row.querySelector('[data-icon]').innerHTML=icon('waiting');row.querySelector('.meta').textContent='aguardando';row.querySelector('.detail').textContent='aguardando'});
}
function lock(v){running=v;$('#tm-reg-run').disabled=v;$('#tm-reg-reset').disabled=v;document.querySelectorAll('[data-run-cell]').forEach(b=>b.disabled=v);const btn=$('#tm-reg-btn');if(btn)btn.dataset.state=v?'running':(current&&current.failed?'failed':'passed')}
async function execute(cellId){
  const A=api();if(!A||running)return;
  lock(true);resetRows(cellId);$('#tm-reg-state').textContent=cellId?'testando célula '+cellId+'…':'testando CRM inteiro…';$('#tm-reg-progress').style.width='0%';
  const report=await A.runAll({mode:'safe',cellId:cellId||null,onProgress:e=>{if(e.phase==='done'){setResult(e.result);$('#tm-reg-progress').style.width=Math.round(((e.index+1)/e.total)*100)+'%'}}});
  current=report;
  $('#tm-reg-total').textContent=report.total;$('#tm-reg-pass').textContent=report.passed;$('#tm-reg-fail').textContent=report.failed;$('#tm-reg-skip').textContent=report.skipped;$('#tm-reg-time').textContent=(report.durationMs/1000).toFixed(1)+'s';
  $('#tm-reg-state').textContent=report.failed?'❌ REGRESSÃO DETECTADA':'✅ SUÍTE VERDE';
  $('#tm-reg-report-id').textContent=report.persistence&&report.persistence.ok?'Relatório '+report.persistence.id:'Relatório local · '+(report.persistence&&report.persistence.error||'não persistido');
  lock(false);
}
function runAll(){return execute(null)} function runCell(id){return execute(id)}
function reset(){const r=api().resetTestState();current=null;resetRows();$('#tm-reg-pass').textContent='0';$('#tm-reg-fail').textContent='0';$('#tm-reg-skip').textContent='0';$('#tm-reg-state').textContent='ambiente de teste resetado';$('#tm-reg-report-id').textContent='Reset seguro · '+r.removed.length+' fixture(s) removida(s)'}
async function copy(){const r=current||api().last();if(!r){$('#tm-reg-state').textContent='rode a suíte primeiro';return}const txt=JSON.stringify(r,null,2);try{await navigator.clipboard.writeText(txt);$('#tm-reg-state').textContent='relatório copiado'}catch(_e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();$('#tm-reg-state').textContent='relatório copiado'}}
function open(){ensure();renderCatalog();$('#tm-reg-overlay').classList.remove('hidden')}function close(){if(!running)$('#tm-reg-overlay').classList.add('hidden')}
function boot(){css();button();ensure();setTimeout(button,500);const mo=new MutationObserver(button);mo.observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
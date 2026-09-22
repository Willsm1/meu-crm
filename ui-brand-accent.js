/* Taurus Magnum CRM — visual accent layer
 * Escopo: somente identidade visual. Nao altera dados, filtros, Supabase ou logica de negocio.
 * Referencia cromatica: verde suave inspirado na marca visual enviada pelo Will.
 */
(function(){
'use strict';
if(document.getElementById('tm-brand-accent-style'))return;
var s=document.createElement('style');
s.id='tm-brand-accent-style';
s.textContent=`
:root{
  --tm-green:#82bf87;
  --tm-green-bright:#91d19a;
  --tm-green-soft:rgba(130,191,135,.085);
  --tm-green-soft-2:rgba(130,191,135,.14);
  --tm-green-border:rgba(130,191,135,.30);
  --tm-green-border-hi:rgba(130,191,135,.50);
  --tm-green-glow:rgba(130,191,135,.12);
}

/* Campos: a base continua azul; verde aparece apenas no estado ativo. */
input:focus,
select:focus,
textarea:focus{
  border-color:var(--tm-green)!important;
  box-shadow:0 0 0 3px var(--tm-green-glow)!important;
}
.cb{accent-color:var(--tm-green)!important}

/* Acoes secundarias: o verde entra apenas no hover, sem substituir CTAs azuis. */
.btn:not(.btn-primary):hover,
.nav-btn:not(.primary):hover{
  border-color:var(--tm-green-border)!important;
}
.status-pick-btn:hover{
  border-color:var(--tm-green-border-hi)!important;
}

/* KPIs positivos: detalhe cromatico em Fechados e Receita. */
#page-leads .stats .stat:nth-child(3)::before,
#page-leads .stats .stat:nth-child(4)::before,
#dash-stats .stat:nth-child(3)::before,
#dash-stats .stat:nth-child(4)::before,
#rel-stats .stat:nth-child(3)::before,
#rel-stats .stat:nth-child(4)::before{
  background:linear-gradient(90deg,var(--blue-2) 0%,var(--tm-green) 100%)!important;
}
#page-leads .stats .stat:nth-child(3),
#page-leads .stats .stat:nth-child(4),
#dash-stats .stat:nth-child(3),
#dash-stats .stat:nth-child(4){
  border-color:rgba(130,191,135,.20)!important;
}

/* Dashboard: apenas Origem dos leads recebe moldura viva. */
#page-dashboard .dash-grid .dash-card:nth-child(2){
  border-color:var(--tm-green-border)!important;
  box-shadow:inset 0 1px 0 rgba(130,191,135,.08),0 0 0 1px rgba(130,191,135,.018);
}
#page-dashboard .dash-grid .dash-card:nth-child(2) .dash-title{
  color:#8fb79a!important;
}
#page-dashboard .dash-grid .dash-card:nth-child(2) .dash-title::before{
  content:'';
  display:inline-block;
  width:6px;
  height:6px;
  border-radius:50%;
  margin-right:8px;
  vertical-align:1px;
  background:var(--tm-green);
  box-shadow:0 0 0 3px rgba(130,191,135,.08);
}
#page-dashboard #origens .origem-bar-mini{
  background:linear-gradient(90deg,var(--blue-3) 0%,var(--tm-green) 100%)!important;
}
#page-dashboard #origens .origem-row:first-child .origem-bar-mini{
  background:linear-gradient(90deg,var(--tm-green) 0%,#c7c66f 100%)!important;
}

/* Kanban: um unico estagio ganha acento fixo; os demais recebem verde somente no hover. */
#page-kanban .k-col:nth-child(2){
  border-color:rgba(130,191,135,.24)!important;
  box-shadow:inset 0 2px 0 rgba(130,191,135,.66);
}
#page-kanban .k-card:hover{
  border-color:var(--tm-green-border-hi)!important;
  box-shadow:0 5px 16px rgba(0,0,0,.16),0 0 0 1px rgba(130,191,135,.035);
  transform:translateY(-1px);
}

/* Follow-up: mantem tabela azul; verde aparece apenas ao interagir. */
#page-followup #fu-tbody tr:hover td{
  background:var(--tm-green-soft)!important;
}

/* Estagio vindo da extensao: badge mais proprietario, sem mudar o valor. */
td[data-tm-estagio-col] .badge{
  background:rgba(130,191,135,.12)!important;
  color:#b7dfbd!important;
  border-color:var(--tm-green-border)!important;
}

/* Estados positivos usam o mesmo verde de identidade. */
.b-fechado,
.b-pronto{
  background:rgba(130,191,135,.13)!important;
  color:#b9e2bf!important;
  border-color:rgba(130,191,135,.34)!important;
}

/* Follow-up: busca deve obedecer ao tema escuro mesmo quando Chrome tenta autofill branco. */
html body #page-followup input#fu-busca{
  -webkit-appearance:none!important;
  appearance:none!important;
  color-scheme:dark!important;
  background:#080f1e!important;
  background-color:#080f1e!important;
  color:#e2e8f0!important;
  -webkit-text-fill-color:#e2e8f0!important;
  border:1px solid rgba(104,208,255,.52)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,234,254,.14),
    0 0 0 1px rgba(96,165,250,.055),
    0 7px 20px rgba(0,0,0,.15),
    0 0 24px rgba(47,174,255,.12)!important;
}
html body #page-followup input#fu-busca::placeholder{
  color:#60728d!important;
  opacity:1!important;
  -webkit-text-fill-color:#60728d!important;
}
html body #page-followup input#fu-busca:-webkit-autofill,
html body #page-followup input#fu-busca:-webkit-autofill:hover,
html body #page-followup input#fu-busca:-webkit-autofill:focus,
html body #page-followup input#fu-busca:-webkit-autofill:active{
  background:#080f1e!important;
  background-color:#080f1e!important;
  color:#e2e8f0!important;
  -webkit-text-fill-color:#e2e8f0!important;
  caret-color:#e2e8f0!important;
  -webkit-box-shadow:
    0 0 0 1000px #080f1e inset,
    0 0 0 1px rgba(96,165,250,.055),
    0 7px 20px rgba(0,0,0,.15),
    0 0 24px rgba(47,174,255,.12)!important;
  box-shadow:
    0 0 0 1000px #080f1e inset,
    0 0 0 1px rgba(96,165,250,.055),
    0 7px 20px rgba(0,0,0,.15),
    0 0 24px rgba(47,174,255,.12)!important;
}
html body #page-followup input#fu-busca:focus{
  border-color:rgba(145,209,154,.80)!important;
  background:#080f1e!important;
  color:#e2e8f0!important;
  -webkit-text-fill-color:#e2e8f0!important;
  box-shadow:
    inset 0 1px 0 rgba(219,244,224,.16),
    0 0 0 3px rgba(130,191,135,.16),
    0 0 0 1px rgba(145,209,154,.18),
    0 8px 22px rgba(0,0,0,.18),
    0 0 26px rgba(130,191,135,.12)!important;
}

/* Sem alterar logo, navegacao ativa ou azul estrutural. */
`;
document.head.appendChild(s);
})();

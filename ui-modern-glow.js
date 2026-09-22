/* Taurus Magnum CRM — modern depth / glow layer
 * Escopo: somente acabamento visual. Nao altera dados, filtros, layout estrutural ou Supabase.
 * Direcao: dark navy + blue glow vivo + accent green previamente aprovado.
 * Carteira permanece funcional/limpa; luz concentrada em contornos, campos e cards.
 */
(function(){
'use strict';
if(document.getElementById('tm-modern-glow-style'))return;
var s=document.createElement('style');
s.id='tm-modern-glow-style';
s.textContent=`
:root{
  --tm-edge-blue:rgba(96,165,250,.46);
  --tm-edge-blue-soft:rgba(59,130,246,.22);
  --tm-edge-blue-faint:rgba(96,165,250,.11);
  --tm-edge-blue-strong:rgba(104,208,255,.58);
  --tm-divider-blue:rgba(96,165,250,.18);
  --tm-deep-shadow:rgba(0,0,0,.25);
  --tm-card-glow:rgba(37,99,235,.13);
  --tm-outer-glow:rgba(47,174,255,.16);
  --tm-field-border:rgba(96,165,250,.46);
  --tm-field-border-hover:rgba(104,208,255,.64);
}

/* Cards principais: contorno bem mais vivo, sem clarear o fundo. */
.stat,
.dash-card,
#page-kanban .k-col,
#page-kanban .k-card{
  border-color:rgba(96,165,250,.34)!important;
  box-shadow:
    inset 1px 1px 0 rgba(191,219,254,.16),
    inset -1px -1px 0 rgba(30,64,175,.08),
    0 0 0 1px rgba(96,165,250,.07),
    0 11px 30px var(--tm-deep-shadow),
    0 0 28px var(--tm-card-glow),
    0 0 44px rgba(47,174,255,.055);
  background-image:
    radial-gradient(circle at 0 0,rgba(96,165,250,.10),transparent 20%),
    radial-gradient(circle at 100% 0,rgba(59,130,246,.08),transparent 18%),
    radial-gradient(circle at 100% 100%,rgba(30,64,175,.045),transparent 20%)!important;
}

.stat,
.dash-card,
#page-kanban .k-col{
  border-width:1px!important;
  backdrop-filter:saturate(110%);
}

/* KPIs. */
.stat{
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;
}
.stat:hover{
  border-color:var(--tm-edge-blue-strong)!important;
  box-shadow:
    inset 1px 1px 0 rgba(219,234,254,.22),
    inset -1px -1px 0 rgba(59,130,246,.10),
    0 0 0 1px rgba(104,208,255,.12),
    0 14px 36px rgba(0,0,0,.28),
    0 0 34px rgba(37,99,235,.18),
    0 0 50px rgba(47,174,255,.09);
  transform:translateY(-1px);
}

/* Dashboard. */
.dash-card{
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;
}
.dash-card:hover{
  border-color:rgba(104,208,255,.54)!important;
  box-shadow:
    inset 1px 1px 0 rgba(219,234,254,.20),
    inset -1px -1px 0 rgba(59,130,246,.09),
    0 0 0 1px rgba(96,165,250,.10),
    0 15px 38px rgba(0,0,0,.28),
    0 0 34px rgba(37,99,235,.16),
    0 0 48px rgba(47,174,255,.075);
  transform:translateY(-1px);
}
#page-dashboard .dash-grid .dash-card:nth-child(2){
  border-color:rgba(130,191,135,.48)!important;
  box-shadow:
    inset 1px 1px 0 rgba(183,223,189,.18),
    inset -1px -1px 0 rgba(130,191,135,.07),
    0 0 0 1px rgba(130,191,135,.07),
    0 14px 36px rgba(0,0,0,.27),
    0 0 32px rgba(130,191,135,.12)!important;
}

/* CARTEIRA / TABELAS: borda externa e divisorias mais vivas; corpo continua limpo. */
.table-wrap{
  background:var(--bg-card)!important;
  background-image:none!important;
  border:1px solid rgba(96,165,250,.34)!important;
  box-shadow:
    inset 0 1px 0 rgba(191,219,254,.08),
    0 0 0 1px rgba(96,165,250,.045),
    0 8px 24px rgba(0,0,0,.18),
    0 0 24px rgba(37,99,235,.085)!important;
}
.table-wrap table{
  background:transparent!important;
}
.table-wrap th{
  background:var(--bg-surface)!important;
  background-image:none!important;
  border-bottom:1px solid rgba(104,208,255,.34)!important;
  box-shadow:
    inset 0 1px 0 rgba(191,219,254,.07),
    inset 0 -1px 0 rgba(59,130,246,.08)!important;
}
.table-wrap tbody tr{
  background:transparent!important;
}
.table-wrap tbody td{
  background:transparent!important;
  background-image:none!important;
  border-bottom:1px solid rgba(96,165,250,.145)!important;
  box-shadow:none!important;
}
.table-wrap tbody tr:last-child td{
  border-bottom:none!important;
}

/* Zebra suave: alterna dois azuis proximos para separar contatos sem listras fortes. */
.table-wrap tbody tr:not(.tr-selected):nth-child(odd) td{
  background-color:rgba(27,57,96,.24)!important;
}
.table-wrap tbody tr:not(.tr-selected):nth-child(even) td{
  background-color:rgba(12,31,58,.16)!important;
}
.table-wrap tbody tr:hover td{
  background-color:rgba(59,130,246,.085)!important;
  box-shadow:inset 0 1px 0 rgba(147,197,253,.035)!important;
}

/* Contraste seletivo na Carteira: somente os campos marcados pelo usuario.
   1 checkbox | 2 nome | 3 equipe | 4 responsavel | 5 contato | 6 status | 7 valor
   8 data | 9 origem | 10 perfil | 11 estagio | 12 regiao | 13 anotacao | 14 acoes */
.table-wrap tbody td:nth-child(3),
.table-wrap tbody td:nth-child(4),
.table-wrap tbody td:nth-child(5),
.table-wrap tbody td:nth-child(8),
.table-wrap tbody td:nth-child(9),
.table-wrap tbody td:nth-child(10),
.table-wrap tbody td:nth-child(11),
.table-wrap tbody td:nth-child(12),
.table-wrap tbody td:nth-child(13){
  color:#d6e2f0!important;
}
.table-wrap tbody td:nth-child(13) .icon-btn,
.table-wrap tbody td:nth-child(13) i,
.table-wrap tbody td:nth-child(13) svg{
  color:#cbd8e8!important;
  opacity:.92;
}

/* Follow-up: mesma linguagem de contorno mais vivo, sem halo no corpo da tabela. */
#page-followup .container>div[style*="overflow-x:auto"]{
  background:var(--bg-card)!important;
  border:1px solid rgba(96,165,250,.34)!important;
  border-radius:10px;
  box-shadow:
    inset 0 1px 0 rgba(191,219,254,.07),
    0 0 0 1px rgba(96,165,250,.04),
    0 8px 24px rgba(0,0,0,.17),
    0 0 22px rgba(37,99,235,.075)!important;
}
#page-followup th{
  background:var(--bg-surface)!important;
  border-bottom:1px solid rgba(104,208,255,.30)!important;
  box-shadow:inset 0 1px 0 rgba(191,219,254,.055)!important;
}
#page-followup #fu-tbody td{
  border-bottom:1px solid rgba(96,165,250,.13)!important;
  box-shadow:none!important;
}

/* Kanban: glow vivo onde os cards comportam profundidade. */
#page-kanban .k-col{
  box-shadow:
    inset 1px 1px 0 rgba(191,219,254,.14),
    inset -1px -1px 0 rgba(30,64,175,.065),
    0 0 0 1px rgba(96,165,250,.05),
    0 10px 30px rgba(0,0,0,.23),
    0 0 28px rgba(37,99,235,.095);
}
#page-kanban .k-card{
  border-color:rgba(96,165,250,.30)!important;
  box-shadow:
    inset 1px 1px 0 rgba(191,219,254,.12),
    0 0 0 1px rgba(96,165,250,.035),
    0 7px 20px rgba(0,0,0,.17),
    0 0 18px rgba(37,99,235,.07);
}
#page-kanban .k-card:hover{
  border-color:rgba(130,191,135,.56)!important;
  box-shadow:
    inset 1px 1px 0 rgba(183,223,189,.16),
    0 0 0 1px rgba(130,191,135,.08),
    0 10px 26px rgba(0,0,0,.23),
    0 0 26px rgba(130,191,135,.11)!important;
}

/* CAMPOS: borda clara + glow perceptivel. */
input[type=text],
input[type=email],
input[type=number],
input[type=date],
select,
textarea{
  background-color:var(--bg-input)!important;
  border-color:var(--tm-field-border)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,234,254,.11),
    inset 0 -1px 0 rgba(30,64,175,.055),
    0 0 0 1px rgba(96,165,250,.035),
    0 6px 17px rgba(0,0,0,.14),
    0 0 20px rgba(37,99,235,.085)!important;
  transition:border-color .15s ease,box-shadow .15s ease,background-color .15s ease;
}
input[type=text]:hover,
input[type=email]:hover,
input[type=number]:hover,
input[type=date]:hover,
select:hover,
textarea:hover{
  border-color:var(--tm-field-border-hover)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,234,254,.15),
    0 0 0 1px rgba(104,208,255,.08),
    0 6px 18px rgba(0,0,0,.16),
    0 0 24px rgba(47,174,255,.13)!important;
}
input::placeholder,
textarea::placeholder{
  color:#60728d!important;
}

/* Busca e filtros: pontos de interacao recebem a maior intensidade azul. */
#search-leads,
#search-notas,
#search-regiao,
#filterStatus,
#filterPerfil,
#filterOrigem,
#fu-busca,
#fu-prio,
#fu-resp{
  border-color:rgba(104,208,255,.52)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,234,254,.14),
    0 0 0 1px rgba(96,165,250,.055),
    0 7px 20px rgba(0,0,0,.15),
    0 0 24px rgba(47,174,255,.12)!important;
}

/* Evita autofill branco do Chrome. */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
select:-webkit-autofill{
  -webkit-text-fill-color:var(--text-primary)!important;
  -webkit-box-shadow:0 0 0 1000px var(--bg-input) inset!important;
  caret-color:var(--text-primary)!important;
  border-color:var(--tm-field-border)!important;
  transition:background-color 9999s ease-out 0s;
}

input:focus,
select:focus,
textarea:focus{
  border-color:rgba(145,209,154,.80)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,244,224,.16),
    0 0 0 3px rgba(130,191,135,.16),
    0 0 0 1px rgba(145,209,154,.18),
    0 8px 22px rgba(0,0,0,.18),
    0 0 26px rgba(130,191,135,.12)!important;
}

/* Botoes: borda mais perceptivel, CTAs continuam azuis. */
.btn,
.nav-btn{
  border-color:rgba(96,165,250,.34)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,234,254,.09),
    0 0 0 1px rgba(96,165,250,.025),
    0 4px 13px rgba(0,0,0,.11),
    0 0 14px rgba(37,99,235,.05);
}
.btn-primary,
.nav-btn.primary{
  border-color:rgba(96,165,250,.48)!important;
  box-shadow:
    inset 0 1px 0 rgba(219,234,254,.20),
    0 0 0 1px rgba(96,165,250,.06),
    0 7px 20px rgba(29,78,216,.18),
    0 0 22px rgba(37,99,235,.12);
}

/* Navegacao: linha luminosa discreta nos limites, sem mudar logo ou cor base. */
.nav{
  box-shadow:
    0 8px 24px rgba(0,0,0,.16),
    inset 0 -1px 0 rgba(104,208,255,.14),
    0 1px 0 rgba(96,165,250,.05);
}
.actionbar{
  box-shadow:
    0 8px 20px rgba(0,0,0,.09),
    inset 0 -1px 0 rgba(104,208,255,.11),
    0 1px 0 rgba(96,165,250,.04);
}

@media (prefers-reduced-motion:reduce){
  .stat,.dash-card,#page-kanban .k-card{transition:none!important;transform:none!important}
}
`;
document.head.appendChild(s);
})();

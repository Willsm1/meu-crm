/* Taurus Magnum CRM — modern depth / glow layer
 * Escopo: somente acabamento visual. Nao altera dados, filtros, layout estrutural ou Supabase.
 * Direcao: dark navy + blue glow discreto + accent green previamente aprovado.
 * Carteira permanece funcional/limpa; luz concentrada em campos e cards.
 */
(function(){
'use strict';
if(document.getElementById('tm-modern-glow-style'))return;
var s=document.createElement('style');
s.id='tm-modern-glow-style';
s.textContent=`
:root{
  --tm-edge-blue:rgba(96,165,250,.28);
  --tm-edge-blue-soft:rgba(59,130,246,.12);
  --tm-edge-blue-faint:rgba(96,165,250,.055);
  --tm-deep-shadow:rgba(0,0,0,.24);
  --tm-card-glow:rgba(37,99,235,.055);
  --tm-field-border:rgba(96,165,250,.28);
  --tm-field-border-hover:rgba(96,165,250,.40);
}

/* Cards principais: profundidade moderna, sem invadir areas densas de dados. */
.stat,
.dash-card,
#page-kanban .k-col,
#page-kanban .k-card{
  border-color:rgba(96,165,250,.18)!important;
  box-shadow:
    inset 1px 1px 0 rgba(147,197,253,.10),
    inset -1px -1px 0 rgba(30,64,175,.045),
    0 10px 28px var(--tm-deep-shadow),
    0 0 24px var(--tm-card-glow);
  background-image:
    radial-gradient(circle at 0 0,rgba(96,165,250,.085),transparent 19%),
    radial-gradient(circle at 100% 0,rgba(59,130,246,.065),transparent 18%),
    radial-gradient(circle at 100% 100%,rgba(30,64,175,.038),transparent 20%)!important;
}

.stat,
.dash-card,
#page-kanban .k-col{
  border-width:1px!important;
  backdrop-filter:saturate(108%);
}

/* KPIs. */
.stat{
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;
}
.stat:hover{
  border-color:rgba(96,165,250,.30)!important;
  box-shadow:
    inset 1px 1px 0 rgba(191,219,254,.15),
    inset -1px -1px 0 rgba(59,130,246,.07),
    0 14px 34px rgba(0,0,0,.27),
    0 0 30px rgba(37,99,235,.085);
  transform:translateY(-1px);
}

/* Dashboard. */
.dash-card{
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;
}
.dash-card:hover{
  border-color:rgba(96,165,250,.29)!important;
  box-shadow:
    inset 1px 1px 0 rgba(191,219,254,.13),
    inset -1px -1px 0 rgba(59,130,246,.055),
    0 15px 36px rgba(0,0,0,.27),
    0 0 32px rgba(37,99,235,.075);
  transform:translateY(-1px);
}
#page-dashboard .dash-grid .dash-card:nth-child(2){
  box-shadow:
    inset 1px 1px 0 rgba(183,223,189,.13),
    inset -1px -1px 0 rgba(130,191,135,.045),
    0 14px 34px rgba(0,0,0,.26),
    0 0 28px rgba(130,191,135,.065)!important;
}

/* CARTEIRA / TABELAS: leitura limpa. Sem halo, sem gradiente sobre o corpo. */
.table-wrap{
  background:var(--bg-card)!important;
  background-image:none!important;
  border:1px solid rgba(96,165,250,.16)!important;
  box-shadow:0 8px 22px rgba(0,0,0,.16)!important;
}
.table-wrap table{
  background:transparent!important;
}
.table-wrap th{
  background:var(--bg-surface)!important;
  background-image:none!important;
  border-bottom:1px solid rgba(96,165,250,.20)!important;
  box-shadow:inset 0 -1px 0 rgba(0,0,0,.14)!important;
}
.table-wrap tbody tr{
  background:transparent!important;
}
.table-wrap tbody td{
  background:transparent!important;
  background-image:none!important;
  border-bottom:1px solid rgba(96,165,250,.095)!important;
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
  background-color:rgba(59,130,246,.075)!important;
  box-shadow:inset 0 1px 0 rgba(147,197,253,.03)!important;
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

/* Follow-up segue a mesma logica de tabela funcional. */
#page-followup .container>div[style*="overflow-x:auto"]{
  background:var(--bg-card)!important;
  border:1px solid rgba(96,165,250,.15)!important;
  border-radius:10px;
  box-shadow:0 8px 22px rgba(0,0,0,.14)!important;
}
#page-followup th{
  background:var(--bg-surface)!important;
  border-bottom:1px solid rgba(96,165,250,.18)!important;
  box-shadow:none!important;
}
#page-followup #fu-tbody td{
  border-bottom:1px solid rgba(96,165,250,.085)!important;
  box-shadow:none!important;
}

/* Kanban: profundidade continua nos cards, onde funciona bem. */
#page-kanban .k-col{
  box-shadow:
    inset 1px 1px 0 rgba(147,197,253,.085),
    inset -1px -1px 0 rgba(30,64,175,.04),
    0 10px 28px rgba(0,0,0,.22),
    0 0 22px rgba(37,99,235,.045);
}
#page-kanban .k-card{
  border-color:rgba(96,165,250,.16)!important;
  box-shadow:
    inset 1px 1px 0 rgba(147,197,253,.075),
    0 7px 18px rgba(0,0,0,.16),
    0 0 14px rgba(37,99,235,.03);
}
#page-kanban .k-card:hover{
  box-shadow:
    inset 1px 1px 0 rgba(183,223,189,.12),
    0 10px 24px rgba(0,0,0,.22),
    0 0 22px rgba(130,191,135,.065)!important;
}

/* CAMPOS: aqui fica a maior parte da luz. */
input[type=text],
input[type=email],
input[type=number],
input[type=date],
select,
textarea{
  background-color:var(--bg-input)!important;
  border-color:var(--tm-field-border)!important;
  box-shadow:
    inset 0 1px 0 rgba(191,219,254,.075),
    inset 0 -1px 0 rgba(30,64,175,.035),
    0 5px 15px rgba(0,0,0,.13),
    0 0 14px rgba(37,99,235,.028)!important;
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
    inset 0 1px 0 rgba(191,219,254,.10),
    0 5px 16px rgba(0,0,0,.15),
    0 0 18px rgba(37,99,235,.045)!important;
}
input::placeholder,
textarea::placeholder{
  color:#60728d!important;
}

/* Busca e filtros: um pouco mais de presenca sem clarear o fundo do CRM. */
#search-leads,
#search-notas,
#search-regiao,
#filterStatus,
#filterPerfil,
#filterOrigem,
#fu-busca,
#fu-prio,
#fu-resp{
  border-color:rgba(96,165,250,.32)!important;
  box-shadow:
    inset 0 1px 0 rgba(191,219,254,.09),
    0 6px 18px rgba(0,0,0,.14),
    0 0 16px rgba(37,99,235,.04)!important;
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
  border-color:var(--tm-green)!important;
  box-shadow:
    inset 0 1px 0 rgba(183,223,189,.10),
    0 0 0 3px var(--tm-green-glow),
    0 7px 20px rgba(0,0,0,.17),
    0 0 20px rgba(130,191,135,.045)!important;
}

/* Botoes: micro-luz apenas. */
.btn,
.nav-btn{
  box-shadow:inset 0 1px 0 rgba(191,219,254,.055),0 4px 12px rgba(0,0,0,.10);
}
.btn-primary,
.nav-btn.primary{
  box-shadow:inset 0 1px 0 rgba(191,219,254,.15),0 6px 18px rgba(29,78,216,.16);
}

/* Navegacao: profundidade discreta; logo e cores estruturais intactos. */
.nav{
  box-shadow:0 8px 24px rgba(0,0,0,.15),inset 0 -1px 0 rgba(96,165,250,.045);
}
.actionbar{
  box-shadow:0 8px 20px rgba(0,0,0,.08),inset 0 -1px 0 rgba(96,165,250,.035);
}

@media (prefers-reduced-motion:reduce){
  .stat,.dash-card,#page-kanban .k-card{transition:none!important;transform:none!important}
}
`;
document.head.appendChild(s);
})();

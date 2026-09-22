/* Taurus Magnum CRM — modern depth / glow layer
 * Escopo: somente acabamento visual. Nao altera dados, filtros, layout estrutural ou Supabase.
 * Direcao: dark navy + blue glow discreto + accent green previamente aprovado.
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
}

/* Blocos principais: mais profundidade sem mudar a paleta. */
.stat,
.dash-card,
.table-wrap,
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

/* Os cards maiores ganham contorno mais limpo, quase "vidro escuro". */
.stat,
.dash-card,
.table-wrap,
#page-kanban .k-col{
  border-width:1px!important;
  backdrop-filter:saturate(108%);
}

/* KPIs: brilho discreto nos quatro cantos, sem alterar a barra superior existente. */
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

/* Dashboard: cards mais "produto", mantendo o verde especial do bloco Origem. */
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

/* Tabela principal e Follow-up: acabamento luminoso só na moldura. */
.table-wrap,
#page-followup .container>div[style*="overflow-x:auto"]{
  box-shadow:
    inset 1px 1px 0 rgba(147,197,253,.10),
    inset -1px -1px 0 rgba(59,130,246,.04),
    0 10px 26px rgba(0,0,0,.20),
    0 0 20px rgba(37,99,235,.045);
}
th{
  box-shadow:inset 0 1px 0 rgba(147,197,253,.055);
}

/* Kanban: colunas e cards deixam de parecer blocos chapados. */
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

/* Campos: dark input permanente; elimina o branco do autofill do Chrome. */
input[type=text],
input[type=email],
input[type=number],
input[type=date],
select,
textarea{
  box-shadow:
    inset 1px 1px 0 rgba(147,197,253,.045),
    0 4px 12px rgba(0,0,0,.10);
  transition:border-color .15s ease,box-shadow .15s ease,background-color .15s ease;
}
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
select:-webkit-autofill{
  -webkit-text-fill-color:var(--text-primary)!important;
  -webkit-box-shadow:0 0 0 1000px var(--bg-input) inset!important;
  caret-color:var(--text-primary)!important;
  border-color:var(--border-md)!important;
  transition:background-color 9999s ease-out 0s;
}
input:focus,
select:focus,
textarea:focus{
  box-shadow:
    inset 1px 1px 0 rgba(183,223,189,.08),
    0 0 0 3px var(--tm-green-glow),
    0 6px 18px rgba(0,0,0,.16)!important;
}

/* Botoes e selects ganham micro-luz de borda; CTAs continuam azuis. */
.btn,
.nav-btn{
  box-shadow:inset 0 1px 0 rgba(191,219,254,.055),0 4px 12px rgba(0,0,0,.10);
}
.btn-primary,
.nav-btn.primary{
  box-shadow:inset 0 1px 0 rgba(191,219,254,.15),0 6px 18px rgba(29,78,216,.16);
}

/* Navegacao: apenas profundidade, sem trocar cor ou logo. */
.nav{
  box-shadow:0 8px 24px rgba(0,0,0,.15),inset 0 -1px 0 rgba(96,165,250,.045);
}
.actionbar{
  box-shadow:0 8px 20px rgba(0,0,0,.08),inset 0 -1px 0 rgba(96,165,250,.035);
}

/* Respeita preferencias de movimento. */
@media (prefers-reduced-motion:reduce){
  .stat,.dash-card,#page-kanban .k-card{transition:none!important;transform:none!important}
}
`;
document.head.appendChild(s);
})();

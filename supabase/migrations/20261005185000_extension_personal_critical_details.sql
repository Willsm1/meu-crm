-- Taurus Magnum extension 2.0.48.16
-- Retorna detalhes do lead visível sem expor a flag crítica global.
-- O estado crítico exibido pela extensão passa a ser pessoal por auth.uid().

create or replace function crm.extension_lead_details(p_lead_id uuid)
returns table(
  perfil_produto text,
  valor numeric,
  is_critical boolean,
  critical_since timestamptz
)
language sql
security definer
set search_path=''
as $function$
  select
    l.perfil_produto,
    l.valor,
    coalesce(a.is_active,false) as is_critical,
    case when coalesce(a.is_active,false) then a.created_at else null end as critical_since
  from crm.leads l
  left join crm.lead_critical_alerts a
    on a.lead_id=l.id
   and a.user_id=(select auth.uid())
  where l.id=p_lead_id
    and l.deleted_at is null
    and crm.can_see_lead(l.id)
  limit 1;
$function$;

revoke all on function crm.extension_lead_details(uuid) from public;
grant execute on function crm.extension_lead_details(uuid) to authenticated;

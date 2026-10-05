-- Taurus Magnum: leitura robusta do alerta crítico pessoal por lead.
-- Mantém isolamento RLS por usuário e evita regressão visual após marcar crítico.

grant select on table crm.lead_critical_alerts to authenticated;

create or replace function crm.my_critical_alert_state(p_lead_id uuid)
returns table(
  is_active boolean,
  alert_since timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path=''
as $function$
  select
    coalesce(a.is_active,false) as is_active,
    a.created_at as alert_since,
    a.updated_at
  from crm.lead_critical_alerts a
  where a.user_id=(select auth.uid())
    and a.lead_id=p_lead_id
  union all
  select false,null::timestamptz,null::timestamptz
  where not exists (
    select 1
    from crm.lead_critical_alerts a
    where a.user_id=(select auth.uid())
      and a.lead_id=p_lead_id
  )
  limit 1;
$function$;

revoke all on function crm.my_critical_alert_state(uuid) from public;
grant execute on function crm.my_critical_alert_state(uuid) to authenticated;

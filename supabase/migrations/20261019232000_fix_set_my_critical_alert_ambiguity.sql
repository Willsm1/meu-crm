create or replace function crm.set_my_critical_alert(p_lead_id uuid, p_is_active boolean)
returns table(resultado text, lead_id uuid, is_active boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_me uuid := auth.uid();
  v_org uuid;
  v_now timestamptz := clock_timestamp();
begin
  if v_me is null then
    raise exception 'set_my_critical_alert: sem usuario autenticado' using errcode='42501';
  end if;
  if p_lead_id is null or p_is_active is null then
    raise exception 'set_my_critical_alert: parametros obrigatorios ausentes' using errcode='22023';
  end if;

  select p.organization_id into v_org
  from crm.profiles p
  join crm.organizations o on o.id=p.organization_id and o.is_active
  where p.id=v_me and p.is_active;

  if v_org is null then
    raise exception 'set_my_critical_alert: perfil inativo' using errcode='42501';
  end if;

  if not crm.can_see_lead(p_lead_id) then
    raise exception 'set_my_critical_alert: lead sem permissao' using errcode='42501';
  end if;

  if not exists (
    select 1
    from crm.leads l
    where l.id=p_lead_id
      and l.organization_id=v_org
      and l.deleted_at is null
  ) then
    raise exception 'set_my_critical_alert: lead nao encontrado' using errcode='P0002';
  end if;

  insert into crm.lead_critical_alerts as a
    (organization_id,lead_id,user_id,is_active,created_at,updated_at)
  values
    (v_org,p_lead_id,v_me,p_is_active,v_now,v_now)
  on conflict on constraint lead_critical_alerts_user_id_lead_id_key
  do update
    set is_active=excluded.is_active,
        updated_at=excluded.updated_at;

  return query
  select
    'atualizado'::text,
    a.lead_id,
    a.is_active,
    a.updated_at
  from crm.lead_critical_alerts a
  where a.user_id=v_me
    and a.lead_id=p_lead_id;
end
$function$;

revoke all on function crm.set_my_critical_alert(uuid,boolean) from public;
grant execute on function crm.set_my_critical_alert(uuid,boolean) to authenticated;

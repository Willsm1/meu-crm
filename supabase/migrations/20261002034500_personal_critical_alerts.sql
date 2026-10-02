-- Taurus Magnum: alertas críticos pessoais por usuário
-- Adiciona nova camada sem alterar a flag legado crm.leads.is_critical.

create table if not exists crm.lead_critical_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm.organizations(id) on delete cascade,
  lead_id uuid not null references crm.leads(id) on delete cascade,
  user_id uuid not null references crm.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lead_id)
);

create index if not exists lead_critical_alerts_user_active_idx
  on crm.lead_critical_alerts(user_id, is_active, updated_at desc);

alter table crm.lead_critical_alerts enable row level security;

drop policy if exists lead_critical_alerts_select_own on crm.lead_critical_alerts;
create policy lead_critical_alerts_select_own
  on crm.lead_critical_alerts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists lead_critical_alerts_insert_own on crm.lead_critical_alerts;
create policy lead_critical_alerts_insert_own
  on crm.lead_critical_alerts
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists lead_critical_alerts_update_own on crm.lead_critical_alerts;
create policy lead_critical_alerts_update_own
  on crm.lead_critical_alerts
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

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
    select 1 from crm.leads l
    where l.id=p_lead_id and l.organization_id=v_org and l.deleted_at is null
  ) then
    raise exception 'set_my_critical_alert: lead nao encontrado' using errcode='P0002';
  end if;

  insert into crm.lead_critical_alerts as a
    (organization_id, lead_id, user_id, is_active, created_at, updated_at)
  values
    (v_org, p_lead_id, v_me, p_is_active, v_now, v_now)
  on conflict (user_id, lead_id)
  do update set is_active=excluded.is_active, updated_at=excluded.updated_at;

  return query
  select 'atualizado'::text, a.lead_id, a.is_active, a.updated_at
  from crm.lead_critical_alerts a
  where a.user_id=v_me and a.lead_id=p_lead_id;
end
$function$;

create or replace function crm.my_critical_alerts()
returns table(
  lead_id uuid,
  nome text,
  telefone text,
  status crm.lead_status,
  is_active boolean,
  alert_since timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path=''
as $function$
  with me as (
    select p.id, p.organization_id
    from crm.profiles p
    join crm.organizations o on o.id=p.organization_id and o.is_active
    where p.id=(select auth.uid()) and p.is_active
  )
  select l.id, l.nome, l.telefone, l.status,
         a.is_active, a.created_at, a.updated_at
  from crm.lead_critical_alerts a
  join me on me.id=a.user_id and me.organization_id=a.organization_id
  join crm.leads l on l.id=a.lead_id and l.organization_id=a.organization_id
  where a.is_active=true
    and l.deleted_at is null
    and crm.can_see_lead(l.id)
  order by a.updated_at desc, l.nome asc;
$function$;

revoke all on function crm.set_my_critical_alert(uuid,boolean) from public;
grant execute on function crm.set_my_critical_alert(uuid,boolean) to authenticated;
revoke all on function crm.my_critical_alerts() from public;
grant execute on function crm.my_critical_alerts() to authenticated;

-- Compatibilidade: preserva os alertas críticos atuais para quem efetivamente os marcou.
-- Não replica esses alertas para outros usuários da organização.
with latest_actor as (
  select distinct on (sh.lead_id)
         sh.lead_id, sh.organization_id, sh.changed_by, sh.changed_at
  from crm.status_history sh
  join crm.leads l on l.id=sh.lead_id
  where sh.is_critical_to=true
    and l.is_critical=true
    and l.deleted_at is null
    and sh.changed_by is not null
  order by sh.lead_id, sh.changed_at desc
)
insert into crm.lead_critical_alerts
  (organization_id, lead_id, user_id, is_active, created_at, updated_at)
select la.organization_id, la.lead_id, la.changed_by, true, la.changed_at, la.changed_at
from latest_actor la
join crm.profiles p on p.id=la.changed_by and p.organization_id=la.organization_id and p.is_active
on conflict (user_id, lead_id) do nothing;

-- Taurus Magnum — isolate WhatsApp ingestion by the owner of the connected session.
-- A WhatsApp session owned by user A must never write into a lead assigned to user B.

create or replace function crm.whatsapp_gateway_ingest_event(
  p_user_id uuid,
  p_session_id text,
  p_message_id text,
  p_direction text,
  p_contact_phone text,
  p_message_type text,
  p_message_text text,
  p_message_timestamp timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_ids uuid[];
  v_count int;
  v_org_count int;
  v_lead uuid;
  v_event_id uuid;
  v_interaction_id uuid;
  v_phone text := regexp_replace(coalesce(p_contact_phone,''),'\D','','g');
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select organization_id into v_org from crm.profiles where id=p_user_id limit 1;
  if v_org is null then raise exception 'profile context unavailable'; end if;
  if p_direction not in ('inbound','outbound') then raise exception 'invalid direction'; end if;
  if coalesce(p_session_id,'')='' or coalesce(p_message_id,'')='' or v_phone='' then raise exception 'missing whatsapp event identity'; end if;

  -- Match only leads actively assigned to the owner of this WhatsApp session.
  select array_agg(x.id order by x.id), count(*)::int into v_ids,v_count
  from (
    select distinct l.id
    from crm.leads l
    join crm.lead_assignments a
      on a.organization_id=l.organization_id
     and a.lead_id=l.id
     and a.unassigned_at is null
     and a.user_id=p_user_id
    where l.organization_id=v_org and l.deleted_at is null and (
      regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone,''),'\D','','g')=v_phone
      or (length(v_phone) in (10,11) and regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')='55'||v_phone)
      or (length(v_phone) in (12,13) and left(v_phone,2)='55' and regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=substring(v_phone from 3))
    )
  ) x;

  if v_count=0 then
    -- Distinguish an unknown phone from a phone that belongs to another executive.
    select count(*)::int into v_org_count
    from crm.leads l
    where l.organization_id=v_org and l.deleted_at is null and (
      regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone,''),'\D','','g')=v_phone
      or (length(v_phone) in (10,11) and regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')='55'||v_phone)
      or (length(v_phone) in (12,13) and left(v_phone,2)='55' and regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=substring(v_phone from 3))
    );
    if v_org_count>0 then
      return jsonb_build_object('status','owner_mismatch','written',false);
    end if;
    return jsonb_build_object('status','not_found','written',false);
  elsif v_count=1 then
    v_lead:=v_ids[1];
    insert into crm.whatsapp_conversation_events(
      organization_id,lead_id,session_id,message_id,direction,contact_phone,message_type,message_text,message_timestamp
    ) values (
      v_org,v_lead,p_session_id,p_message_id,p_direction,v_phone,p_message_type,left(p_message_text,8000),p_message_timestamp
    ) on conflict (organization_id,session_id,message_id) do nothing returning id into v_event_id;

    insert into crm.interactions(
      organization_id,lead_id,user_id,event_type,direction,source,occurred_at,external_id,dedupe_key,metadata
    ) values (
      v_org,v_lead,p_user_id,'message'::crm.interaction_type,p_direction::crm.interaction_direction,
      'whatsapp_live'::crm.interaction_source,p_message_timestamp,p_message_id,
      'wa:'||p_session_id||':'||p_message_id,
      jsonb_build_object('captured_by','taurus_whatsapp_gateway','session_id',p_session_id,'message_type',p_message_type,'contact_phone',v_phone,'message_text',left(coalesce(p_message_text,''),8000))
    ) on conflict (organization_id,lead_id,dedupe_key) do nothing returning id into v_interaction_id;

    return jsonb_build_object('status','matched','written',true,'lead_id',v_lead,'conversation_event_inserted',v_event_id is not null,'interaction_inserted',v_interaction_id is not null);
  else
    insert into crm.whatsapp_identity_pending(
      organization_id,session_id,message_id,direction,contact_phone,message_type,message_text,message_timestamp,candidate_lead_ids,candidate_count
    ) values (
      v_org,p_session_id,p_message_id,p_direction,v_phone,p_message_type,left(p_message_text,8000),p_message_timestamp,coalesce(v_ids,'{}'),v_count
    ) on conflict (organization_id,session_id,message_id) do update set
      candidate_lead_ids=excluded.candidate_lead_ids,candidate_count=excluded.candidate_count,message_text=excluded.message_text,message_type=excluded.message_type,message_timestamp=excluded.message_timestamp;
    return jsonb_build_object('status','ambiguous','written',true,'candidate_count',v_count);
  end if;
end
$$;

create or replace function public.whatsapp_ingest_event(
  p_session_id text,
  p_message_id text,
  p_direction text,
  p_contact_phone text,
  p_message_type text,
  p_message_text text,
  p_message_timestamp timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = 'crm', 'public'
as $$
declare
  v_org uuid;
  v_ids uuid[];
  v_count int;
  v_org_count int;
  v_lead uuid;
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_interaction_id uuid;
  v_phone text := regexp_replace(coalesce(p_contact_phone,''),'\D','','g');
begin
  select organization_id into v_org from crm.profiles where id=v_user limit 1;
  if v_org is null then raise exception 'profile context unavailable'; end if;
  if p_direction not in ('inbound','outbound') then raise exception 'invalid direction'; end if;
  if coalesce(p_session_id,'')='' or coalesce(p_message_id,'')='' or v_phone='' then raise exception 'missing whatsapp event identity'; end if;

  select array_agg(x.id order by x.id), count(*)::int into v_ids,v_count
  from (
    select distinct l.id
    from crm.leads l
    join crm.lead_assignments a
      on a.organization_id=l.organization_id
     and a.lead_id=l.id
     and a.unassigned_at is null
     and a.user_id=v_user
    where l.organization_id=v_org and l.deleted_at is null and (
      regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone,''),'\D','','g')=v_phone
      or (length(v_phone) in (10,11) and regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')='55'||v_phone)
      or (length(v_phone) in (12,13) and left(v_phone,2)='55' and regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=substring(v_phone from 3))
    )
  ) x;

  if v_count=0 then
    select count(*)::int into v_org_count
    from crm.leads l
    where l.organization_id=v_org and l.deleted_at is null and (
      regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone,''),'\D','','g')=v_phone
      or (length(v_phone) in (10,11) and regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')='55'||v_phone)
      or (length(v_phone) in (12,13) and left(v_phone,2)='55' and regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=substring(v_phone from 3))
    );
    if v_org_count>0 then
      return jsonb_build_object('status','owner_mismatch','written',false);
    end if;
    return jsonb_build_object('status','not_found','written',false);
  elsif v_count=1 then
    v_lead:=v_ids[1];
    insert into crm.whatsapp_conversation_events(
      organization_id,lead_id,session_id,message_id,direction,contact_phone,message_type,message_text,message_timestamp
    ) values (
      v_org,v_lead,p_session_id,p_message_id,p_direction,v_phone,p_message_type,left(p_message_text,8000),p_message_timestamp
    ) on conflict (organization_id,session_id,message_id) do nothing returning id into v_event_id;

    insert into crm.interactions(
      organization_id,lead_id,user_id,event_type,direction,source,occurred_at,external_id,dedupe_key,metadata
    ) values (
      v_org,v_lead,v_user,'message'::crm.interaction_type,p_direction::crm.interaction_direction,
      'whatsapp_live'::crm.interaction_source,p_message_timestamp,p_message_id,
      'wa:'||p_session_id||':'||p_message_id,
      jsonb_build_object('captured_by','taurus_whatsapp_observer','session_id',p_session_id,'message_type',p_message_type,'contact_phone',v_phone,'message_text',left(coalesce(p_message_text,''),8000))
    ) on conflict (organization_id,lead_id,dedupe_key) do nothing returning id into v_interaction_id;

    return jsonb_build_object('status','matched','written',true,'lead_id',v_lead,'conversation_event_inserted',v_event_id is not null,'interaction_inserted',v_interaction_id is not null);
  else
    insert into crm.whatsapp_identity_pending(
      organization_id,session_id,message_id,direction,contact_phone,message_type,message_text,message_timestamp,candidate_lead_ids,candidate_count
    ) values (
      v_org,p_session_id,p_message_id,p_direction,v_phone,p_message_type,left(p_message_text,8000),p_message_timestamp,coalesce(v_ids,'{}'),v_count
    ) on conflict (organization_id,session_id,message_id) do update set
      candidate_lead_ids=excluded.candidate_lead_ids,candidate_count=excluded.candidate_count,message_text=excluded.message_text,message_type=excluded.message_type,message_timestamp=excluded.message_timestamp;
    return jsonb_build_object('status','ambiguous','written',true,'candidate_count',v_count);
  end if;
end
$$;

create or replace function crm.whatsapp_ingest_event(
  p_session_id text,
  p_message_id text,
  p_direction text,
  p_contact_phone text,
  p_message_type text,
  p_message_text text,
  p_message_timestamp timestamptz
) returns jsonb
language sql
set search_path = 'public','crm'
as $$
  select public.whatsapp_ingest_event(
    p_session_id,p_message_id,p_direction,p_contact_phone,p_message_type,p_message_text,p_message_timestamp
  );
$$;

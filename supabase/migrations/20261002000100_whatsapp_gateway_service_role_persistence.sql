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
set search_path=''
as $$
declare
  v_org uuid;
  v_ids uuid[];
  v_count int;
  v_lead uuid;
  v_owner uuid;
  v_event_id uuid;
  v_interaction_id uuid;
  v_phone text := regexp_replace(coalesce(p_contact_phone,''),'\D','','g');
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select organization_id into v_org from crm.profiles where id=p_user_id limit 1;
  if v_org is null then raise exception 'profile context unavailable'; end if;
  if p_direction not in ('inbound','outbound') then raise exception 'invalid direction'; end if;
  if coalesce(p_session_id,'')='' or coalesce(p_message_id,'')='' or v_phone='' then raise exception 'missing whatsapp event identity'; end if;

  select array_agg(x.id order by x.id), count(*)::int into v_ids,v_count
  from (
    select l.id from crm.leads l
    where l.organization_id=v_org and l.deleted_at is null and (
      regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=v_phone
      or regexp_replace(coalesce(l.telefone,''),'\D','','g')=v_phone
      or (length(v_phone) in (10,11) and regexp_replace(coalesce(l.telefone_e164,''),'\D','','g')='55'||v_phone)
      or (length(v_phone) in (12,13) and left(v_phone,2)='55' and regexp_replace(coalesce(l.telefone_norm,''),'\D','','g')=substring(v_phone from 3))
    )
  ) x;

  if v_count=0 then
    return jsonb_build_object('status','not_found','written',false);
  elsif v_count=1 then
    v_lead:=v_ids[1];
    insert into crm.whatsapp_conversation_events(
      organization_id,lead_id,session_id,message_id,direction,contact_phone,message_type,message_text,message_timestamp
    ) values (
      v_org,v_lead,p_session_id,p_message_id,p_direction,v_phone,p_message_type,left(p_message_text,8000),p_message_timestamp
    ) on conflict (organization_id,session_id,message_id) do nothing returning id into v_event_id;

    select a.user_id into v_owner from crm.lead_assignments a
    where a.organization_id=v_org and a.lead_id=v_lead and a.unassigned_at is null
    order by a.assigned_at desc limit 1;

    insert into crm.interactions(
      organization_id,lead_id,user_id,event_type,direction,source,occurred_at,external_id,dedupe_key,metadata
    ) values (
      v_org,v_lead,v_owner,'message'::crm.interaction_type,p_direction::crm.interaction_direction,
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

create or replace function crm.whatsapp_gateway_media_context(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_org uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select organization_id into v_org from crm.profiles where id=p_user_id limit 1;
  if v_org is null then raise exception 'profile context unavailable'; end if;
  return jsonb_build_object('organization_id',v_org,'user_id',p_user_id);
end
$$;

create or replace function crm.whatsapp_gateway_media_register(
  p_user_id uuid,
  p_lead_id uuid,
  p_event_id uuid,
  p_session_id text,
  p_message_id text,
  p_media_kind text,
  p_mime_type text,
  p_storage_path text,
  p_original_filename text default null,
  p_byte_size bigint default null,
  p_duration_seconds numeric default null,
  p_caption text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_org uuid; v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select organization_id into v_org from crm.profiles where id=p_user_id limit 1;
  if v_org is null then raise exception 'profile context unavailable'; end if;
  if not exists(select 1 from crm.leads l where l.id=p_lead_id and l.organization_id=v_org and l.deleted_at is null) then raise exception 'lead_out_of_scope'; end if;
  if split_part(p_storage_path,'/',1) <> v_org::text then raise exception 'invalid_storage_namespace'; end if;
  insert into crm.whatsapp_media_assets(
    organization_id,lead_id,event_id,session_id,message_id,media_kind,mime_type,storage_bucket,storage_path,original_filename,byte_size,duration_seconds,caption,media_status
  ) values (
    v_org,p_lead_id,p_event_id,p_session_id,p_message_id,p_media_kind,p_mime_type,'whatsapp-media',p_storage_path,p_original_filename,p_byte_size,p_duration_seconds,p_caption,'stored'
  ) on conflict (organization_id,session_id,message_id) where purged_at is null do update set
    lead_id=excluded.lead_id,event_id=coalesce(excluded.event_id,crm.whatsapp_media_assets.event_id),media_kind=excluded.media_kind,mime_type=excluded.mime_type,storage_bucket='whatsapp-media',storage_path=excluded.storage_path,original_filename=excluded.original_filename,byte_size=excluded.byte_size,duration_seconds=excluded.duration_seconds,caption=coalesce(excluded.caption,crm.whatsapp_media_assets.caption),media_status='stored'
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function crm.whatsapp_gateway_ingest_event(uuid,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function crm.whatsapp_gateway_media_context(uuid) from public, anon, authenticated;
revoke all on function crm.whatsapp_gateway_media_register(uuid,uuid,uuid,text,text,text,text,text,text,bigint,numeric,text) from public, anon, authenticated;
grant execute on function crm.whatsapp_gateway_ingest_event(uuid,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function crm.whatsapp_gateway_media_context(uuid) to service_role;
grant execute on function crm.whatsapp_gateway_media_register(uuid,uuid,uuid,text,text,text,text,text,text,bigint,numeric,text) to service_role;

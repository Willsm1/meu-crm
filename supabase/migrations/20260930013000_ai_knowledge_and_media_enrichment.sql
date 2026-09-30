-- Taurus Magnum CRM — Gate IA / WhatsApp production skeleton
-- TEST BRANCH: central knowledge, future multimodal enrichment, per-user WhatsApp sessions.

create table if not exists crm.ai_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm.organizations(id) on delete cascade,
  scope text not null default 'org' check (scope in ('org','team','user')),
  team_id uuid null references crm.teams(id) on delete cascade,
  user_id uuid null references crm.profiles(id) on delete cascade,
  category text not null default 'geral',
  title text not null,
  content text not null,
  keywords text[] not null default '{}',
  source_type text not null default 'manual' check (source_type in ('manual','drive','file','system')),
  source_ref text null,
  source_hash text null,
  version bigint not null default 1,
  is_active boolean not null default true,
  created_by uuid null references crm.profiles(id),
  updated_by uuid null references crm.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope='org' and team_id is null and user_id is null) or (scope='team' and team_id is not null and user_id is null) or (scope='user' and user_id is not null))
);
alter table crm.ai_knowledge_documents enable row level security;
create index if not exists ai_knowledge_documents_org_active_idx on crm.ai_knowledge_documents(organization_id,is_active,scope);
create index if not exists ai_knowledge_documents_search_idx on crm.ai_knowledge_documents using gin (to_tsvector('simple', coalesce(title,'')||' '||coalesce(category,'')||' '||coalesce(content,'')));

create table if not exists crm.ai_media_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm.organizations(id) on delete cascade,
  media_id uuid not null unique references crm.whatsapp_media_assets(id) on delete cascade,
  lead_id uuid not null references crm.leads(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','review','failed')),
  transcription text null,
  knowledge_text text null,
  structured jsonb not null default '{}'::jsonb,
  confidence numeric null check (confidence is null or (confidence>=0 and confidence<=1)),
  model text null,
  attempts int not null default 0 check (attempts>=0),
  error text null,
  queued_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references crm.profiles(id)
);
alter table crm.ai_media_enrichment_jobs enable row level security;
create index if not exists ai_media_enrichment_jobs_queue_idx on crm.ai_media_enrichment_jobs(status,queued_at);
create index if not exists ai_media_enrichment_jobs_lead_idx on crm.ai_media_enrichment_jobs(organization_id,lead_id,status);

create table if not exists crm.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm.organizations(id) on delete cascade,
  user_id uuid not null references crm.profiles(id) on delete cascade,
  session_id text not null,
  phone text null,
  display_name text null,
  status text not null default 'disconnected' check (status in ('disconnected','qr','connecting','connected','error')),
  last_seen_at timestamptz null,
  connected_at timestamptz null,
  disconnected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,session_id)
);
alter table crm.whatsapp_sessions enable row level security;
create index if not exists whatsapp_sessions_user_idx on crm.whatsapp_sessions(organization_id,user_id,status);

create or replace function crm.tg_queue_media_enrichment()
returns trigger language plpgsql security definer set search_path=crm,public as $$
begin
  if new.media_kind in ('audio','image','video','document') then
    insert into crm.ai_media_enrichment_jobs(organization_id,media_id,lead_id,status)
    values(new.organization_id,new.id,new.lead_id,
      case when (new.media_kind='audio' and nullif(btrim(new.transcription),'') is not null)
             or (new.media_kind<>'audio' and nullif(btrim(new.knowledge_text),'') is not null)
           then 'completed' else 'pending' end)
    on conflict(media_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_queue_media_enrichment on crm.whatsapp_media_assets;
create trigger trg_queue_media_enrichment after insert on crm.whatsapp_media_assets for each row execute function crm.tg_queue_media_enrichment();

insert into crm.ai_media_enrichment_jobs(organization_id,media_id,lead_id,status)
select m.organization_id,m.id,m.lead_id,
 case when (m.media_kind='audio' and nullif(btrim(m.transcription),'') is not null)
        or (m.media_kind<>'audio' and nullif(btrim(m.knowledge_text),'') is not null)
      then 'completed' else 'pending' end
from crm.whatsapp_media_assets m
where m.media_kind in ('audio','image','video','document')
on conflict(media_id) do nothing;

create or replace function crm.ai_knowledge_context(p_lead_id uuid, p_query text default '', p_limit int default 6)
returns table(id uuid,title text,category text,content text,source_type text,source_ref text,rank real)
language plpgsql security definer set search_path=crm,public as $$
declare v_org uuid; v_team uuid; v_uid uuid; v_q tsquery;
begin
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'authentication required'; end if;
  select organization_id,team_id into v_org,v_team from crm.profiles where id=v_uid and is_active=true;
  if v_org is null then raise exception 'profile context unavailable'; end if;
  if not crm.can_see_lead(p_lead_id) then raise exception 'lead not visible'; end if;
  v_q:=plainto_tsquery('simple',coalesce(p_query,''));
  return query
  select d.id,d.title,d.category,d.content,d.source_type,d.source_ref,
    case when coalesce(btrim(p_query),'')='' then 0::real else ts_rank_cd(to_tsvector('simple',coalesce(d.title,'')||' '||coalesce(d.category,'')||' '||coalesce(d.content,'')),v_q)::real end as rank
  from crm.ai_knowledge_documents d
  where d.organization_id=v_org and d.is_active=true
    and (d.scope='org' or (d.scope='team' and d.team_id=v_team) or (d.scope='user' and d.user_id=v_uid))
  order by
    case when coalesce(btrim(p_query),'')='' then 0 else (to_tsvector('simple',coalesce(d.title,'')||' '||coalesce(d.category,'')||' '||coalesce(d.content,'')) @@ v_q)::int end desc,
    rank desc,d.updated_at desc
  limit greatest(1,least(coalesce(p_limit,6),12));
end $$;

create or replace function crm.ai_knowledge_upsert(p_id uuid,p_scope text,p_team_id uuid,p_user_id uuid,p_category text,p_title text,p_content text,p_keywords text[],p_source_type text,p_source_ref text)
returns uuid language plpgsql security definer set search_path=crm,public as $$
declare v_org uuid; v_role text; v_id uuid;
begin
  select organization_id,role::text into v_org,v_role from crm.profiles where id=auth.uid() and is_active=true;
  if v_org is null or v_role not in ('admin','gerente') then raise exception 'admin/manager required'; end if;
  if p_id is null then
    insert into crm.ai_knowledge_documents(organization_id,scope,team_id,user_id,category,title,content,keywords,source_type,source_ref,source_hash,created_by,updated_by)
    values(v_org,coalesce(p_scope,'org'),p_team_id,p_user_id,coalesce(nullif(btrim(p_category),''),'geral'),p_title,p_content,coalesce(p_keywords,'{}'),coalesce(p_source_type,'manual'),p_source_ref,encode(extensions.digest(p_content,'sha256'),'hex'),auth.uid(),auth.uid()) returning id into v_id;
  else
    update crm.ai_knowledge_documents set scope=coalesce(p_scope,scope),team_id=p_team_id,user_id=p_user_id,category=coalesce(nullif(btrim(p_category),''),category),title=p_title,content=p_content,keywords=coalesce(p_keywords,keywords),source_type=coalesce(p_source_type,source_type),source_ref=p_source_ref,source_hash=encode(extensions.digest(p_content,'sha256'),'hex'),version=version+1,updated_by=auth.uid(),updated_at=now()
    where id=p_id and organization_id=v_org returning id into v_id;
    if v_id is null then raise exception 'knowledge document not found'; end if;
  end if;
  return v_id;
end $$;

create or replace function crm.whatsapp_my_sessions()
returns table(id uuid,session_id text,phone text,display_name text,status text,last_seen_at timestamptz,updated_at timestamptz)
language sql security definer set search_path=crm,public as $$
 select s.id,s.session_id,s.phone,s.display_name,s.status,s.last_seen_at,s.updated_at
 from crm.whatsapp_sessions s join crm.profiles p on p.id=auth.uid() and p.organization_id=s.organization_id
 where s.user_id=auth.uid() order by s.updated_at desc;
$$;

insert into crm.ai_knowledge_documents(organization_id,scope,category,title,content,source_type,source_ref,source_hash)
select o.id,'org','metodo','Diretrizes do Copiloto Taurus',
'Use a conversa real e os dados do CRM como fonte primária. Não invente orçamento, urgência, preferência ou objeção. Diferencie fatos de inferências. Evite follow-up genérico: recomende um movimento comercial concreto e uma mensagem curta coerente com o histórico. Não repita perguntas já respondidas. O objetivo é ajudar o executivo a descobrir a próxima informação ou ação que aumenta a chance de avanço da negociação.',
'system','taurus-core-v1',encode(extensions.digest('taurus-core-v1','sha256'),'hex')
from crm.organizations o
where not exists(select 1 from crm.ai_knowledge_documents d where d.organization_id=o.id and d.source_ref='taurus-core-v1');

revoke all on function crm.ai_knowledge_context(uuid,text,int) from public,anon;
grant execute on function crm.ai_knowledge_context(uuid,text,int) to authenticated;
revoke all on function crm.ai_knowledge_upsert(uuid,text,uuid,uuid,text,text,text,text[],text,text) from public,anon;
grant execute on function crm.ai_knowledge_upsert(uuid,text,uuid,uuid,text,text,text,text[],text,text) to authenticated;
revoke all on function crm.whatsapp_my_sessions() from public,anon;
grant execute on function crm.whatsapp_my_sessions() to authenticated;
revoke all on function crm.tg_queue_media_enrichment() from public,anon,authenticated;

import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs/promises';
import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState, downloadContentFromMessage } from 'baileys';
import { classifyEvent, disconnectPolicy, extractMessageContent, phoneFromJid, phoneFromMessageKey as resolvePhoneFromMessageKey, shouldSyncHistory, historyBackfillPlan } from './core.mjs';
import { downloadMediaBuffer, shouldCleanupLocalMedia } from './media-core.mjs';

const PORT=Number(process.env.PORT||8787);
const DATA_ROOT=path.resolve(process.env.TAURUS_DATA_ROOT||'./.data');
const AUTH_ROOT=path.join(DATA_ROOT,'auth');
const MEDIA_ROOT=path.join(DATA_ROOT,'media');
const SUPABASE_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SUPABASE_SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'';
const ALLOWED_ORIGIN=process.env.TAURUS_ORIGIN||true;
const MAX_EVENTS=Number(process.env.WA_EVENT_BUFFER||500);
const MAX_MEDIA_BYTES=Number(process.env.WA_MEDIA_MAX_BYTES||25*1024*1024);
const GATEWAY_VERSION='linked-device-outbound-v4-recovery-14d-prod';
const RECOVERY_DAYS=14;
const RECOVERY_MAX_AGE_MS=RECOVERY_DAYS*24*60*60*1000;
const STAGING_MODE=String(process.env.TAURUS_STAGING_MODE||'')==='1';
const STAGING_TOKEN=String(process.env.TAURUS_STAGING_BYPASS_TOKEN||'');
const STAGING_USER_ID=String(process.env.TAURUS_STAGING_USER_ID||'11111111-1111-4111-8111-111111111111');
const logger=pino({level:process.env.LOG_LEVEL||'warn'});
const app=express();
app.use(cors({origin:ALLOWED_ORIGIN,credentials:false}));
app.use(express.json({limit:'128kb'}));

const sessions=new Map();
const MEDIA_TYPES={imageMessage:{kind:'image',stream:'image'},videoMessage:{kind:'video',stream:'video'},audioMessage:{kind:'audio',stream:'audio'},documentMessage:{kind:'document',stream:'document'},stickerMessage:{kind:'sticker',stream:'sticker'}};

function cleanSlot(v){const s=String(v||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(s))throw new Error('slot inválido');return s}
function safeId(v){return String(v||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,180)}
function encPath(v){return String(v||'').split('/').map(encodeURIComponent).join('/')}
function publicId(userId,slot){return `${userId}.${slot}`}
function key(userId,slot){return `${userId}:${slot}`}
function createSession(userId,slot){return{userId,slot,sessionId:publicId(userId,slot),authDir:path.join(AUTH_ROOT,userId,slot),mediaDir:path.join(MEDIA_ROOT,userId,slot),sock:null,starting:null,reconnectTimer:null,intentionalRestart:false,restoredFromDisk:false,events:[],seenMessageIds:new Set(),seenMessageOrder:[],lidPnMap:new Map(),catchupRequested:new Map(),recoveryPending:[],eligibleTargetsCache:{at:0,rows:[]},targetedRecoveryUntil:0,lastEligibleRecoveryAt:0,backfill:null,state:{phase:'idle',connected:false,qr:null,qrDataUrl:null,user:null,lastError:null,updatedAt:new Date().toISOString()}}}
function getSession(userId,slot){slot=cleanSlot(slot);const k=key(userId,slot);if(!sessions.has(k))sessions.set(k,createSession(userId,slot));return sessions.get(k)}
function patch(s,next){s.state={...s.state,...next,updatedAt:new Date().toISOString()}}
function statusPayload(s){return{slot:s.slot,sessionId:s.sessionId,phase:s.state.phase,connected:s.state.connected,qrDataUrl:s.state.qrDataUrl,user:s.state.user,lastError:s.state.lastError,eventCount:s.events.length,followupCandidateCount:s.events.filter(e=>e.eligibleForFollowup).length,directPersistence:Boolean(SUPABASE_SERVICE_KEY),backfill:s.backfill?{enabled:Boolean(s.backfill.enabled),manual:Boolean(s.backfill.manual),cutoffMs:s.backfill.cutoffMs||null,latestMs:s.backfill.latestMs||null,completedAt:s.backfill.completedAt||null}:null,updatedAt:s.state.updatedAt}}
function adminStatusPayload(s){const p=statusPayload(s);p.qrDataUrl=null;return p}
function asEpochMs(v){if(v==null)return null;if(typeof v==='number')return v>1e12?v:v*1000;if(typeof v==='bigint')return Number(v)*1000;if(typeof v==='string'){const n=Number(v);return Number.isFinite(n)?(n>1e12?n:n*1000):null}if(typeof v?.toNumber==='function')return v.toNumber()*1000;const n=Number(v);return Number.isFinite(n)?(n>1e12?n:n*1000):null}
function rememberLidPn(s,lid,pn){
  const l=String(lid||''),p=String(pn||'');
  const phone=phoneFromJid(p);
  if(!s||!l.endsWith('@lid')||!phone)return;
  s.lidPnMap.set(l,phone)
}
function learnKeyMappings(s,key={}){
  const pairs=[
    [key.remoteJid,key.remoteJidAlt],
    [key.remoteJidAlt,key.remoteJid],
    [key.participant,key.participantAlt],
    [key.participantAlt,key.participant]
  ];
  for(const [a,b] of pairs){
    if(String(a||'').endsWith('@lid'))rememberLidPn(s,a,b)
  }
}
function phoneFromMessageKey(key={},s=null){
  learnKeyMappings(s,key);
  return resolvePhoneFromMessageKey(key,s?.lidPnMap)
}
function messageText(message,type){if(!message||!type)return null;try{if(type==='conversation')return String(message.conversation||'').trim()||null;if(type==='extendedTextMessage')return String(message.extendedTextMessage?.text||'').trim()||null;if(type==='imageMessage')return String(message.imageMessage?.caption||'').trim()||'[imagem]';if(type==='videoMessage')return String(message.videoMessage?.caption||'').trim()||'[vídeo]';if(type==='audioMessage')return'[áudio]';if(type==='stickerMessage')return'[figurinha]';if(type==='documentMessage')return String(message.documentMessage?.fileName||message.documentMessage?.caption||'[documento]').trim();if(type==='contactMessage')return'[contato]';if(type==='contactsArrayMessage')return'[contatos]';if(type==='locationMessage'||type==='liveLocationMessage')return'[localização]'}catch{}return null}
function extFor(mime,kind){const m=String(mime||'').toLowerCase();if(m.includes('jpeg'))return'jpg';if(m.includes('png'))return'png';if(m.includes('webp'))return'webp';if(m.includes('gif'))return'gif';if(m.includes('ogg'))return'ogg';if(m.includes('opus'))return'opus';if(m.includes('mpeg'))return'mp3';if(m.includes('aac'))return'aac';if(m.includes('wav'))return'wav';if(m.includes('webm'))return'webm';if(m.includes('quicktime'))return'mov';if(m.includes('mp4'))return'mp4';if(m.includes('pdf'))return'pdf';if(m.includes('word'))return'docx';return kind==='audio'?'bin':kind==='image'?'img':kind==='video'?'vid':'bin'}
function pushEvent(s,e){const mid=String(e?.messageId||'');if(mid&&s.seenMessageIds.has(mid))return false;if(mid){s.seenMessageIds.add(mid);s.seenMessageOrder.push(mid);const seenCap=Math.max(1000,MAX_EVENTS*4);if(s.seenMessageOrder.length>seenCap){const old=s.seenMessageOrder.splice(0,s.seenMessageOrder.length-seenCap);for(const id of old)s.seenMessageIds.delete(id)}}s.events.push(e);if(s.events.length>MAX_EVENTS)s.events.splice(0,s.events.length-MAX_EVENTS);return true}
async function captureMedia(s,msg,e,contentMessage=msg?.message){
  const spec=MEDIA_TYPES[e.messageType];
  if(!spec||!e.eligibleForFollowup||!e.messageId)return;
  const node=contentMessage?.[e.messageType];
  if(!node)return;
  const meta={kind:spec.kind,mimeType:node.mimetype||null,fileName:node.fileName||null,durationSeconds:Number(node.seconds||0)||null,caption:node.caption||null,status:'downloading',byteSize:null,error:null,supabaseStatus:'pending',persistError:null,storagePath:null};
  e.media=meta;
  try{
    const buf=await downloadMediaBuffer({
      node,
      streamType:spec.stream,
      download:downloadContentFromMessage,
      maxBytes:MAX_MEDIA_BYTES,
      attempts:2,
      delayMs:750
    });
    await fs.mkdir(s.mediaDir,{recursive:true});
    const file=`${safeId(e.messageId)}.${extFor(meta.mimeType,spec.kind)}`;
    await fs.writeFile(path.join(s.mediaDir,file),buf);
    Object.assign(meta,{status:'stored_gateway',byteSize:buf.length,file,error:null});
    logger.warn({sessionId:s.sessionId,messageId:e.messageId,kind:spec.kind,byteSize:buf.length},'media captured at gateway');
  }catch(err){
    Object.assign(meta,{status:'failed',supabaseStatus:'capture_failed',error:err?.message||String(err)});
    logger.warn({err,sessionId:s.sessionId,messageId:e.messageId,kind:spec.kind},'media capture failed')
  }
}
function serviceHeaders(extra={}){const h={apikey:SUPABASE_SERVICE_KEY,'Content-Type':'application/json','Accept-Profile':'crm','Content-Profile':'crm',...extra};if(!STAGING_MODE&&SUPABASE_SERVICE_KEY&&!SUPABASE_SERVICE_KEY.startsWith('sb_secret_'))h.Authorization=`Bearer ${SUPABASE_SERVICE_KEY}`;return h}
async function rpcAsService(name,args={}){if(!SUPABASE_SERVICE_KEY)throw new Error('service role ausente');const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify(args)});const text=await r.text();if(!r.ok)throw new Error(`${name} ${r.status}: ${text.slice(0,240)}`);try{return text?JSON.parse(text):null}catch{return text}}
async function latestPersistedMessageMs(sessionId){
  if(!SUPABASE_SERVICE_KEY)return null;
  try{
    const q=new URLSearchParams({
      select:'message_timestamp',
      session_id:'eq.'+sessionId,
      order:'message_timestamp.desc',
      limit:'1'
    });
    const r=await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_conversation_events?${q.toString()}`,{
      headers:serviceHeaders()
    });
    if(!r.ok)return null;
    const rows=await r.json();
    const ts=rows?.[0]?.message_timestamp;
    const ms=ts?Date.parse(ts):NaN;
    return Number.isFinite(ms)?ms:null;
  }catch{return null}
}
async function backfillPlan(s){
  const latest=await latestPersistedMessageMs(s.sessionId);
  const now=Date.now();
  const plan=historyBackfillPlan(latest,now,{
    force:s.forceBackfill===true,
    maxAgeMs:RECOVERY_MAX_AGE_MS,
    overlapMs:s.restoredFromDisk?30*60*1000:12*60*60*1000
  });
  if(s.restoredFromDisk&&!s.forceBackfill&&latest){
    return{...plan,enabled:true,manual:false,restartCatchup:true};
  }
  return plan;
}
async function eligibleRecoveryTargets(s,{limit=100,force=false}={}){
  if(!SUPABASE_SERVICE_KEY)return[];
  const now=Date.now();
  if(!force&&s.eligibleTargetsCache?.rows?.length&&now-Number(s.eligibleTargetsCache.at||0)<30000)return s.eligibleTargetsCache.rows;
  try{
    const raw=await rpcAsService('whatsapp_gateway_recovery_targets',{p_user_id:s.userId,p_session_id:s.sessionId,p_days:RECOVERY_DAYS,p_limit:Math.max(1,Math.min(200,Number(limit||100)))});
    const rows=(Array.isArray(raw)?raw:[]).map(x=>{
      let phone=String(x?.phone||'').replace(/\D/g,'');
      if(phone.length===10||phone.length===11)phone='55'+phone;
      return{leadId:x?.lead_id||null,phone,status:x?.status||null,messageId:x?.anchor_message_id||null,direction:x?.anchor_direction==='outbound'?'outbound':'inbound',timestampMs:Date.parse(x?.anchor_timestamp||''),anchorSessionId:x?.anchor_session_id||null};
    }).filter(x=>x.phone);
    s.eligibleTargetsCache={at:now,rows};
    return rows;
  }catch(err){logger.warn({err,sessionId:s.sessionId},'eligible recovery targets load failed');return[]}
}
async function recentRecoveryAnchors(s,{maxChats=50}={}){
  const rows=await eligibleRecoveryTargets(s,{limit:Math.max(100,maxChats),force:true});
  const seen=new Set(),out=[];
  for(const row of rows){
    if(!row.messageId||!Number.isFinite(row.timestampMs)||seen.has(row.phone))continue;
    seen.add(row.phone);
    out.push(row);
    if(out.length>=maxChats)break;
  }
  logger.warn({sessionId:s.sessionId,eligibleTargets:rows.length,anchoredTargets:out.length},'eligible recovery anchors prepared');
  return out;
}
async function requestRecentConversationCatchup(s,sock,anchors=[]){
  if(typeof sock?.fetchMessageHistory!=='function')return;
  s.targetedRecoveryUntil=Date.now()+120000;
  logger.warn({sessionId:s.sessionId,count:anchors.length},'active recovery anchors loaded');
  for(const a of anchors){
    try{
      const pnJid=`${a.phone}@s.whatsapp.net`;
      let remoteJid=pnJid,remoteJidAlt=null;
      try{
        const lid=await sock?.signalRepository?.lidMapping?.getLIDForPN?.(pnJid);
        if(lid){remoteJid=lid;remoteJidAlt=pnJid;rememberLidPn(s,lid,pnJid)}
      }catch{}
      const key={remoteJid,id:a.messageId,fromMe:a.direction==='outbound'};
      if(remoteJidAlt)key.remoteJidAlt=remoteJidAlt;
      const requestId=await sock.fetchMessageHistory(50,key,Math.floor(a.timestampMs/1000));
      s.recoveryPending.push({requestId:String(requestId||''),phone:a.phone,anchorMessageId:a.messageId,requestedAt:Date.now(),consumed:false});
      logger.warn({sessionId:s.sessionId,phone:a.phone,requestId,anchorMessageId:a.messageId},'active recovery history requested');
    }catch(err){
      logger.warn({err,sessionId:s.sessionId,phone:a.phone,anchorMessageId:a.messageId},'active recovery history request failed');
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
}
async function uploadAsService(storagePath,buf,mime){if(!SUPABASE_SERVICE_KEY)throw new Error('service role ausente');const h={apikey:SUPABASE_SERVICE_KEY,'Content-Type':mime||'application/octet-stream','x-upsert':'true'};if(!STAGING_MODE&&!SUPABASE_SERVICE_KEY.startsWith('sb_secret_'))h.Authorization=`Bearer ${SUPABASE_SERVICE_KEY}`;const r=await fetch(`${SUPABASE_URL}/storage/v1/object/whatsapp-media/${encPath(storagePath)}`,{method:'POST',headers:h,body:buf});const text=await r.text();if(!r.ok)throw new Error(`storage ${r.status}: ${text.slice(0,240)}`);return text}
async function persistEventDirect(s,e){
  if(!SUPABASE_SERVICE_KEY||!e?.eligibleForFollowup||!e.messageId||!e.contactPhone)return;
  try{
    const matched=await rpcAsService('whatsapp_gateway_ingest_event',{p_user_id:s.userId,p_session_id:e.sessionId,p_message_id:e.messageId,p_direction:e.direction,p_contact_phone:e.contactPhone,p_message_type:e.messageType||null,p_message_text:e.messageText||null,p_message_timestamp:new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()).toISOString()});
    e.persistenceStatus=matched?.status||'unknown';
    if(!e.media||e.media.status!=='stored_gateway'||!e.media.file||matched?.status!=='matched'||!matched?.lead_id)return;
    e.media.supabaseStatus='persisting';e.media.persistError=null;
    const ctxRaw=await rpcAsService('whatsapp_gateway_media_context',{p_user_id:s.userId}),ctx=Array.isArray(ctxRaw)?(ctxRaw[0]||{}):(ctxRaw||{});
    if(!ctx.organization_id||!ctx.user_id)throw new Error('contexto de mídia incompleto');
    const filePath=path.join(s.mediaDir,e.media.file),buf=await fs.readFile(filePath);
    const when=new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()),yyyy=String(when.getFullYear()),mm=String(when.getMonth()+1).padStart(2,'0');
    const storagePath=[ctx.organization_id,ctx.user_id,e.sessionId,matched.lead_id,yyyy,mm,e.media.file].join('/');
    await uploadAsService(storagePath,buf,e.media.mimeType);
    await rpcAsService('whatsapp_gateway_media_register',{p_user_id:s.userId,p_lead_id:matched.lead_id,p_event_id:null,p_session_id:e.sessionId,p_message_id:e.messageId,p_media_kind:e.media.kind,p_mime_type:e.media.mimeType||'application/octet-stream',p_storage_path:storagePath,p_original_filename:e.media.fileName||null,p_byte_size:buf.length,p_duration_seconds:e.media.durationSeconds||null,p_caption:e.media.caption||null});
    Object.assign(e.media,{supabaseStatus:'stored',persistError:null,storagePath});
    // A mídia já está no Storage privado do Supabase; a cópia local é apenas cache.
    // Removê-la evita que o disco persistente do gateway encha e force reconexões do WhatsApp.
    if(shouldCleanupLocalMedia(e.media.supabaseStatus)){try{await fs.rm(filePath,{force:true});e.media.file=null}catch(cleanErr){logger.warn({err:cleanErr,sessionId:e.sessionId,messageId:e.messageId},'local media cleanup failed')}}
    logger.info({sessionId:e.sessionId,messageId:e.messageId,storagePath},'event/media persisted directly');
  }catch(err){e.persistenceStatus='error';if(e.media){e.media.supabaseStatus='error';e.media.persistError=err?.message||String(err)}logger.warn({err,sessionId:e.sessionId,messageId:e.messageId},'direct persistence failed')}
}
async function captureUpsert(s,upsert){const receivedAt=Date.now(),upsertType=upsert?.type||'unknown';for(const msg of upsert?.messages||[]){const jid=msg?.key?.remoteJid||null;if(!jid)continue;const alt=msg?.key?.remoteJidAlt||null;const extracted=extractMessageContent(msg?.message),type=extracted.type,contentMessage=extracted.message;const msgTs=asEpochMs(msg?.messageTimestamp);let resolvedPhone=phoneFromMessageKey(msg?.key,s)||phoneFromJid(alt)||null;if(!resolvedPhone&&String(jid).endsWith('@lid')){try{const pn=await s.sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);resolvedPhone=phoneFromJid(pn)||null;if(resolvedPhone)rememberLidPn(s,jid,pn)}catch(err){logger.warn({err,sessionId:s.sessionId,jid},'LID to PN lookup failed')}}if(resolvedPhone){try{const pnJid=`${resolvedPhone}@s.whatsapp.net`;const learnedLid=await s.sock?.signalRepository?.lidMapping?.getLIDForPN?.(pnJid);if(learnedLid)rememberLidPn(s,learnedLid,pnJid)}catch(err){logger.warn({err,sessionId:s.sessionId,resolvedPhone},'PN to LID warmup failed')}}const e={sessionId:s.sessionId,slot:s.slot,source:'messages.upsert',upsertType,live:upsertType==='notify',messageId:msg?.key?.id||null,chatJid:jid,chatJidAlt:alt,contactPhone:resolvedPhone,fromMe:Boolean(msg?.key?.fromMe),direction:msg?.key?.fromMe?'outbound':'inbound',messageTimestampMs:msgTs,receivedAtMs:receivedAt,hasMessage:Boolean(msg?.message),messageType:type,messageText:messageText(contentMessage,type),media:null,persistenceStatus:'pending',backfillEligible:upsertType==='append'&&Boolean(msgTs)&&((Boolean(s.backfill?.enabled)&&msgTs>=Number(s.backfill?.cutoffMs||0))||(Date.now()<Number(s.targetedRecoveryUntil||0)&&msgTs>=Date.now()-RECOVERY_MAX_AGE_MS))};const c=classifyEvent(e);e.eligibleForFollowup=c.eligible;e.ignoreReason=c.reason;e.dedupeKey=`${s.sessionId}:${e.messageId||'sem-id'}`;if(STAGING_MODE&&e.fromMe)logger.warn({sessionId:s.sessionId,messageId:e.messageId,upsertType:e.upsertType,messageType:e.messageType,chatJid:e.chatJid,chatJidAlt:e.chatJidAlt,contactPhone:e.contactPhone,eligible:e.eligibleForFollowup,ignoreReason:e.ignoreReason,messageTimestampMs:e.messageTimestampMs},'staging outbound event observed');if(!pushEvent(s,e))continue;if(e.eligibleForFollowup&&MEDIA_TYPES[type])await captureMedia(s,msg,e,contentMessage);if(e.eligibleForFollowup&&SUPABASE_SERVICE_KEY)await persistEventDirect(s,e);
if(upsertType==='notify'&&msgTs&&e.contactPhone&&typeof s.sock?.fetchMessageHistory==='function'){
  const targets=await eligibleRecoveryTargets(s,{limit:200});
  const target=targets.find(x=>x.phone===String(e.contactPhone).replace(/\D/g,'')||x.phone==='55'+String(e.contactPhone).replace(/\D/g,''));
  if(target){
    const chatKey=String(e.contactPhone);
    const lastReq=s.catchupRequested.get(chatKey)||0;
    if(Date.now()-lastReq>6*60*60*1000){
      s.catchupRequested.set(chatKey,Date.now());
      s.targetedRecoveryUntil=Date.now()+120000;
      s.sock.fetchMessageHistory(50,msg.key,msg.messageTimestamp).then(requestId=>{
        s.recoveryPending.push({requestId:String(requestId||''),phone:target.phone,anchorMessageId:e.messageId,requestedAt:Date.now(),consumed:false});
        logger.warn({sessionId:s.sessionId,leadId:target.leadId,phone:target.phone,requestId},'eligible lead live catch-up requested')
      }).catch(err=>logger.warn({err,sessionId:s.sessionId,leadId:target.leadId,phone:target.phone},'eligible lead live catch-up failed'))
    }
  }
}}}
async function connect(s){if(s.starting)return s.starting;if(s.sock&&s.state.connected)return statusPayload(s);s.starting=(async()=>{patch(s,{phase:'starting',connected:false,lastError:null});await fs.mkdir(s.authDir,{recursive:true});let authState=await useMultiFileAuthState(s.authDir);let auth=authState.state,saveCreds=authState.saveCreds;let isRegistered=Boolean(auth?.creds?.registered),hasMe=Boolean(auth?.creds?.me);const pairingRestart=Boolean(s.pairingRestart);const stablePaired=isRegistered||(hasMe&&(Boolean(s.pairingEstablished)||Boolean(s.restoredFromDisk)));const finishingPairing=!stablePaired&&hasMe;const isPaired=isRegistered||hasMe;const requestedBackfill=Boolean(s.forceBackfill);logger.warn({sessionId:s.sessionId,registered:isRegistered,hasMe,isPaired,pairingRestart,finishingPairing},'WhatsApp auth state loaded');s.backfill=(pairingRestart||finishingPairing)?{enabled:false,cutoffMs:0,latestMs:null,manual:false,pairing:true,finishingPairing:true}:(stablePaired?await backfillPlan(s):{enabled:false,cutoffMs:0,latestMs:null,manual:false,pairing:true});const activeRecovery=stablePaired&&!pairingRestart&&!finishingPairing&&Boolean(s.backfill?.enabled);const manualRecovery=activeRecovery&&Boolean(s.backfill?.manual);const automaticRecovery=activeRecovery&&!Boolean(s.backfill?.manual);const historyMode=false;if(activeRecovery)s.recoveryAnchors=await recentRecoveryAnchors(s);else s.recoveryAnchors=[];logger.warn({sessionId:s.sessionId,historyMode,manualRecovery,automaticRecovery,manual:Boolean(s.backfill?.manual),cutoffMs:s.backfill?.cutoffMs,latestMs:s.backfill?.latestMs,requestedBackfill,recoveryAnchors:s.recoveryAnchors.length},'WhatsApp connection mode selected');const sock=makeWASocket({
  auth,
  browser:Browsers.windows('Desktop'),
  // Em sessão já pareada, gaps reais de persistência ativam uma sincronização limitada.
  // O WhatsApp decide o lote que entrega; o Taurus filtra e persiste somente a janela de até 7 dias.
  syncFullHistory:shouldSyncHistory(historyMode?'history':'realtime'),
  // Manual recovery stays on a normal realtime socket, but must accept the
  // history payloads explicitly requested through fetchMessageHistory.
  shouldSyncHistoryMessage:()=>activeRecovery||Date.now()<Number(s.targetedRecoveryUntil||0)||shouldSyncHistory(historyMode?'history':'realtime'),
  fireInitQueries:historyMode,
  markOnlineOnConnect:false,
  printQRInTerminal:false,
  // Grupos, Status e newsletters nunca são candidatos a follow-up no Taurus.
  // Ignorá-los antes da descriptografia reduz churn de chaves/retries sem afetar
  // conversas individuais de clientes.
  shouldIgnoreJid:(jid)=>{
    const j=String(jid||'');
    return j==='status@broadcast'||j.endsWith('@broadcast')||j.endsWith('@g.us')||j.endsWith('@newsletter');
  },
  logger
});s.sock=sock;sock.ev.on('creds.update',saveCreds);sock.ev.on('messages.upsert',u=>captureUpsert(s,u).catch(err=>logger.warn({err,sessionId:s.sessionId},'message capture failed')));
function applyRecoveryPhoneFallback(s,msgs){
  const unresolvedJids=[...new Set((msgs||[]).map(m=>String(m?.key?.remoteJid||'')).filter(j=>j.endsWith('@lid')&&!s.lidPnMap.has(j)))];
  if(unresolvedJids.length!==1)return null;
  const pending=(s.recoveryPending||[]).find(x=>!x.consumed&&Date.now()-Number(x.requestedAt||0)<120000);
  if(!pending?.phone)return null;
  const lid=unresolvedJids[0],pnJid=`${pending.phone}@s.whatsapp.net`;
  rememberLidPn(s,lid,pnJid);
  pending.consumed=true;
  logger.warn({sessionId:s.sessionId,lid,phone:pending.phone,requestId:pending.requestId,anchorMessageId:pending.anchorMessageId},'recovery LID phone fallback applied');
  return pending.phone;
}
sock.ev.on('messaging-history.set',h=>{
  for(const m of Array.isArray(h?.lidPnMappings)?h.lidPnMappings:[])rememberLidPn(s,m?.lid,m?.pn);
  for(const ct of Array.isArray(h?.contacts)?h.contacts:[]){
    if(String(ct?.id||'').endsWith('@lid'))rememberLidPn(s,ct.id,ct.phoneNumber);
    if(String(ct?.lid||'').endsWith('@lid'))rememberLidPn(s,ct.lid,ct.phoneNumber||ct.id)
  }
  const msgs=Array.isArray(h?.messages)?h.messages:[];
  applyRecoveryPhoneFallback(s,msgs);
  captureUpsert(s,{type:'append',messages:msgs}).then(()=>{
    logger.warn({sessionId:s.sessionId,count:msgs.length,mappings:s.lidPnMap.size,cutoffMs:s.backfill?.cutoffMs,isLatest:Boolean(h?.isLatest),progress:h?.progress||null,syncType:h?.syncType||null},'WhatsApp history batch processed');
    if(s.backfill?.enabled&&(h?.isLatest===true||Number(h?.progress||0)>=100)){
      s.backfill={...(s.backfill||{}),enabled:false,completedAt:Date.now()};
      patch(s,{phase:'connected'})
    }
  }).catch(err=>logger.warn({err,sessionId:s.sessionId},'history backfill failed'))
})
sock.ev.on('connection.update',async u=>{const{connection,qr,lastDisconnect}=u;if(qr){let qrDataUrl=null;try{qrDataUrl=await QRCode.toDataURL(qr,{margin:2,width:320,errorCorrectionLevel:'M'})}catch(err){logger.error({err,sessionId:s.sessionId},'WhatsApp QR encode failed')}logger.warn({sessionId:s.sessionId,hasQr:Boolean(qr),hasQrDataUrl:Boolean(qrDataUrl)},'WhatsApp QR received');patch(s,{phase:'qr',connected:false,qrDataUrl,lastError:null})}if(connection==='open'){if(s.reconnectTimer)clearTimeout(s.reconnectTimer);s.reconnectTimer=null;s.pairingRestart=false;s.pairingEstablished=true;if(!s.backfill?.enabled&&Date.now()-Number(s.lastEligibleRecoveryAt||0)>5*60*1000){s.lastEligibleRecoveryAt=Date.now();setTimeout(async()=>{try{const anchors=await recentRecoveryAnchors(s,{maxChats:50});if(anchors.length)await requestRecentConversationCatchup(s,sock,anchors)}catch(err){logger.warn({err,sessionId:s.sessionId},'automatic eligible recovery failed')}},1200)};patch(s,{phase:s.backfill?.enabled?'backfilling':'connected',connected:true,qrDataUrl:null,user:sock.user?{id:sock.user.id||null,name:sock.user.name||null}:null,lastError:null});if(s.backfill?.enabled&&!s.activeRecoveryRequested){s.activeRecoveryRequested=true;s.forceBackfill=false;requestRecentConversationCatchup(s,sock,s.recoveryAnchors||[]).catch(err=>{s.activeRecoveryRequested=false;if(s.backfill?.manual)s.forceBackfill=true;logger.warn({err,sessionId:s.sessionId},'active recovery failed')})}s.restoredFromDisk=false;if(s.forceBackfill&&!s.backfill?.enabled&&!s.postPairingBackfillRestart){s.postPairingBackfillRestart=true;logger.warn({sessionId:s.sessionId},'manual backfill survived pairing; scheduling registered reconnect');setTimeout(async()=>{try{await saveCreds()}catch{}s.intentionalRestart=true;try{s.sock?.end?.(new Error('manual_backfill_registered_restart'))}catch{}setTimeout(()=>{s.sock=null;s.postPairingBackfillRestart=false;s.intentionalRestart=false;connect(s).catch(err=>patch(s,{phase:'error',lastError:err.message||String(err)}))},600)},1200)}}if(connection==='close'){const code=lastDisconnect?.error?.output?.statusCode;const policy=disconnectPolicy(code);const intentionalRestart=Boolean(s.intentionalRestart);if(s.backfill?.enabled&&s.backfill?.manual&&!s.activeRecoveryRequested)s.forceBackfill=true;const loggedOut=policy.loggedOut;const restartRequired=policy.restartRequired;logger.warn({sessionId:s.sessionId,code,loggedOut,restartRequired},'WhatsApp connection closed');if(restartRequired){s.pairingRestart=true;try{await saveCreds();logger.warn({sessionId:s.sessionId},'WhatsApp creds persisted before required restart')}catch(err){logger.error({err,sessionId:s.sessionId},'failed to persist WhatsApp creds before restart')}}patch(s,{phase:loggedOut?'logged_out':'disconnected',connected:false,qrDataUrl:null,lastError:lastDisconnect?.error?.message||String(lastDisconnect?.error||'connection closed')});s.sock=null;if(!loggedOut&&!intentionalRestart&&!s.suppressReconnect&&!s.reconnectTimer){const reconnectDelay=policy.reconnectDelayMs;s.reconnectTimer=setTimeout(()=>{s.reconnectTimer=null;connect(s).catch(err=>patch(s,{phase:'error',lastError:err.message||String(err)}))},reconnectDelay)}}});return statusPayload(s)})();try{return await s.starting}catch(err){patch(s,{phase:'error',connected:false,lastError:err.message||String(err)});throw err}finally{s.starting=null}}
async function authenticate(req){if(STAGING_MODE&&STAGING_TOKEN&&String(req.headers['x-taurus-staging']||'')===STAGING_TOKEN)return{id:STAGING_USER_ID,staging:true};if(!SUPABASE_URL||!SUPABASE_KEY)throw Object.assign(new Error('gateway sem configuração Supabase'),{status:503});const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))throw Object.assign(new Error('não autenticado'),{status:401});const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!r.ok)throw Object.assign(new Error('sessão Taurus inválida'),{status:401});const u=await r.json();if(!u?.id)throw Object.assign(new Error('usuário inválido'),{status:401});return u}
async function authMw(req,res,next){try{req.taurusUser=await authenticate(req);next()}catch(err){res.status(err.status||401).json({ok:false,error:err.message||String(err)})}}
function userHeaders(auth,extra={}){return{apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json','Accept-Profile':'crm','Content-Profile':'crm',...extra}}
async function rpcAsUser(auth,name,args={}){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:userHeaders(auth),body:JSON.stringify(args)});const text=await r.text();if(!r.ok)throw new Error(`${name} ${r.status}: ${text.slice(0,240)}`);try{return text?JSON.parse(text):null}catch{return text}}
async function uploadAsUser(auth,storagePath,buf,mime){const r=await fetch(`${SUPABASE_URL}/storage/v1/object/whatsapp-media/${encPath(storagePath)}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':mime||'application/octet-stream','x-upsert':'true'},body:buf});const text=await r.text();if(!r.ok)throw new Error(`storage ${r.status}: ${text.slice(0,240)}`);return text}
function firstRow(raw){return Array.isArray(raw)?(raw[0]||{}):(raw||{})}
function validUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
async function resolveSessionTarget(req){
  const own=String(req.taurusUser.id||''),requested=String(req.query.target_user_id||'').trim();
  if(!requested||requested===own)return{userId:own,readOnly:false,viewerRole:null};
  if(!validUuid(requested))throw Object.assign(new Error('target_user_id inválido'),{status:400});
  const auth=req.headers.authorization||'';
  const me=firstRow(await rpcAsUser(auth,'current_profile_context',{}));
  if(String(me.role||'')!=='admin')throw Object.assign(new Error('acesso administrativo necessário'),{status:403});
  const opts=await rpcAsUser(auth,'admin_scope_options',{});
  const allowed=Array.isArray(opts)&&opts.some(p=>String(p?.user_id||'')===requested&&p?.is_active!==false);
  if(!allowed)throw Object.assign(new Error('executivo fora do escopo administrativo'),{status:403});
  return{userId:requested,readOnly:true,viewerRole:'admin'};
}
async function persistEventMedia(req,s,e){
  if(!e?.media||e.media.status!=='stored_gateway'||!e.media.file||e.media.supabaseStatus==='stored'||e.media.supabaseStatus==='persisting')return;
  e.media.supabaseStatus='persisting';e.media.persistError=null;
  const auth=req.headers.authorization||'';
  try{
    const matched=await rpcAsUser(auth,'whatsapp_ingest_event',{p_session_id:e.sessionId,p_message_id:e.messageId,p_direction:e.direction,p_contact_phone:e.contactPhone,p_message_type:e.messageType||null,p_message_text:e.messageText||null,p_message_timestamp:new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()).toISOString()});
    if(!matched||matched.status!=='matched'||!matched.lead_id){e.media.supabaseStatus=matched?.status||'unmatched';return;}
    const ctxRaw=await rpcAsUser(auth,'whatsapp_media_context',{}),ctx=Array.isArray(ctxRaw)?(ctxRaw[0]||{}):(ctxRaw||{});
    if(!ctx.organization_id||!ctx.user_id)throw new Error('contexto de mídia incompleto');
    const filePath=path.join(s.mediaDir,e.media.file),buf=await fs.readFile(filePath);
    const when=new Date(e.messageTimestampMs||e.receivedAtMs||Date.now()),yyyy=String(when.getFullYear()),mm=String(when.getMonth()+1).padStart(2,'0');
    const storagePath=[ctx.organization_id,ctx.user_id,e.sessionId,matched.lead_id,yyyy,mm,e.media.file].join('/');
    await uploadAsUser(auth,storagePath,buf,e.media.mimeType);
    await rpcAsUser(auth,'whatsapp_media_register',{p_lead_id:matched.lead_id,p_event_id:null,p_session_id:e.sessionId,p_message_id:e.messageId,p_media_kind:e.media.kind,p_mime_type:e.media.mimeType||'application/octet-stream',p_storage_path:storagePath,p_original_filename:e.media.fileName||null,p_byte_size:buf.length,p_duration_seconds:e.media.durationSeconds||null,p_caption:e.media.caption||null});
    Object.assign(e.media,{supabaseStatus:'stored',persistError:null,storagePath});
    if(shouldCleanupLocalMedia(e.media.supabaseStatus)){try{await fs.rm(filePath,{force:true});e.media.file=null}catch(cleanErr){logger.warn({err:cleanErr,sessionId:e.sessionId,messageId:e.messageId},'local media cleanup failed')}}
    logger.info({sessionId:e.sessionId,messageId:e.messageId,storagePath},'media persisted to Supabase');
  }catch(err){e.media.supabaseStatus='error';e.media.persistError=err?.message||String(err);logger.warn({err,sessionId:e.sessionId,messageId:e.messageId},'media Supabase persistence failed')}
}
function candidateView(e){return{sessionId:e.sessionId,slot:e.slot,messageId:e.messageId,dedupeKey:e.dedupeKey,direction:e.direction,messageTimestampMs:e.messageTimestampMs,receivedAtMs:e.receivedAtMs,messageType:e.messageType,messageText:e.messageText,chatJid:e.chatJid,chatJidAlt:e.chatJidAlt,contactPhone:e.contactPhone,upsertType:e.upsertType||null,live:Boolean(e.live),historyBackfill:Boolean(e.backfillEligible),eligibleForFollowup:e.eligibleForFollowup,ignoreReason:e.ignoreReason,persistenceStatus:e.persistenceStatus||null,media:e.media?{...e.media,url:null}:null}}
function userSessions(userId){return[...sessions.values()].filter(s=>s.userId===userId)}

app.get('/health',(_req,res)=>res.json({ok:true,service:'taurus-whatsapp-gateway',mode:'hosted-multisession',version:GATEWAY_VERSION,sessions:sessions.size,directPersistence:Boolean(SUPABASE_SERVICE_KEY),dataRoot:DATA_ROOT,adminSessionView:true,staging:STAGING_MODE}));
if(STAGING_MODE){
  app.get('/staging',(_req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.sendFile(path.join(process.cwd(),'staging.html'))});
  app.use('/api/staging',authMw);
  app.post('/api/staging/test-lead',async(req,res)=>{
    try{
      const phone=String(req.body?.phone||'');
      const name=String(req.body?.name||'Cliente Staging');
      const out=await rpcAsService('staging_upsert_test_lead',{p_phone:phone,p_name:name});
      res.json(out||{ok:true});
    }catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}
  });
  app.get('/api/staging/conversation',async(req,res)=>{
    try{
      const raw=await rpcAsService('staging_conversation',{p_phone:String(req.query.phone||'')});
      const out=Array.isArray(raw)?(raw[0]||{}):(raw||{});
      const media=Array.isArray(out.media)?out.media.map(m=>({...m,url:m.storage_path?SUPABASE_URL+'/storage/v1/object/public/whatsapp-media/'+encPath(m.storage_path):null})):[];
      res.json({...out,media});
    }catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}
  });
  app.post('/api/staging/reset',async(_req,res)=>{
    try{res.json(await rpcAsService('staging_reset_test_data',{})||{ok:true})}
    catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}
  });
  app.post('/api/staging/sessions/:slot/pause',async(req,res)=>{
    try{
      const s=getSession(req.taurusUser.id,req.params.slot);
      s.suppressReconnect=true;
      if(s.reconnectTimer)clearTimeout(s.reconnectTimer);
      s.reconnectTimer=null;
      try{s.sock?.end?.(new Error('staging_pause'))}catch{}
      s.sock=null;
      patch(s,{phase:'staging_paused',connected:false,lastError:null});
      res.json({ok:true,...statusPayload(s)});
    }catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}
  });
  app.post('/api/staging/sessions/:slot/reset-pairing',async(req,res)=>{
    try{
      const old=getSession(req.taurusUser.id,req.params.slot);
      old.suppressReconnect=true;
      if(old.reconnectTimer)clearTimeout(old.reconnectTimer);
      old.reconnectTimer=null;
      try{old.sock?.end?.(new Error('staging_pairing_reset'))}catch{}
      old.sock=null;
      sessions.delete(key(old.userId,old.slot));
      await fs.rm(old.authDir,{recursive:true,force:true});
      await fs.mkdir(old.authDir,{recursive:true});
      const fresh=getSession(req.taurusUser.id,req.params.slot);
      patch(fresh,{phase:'disconnected',connected:false,qrDataUrl:null,user:null,lastError:null});
      res.json({ok:true,reset:true,...statusPayload(fresh)});
    }catch(err){res.status(500).json({ok:false,error:err.message||String(err)})}
  });
  app.post('/api/staging/sessions/:slot/restart',async(req,res)=>{
    try{
      const old=getSession(req.taurusUser.id,req.params.slot);
      old.suppressReconnect=true;
      if(old.reconnectTimer)clearTimeout(old.reconnectTimer);
      old.reconnectTimer=null;
      try{old.sock?.end?.(new Error('staging_restart'))}catch{}
      old.sock=null;
      sessions.delete(key(old.userId,old.slot));
      const s=getSession(req.taurusUser.id,req.params.slot);
      s.forceBackfill=true;
      const out=await connect(s);
      res.json({ok:true,simulatedProcessRestart:true,...out});
    }catch(err){res.status(500).json({ok:false,error:err.message||String(err)})}
  });
}

app.use('/api/whatsapp',authMw);
app.post('/api/whatsapp/diagnostics/history-ui',(req,res)=>{try{
  const body=Object.assign({},req.query||{},req.body&&typeof req.body==='object'?req.body:{});
  const safe={
    type:String(body.type||'').slice(0,80),
    buttonText:body.buttonText==null?null:String(body.buttonText).slice(0,120),
    modalText:body.modalText==null?null:String(body.modalText).slice(0,240),
    historyShell:Boolean(body.historyShell),
    href:body.path==null?null:String(body.path).slice(0,120),framed:String(body.framed||'').slice(0,8)
  };
  logger.warn({userId:req.taurusUser.id,...safe},'history ui diagnostic');
  res.json({ok:true});
}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.get('/api/whatsapp/sessions',async(req,res)=>{try{const target=await resolveSessionTarget(req);const rows=userSessions(target.userId).map(s=>target.readOnly?adminStatusPayload(s):statusPayload(s));res.json({sessions:rows,targetUserId:target.userId,readOnly:target.readOnly,viewerRole:target.viewerRole})}catch(err){res.status(err.status||500).json({ok:false,error:err.message||String(err)})}});
app.post('/api/whatsapp/sessions/:slot/start',async(req,res)=>{try{const s=getSession(req.taurusUser.id,req.params.slot);logger.warn({userId:req.taurusUser.id,slot:req.params.slot,sessionId:s.sessionId},'WhatsApp session start requested');const out=await connect(s);logger.warn({sessionId:s.sessionId,phase:out?.phase,connected:out?.connected,hasQr:Boolean(out?.qrDataUrl)},'WhatsApp session start response');res.json({ok:true,...out})}catch(err){logger.error({err,userId:req.taurusUser?.id,slot:req.params.slot},'WhatsApp session start failed');res.status(500).json({ok:false,error:err.message||String(err)})}});
app.get('/api/whatsapp/sessions/:slot/status',(req,res)=>{try{res.json(statusPayload(getSession(req.taurusUser.id,req.params.slot)))}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.post('/api/whatsapp/sessions/:slot/backfill',async(req,res)=>{
  try{
    const s=getSession(req.taurusUser.id,req.params.slot);
    s.forceBackfill=true;
    s.activeRecoveryRequested=false;
    s.recoveryPending=[];
    const plan=await backfillPlan(s);
    s.backfill=plan;
    logger.warn({userId:req.taurusUser.id,slot:req.params.slot,sessionId:s.sessionId,connected:Boolean(s.state.connected),cutoffMs:plan.cutoffMs},`manual ${RECOVERY_DAYS}-day backfill armed`);
    if(!s.state.connected){
      await connect(s);
      return res.json({ok:true,mode:'automatic-on-connect',message:`Recuperação de até ${RECOVERY_DAYS} dias iniciada.`,...statusPayload(s)})
    }

    // A sessão já está pareada e conectada. Reinicia somente o socket técnico,
    // preservando as credenciais, para recriar a conexão em manualRecovery=true.
    // Isso faz o próprio botão executar o recovery imediatamente, sem logout/novo QR.
    s.intentionalRestart=true;
    if(s.reconnectTimer)clearTimeout(s.reconnectTimer);
    s.reconnectTimer=null;
    try{s.sock?.end?.(new Error('manual_backfill_immediate_restart'))}catch{}
    s.sock=null;
    await new Promise(resolve=>setTimeout(resolve,700));
    s.intentionalRestart=false;
    const out=await connect(s);
    return res.json({ok:true,mode:'immediate-recovery',message:`Recuperação de até ${RECOVERY_DAYS} dias iniciada.`,...out})
  }catch(err){
    res.status(500).json({ok:false,error:err.message||String(err)})
  }
});
app.delete('/api/whatsapp/sessions/:slot',(req,res)=>{(async()=>{try{const s=getSession(req.taurusUser.id,req.params.slot);try{await s.sock?.logout()}catch{}if(s.reconnectTimer)clearTimeout(s.reconnectTimer);sessions.delete(key(s.userId,s.slot));await fs.rm(s.authDir,{recursive:true,force:true});await fs.rm(s.mediaDir,{recursive:true,force:true});res.json({ok:true})}catch(err){res.status(500).json({ok:false,error:err.message||String(err)})}})()});
app.get('/api/whatsapp/followup/candidates',async(req,res)=>{try{const lim=Math.max(1,Math.min(500,Number(req.query.limit||200))),ss=userSessions(req.taurusUser.id),events=ss.flatMap(s=>s.events.filter(e=>e.eligibleForFollowup).map(e=>({s,e})));events.sort((a,b)=>(b.e.messageTimestampMs||b.e.receivedAtMs||0)-(a.e.messageTimestampMs||a.e.receivedAtMs||0));const selected=events.slice(0,lim);await Promise.allSettled(selected.filter(x=>x.e.media?.status==='stored_gateway'&&x.e.media.supabaseStatus!=='stored').map(x=>persistEventMedia(req,x.s,x.e)));const rows=selected.map(x=>candidateView(x.e));res.json({mode:'hosted',writesEnabled:true,directPersistence:Boolean(SUPABASE_SERVICE_KEY),mediaPersistence:SUPABASE_SERVICE_KEY?'gateway-direct':'gateway-to-supabase-on-read',version:GATEWAY_VERSION,count:events.length,candidates:rows})}catch(err){logger.warn({err},'candidate endpoint failed');res.status(500).json({ok:false,error:err.message||String(err)})}});
app.get('/api/whatsapp/media/:slot/:messageId',async(req,res)=>{try{const s=getSession(req.taurusUser.id,req.params.slot),mid=safeId(req.params.messageId);const files=await fs.readdir(s.mediaDir).catch(()=>[]);const file=files.find(x=>x===mid||x.startsWith(mid+'.'));if(!file)return res.status(404).json({ok:false,error:'media not found'});res.set('Cache-Control','private, max-age=120');res.sendFile(path.join(s.mediaDir,file))}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});

async function cleanupOldMediaCache(){
  const cutoff=Date.now()-72*60*60*1000;
  let removed=0,freed=0;
  async function walk(dir){
    const rows=await fs.readdir(dir,{withFileTypes:true}).catch(()=>[]);
    for(const row of rows){
      const p=path.join(dir,row.name);
      if(row.isDirectory()){await walk(p);continue}
      try{
        const st=await fs.stat(p);
        if(st.mtimeMs<cutoff){await fs.rm(p,{force:true});removed++;freed+=Number(st.size||0)}
      }catch{}
    }
  }
  await fs.mkdir(MEDIA_ROOT,{recursive:true});
  await walk(MEDIA_ROOT);
  if(removed)logger.warn({removed,freedBytes:freed},'old local media cache cleaned');
}
async function restore(){await fs.mkdir(AUTH_ROOT,{recursive:true});await fs.mkdir(MEDIA_ROOT,{recursive:true});await cleanupOldMediaCache();const users=await fs.readdir(AUTH_ROOT,{withFileTypes:true}).catch(()=>[]);for(const u of users.filter(x=>x.isDirectory())){const slots=await fs.readdir(path.join(AUTH_ROOT,u.name),{withFileTypes:true}).catch(()=>[]);for(const sl of slots.filter(x=>x.isDirectory())){try{const s=getSession(u.name,sl.name);s.restoredFromDisk=true;connect(s).catch(err=>logger.warn({err,sessionId:s.sessionId},'restore failed'))}catch{}}}}
await restore();
app.listen(PORT,'0.0.0.0',()=>console.log(`[Taurus WhatsApp Gateway] ${GATEWAY_VERSION} listening on 0.0.0.0:${PORT}`));

import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs/promises';
import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState, downloadContentFromMessage } from 'baileys';

const PORT=Number(process.env.PORT||8787);
const DATA_ROOT=path.resolve(process.env.TAURUS_DATA_ROOT||'./.data');
const AUTH_ROOT=path.join(DATA_ROOT,'auth');
const MEDIA_ROOT=path.join(DATA_ROOT,'media');
const SUPABASE_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SUPABASE_SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const ALLOWED_ORIGIN=process.env.TAURUS_ORIGIN||true;
const MAX_EVENTS=Number(process.env.WA_EVENT_BUFFER||500);
const MAX_MEDIA_BYTES=Number(process.env.WA_MEDIA_MAX_BYTES||25*1024*1024);
const GATEWAY_VERSION='direct-persist-v3';
const logger=pino({level:process.env.LOG_LEVEL||'warn'});
const app=express();
app.use(cors({origin:ALLOWED_ORIGIN,credentials:false}));
app.use(express.json({limit:'128kb'}));

const sessions=new Map();
const FOLLOWUP_TYPES=new Set(['conversation','extendedTextMessage','imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage','contactMessage','contactsArrayMessage','locationMessage','liveLocationMessage']);
const MEDIA_TYPES={imageMessage:{kind:'image',stream:'image'},videoMessage:{kind:'video',stream:'video'},audioMessage:{kind:'audio',stream:'audio'},documentMessage:{kind:'document',stream:'document'},stickerMessage:{kind:'sticker',stream:'sticker'}};

function cleanSlot(v){const s=String(v||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(s))throw new Error('slot inválido');return s}
function safeId(v){return String(v||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,180)}
function encPath(v){return String(v||'').split('/').map(encodeURIComponent).join('/')}
function publicId(userId,slot){return `${userId}.${slot}`}
function key(userId,slot){return `${userId}:${slot}`}
function createSession(userId,slot){return{userId,slot,sessionId:publicId(userId,slot),authDir:path.join(AUTH_ROOT,userId,slot),mediaDir:path.join(MEDIA_ROOT,userId,slot),sock:null,starting:null,reconnectTimer:null,events:[],state:{phase:'idle',connected:false,qr:null,qrDataUrl:null,user:null,lastError:null,updatedAt:new Date().toISOString()}}}
function getSession(userId,slot){slot=cleanSlot(slot);const k=key(userId,slot);if(!sessions.has(k))sessions.set(k,createSession(userId,slot));return sessions.get(k)}
function patch(s,next){s.state={...s.state,...next,updatedAt:new Date().toISOString()}}
function statusPayload(s){return{slot:s.slot,sessionId:s.sessionId,phase:s.state.phase,connected:s.state.connected,qrDataUrl:s.state.qrDataUrl,user:s.state.user,lastError:s.state.lastError,eventCount:s.events.length,followupCandidateCount:s.events.filter(e=>e.eligibleForFollowup).length,directPersistence:Boolean(SUPABASE_SERVICE_KEY),updatedAt:s.state.updatedAt}}
function adminStatusPayload(s){const p=statusPayload(s);p.qrDataUrl=null;return p}
function asEpochMs(v){if(v==null)return null;if(typeof v==='number')return v>1e12?v:v*1000;if(typeof v==='bigint')return Number(v)*1000;if(typeof v==='string'){const n=Number(v);return Number.isFinite(n)?(n>1e12?n:n*1000):null}if(typeof v?.toNumber==='function')return v.toNumber()*1000;const n=Number(v);return Number.isFinite(n)?(n>1e12?n:n*1000):null}
function phoneFromJid(jid){const m=String(jid||'').match(/^(\d+)@s\.whatsapp\.net$/);return m?m[1]:null}
function messageText(message,type){if(!message||!type)return null;try{if(type==='conversation')return String(message.conversation||'').trim()||null;if(type==='extendedTextMessage')return String(message.extendedTextMessage?.text||'').trim()||null;if(type==='imageMessage')return String(message.imageMessage?.caption||'').trim()||'[imagem]';if(type==='videoMessage')return String(message.videoMessage?.caption||'').trim()||'[vídeo]';if(type==='audioMessage')return'[áudio]';if(type==='stickerMessage')return'[figurinha]';if(type==='documentMessage')return String(message.documentMessage?.fileName||message.documentMessage?.caption||'[documento]').trim();if(type==='contactMessage')return'[contato]';if(type==='contactsArrayMessage')return'[contatos]';if(type==='locationMessage'||type==='liveLocationMessage')return'[localização]'}catch{}return null}
function extFor(mime,kind){const m=String(mime||'').toLowerCase();if(m.includes('jpeg'))return'jpg';if(m.includes('png'))return'png';if(m.includes('webp'))return'webp';if(m.includes('gif'))return'gif';if(m.includes('ogg'))return'ogg';if(m.includes('opus'))return'opus';if(m.includes('mpeg'))return'mp3';if(m.includes('aac'))return'aac';if(m.includes('wav'))return'wav';if(m.includes('webm'))return'webm';if(m.includes('quicktime'))return'mov';if(m.includes('mp4'))return'mp4';if(m.includes('pdf'))return'pdf';if(m.includes('word'))return'docx';return kind==='audio'?'bin':kind==='image'?'img':kind==='video'?'vid':'bin'}
function classify(e){if(!e.live||e.upsertType!=='notify')return{eligible:false,reason:'historico_ou_sync'};if(!e.hasMessage)return{eligible:false,reason:'sem_payload'};const jid=String(e.chatJid||'');if(jid.endsWith('@g.us'))return{eligible:false,reason:'grupo'};if(jid==='status@broadcast'||jid.endsWith('@broadcast'))return{eligible:false,reason:'broadcast_status'};if(!FOLLOWUP_TYPES.has(e.messageType))return{eligible:false,reason:'tipo_tecnico_ou_nao_relevante'};return{eligible:true,reason:null}}
function pushEvent(s,e){s.events.push(e);if(s.events.length>MAX_EVENTS)s.events.splice(0,s.events.length-MAX_EVENTS)}
async function captureMedia(s,msg,e){const spec=MEDIA_TYPES[e.messageType];if(!spec||!e.eligibleForFollowup||!e.messageId)return;const node=msg.message?.[e.messageType];if(!node)return;const meta={kind:spec.kind,mimeType:node.mimetype||null,fileName:node.fileName||null,durationSeconds:Number(node.seconds||0)||null,caption:node.caption||null,status:'downloading',byteSize:null,error:null,supabaseStatus:'pending',persistError:null,storagePath:null};e.media=meta;try{const chunks=[];let total=0;const stream=await downloadContentFromMessage(node,spec.stream);for await(const chunk of stream){const b=Buffer.from(chunk);total+=b.length;if(total>MAX_MEDIA_BYTES)throw new Error('mídia excede limite do gateway');chunks.push(b)}const buf=Buffer.concat(chunks);await fs.mkdir(s.mediaDir,{recursive:true});const file=`${safeId(e.messageId)}.${extFor(meta.mimeType,spec.kind)}`;await fs.writeFile(path.join(s.mediaDir,file),buf);Object.assign(meta,{status:'stored_gateway',byteSize:buf.length,file})}catch(err){Object.assign(meta,{status:'failed',supabaseStatus:'capture_failed',error:err?.message||String(err)});logger.warn({err,sessionId:s.sessionId,messageId:e.messageId},'media capture failed')}}
function serviceHeaders(extra={}){return{apikey:SUPABASE_SERVICE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_KEY}`,'Content-Type':'application/json','Accept-Profile':'crm','Content-Profile':'crm',...extra}}
async function rpcAsService(name,args={}){if(!SUPABASE_SERVICE_KEY)throw new Error('service role ausente');const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify(args)});const text=await r.text();if(!r.ok)throw new Error(`${name} ${r.status}: ${text.slice(0,240)}`);try{return text?JSON.parse(text):null}catch{return text}}
async function uploadAsService(storagePath,buf,mime){if(!SUPABASE_SERVICE_KEY)throw new Error('service role ausente');const r=await fetch(`${SUPABASE_URL}/storage/v1/object/whatsapp-media/${encPath(storagePath)}`,{method:'POST',headers:{apikey:SUPABASE_SERVICE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_KEY}`,'Content-Type':mime||'application/octet-stream','x-upsert':'true'},body:buf});const text=await r.text();if(!r.ok)throw new Error(`storage ${r.status}: ${text.slice(0,240)}`);return text}
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
    logger.info({sessionId:e.sessionId,messageId:e.messageId,storagePath},'event/media persisted directly');
  }catch(err){e.persistenceStatus='error';if(e.media){e.media.supabaseStatus='error';e.media.persistError=err?.message||String(err)}logger.warn({err,sessionId:e.sessionId,messageId:e.messageId},'direct persistence failed')}
}
async function captureUpsert(s,upsert){const receivedAt=Date.now(),upsertType=upsert?.type||'unknown';for(const msg of upsert?.messages||[]){const jid=msg?.key?.remoteJid||null;if(!jid)continue;const alt=msg?.key?.remoteJidAlt||null;const type=msg?.message?Object.keys(msg.message)[0]||null:null;const e={sessionId:s.sessionId,slot:s.slot,source:'messages.upsert',upsertType,live:upsertType==='notify',messageId:msg?.key?.id||null,chatJid:jid,chatJidAlt:alt,contactPhone:phoneFromJid(jid)||phoneFromJid(alt)||null,fromMe:Boolean(msg?.key?.fromMe),direction:msg?.key?.fromMe?'outbound':'inbound',messageTimestampMs:asEpochMs(msg?.messageTimestamp),receivedAtMs:receivedAt,hasMessage:Boolean(msg?.message),messageType:type,messageText:messageText(msg?.message,type),media:null,persistenceStatus:'pending'};const c=classify(e);e.eligibleForFollowup=c.eligible;e.ignoreReason=c.reason;e.dedupeKey=`${s.sessionId}:${e.messageId||'sem-id'}`;pushEvent(s,e);if(e.eligibleForFollowup&&MEDIA_TYPES[type])await captureMedia(s,msg,e);if(e.eligibleForFollowup&&SUPABASE_SERVICE_KEY)await persistEventDirect(s,e)}}
async function connect(s){if(s.starting)return s.starting;if(s.sock&&s.state.connected)return statusPayload(s);s.starting=(async()=>{patch(s,{phase:'starting',connected:false,lastError:null});await fs.mkdir(s.authDir,{recursive:true});const{state:auth,saveCreds}=await useMultiFileAuthState(s.authDir);const sock=makeWASocket({auth,browser:Browsers.windows('Desktop'),syncFullHistory:false,markOnlineOnConnect:false,printQRInTerminal:false,logger});s.sock=sock;sock.ev.on('creds.update',saveCreds);sock.ev.on('messages.upsert',u=>captureUpsert(s,u).catch(err=>logger.warn({err,sessionId:s.sessionId},'message capture failed')));sock.ev.on('connection.update',async u=>{const{connection,qr,lastDisconnect}=u;if(qr){let qrDataUrl=null;try{qrDataUrl=await QRCode.toDataURL(qr,{margin:2,width:320,errorCorrectionLevel:'M'})}catch{}patch(s,{phase:'qr',connected:false,qrDataUrl,lastError:null})}if(connection==='open'){if(s.reconnectTimer)clearTimeout(s.reconnectTimer);s.reconnectTimer=null;patch(s,{phase:'connected',connected:true,qrDataUrl:null,user:sock.user?{id:sock.user.id||null,name:sock.user.name||null}:null,lastError:null})}if(connection==='close'){const code=lastDisconnect?.error?.output?.statusCode;const loggedOut=code===DisconnectReason.loggedOut;patch(s,{phase:loggedOut?'logged_out':'disconnected',connected:false,qrDataUrl:null,lastError:lastDisconnect?.error?.message||String(lastDisconnect?.error||'connection closed')});s.sock=null;if(!loggedOut&&!s.reconnectTimer){s.reconnectTimer=setTimeout(()=>{s.reconnectTimer=null;connect(s).catch(err=>patch(s,{phase:'error',lastError:err.message||String(err)}))},1800)}}});return statusPayload(s)})();try{return await s.starting}catch(err){patch(s,{phase:'error',connected:false,lastError:err.message||String(err)});throw err}finally{s.starting=null}}
async function authenticate(req){if(!SUPABASE_URL||!SUPABASE_KEY)throw Object.assign(new Error('gateway sem configuração Supabase'),{status:503});const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))throw Object.assign(new Error('não autenticado'),{status:401});const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!r.ok)throw Object.assign(new Error('sessão Taurus inválida'),{status:401});const u=await r.json();if(!u?.id)throw Object.assign(new Error('usuário inválido'),{status:401});return u}
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
    logger.info({sessionId:e.sessionId,messageId:e.messageId,storagePath},'media persisted to Supabase');
  }catch(err){e.media.supabaseStatus='error';e.media.persistError=err?.message||String(err);logger.warn({err,sessionId:e.sessionId,messageId:e.messageId},'media Supabase persistence failed')}
}
function candidateView(e){return{sessionId:e.sessionId,slot:e.slot,messageId:e.messageId,dedupeKey:e.dedupeKey,direction:e.direction,messageTimestampMs:e.messageTimestampMs,receivedAtMs:e.receivedAtMs,messageType:e.messageType,messageText:e.messageText,chatJid:e.chatJid,chatJidAlt:e.chatJidAlt,contactPhone:e.contactPhone,eligibleForFollowup:e.eligibleForFollowup,ignoreReason:e.ignoreReason,persistenceStatus:e.persistenceStatus||null,media:e.media?{...e.media,url:null}:null}}
function userSessions(userId){return[...sessions.values()].filter(s=>s.userId===userId)}

app.get('/health',(_req,res)=>res.json({ok:true,service:'taurus-whatsapp-gateway',mode:'hosted-multisession',version:GATEWAY_VERSION,sessions:sessions.size,directPersistence:Boolean(SUPABASE_SERVICE_KEY),dataRoot:DATA_ROOT,adminSessionView:true}));
app.use('/api/whatsapp',authMw);
app.get('/api/whatsapp/sessions',async(req,res)=>{try{const target=await resolveSessionTarget(req);const rows=userSessions(target.userId).map(s=>target.readOnly?adminStatusPayload(s):statusPayload(s));res.json({sessions:rows,targetUserId:target.userId,readOnly:target.readOnly,viewerRole:target.viewerRole})}catch(err){res.status(err.status||500).json({ok:false,error:err.message||String(err)})}});
app.post('/api/whatsapp/sessions/:slot/start',async(req,res)=>{try{res.json({ok:true,...await connect(getSession(req.taurusUser.id,req.params.slot))})}catch(err){res.status(500).json({ok:false,error:err.message||String(err)})}});
app.get('/api/whatsapp/sessions/:slot/status',(req,res)=>{try{res.json(statusPayload(getSession(req.taurusUser.id,req.params.slot)))}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.delete('/api/whatsapp/sessions/:slot',(req,res)=>{(async()=>{try{const s=getSession(req.taurusUser.id,req.params.slot);try{await s.sock?.logout()}catch{}if(s.reconnectTimer)clearTimeout(s.reconnectTimer);sessions.delete(key(s.userId,s.slot));await fs.rm(s.authDir,{recursive:true,force:true});await fs.rm(s.mediaDir,{recursive:true,force:true});res.json({ok:true})}catch(err){res.status(500).json({ok:false,error:err.message||String(err)})}})()});
app.get('/api/whatsapp/followup/candidates',async(req,res)=>{try{const lim=Math.max(1,Math.min(500,Number(req.query.limit||200))),ss=userSessions(req.taurusUser.id),events=ss.flatMap(s=>s.events.filter(e=>e.eligibleForFollowup).map(e=>({s,e})));events.sort((a,b)=>(b.e.messageTimestampMs||b.e.receivedAtMs||0)-(a.e.messageTimestampMs||a.e.receivedAtMs||0));const selected=events.slice(0,lim);await Promise.allSettled(selected.filter(x=>x.e.media?.status==='stored_gateway'&&x.e.media.supabaseStatus!=='stored').map(x=>persistEventMedia(req,x.s,x.e)));const rows=selected.map(x=>candidateView(x.e));res.json({mode:'hosted',writesEnabled:true,directPersistence:Boolean(SUPABASE_SERVICE_KEY),mediaPersistence:SUPABASE_SERVICE_KEY?'gateway-direct':'gateway-to-supabase-on-read',version:GATEWAY_VERSION,count:events.length,candidates:rows})}catch(err){logger.warn({err},'candidate endpoint failed');res.status(500).json({ok:false,error:err.message||String(err)})}});
app.get('/api/whatsapp/media/:slot/:messageId',async(req,res)=>{try{const s=getSession(req.taurusUser.id,req.params.slot),mid=safeId(req.params.messageId);const files=await fs.readdir(s.mediaDir).catch(()=>[]);const file=files.find(x=>x===mid||x.startsWith(mid+'.'));if(!file)return res.status(404).json({ok:false,error:'media not found'});res.set('Cache-Control','private, max-age=120');res.sendFile(path.join(s.mediaDir,file))}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});

async function restore(){await fs.mkdir(AUTH_ROOT,{recursive:true});await fs.mkdir(MEDIA_ROOT,{recursive:true});const users=await fs.readdir(AUTH_ROOT,{withFileTypes:true}).catch(()=>[]);for(const u of users.filter(x=>x.isDirectory())){const slots=await fs.readdir(path.join(AUTH_ROOT,u.name),{withFileTypes:true}).catch(()=>[]);for(const sl of slots.filter(x=>x.isDirectory())){try{const s=getSession(u.name,sl.name);connect(s).catch(err=>logger.warn({err,sessionId:s.sessionId},'restore failed'))}catch{}}}}
await restore();
app.listen(PORT,'0.0.0.0',()=>console.log(`[Taurus WhatsApp Gateway] ${GATEWAY_VERSION} listening on 0.0.0.0:${PORT}`));

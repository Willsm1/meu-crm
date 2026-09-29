import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  downloadContentFromMessage
} from 'baileys';

const PORT = Number(process.env.PORT || 8787);
const AUTH_ROOT = process.env.WA_AUTH_ROOT || './.auth';
const MEDIA_ROOT = process.env.WA_MEDIA_ROOT || './.media';
const DEFAULT_SESSION_ID = process.env.WA_DEFAULT_SESSION_ID || 'taurus-test';
const MAX_EVENTS_PER_SESSION = Number(process.env.WA_EVENT_BUFFER || 500);
const MAX_MEDIA_BYTES = Number(process.env.WA_MEDIA_MAX_BYTES || 25 * 1024 * 1024);
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();
const mediaIndex = new Map();
const FOLLOWUP_MESSAGE_TYPES = new Set([
  'conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage',
  'audioMessage', 'documentMessage', 'stickerMessage', 'contactMessage',
  'contactsArrayMessage', 'locationMessage', 'liveLocationMessage'
]);
const MEDIA_TYPES = {
  imageMessage:{kind:'image',stream:'image'},
  videoMessage:{kind:'video',stream:'video'},
  audioMessage:{kind:'audio',stream:'audio'},
  documentMessage:{kind:'document',stream:'document'},
  stickerMessage:{kind:'sticker',stream:'sticker'}
};

function normalizeSessionId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) throw new Error('sessionId invalido');
  return id;
}
function safeMessageId(value){return String(value||'').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}
function createSession(sessionId) {
  return { sessionId, authDir:path.join(AUTH_ROOT,sessionId), sock:null, starting:null, reconnectTimer:null, events:[], state:{phase:'idle',connected:false,qr:null,qrDataUrl:null,user:null,lastError:null,updatedAt:new Date().toISOString()} };
}
function getSession(value=DEFAULT_SESSION_ID){const id=normalizeSessionId(value);if(!sessions.has(id))sessions.set(id,createSession(id));return sessions.get(id)}
function patch(session,next){session.state={...session.state,...next,updatedAt:new Date().toISOString()}}
function statusPayload(session){const candidates=session.events.filter(e=>e.eligibleForFollowup).length;return{sessionId:session.sessionId,phase:session.state.phase,connected:session.state.connected,qr:session.state.qr,qrDataUrl:session.state.qrDataUrl,user:session.state.user,lastError:session.state.lastError,eventCount:session.events.length,followupCandidateCount:candidates,updatedAt:session.state.updatedAt}}
function asEpochMs(value){if(value==null)return null;if(typeof value==='number')return value>1e12?value:value*1000;if(typeof value==='bigint')return Number(value)*1000;if(typeof value==='string'){const n=Number(value);return Number.isFinite(n)?(n>1e12?n:n*1000):null}if(typeof value?.toNumber==='function')return value.toNumber()*1000;const n=Number(value);return Number.isFinite(n)?(n>1e12?n:n*1000):null}
function phoneFromJid(jid){const m=String(jid||'').match(/^(\d+)@s\.whatsapp\.net$/);return m?m[1]:null}
function messageText(message,type){
  if(!message||!type)return null;
  try{
    if(type==='conversation') return String(message.conversation||'').trim()||null;
    if(type==='extendedTextMessage') return String(message.extendedTextMessage?.text||'').trim()||null;
    if(type==='imageMessage') return String(message.imageMessage?.caption||'').trim()||'[imagem]';
    if(type==='videoMessage') return String(message.videoMessage?.caption||'').trim()||'[vídeo]';
    if(type==='audioMessage') return '[áudio]';
    if(type==='stickerMessage') return '[figurinha]';
    if(type==='documentMessage') return String(message.documentMessage?.fileName||message.documentMessage?.caption||'[documento]').trim();
    if(type==='contactMessage') return '[contato]';
    if(type==='contactsArrayMessage') return '[contatos]';
    if(type==='locationMessage'||type==='liveLocationMessage') return '[localização]';
  }catch(e){}
  return null;
}
function classifyForFollowup(event){if(!event.live||event.upsertType!=='notify')return{eligible:false,reason:'historico_ou_sync'};if(!event.hasMessage)return{eligible:false,reason:'sem_payload'};const jid=String(event.chatJid||'');if(jid.endsWith('@g.us'))return{eligible:false,reason:'grupo'};if(jid==='status@broadcast'||jid.endsWith('@broadcast'))return{eligible:false,reason:'broadcast_status'};if(!FOLLOWUP_MESSAGE_TYPES.has(event.messageType))return{eligible:false,reason:'tipo_tecnico_ou_nao_relevante'};return{eligible:true,reason:null}}
function pushEvent(session,event){session.events.push(event);if(session.events.length>MAX_EVENTS_PER_SESSION)session.events.splice(0,session.events.length-MAX_EVENTS_PER_SESSION)}
function mediaNode(message,type){return message?.[type]||null}
function extFor(mime,kind){const m=String(mime||'').toLowerCase();if(m.includes('jpeg'))return'jpg';if(m.includes('png'))return'png';if(m.includes('webp'))return'webp';if(m.includes('ogg'))return'ogg';if(m.includes('mpeg'))return'mp3';if(m.includes('mp4'))return'mp4';if(m.includes('pdf'))return'pdf';if(m.includes('word'))return'docx';return kind==='audio'?'bin':kind==='image'?'img':kind==='video'?'vid':'bin'}
async function captureMedia(session,msg,event){
  const spec=MEDIA_TYPES[event.messageType]; if(!spec||!event.eligibleForFollowup||!event.messageId)return null;
  const node=mediaNode(msg.message,event.messageType); if(!node)return null;
  const meta={kind:spec.kind,mimeType:node.mimetype||null,fileName:node.fileName||null,durationSeconds:Number(node.seconds||0)||null,caption:node.caption||null,status:'downloading',byteSize:null,url:null,error:null};
  event.media=meta;
  try{
    const chunks=[]; let total=0;
    const stream=await downloadContentFromMessage(node,spec.stream);
    for await (const chunk of stream){const b=Buffer.from(chunk);total+=b.length;if(total>MAX_MEDIA_BYTES)throw new Error('media excede limite local de teste');chunks.push(b)}
    const buffer=Buffer.concat(chunks); const ext=extFor(meta.mimeType,spec.kind); const sid=normalizeSessionId(session.sessionId); const mid=safeMessageId(event.messageId);
    const dir=path.resolve(MEDIA_ROOT,sid); await fs.mkdir(dir,{recursive:true}); const file=path.join(dir,`${mid}.${ext}`); await fs.writeFile(file,buffer);
    const k=`${sid}:${event.messageId}`; const rec={file,mimeType:meta.mimeType||'application/octet-stream',byteSize:buffer.length,kind:spec.kind,fileName:meta.fileName||null}; mediaIndex.set(k,rec);
    Object.assign(meta,{status:'stored_local',byteSize:buffer.length,url:`http://127.0.0.1:${PORT}/media/${encodeURIComponent(sid)}/${encodeURIComponent(event.messageId)}`});
  }catch(err){Object.assign(meta,{status:'failed',error:err?.message||String(err)});logger.warn({err,sessionId:session.sessionId,messageId:event.messageId},'failed to capture media')}
  return meta;
}
async function captureMessageUpsert(session,upsert){const receivedAt=Date.now();const type=upsert?.type||'unknown';for(const msg of upsert?.messages||[]){const jid=msg?.key?.remoteJid||null;if(!jid)continue;const chatJidAlt=msg?.key?.remoteJidAlt||null;const participantJid=msg?.key?.participant||null;const participantJidAlt=msg?.key?.participantAlt||null;const mType=msg?.message?Object.keys(msg.message)[0]||null:null;const event={sessionId:session.sessionId,source:'messages.upsert',upsertType:type,live:type==='notify',messageId:msg?.key?.id||null,chatJid:jid,chatJidAlt,participantJid,participantJidAlt,contactPhone:phoneFromJid(jid)||phoneFromJid(chatJidAlt)||null,fromMe:Boolean(msg?.key?.fromMe),direction:msg?.key?.fromMe?'outbound':'inbound',messageTimestampMs:asEpochMs(msg?.messageTimestamp),receivedAtMs:receivedAt,hasMessage:Boolean(msg?.message),messageType:mType,messageText:messageText(msg?.message,mType),media:null};const c=classifyForFollowup(event);event.eligibleForFollowup=c.eligible;event.ignoreReason=c.reason;event.dedupeKey=`${session.sessionId}:${event.messageId||'sem-id'}`;pushEvent(session,event);if(event.eligibleForFollowup&&MEDIA_TYPES[mType])await captureMedia(session,msg,event)}}
async function connect(sessionId=DEFAULT_SESSION_ID){const session=getSession(sessionId);if(session.starting)return session.starting;if(session.sock&&session.state.connected)return statusPayload(session);session.starting=(async()=>{patch(session,{phase:'starting',connected:false,lastError:null});const{state:auth,saveCreds}=await useMultiFileAuthState(session.authDir);const nextSock=makeWASocket({auth,browser:Browsers.windows('Desktop'),syncFullHistory:false,markOnlineOnConnect:false,printQRInTerminal:false,logger});session.sock=nextSock;nextSock.ev.on('creds.update',saveCreds);nextSock.ev.on('messages.upsert',upsert=>captureMessageUpsert(session,upsert).catch(err=>logger.warn({err,sessionId:session.sessionId},'message capture failed')));nextSock.ev.on('connection.update',async update=>{const{connection,qr,lastDisconnect}=update;if(qr){let qrDataUrl=null;try{qrDataUrl=await QRCode.toDataURL(qr,{margin:2,width:320,errorCorrectionLevel:'M'})}catch(err){logger.warn({err,sessionId:session.sessionId},'failed to render qr')}patch(session,{phase:'qr',connected:false,qr,qrDataUrl,lastError:null})}if(connection==='open'){if(session.reconnectTimer)clearTimeout(session.reconnectTimer);session.reconnectTimer=null;patch(session,{phase:'connected',connected:true,qr:null,qrDataUrl:null,user:nextSock.user?{id:nextSock.user.id||null,name:nextSock.user.name||null}:null,lastError:null})}if(connection==='close'){const statusCode=lastDisconnect?.error?.output?.statusCode;const loggedOut=statusCode===DisconnectReason.loggedOut;patch(session,{phase:loggedOut?'logged_out':'disconnected',connected:false,qr:null,qrDataUrl:null,lastError:lastDisconnect?.error?.message||String(lastDisconnect?.error||'connection closed')});session.sock=null;if(!loggedOut&&!session.reconnectTimer){session.reconnectTimer=setTimeout(()=>{session.reconnectTimer=null;connect(session.sessionId).catch(err=>patch(session,{phase:'error',lastError:err.message||String(err)}))},1500)}}});return statusPayload(session)})();try{return await session.starting}catch(err){patch(session,{phase:'error',connected:false,lastError:err.message||String(err)});throw err}finally{session.starting=null}}
async function restorePersistedSessions(){try{await fs.mkdir(AUTH_ROOT,{recursive:true});await fs.mkdir(MEDIA_ROOT,{recursive:true});const entries=await fs.readdir(AUTH_ROOT,{withFileTypes:true});const ids=entries.filter(e=>e.isDirectory()).map(e=>e.name).filter(id=>/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id));for(const id of ids)connect(id).catch(err=>logger.warn({err,sessionId:id},'autostart session failed'))}catch(err){logger.warn({err},'failed to scan persisted sessions')}}
function sessionFromRequest(req){return getSession(req.params.sessionId||req.query.sessionId||DEFAULT_SESSION_ID)}
function candidateView(event){return{sessionId:event.sessionId,messageId:event.messageId,dedupeKey:event.dedupeKey,direction:event.direction,messageTimestampMs:event.messageTimestampMs,receivedAtMs:event.receivedAtMs,messageType:event.messageType,messageText:event.messageText,chatJid:event.chatJid,chatJidAlt:event.chatJidAlt,contactPhone:event.contactPhone,eligibleForFollowup:event.eligibleForFollowup,ignoreReason:event.ignoreReason,media:event.media||null}}
app.get('/health',(_req,res)=>res.json({ok:true,service:'taurus-whatsapp-qr-poc',gate:'3.2',mode:'observer-media-test',sessions:[...sessions.values()].map(statusPayload)}));
app.get('/sessions',(_req,res)=>res.json({sessions:[...sessions.values()].map(statusPayload)}));
app.get('/session/status',(req,res)=>res.json(statusPayload(sessionFromRequest(req))));
app.post('/session/start',async(req,res)=>{const sessionId=req.body?.sessionId||req.query.sessionId||DEFAULT_SESSION_ID;try{res.json({ok:true,...(await connect(sessionId))})}catch(err){res.status(500).json({ok:false,error:err.message||String(err),...statusPayload(getSession(sessionId))})}});
app.get('/session/:sessionId/status',(req,res)=>{try{res.json(statusPayload(getSession(req.params.sessionId)))}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.post('/session/:sessionId/start',async(req,res)=>{try{res.json({ok:true,...(await connect(req.params.sessionId))})}catch(err){res.status(500).json({ok:false,error:err.message||String(err)})}});
app.get('/session/:sessionId/events',(req,res)=>{try{const session=getSession(req.params.sessionId);const requested=Number(req.query.limit||100);const limit=Math.max(1,Math.min(500,Number.isFinite(requested)?requested:100));res.json({sessionId:session.sessionId,count:session.events.length,events:session.events.slice(-limit).map(candidateView)})}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.get('/followup/candidates',(req,res)=>{const sessionId=req.query.sessionId?normalizeSessionId(req.query.sessionId):null;const requested=Number(req.query.limit||100);const limit=Math.max(1,Math.min(500,Number.isFinite(requested)?requested:100));const source=sessionId?[getSession(sessionId)]:[...sessions.values()];const rows=source.flatMap(s=>s.events.filter(e=>e.eligibleForFollowup).map(candidateView));rows.sort((a,b)=>(b.messageTimestampMs||b.receivedAtMs||0)-(a.messageTimestampMs||a.receivedAtMs||0));res.json({mode:'observer',writesEnabled:false,count:rows.length,candidates:rows.slice(0,limit)})});
app.get('/followup/observer',(_req,res)=>{const sessionRows=[...sessions.values()].map(statusPayload);const candidates=[...sessions.values()].flatMap(s=>s.events.filter(e=>e.eligibleForFollowup).map(candidateView));const ignored=[...sessions.values()].flatMap(s=>s.events.filter(e=>!e.eligibleForFollowup).map(candidateView));candidates.sort((a,b)=>(b.messageTimestampMs||0)-(a.messageTimestampMs||0));res.json({mode:'observer',writesEnabled:false,summary:{sessions:sessionRows.length,connected:sessionRows.filter(s=>s.connected).length,candidates:candidates.length,ignored:ignored.length},sessions:sessionRows,candidates:candidates.slice(0,100)})});
app.get('/media/:sessionId/:messageId',(req,res)=>{try{const sid=normalizeSessionId(req.params.sessionId),k=`${sid}:${req.params.messageId}`,rec=mediaIndex.get(k);if(!rec)return res.status(404).json({ok:false,error:'media not found in this runtime'});res.type(rec.mimeType);res.set('Cache-Control','private, max-age=300');res.sendFile(rec.file)}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.delete('/session/:sessionId/events',(req,res)=>{try{const session=getSession(req.params.sessionId);session.events.length=0;res.json({ok:true,sessionId:session.sessionId,count:0})}catch(err){res.status(400).json({ok:false,error:err.message||String(err)})}});
app.listen(PORT,'127.0.0.1',()=>{console.log(`[Taurus WhatsApp QR POC] http://127.0.0.1:${PORT}`);console.log('[Gate 3.2] observer visual + texto + captura LOCAL de mídia 1:1 para teste; ZERO escrita direta pelo serviço local.');restorePersistedSessions()});

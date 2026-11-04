export const FOLLOWUP_TYPES=new Set(['conversation','extendedTextMessage','imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage','contactMessage','contactsArrayMessage','locationMessage','liveLocationMessage']);

const MESSAGE_WRAPPERS=['ephemeralMessage','viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','documentWithCaptionMessage'];

export function extractMessageContent(message){
  let current=message;
  for(let depth=0;depth<6&&current&&typeof current==='object';depth++){
    for(const type of FOLLOWUP_TYPES){
      if(Object.prototype.hasOwnProperty.call(current,type)){
        return{type,message:current,node:current[type]};
      }
    }
    const wrapper=MESSAGE_WRAPPERS.find(type=>current?.[type]?.message);
    if(!wrapper)break;
    current=current[wrapper].message;
  }
  return{type:null,message:current||message||null,node:null};
}

export function phoneFromJid(jid){
  const m=String(jid||'').match(/^(\d+)@s\.whatsapp\.net$/);
  return m?m[1]:null;
}

export function phoneFromMessageKey(key={},lidPnMap=new Map()){
  const candidates=[key.remoteJidAlt,key.participantAlt,key.participantPn,key.senderPn,key.remoteJid,key.participant];
  for(const jid of candidates){
    const phone=phoneFromJid(jid);
    if(phone)return phone;
  }
  for(const jid of [key.remoteJid,key.participant]){
    const mapped=lidPnMap?.get(String(jid||''));
    if(mapped)return mapped;
  }
  return null;
}

export function classifyEvent(e){
  if(!e.hasMessage)return{eligible:false,reason:'sem_payload'};
  const jid=String(e.chatJid||'');
  if(jid.endsWith('@g.us'))return{eligible:false,reason:'grupo'};
  if(jid==='status@broadcast'||jid.endsWith('@broadcast'))return{eligible:false,reason:'broadcast_status'};
  if(!FOLLOWUP_TYPES.has(e.messageType))return{eligible:false,reason:'tipo_tecnico_ou_nao_relevante'};
  if(e.upsertType==='notify')return{eligible:true,reason:null};
  const ageMs=Math.abs(Number(e.receivedAtMs||Date.now())-Number(e.messageTimestampMs||0));
  if(e.upsertType==='append'&&e.fromMe&&e.messageTimestampMs&&ageMs<=180000)return{eligible:true,reason:null,linkedDeviceOutbound:true};
  if(e.upsertType==='append'&&e.messageTimestampMs&&e.backfillEligible===true)return{eligible:true,reason:null,historyBackfill:true};
  return{eligible:false,reason:'historico_ou_sync'};
}

export function disconnectPolicy(code){
  const loggedOut=Number(code)===401;
  const restartRequired=Number(code)===515;
  return{loggedOut,restartRequired,reconnectDelayMs:loggedOut?null:(restartRequired?4000:1800)};
}

export function shouldSyncHistory(mode){
  return mode==='history';
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEvent, disconnectPolicy, phoneFromMessageKey, shouldSyncHistory, historyBackfillPlan } from '../core.mjs';

const base={hasMessage:true,chatJid:'5511999999999@s.whatsapp.net',messageType:'conversation',receivedAtMs:1_000_000,messageTimestampMs:1_000_000,fromMe:false};

test('notify direct message is eligible realtime',()=>{
  assert.deepEqual(classifyEvent({...base,upsertType:'notify'}),{eligible:true,reason:null});
});

test('group and status are excluded',()=>{
  assert.equal(classifyEvent({...base,upsertType:'notify',chatJid:'123@g.us'}).eligible,false);
  assert.equal(classifyEvent({...base,upsertType:'notify',chatJid:'status@broadcast'}).eligible,false);
});

test('recent outbound append is eligible linked-device outbound',()=>{
  const r=classifyEvent({...base,upsertType:'append',fromMe:true,receivedAtMs:1_100_000,messageTimestampMs:1_000_000});
  assert.equal(r.eligible,true);
  assert.equal(r.linkedDeviceOutbound,true);
});

test('history append is only eligible when explicitly backfill eligible',()=>{
  assert.equal(classifyEvent({...base,upsertType:'append',fromMe:false,backfillEligible:false}).eligible,false);
  const r=classifyEvent({...base,upsertType:'append',fromMe:false,backfillEligible:true});
  assert.equal(r.eligible,true);
  assert.equal(r.historyBackfill,true);
});

test('515 requests restart without logout',()=>{
  assert.deepEqual(disconnectPolicy(515),{loggedOut:false,restartRequired:true,reconnectDelayMs:4000});
});

test('logged out does not reconnect',()=>{
  const r=disconnectPolicy(401);
  assert.equal(r.loggedOut,true);
  assert.equal(r.reconnectDelayMs,null);
});

test('LID resolves through PN alias map',()=>{
  const map=new Map([['12345@lid','5511977392993']]);
  assert.equal(phoneFromMessageKey({remoteJid:'12345@lid'},map),'5511977392993');
  assert.equal(phoneFromMessageKey({remoteJid:'12345@lid',remoteJidAlt:'5511997479902@s.whatsapp.net'},map),'5511997479902');
});

test('history sync stays disabled in normal realtime mode',()=>{
  assert.equal(shouldSyncHistory('realtime'),false);
  assert.equal(shouldSyncHistory('history'),true);
});


test('outbound notify from linked phone or WhatsApp Web is eligible realtime',()=>{
  const r=classifyEvent({...base,upsertType:'notify',fromMe:true});
  assert.equal(r.eligible,true);
});

test('stale persisted history enables bounded automatic backfill',()=>{
  const day=24*60*60*1000,now=10*day,latest=8*day;
  const p=historyBackfillPlan(latest,now);
  assert.equal(p.enabled,true);
  assert.equal(p.manual,false);
  assert.ok(p.cutoffMs>=now-7*day);
  assert.ok(p.cutoffMs<=latest);
});

test('fresh persisted history stays realtime-only',()=>{
  const now=10_000_000;
  const p=historyBackfillPlan(now-5*60*1000,now);
  assert.equal(p.enabled,false);
});

test('missing persisted history requests at most seven days',()=>{
  const day=24*60*60*1000,now=20*day;
  const p=historyBackfillPlan(null,now);
  assert.equal(p.enabled,true);
  assert.equal(p.cutoffMs,now-7*day);
});

test('forced history recovery remains capped at seven days',()=>{
  const day=24*60*60*1000,now=20*day;
  const p=historyBackfillPlan(now-day,now,{force:true});
  assert.equal(p.enabled,true);
  assert.equal(p.manual,true);
  assert.equal(p.cutoffMs,now-7*day);
});

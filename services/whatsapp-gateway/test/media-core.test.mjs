import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadMediaBuffer, shouldCleanupLocalMedia } from '../media-core.mjs';

function streamOf(...chunks){return (async function*(){for(const c of chunks)yield Buffer.from(c)})()}

test('media download retries once and returns bytes on second attempt',async()=>{
  let attempts=0;
  const download=async()=>{attempts++;if(attempts===1)throw new Error('temporary');return streamOf('abc')};
  const waits=[];
  const out=await downloadMediaBuffer({node:{},streamType:'audio',download,maxBytes:100,attempts:2,delayMs:750,wait:async ms=>waits.push(ms)});
  assert.equal(out.toString(),'abc');
  assert.equal(attempts,2);
  assert.deepEqual(waits,[750]);
});

test('media download rejects content over configured limit',async()=>{
  const download=async()=>streamOf('123','456');
  await assert.rejects(()=>downloadMediaBuffer({node:{},streamType:'image',download,maxBytes:5,attempts:1}),/excede limite/);
});

test('local media is deleted only after remote storage is confirmed',()=>{
  assert.equal(shouldCleanupLocalMedia('pending'),false);
  assert.equal(shouldCleanupLocalMedia('persisting'),false);
  assert.equal(shouldCleanupLocalMedia('error'),false);
  assert.equal(shouldCleanupLocalMedia('stored'),true);
});

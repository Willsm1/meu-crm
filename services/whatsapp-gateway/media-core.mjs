export async function downloadMediaBuffer({node,streamType,download,maxBytes,attempts=2,delayMs=750,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
  let lastErr=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const chunks=[];
      let total=0;
      const stream=await download(node,streamType);
      for await(const chunk of stream){
        const b=Buffer.from(chunk);
        total+=b.length;
        if(total>maxBytes)throw new Error('mídia excede limite do gateway');
        chunks.push(b);
      }
      const buf=Buffer.concat(chunks);
      if(!buf.length)throw new Error('mídia vazia');
      return buf;
    }catch(err){
      lastErr=err;
      if(attempt<attempts)await wait(delayMs);
    }
  }
  throw lastErr||new Error('media capture failed');
}

export function shouldCleanupLocalMedia(status){
  return status==='stored';
}

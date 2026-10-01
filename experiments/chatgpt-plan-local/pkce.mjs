import crypto from 'node:crypto';

export function randomValue(bytes=32){
  return crypto.randomBytes(bytes).toString('base64url');
}

export function pkcePair(){
  const verifier=randomValue(64);
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  return {verifier,challenge};
}

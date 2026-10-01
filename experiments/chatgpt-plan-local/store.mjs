import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'.chatgpt-plan');
const CREDS=path.join(ROOT,'credentials.json');
const HOST=path.join(ROOT,'host.json');

async function read(file){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return null}}
async function write(file,data){await fs.mkdir(ROOT,{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(tmp,file)}

export const loadCredentials=()=>read(CREDS);
export const saveCredentials=data=>write(CREDS,data);
export const clearCredentials=()=>fs.rm(CREDS,{force:true});
export async function getHostId(){const h=await read(HOST);if(h?.id)return h.id;const id='urn:uuid:'+crypto.randomUUID();await write(HOST,{id});return id}

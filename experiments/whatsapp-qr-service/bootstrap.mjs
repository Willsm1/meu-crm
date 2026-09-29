import './server.mjs';
import express from 'express';
import cors from 'cors';
import path from 'node:path';

const MEDIA_PORT = Number(process.env.WA_MEDIA_PORT || 8788);
const MEDIA_ROOT = path.resolve(process.env.WA_MEDIA_ROOT || './.media');
const mediaApp = express();
mediaApp.use(cors({ origin: true, credentials: false }));
mediaApp.use('/media', express.static(MEDIA_ROOT, {
  dotfiles: 'allow',
  fallthrough: false,
  maxAge: '5m',
  immutable: false,
  setHeaders(res){ res.setHeader('Cache-Control','private, max-age=300'); }
}));
mediaApp.get('/health', (_req,res)=>res.json({ok:true,service:'taurus-whatsapp-media-staging',mode:'temporary-source-for-supabase-storage',root:MEDIA_ROOT}));
mediaApp.listen(MEDIA_PORT,'127.0.0.1',()=>{
  console.log(`[Gate 3.3] fonte temporaria de midia http://127.0.0.1:${MEDIA_PORT}/media -> Supabase Storage privado`);
});

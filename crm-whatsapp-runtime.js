/* Taurus Magnum — WhatsApp hosted runtime adapter — RC */
(function(){
'use strict';
if(window.TM_WA_RUNTIME)return;
function cfg(){return window.CRM_SUPABASE&&window.CRM_SUPABASE.config||null}
function token(){const c=cfg();if(!c)return null;try{const raw=localStorage.getItem('sb-'+c.projectRef+'-auth-token');if(!raw)return null;const s=JSON.parse(raw);return s&&(s.access_token||(s.currentSession&&s.currentSession.access_token))||null}catch(_e){return null}}
function gateway(){const explicit=String(window.TAURUS_WHATSAPP_GATEWAY_URL||localStorage.getItem('tm_whatsapp_gateway_url')||'').trim().replace(/\/$/,'');if(explicit)return explicit;if(location.hostname==='127.0.0.1'||location.hostname==='localhost')return 'http://127.0.0.1:8787';return ''}
function headers(extra){const t=token();if(!t)throw new Error('Sessão Taurus ausente');return Object.assign({'Authorization':'Bearer '+t},extra||{})}
async function api(path,opts){const base=gateway();if(!base)throw new Error('Gateway WhatsApp ainda não configurado');const r=await fetch(base+path,Object.assign({cache:'no-store'},opts||{}, {headers:headers(opts&&opts.headers)}));const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}if(!r.ok)throw new Error(data.error||('Gateway HTTP '+r.status));return data}
window.TM_WA_RUNTIME={gateway,token,headers,api,setGateway:url=>{localStorage.setItem('tm_whatsapp_gateway_url',String(url||'').trim().replace(/\/$/,''));return gateway()}};
})();

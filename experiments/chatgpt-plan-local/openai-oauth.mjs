export const OPENAI_AUTH_URL='https://auth.openai.com/api/accounts/authorize';
export const OPENAI_TOKEN_URL='https://auth.openai.com/api/accounts/oauth/token';
export const OPENAI_JWKS_URL='https://auth.openai.com/.well-known/jwks.json';
export const OPENAI_ISSUER='https://auth.openai.com';
export const OPENAI_RESOURCE='https://api.openai.com/v1';
export const OPENAI_SCOPES='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';

export function buildAuthorizeUrl({clientId,redirectUri,state,nonce,challenge,hostId,agentName,idTokenHint}){
  const q=new URLSearchParams({
    client_id:clientId,
    response_type:'code',
    redirect_uri:redirectUri,
    scope:OPENAI_SCOPES,
    resource:OPENAI_RESOURCE,
    state,
    nonce,
    code_challenge_method:'S256',
    code_challenge:challenge,
    ext_agent_host_id:hostId
  });
  if(clientId==='dynamic_agent_client') q.set('agent_name_hint',agentName);
  else if(idTokenHint) q.set('id_token_hint',idTokenHint);
  return OPENAI_AUTH_URL+'?'+q.toString();
}

/* Taurus Magnum CRM — atomic sale close: status + sale date in one RPC */
(function(){
'use strict';
if(window.__TM_SALE_STATUS_CONSISTENCY__)return;
window.__TM_SALE_STATUS_CONSISTENCY__=true;

var originalFetch=window.fetch.bind(window);

window.fetch=function(input,init){
  var url='';
  try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(e){}
  var isSaleDate=url.indexOf('/rest/v1/rpc/set_lead_sale_date')>=0;
  if(!isSaleDate)return originalFetch(input,init);

  var payload=null;
  try{payload=JSON.parse((init&&init.body)||'{}');}catch(e){payload=null;}

  /* Quando há data da venda, o fechamento precisa ser atômico no banco.
     Redirecionamos o mesmo payload para o RPC que grava status=Fechado e
     data_fechamento na mesma transação. Assim não existe janela para um
     snapshot local salvar a data e deixar/repor o status anterior. */
  if(payload&&payload.p_data_fechamento){
    var atomicUrl=url.replace('/rest/v1/rpc/set_lead_sale_date','/rest/v1/rpc/close_lead_with_sale_date');
    return originalFetch(atomicUrl,init).then(function(response){
      if(response&&response.ok){
        setTimeout(function(){
          try{
            if(window.CRM_CANONICAL&&typeof window.CRM_CANONICAL.reload==='function'){
              Promise.resolve(window.CRM_CANONICAL.reload()).then(function(){
                if(window.CRM_FOLLOWUP&&typeof window.CRM_FOLLOWUP.carregar==='function')
                  return window.CRM_FOLLOWUP.carregar();
              }).catch(function(){});
            }
          }catch(e){}
        },120);
      }
      return response;
    });
  }

  /* Remoção da data continua usando o RPC original; não implica fechar lead. */
  return originalFetch(input,init);
};
})();

from pathlib import Path

p=Path('supabase-canonical.js')
s=p.read_text(encoding='utf-8')
old="""function carregarCanonico(){
  var c=cfg(), h=headers();
  if(!c || !h) return Promise.resolve([]);
  var cols='id,legacy_id,local_id,nome,empresa,email,telefone,status,valor,data_entrada,origem,perfil,regiao,ult_meu,ult_dele,notas,proximo_contato';
  return fetch(c.url+'/rest/v1/leads?select='+encodeURIComponent(cols)+'&deleted_at=is.null&order=created_at.desc',{
    headers:{'apikey':c.publishableKey,'Authorization':h.Authorization,'Accept-Profile':c.schema||'crm'}
  }).then(function(r){
    if(!r.ok) throw new Error('Falha ao carregar leads do Supabase: http '+r.status);
    return r.json();
  }).then(function(rows){
    var out=(rows||[]).map(function(l){
"""
new="""function carregarCanonico(){
  var c=cfg(), h=headers();
  if(!c || !h) return Promise.resolve([]);
  var cols='id,legacy_id,local_id,nome,empresa,email,telefone,status,valor,data_entrada,origem,perfil,regiao,ult_meu,ult_dele,notas,proximo_contato';
  var pageSize=1000;
  function buscarPagina(offset, acumulado){
    var url=c.url+'/rest/v1/leads?select='+encodeURIComponent(cols)
      +'&deleted_at=is.null&order=created_at.desc,id.desc&limit='+pageSize+'&offset='+offset;
    return fetch(url,{
      headers:{'apikey':c.publishableKey,'Authorization':h.Authorization,'Accept-Profile':c.schema||'crm'}
    }).then(function(r){
      if(!r.ok) throw new Error('Falha ao carregar leads do Supabase: http '+r.status);
      return r.json();
    }).then(function(rows){
      rows=Array.isArray(rows)?rows:[];
      Array.prototype.push.apply(acumulado,rows);
      return rows.length===pageSize ? buscarPagina(offset+pageSize,acumulado) : acumulado;
    });
  }
  return buscarPagina(0,[]).then(function(rows){
    var out=(rows||[]).map(function(l){
"""
if new in s:
    print('Paginacao ja aplicada.')
elif s.count(old)!=1:
    raise SystemExit(f'PATCH ABORTADO: esperado 1 bloco, encontrado {s.count(old)}')
else:
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
    print('Paginacao Supabase aplicada.')

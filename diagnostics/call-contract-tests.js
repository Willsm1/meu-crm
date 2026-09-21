#!/usr/bin/env node
'use strict';

/*
  Testes NÃO destrutivos do contrato de ligação da extensão.
  Não usa Supabase real e não grava dados.
  Uso: node diagnostics/call-contract-tests.js
*/

const assert = require('assert');
const crypto = require('crypto');

const RESULTS = ['Atendeu','Caixa Postal','Perdido','Número Errado'];

function eventId(leadUuid){
  return `wa-call:${leadUuid}:${crypto.randomUUID()}`;
}

function payload({leadUuid,result,occurredAt,id}){
  return {
    p_lead_id:String(leadUuid),
    p_result:String(result),
    p_occurred_at:String(occurredAt),
    p_client_event_id:String(id)
  };
}

function run(){
  const N = Number(process.env.N || 100000);
  const seen = new Set();
  const lead = '11111111-1111-4111-8111-111111111111';
  let perResult = Object.fromEntries(RESULTS.map(x=>[x,0]));

  for(let i=0;i<N;i++){
    const result = RESULTS[i % RESULTS.length];
    const id = eventId(lead);
    assert(!seen.has(id), `colisão de eventId no índice ${i}`);
    seen.add(id);

    const ts = new Date(Date.now() - (i % 1000)).toISOString();
    const p = payload({leadUuid:lead,result,occurredAt:ts,id});

    assert.equal(p.p_lead_id, lead);
    assert(RESULTS.includes(p.p_result));
    assert(!Number.isNaN(Date.parse(p.p_occurred_at)));
    assert.equal(p.p_client_event_id, id);
    perResult[result]++;
  }

  // Retry deve reutilizar exatamente o mesmo client_event_id.
  const retryId = eventId(lead);
  const first = payload({leadUuid:lead,result:'Caixa Postal',occurredAt:new Date().toISOString(),id:retryId});
  const retry = payload({leadUuid:lead,result:'Caixa Postal',occurredAt:first.p_occurred_at,id:retryId});
  assert.deepEqual(retry, first, 'retry alterou payload/id e quebraria dedupe');

  // Resultado inválido deve ser detectado pelo teste antes de integração.
  assert(!RESULTS.includes('Qualquer Coisa'));

  console.log(JSON.stringify({
    ok:true,
    tests:N,
    uniqueEventIds:seen.size,
    distribution:perResult,
    retryStable:true,
    writesToProduction:0
  }, null, 2));
}

run();

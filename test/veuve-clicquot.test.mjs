import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/store.mjs';
import {recommend} from '../src/engine.mjs';

const store=await KnowledgeStore.fromFile();
const ids=[
  'veuve-clicquot-rose-nv-750',
  'veuve-clicquot-la-grande-dame-2012-750',
  'veuve-clicquot-la-grande-dame-2015-750',
  'veuve-clicquot-la-grande-dame-2018-750',
  'veuve-clicquot-la-grande-dame-rose-2015-750',
  'veuve-clicquot-vintage-2015-750',
  'veuve-clicquot-vintage-rose-2015-750',
  'veuve-clicquot-vintage-rose-2012-750'
];

test('huit fiches officielles Veuve Clicquot sont présentes et traçables',()=>{
  for(const id of ids){
    const record=store.get(id);
    assert.ok(record,`${id} absent`);
    const source=record.sources.find(item=>item.id==='producer-email:veuve-clicquot:2026-08-03');
    assert.equal(source?.evidenceLevel,'primary');
    assert.match(source?.document?.sha256||'',/^[a-f0-9]{64}$/);
    assert.ok(record.evidence.some(item=>item.field==='technical'&&item.level==='primary'));
  }
});

test('les fiches sans offre ne sont pas proposées comme bouteilles achetables',()=>{
  const resultIds=new Set(recommend(store,{availableOnly:true},store.size).map(item=>item.record.id));
  assert.ok(ids.every(id=>!resultIds.has(id)));
});

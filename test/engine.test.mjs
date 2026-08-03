import test from 'node:test';import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/store.mjs';import {recommend,similarity,similar,compare} from '../src/engine.mjs';
const store=await KnowledgeStore.fromFile();
test('base autonome enrichie',()=>{assert.ok(store.size>=56);assert.deepEqual(store.validate(),[]);});
test('budget et disponibilité sont éliminatoires',()=>{const results=recommend(store,{budgetMax:50,availableOnly:true},48);assert.ok(results.length);assert.ok(results.every(({record})=>record.commerce.available&&record.commerce.priceEur<=50));});
test('recommandation expliquée',()=>{const [pick]=recommend(store,{preset:'fresh',pairing:'accord_mer',budgetMax:100},3);assert.ok(pick.assessment.strengths.length);assert.ok(pick.assessment.evidenceConfidence>0);});
test('similarité symétrique',()=>{const [a,b]=store.all();assert.equal(similarity(a,b),similarity(b,a));});
test('alternatives excluent la source',()=>{const source=store.all()[0];assert.ok(similar(store,source.id,{limit:5}).every(item=>item.record.id!==source.id));});
test('comparaison conserve chaque référence',()=>{const ids=store.all().slice(0,3).map(r=>r.id);assert.equal(compare(store,ids).length,3);});

import test from 'node:test';import assert from 'node:assert/strict';import {validateTasting,aggregateTastings,mergeTastingConsensus} from '../src/tasting.mjs';import {KnowledgeStore} from '../src/store.mjs';
const store=await KnowledgeStore.fromFile();const productId=store.all()[0].id;
const tastings=[
  {id:'t1',productId,taster:{id:'a',level:'sommelier'},tastedAt:'2026-08-03',blind:true,axes:{freshness:4,roundness:3,power:3,complexity:4},aromas:['agrumes','brioche']},
  {id:'t2',productId,taster:{id:'b',level:'enthusiast'},tastedAt:'2026-08-03',blind:true,axes:{freshness:4.5,roundness:3,power:3.5,complexity:4},aromas:['agrumes','brioche']},
  {id:'t3',productId,taster:{id:'c',level:'critic'},tastedAt:'2026-08-03',blind:false,axes:{freshness:4,roundness:3.5,power:3,complexity:4.5},aromas:['agrumes','fleurs blanches']}
];
test('dégustations valides',()=>assert.deepEqual(tastings.flatMap(validateTasting),[]));
test('panel consolidé',()=>{const [panel]=aggregateTastings(tastings);assert.equal(panel.status,'publishable');assert.equal(panel.panelSize,3);assert.ok(panel.agreement.freshness>=80);assert.ok(panel.aromas.includes('agrumes'));});
test('petit panel non publiable',()=>assert.equal(aggregateTastings(tastings.slice(0,2))[0].status,'insufficient_panel'));
test('consensus ajoute sa provenance',()=>{const panel=aggregateTastings(tastings)[0];const updated=mergeTastingConsensus(store.get(productId),panel);assert.equal(updated.lifecycle.revision,2);assert.ok(updated.sources.some(source=>source.usage==='structured_tasting_panel'));});

import assert from 'node:assert/strict';
import {PARTNER_CATALOGUE} from './build-partner-catalogue.mjs';
import {AXES,buildKnowledgeBase,recommend,similarity,findSimilar} from './expert-engine.mjs';

const kb=buildKnowledgeBase(PARTNER_CATALOGUE);
assert.equal(kb.count,48);
assert.equal(Object.keys(AXES).length,12);
for(const record of kb.records){
  assert.ok(record.id && record.identity.house && record.identity.cuvee);
  assert.ok(record.evidence.confidence>=0 && record.evidence.confidence<=1);
  for(const axis of Object.keys(AXES)) assert.ok(record.sensory.axes[axis]>=1 && record.sensory.axes[axis]<=5,`${record.id}: ${axis}`);
}
const under50=recommend(kb,{budgetMax:50,availableOnly:true},{limit:48});
assert.ok(under50.length>0);
assert.ok(under50.every(item=>item.record.commerce.available && item.record.commerce.price<=50));
assert.ok(under50.every(item=>item.record.id!=='perrier-jouet-belle-epoque-2016'));
const freshSea=recommend(kb,{preset:'fresh',pairing:'accord_mer',availableOnly:true},{limit:3});
assert.equal(freshSea.length,3);
assert.ok(freshSea.every(item=>item.explanation.headline && item.assessment.score>0));
const lowDosage=recommend(kb,{signature:'low_dosage',availableOnly:true},{limit:48});
assert.ok(lowDosage.length>0);
assert.ok(lowDosage.every(item=>item.record.sensory.axes.sweetness<=1.8 || /extra-brut|nature|zéro|zero/i.test(item.record.identity.tags.join(' '))));
const [a,b]=kb.records;
assert.equal(similarity(a,b),similarity(b,a));
const similar=findSimilar(kb,a.id,{availableOnly:true,maxPrice:100,limit:5});
assert.ok(similar.every(item=>item.record.id!==a.id && item.record.commerce.available && item.record.commerce.price<=100));
const scenarios=[
  {preset:'fresh',pairing:'accord_mer',budgetMax:80},
  {preset:'fruity',occasion:'occ_fete',budgetMax:80},
  {preset:'gastronomic',occasion:'occ_diner',budgetMax:150},
  {preset:'complex',occasion:'occ_cadeau',budgetMax:250},
  {preset:'delicate',occasion:'occ_apero',budgetMax:70}
];
const winners=new Set(scenarios.map(request=>recommend(kb,{...request,availableOnly:true},{limit:1})[0]?.record.id));
assert.ok(winners.size>=3,`Diversité insuffisante : ${[...winners].join(', ')}`);
console.log(`✅ Moteur expert validé : ${kb.count} cuvées, ${Object.keys(AXES).length} axes, ${scenarios.length} scénarios.`);

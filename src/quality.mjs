import {AXES,confidence} from './model.mjs';
const percent=(count,total)=>total?Math.round(count/total*1000)/10:0;
export function qualityReport(store){
  const records=store.all(),total=records.length;
  const primaryIdentity=records.filter(record=>record.evidence.some(item=>item.field==='identity'&&item.level==='primary')).length;
  const grapes=records.filter(record=>record.technical.grapes?.length).length;
  const dosage=records.filter(record=>record.technical.dosage!==null&&record.technical.dosage!==undefined).length;
  const fullAxes=records.filter(record=>Object.keys(record.sensory.axes||{}).length===Object.keys(AXES).length).length;
  const competitions=records.filter(record=>record.competitions?.length).length;
  const available=records.filter(record=>record.commerce?.available).length;
  const images=records.filter(record=>record.commerce?.imageUrl).length;
  const confidences=records.map(confidence);const sourceTypes={};for(const record of records)for(const source of record.sources)sourceTypes[source.type]=(sourceTypes[source.type]||0)+1;
  return {generatedAt:new Date().toISOString(),total,coverage:{primaryIdentity:percent(primaryIdentity,total),grapes:percent(grapes,total),dosage:percent(dosage,total),fullSensoryAxes:percent(fullAxes,total),competitionResults:percent(competitions,total),availableOffers:percent(available,total),images:percent(images,total)},evidence:{averageConfidence:total?Math.round(confidences.reduce((a,b)=>a+b,0)/total):0,minimumConfidence:total?Math.min(...confidences):0,sourceTypes},readiness:{targetRecords:200,progressPercent:percent(total,200),siteIntegrationReady:total>=200&&percent(primaryIdentity,total)>=95&&percent(grapes,total)>=80&&percent(dosage,total)>=80}};
}

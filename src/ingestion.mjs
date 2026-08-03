import {canonicalKey,validateRecord} from './model.mjs';

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens=value=>new Set(normalize(value).split(' ').filter(Boolean));
const overlap=(a,b)=>{const left=tokens(a),right=tokens(b);if(!left.size||!right.size)return 0;const common=[...left].filter(token=>right.has(token)).length;return common/Math.max(left.size,right.size);};

export function identityScore(candidate,record){
  const producer=overlap(candidate.producer,record.identity.producer);
  const cuvee=overlap(candidate.cuvee,record.identity.cuvee);
  const vintage=String(candidate.vintage||'NV')===String(record.identity.vintage||'NV')?1:0;
  const format=Number(candidate.formatMl||750)===Number(record.identity.formatMl||750)?1:0;
  return Math.round((producer*.4+cuvee*.4+vintage*.15+format*.05)*100);
}

export function resolveIdentity(candidate,records,{exactThreshold=92,reviewThreshold=72}={}){
  const ranked=records.map(record=>({record,score:identityScore(candidate,record)})).sort((a,b)=>b.score-a.score);
  const first=ranked[0],second=ranked[1];
  if(first?.score>=exactThreshold&&first.score-(second?.score||0)>=8)return {status:'matched',record:first.record,score:first.score,candidates:ranked.slice(0,3)};
  if(first?.score>=reviewThreshold)return {status:'review',score:first.score,candidates:ranked.slice(0,3)};
  return {status:'new',score:first?.score||0,candidates:ranked.slice(0,3)};
}

export function createRecord(candidate,source,now=new Date().toISOString()){
  const id=candidate.id||normalize(`${candidate.producer}-${candidate.cuvee}-${candidate.vintage||'nv'}-${candidate.formatMl||750}`).replaceAll(' ','-');
  const recordSource={...source,...(candidate.document?{document:candidate.document}:{})};
  const record={id,canonicalKey:'',identity:{producer:candidate.producer,cuvee:candidate.cuvee,vintage:candidate.vintage||null,formatMl:candidate.formatMl||750,appellation:'Champagne',producerType:candidate.producerType||'unknown',tags:candidate.tags||[]},technical:candidate.technical||{grapes:[],dosage:null,classification:null},sensory:candidate.sensory||{axes:{},aromas:[]},uses:candidate.uses||{occasions:[],pairings:[],pairingLabels:[]},editorial:candidate.editorial||{},competitions:candidate.competitions||[],commerce:candidate.commerce||{},sources:[recordSource],evidence:(candidate.evidenceFields||['identity']).map(field=>({field,sourceId:source.id,level:source.evidenceLevel||'primary'})),lifecycle:{status:'candidate',createdAt:now,updatedAt:now,revision:1}};
  if(candidate.derivedFields?.length){const derivationId='engine:official-descriptors-v1';record.sources.push({id:derivationId,type:'editorial',url:'urn:quelchampagne:official-descriptors-v1',checkedAt:now.slice(0,10),usage:'structured_derivation'});record.evidence.push(...candidate.derivedFields.map(field=>({field,sourceId:derivationId,level:'derived'})));}
  record.canonicalKey=canonicalKey(record);return record;
}

export function ingestCandidates(store,candidates,source){
  const accepted=[],updates=[],review=[],rejected=[];
  for(const candidate of candidates){
    if(!candidate.producer||!candidate.cuvee){rejected.push({candidate,reasons:['identité incomplète']});continue;}
    const resolution=resolveIdentity(candidate,store.all());
    if(resolution.status==='matched'){updates.push({candidate,matchId:resolution.record.id,score:resolution.score,source});continue;}
    if(resolution.status==='review'){review.push({candidate,candidates:resolution.candidates.map(item=>({id:item.record.id,score:item.score})),source});continue;}
    const record=createRecord(candidate,source);const errors=validateRecord(record);
    if(errors.length)rejected.push({candidate,reasons:errors});else accepted.push(record);
  }
  return {accepted,updates,review,rejected,summary:{total:candidates.length,accepted:accepted.length,updates:updates.length,review:review.length,rejected:rejected.length}};
}

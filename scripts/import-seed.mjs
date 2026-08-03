import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {canonicalKey,validateRecord,ENGINE_VERSION} from '../src/model.mjs';

const inputArg=process.argv.find(arg=>arg.startsWith('--input='))?.slice(8)||'../quelchampagne-v5/data/champagne-knowledge-base.json';
const input=resolve(process.cwd(),inputArg);const source=JSON.parse(await readFile(input,'utf8'));const importedAt=new Date().toISOString();
const records=source.records.map(old=>{
  const sourceId=`seed:${old.id}`;
  const sourceUrl=old.evidence.officialSourceUrl||old.evidence.technicalSourceUrl||old.evidence.merchantSourceUrl;
  const level=old.evidence.sourceKind==='primary'?'primary':old.evidence.sourceKind==='mixed'?'secondary':'derived';
  const record={
    id:old.id,
    canonicalKey:'',
    identity:{producer:old.identity.house,cuvee:old.identity.cuvee,vintage:old.technical.vintage||null,formatMl:750,appellation:'Champagne',producerType:old.identity.producerType||'unknown',tags:old.identity.tags||[]},
    technical:{grapes:old.technical.grapes||[],dosage:old.technical.dosage,classification:old.technical.classification},
    sensory:old.sensory,
    uses:old.uses,
    editorial:old.editorial,
    competitions:[],
    commerce:{priceEur:old.commerce.price,available:old.commerce.available,checkedAt:old.commerce.checkedAt,merchant:old.commerce.merchant,imageUrl:old.commerce.image,affiliateUrl:old.commerce.affiliateUrl},
    sources:[{id:sourceId,type:old.evidence.sourceKind==='primary'?'producer':old.evidence.sourceKind==='mixed'?'editorial':'merchant',url:sourceUrl,checkedAt:old.evidence.verifiedAt||old.commerce.checkedAt,usage:'seed_migration'}],
    evidence:[
      {field:'identity',sourceId,level},
      {field:'technical',sourceId,level},
      {field:'sensory.axes',sourceId:'engine:rules-v1',level:'derived'},
      {field:'commerce',sourceId,level:'secondary'}
    ],
    lifecycle:{status:'active',createdAt:importedAt,updatedAt:importedAt,revision:1}
  };
  record.sources.push({id:'engine:rules-v1',type:'editorial',url:'urn:quelchampagne:rules-v1',checkedAt:importedAt.slice(0,10),usage:'sensory_derivation'});
  record.canonicalKey=canonicalKey(record);return record;
});
const seen=new Map(),quarantine=[],accepted=[];
for(const record of records){const errors=validateRecord(record);if(seen.has(record.canonicalKey))errors.push(`doublon de ${seen.get(record.canonicalKey)}`);if(errors.length)quarantine.push({record,errors});else{seen.set(record.canonicalKey,record.id);accepted.push(record);}}
const payload={schemaVersion:1,engineVersion:ENGINE_VERSION,generatedAt:importedAt,recordCount:accepted.length,records:accepted};
await mkdir('data/imports',{recursive:true});await mkdir('data/quarantine',{recursive:true});
await writeFile('data/knowledge-base.json',JSON.stringify(payload,null,2)+'\n');
await writeFile(`data/imports/seed-${importedAt.slice(0,10)}.json`,JSON.stringify({input,importedAt,total:records.length,accepted:accepted.length,quarantined:quarantine.length},null,2)+'\n');
await writeFile('data/quarantine/seed.json',JSON.stringify(quarantine,null,2)+'\n');
console.log(`Import initial : ${accepted.length} acceptées · ${quarantine.length} en quarantaine.`);

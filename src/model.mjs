export const ENGINE_VERSION='0.3.0';

export const AXES=Object.freeze({
  freshness:'Fraîcheur',acidity:'Tension',roundness:'Rondeur',sweetness:'Douceur',
  power:'Puissance',complexity:'Complexité',persistence:'Persistance',
  fruitiness:'Expression fruitée',minerality:'Expression minérale',brioche:'Expression briochée',
  gastronomic:'Aptitude à table',accessibility:'Accessibilité'
});

export const SOURCE_TYPES=new Set(['producer','interprofession','public_dataset','competition','critic_licensed','merchant','editorial','community']);
export const EVIDENCE_LEVELS=new Set(['primary','licensed','public_result','secondary','derived','unverified']);

export function canonicalKey(record){
  return [record.identity.producer,record.identity.cuvee,record.identity.vintage||'NV',record.identity.formatMl||750]
    .map(value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))
    .join('::');
}

export function validateRecord(record){
  const errors=[];
  if(!record?.id) errors.push('id absent');
  if(!record?.identity?.producer) errors.push('producteur absent');
  if(!record?.identity?.cuvee) errors.push('cuvée absente');
  if(record?.identity?.appellation!=='Champagne') errors.push('appellation différente de Champagne');
  if(record?.identity?.formatMl<=0) errors.push('format invalide');
  for(const [axis,value] of Object.entries(record?.sensory?.axes||{})){
    if(!(axis in AXES)) errors.push(`axe inconnu : ${axis}`);
    if(!Number.isFinite(value)||value<1||value>5) errors.push(`valeur hors borne : ${axis}`);
  }
  for(const source of record?.sources||[]){
    if(!source.id||!source.url||!source.checkedAt) errors.push('source incomplète');
    if(!SOURCE_TYPES.has(source.type)) errors.push(`type de source inconnu : ${source.type}`);
  }
  for(const evidence of record?.evidence||[]){
    if(!evidence.field||!evidence.sourceId||!EVIDENCE_LEVELS.has(evidence.level)) errors.push('preuve incomplète');
  }
  if(record?.canonicalKey!==canonicalKey(record)) errors.push('clé canonique incorrecte');
  return errors;
}

export function confidence(record){
  const weights={primary:1,licensed:.95,public_result:.9,secondary:.7,derived:.55,unverified:.2};
  const evidence=record.evidence||[];
  if(!evidence.length) return 0;
  return Math.round(evidence.reduce((sum,item)=>sum+(weights[item.level]||0),0)/evidence.length*100);
}

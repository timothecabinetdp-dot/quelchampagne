/**
 * QuelChampagne Expert Engine
 *
 * Moteur déterministe et explicable. Il ne prétend pas avoir dégusté les vins :
 * chaque profil distingue les faits sourcés des valeurs éditoriales ou déduites.
 */

export const ENGINE_VERSION = '1.0.0';

export const AXES = Object.freeze({
  freshness:{label:'Fraîcheur',group:'sensation'},
  acidity:{label:'Tension',group:'sensation'},
  roundness:{label:'Rondeur',group:'sensation'},
  sweetness:{label:'Douceur',group:'sensation'},
  power:{label:'Puissance',group:'structure'},
  complexity:{label:'Complexité',group:'structure'},
  persistence:{label:'Persistance',group:'structure'},
  fruitiness:{label:'Expression fruitée',group:'aroma'},
  minerality:{label:'Expression minérale',group:'aroma'},
  brioche:{label:'Expression briochée',group:'aroma'},
  gastronomic:{label:'Aptitude à table',group:'use'},
  accessibility:{label:'Accessibilité',group:'use'}
});

export const REQUEST_SCHEMA = Object.freeze({
  occasion:['occ_apero','occ_diner','occ_cadeau','occ_romantique','occ_fete'],
  pairing:['accord_aperitif','accord_mer','accord_volaille','accord_fromage','accord_dessert','accord_any'],
  producerType:['any','maison','vigneron'],
  signature:['any','low_dosage','rose','blanc_de_blancs','vintage','grand_cru'],
  experience:['discovery','regular','expert']
});

const FRUITS = new Set(['agrumes','pomme','poire','pêche','fruits rouges','fruits mûrs']);
const MINERAL = new Set(['minéralité','salinité']);
const AUTOLYTIC = new Set(['brioche','noisette','amande','pain grillé']);

const clamp = value=>Math.max(1,Math.min(5,Math.round(value*10)/10));
const unique = values=>[...new Set(values.filter(Boolean))];
const average = values=>values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 3;

function includesTag(product, expression){
  return (product.tags||[]).some(tag=>expression.test(tag));
}

function evidenceConfidence(product){
  const status=String(product.identityStatus||product.details?.evidenceStatus||'');
  if(/^official_producer_confirmed$/.test(status)) return .98;
  if(status.includes('official_producer_confirmed')) return .86;
  if(product.officialSourceUrl && product.technicalSourceUrl) return .9;
  if(product.officialSourceUrl || product.technicalSourceUrl) return .78;
  return .55;
}

function derivedAxes(product){
  const base=product.details?.scores||{};
  const aromas=product.details?.aromas||[];
  const freshness=clamp(base.freshness||3);
  const roundness=clamp(base.roundness||3);
  const power=clamp(base.power||3);
  const complexity=clamp(base.complexity||3);
  const lowDosage=includesTag(product,/extra-brut|nature|zéro|zero/i);
  const demiSec=includesTag(product,/demi-sec/i);
  const blancDeBlancs=includesTag(product,/blanc de blancs/i);
  const fruitCount=aromas.filter(aroma=>FRUITS.has(aroma)).length;
  const mineralCount=aromas.filter(aroma=>MINERAL.has(aroma)).length;
  const briocheCount=aromas.filter(aroma=>AUTOLYTIC.has(aroma)).length;
  const mealAccords=(product.accords||[]).filter(token=>['accord_mer','accord_volaille','accord_fromage'].includes(token)).length;
  return {
    freshness,
    acidity:clamp(average([freshness,lowDosage?5:3,blancDeBlancs?4:3])),
    roundness,
    sweetness:clamp(demiSec?5:lowDosage?1:roundness>=4?2.8:2),
    power,
    complexity,
    persistence:clamp(average([complexity,power,complexity>=4?4.5:3])),
    fruitiness:clamp(2+Math.min(3,fruitCount*.75)+((product.profil||[]).includes('profil_fruite') ? .5 : 0)),
    minerality:clamp(2+mineralCount*1.2+(blancDeBlancs ? .8 : 0)+(lowDosage ? .5 : 0)),
    brioche:clamp(1.8+briocheCount*1.25+(complexity>=4 ? .6 : 0)),
    gastronomic:clamp(2+mealAccords*.65+Math.max(0,power-3)*.55+Math.max(0,complexity-3)*.55),
    accessibility:clamp(6-complexity+(roundness>=4 ? .5 : 0)+(product.popularity>=84 ? .5 : 0))
  };
}

export function buildExpertRecord(product){
  const confidence=evidenceConfidence(product);
  const axes=derivedAxes(product);
  const sourceKind=confidence>=.9?'primary':confidence>=.75?'mixed':'merchant';
  return {
    id:product.id,
    identity:{
      house:product.house||product.brand,
      cuvee:product.name,
      region:product.region,
      producerType:product.producerType,
      tags:product.tags||[]
    },
    technical:{
      grapes:product.details?.grapes||[],
      dosage:product.details?.dosage||null,
      vintage:(product.tags||[]).includes('Millésimé'),
      classification:(product.tags||[]).find(tag=>/Grand Cru|Premier Cru/i.test(tag))||null
    },
    sensory:{axes,aromas:product.details?.aromas||[]},
    uses:{occasions:product.occ||[],pairings:product.accords||[],pairingLabels:(product.details?.accords||[]).map(item=>item.d)},
    editorial:{summary:product.note,choose:product.details?.advice,avoid:product.details?.avoid},
    evidence:{
      confidence,
      sourceKind,
      status:product.identityStatus,
      verifiedAt:product.verifiedAt,
      officialSourceUrl:product.officialSourceUrl||null,
      technicalSourceUrl:product.technicalSourceUrl||null,
      merchantSourceUrl:product.merchantSourceUrl||null,
      method:'rules-v1'
    },
    commerce:{
      price:product.price,
      available:product.commerceReady===true && product.availability==='in_stock',
      checkedAt:product.offerCheckedAt,
      merchant:product.details?.merchant||null,
      affiliateUrl:product.aff||null,
      image:product.image||null
    }
  };
}

export function buildKnowledgeBase(products){
  return {
    version:1,
    engineVersion:ENGINE_VERSION,
    generatedAt:new Date().toISOString(),
    axes:AXES,
    count:products.length,
    records:products.map(buildExpertRecord)
  };
}

export const PRESETS = Object.freeze({
  balanced:{label:'Équilibré et polyvalent',axes:{freshness:3.5,roundness:3.5,power:3,complexity:3,accessibility:4}},
  fresh:{label:'Vif et minéral',axes:{freshness:5,acidity:5,minerality:4.5,roundness:2,power:2.5}},
  fruity:{label:'Rond et fruité',axes:{fruitiness:5,roundness:4.5,freshness:3,sweetness:2.8,power:3}},
  gastronomic:{label:'Puissant et gastronomique',axes:{power:4.5,complexity:4.5,persistence:4.5,gastronomic:5}},
  complex:{label:'Complexe et brioché',axes:{complexity:5,brioche:4.5,persistence:5,roundness:3.5}},
  delicate:{label:'Fin et délicat',axes:{freshness:4,power:1.8,roundness:2.5,accessibility:4,fruitiness:3.5}}
});

function signatureMatch(record,signature){
  const tags=record.identity.tags.join(' ').toLowerCase();
  if(!signature||signature==='any') return true;
  if(signature==='low_dosage') return /extra-brut|nature|zéro|zero/.test(tags) || record.sensory.axes.sweetness<=1.8;
  if(signature==='rose') return /rosé|rose/.test(tags);
  if(signature==='blanc_de_blancs') return /blanc de blancs/.test(tags);
  if(signature==='vintage') return record.technical.vintage;
  if(signature==='grand_cru') return /grand cru/i.test(record.technical.classification||'');
  return true;
}

function hardFilter(record,request){
  if(request.availableOnly!==false && !record.commerce.available) return false;
  if(Number.isFinite(request.budgetMax) && record.commerce.price>request.budgetMax) return false;
  if(Number.isFinite(request.budgetMin) && record.commerce.price<request.budgetMin) return false;
  if(request.producerType && request.producerType!=='any' && record.identity.producerType!==request.producerType) return false;
  if(!signatureMatch(record,request.signature)) return false;
  if((request.excludeTags||[]).some(tag=>record.identity.tags.includes(tag))) return false;
  return true;
}

function axisContribution(value,target,weight){
  const closeness=1-Math.abs(value-target)/4;
  return {points:Math.max(0,closeness)*weight,max:weight};
}

function scoreRecord(record,request){
  const preset=PRESETS[request.preset]||PRESETS.balanced;
  const targets={...preset.axes,...(request.axes||{})};
  const parts=[];
  for(const [axis,target] of Object.entries(targets)){
    if(!(axis in AXES) || !Number.isFinite(target)) continue;
    const weight=request.axisWeights?.[axis]||10;
    const contribution=axisContribution(record.sensory.axes[axis],target,weight);
    parts.push({key:axis,label:AXES[axis].label,...contribution,value:record.sensory.axes[axis],target});
  }
  if(request.occasion){
    const match=record.uses.occasions.includes(request.occasion);
    parts.push({key:'occasion',label:'Moment choisi',points:match?24:2,max:24,match});
  }
  if(request.pairing && request.pairing!=='accord_any'){
    const match=record.uses.pairings.includes(request.pairing);
    parts.push({key:'pairing',label:'Accord recherché',points:match?28:0,max:28,match});
  }
  if(request.experience){
    const target=request.experience==='discovery'?5:request.experience==='expert'?2.5:3.7;
    const contribution=axisContribution(record.sensory.axes.accessibility,target,12);
    parts.push({key:'experience',label:'Niveau de découverte',...contribution,value:record.sensory.axes.accessibility,target});
  }
  for(const aroma of request.aromas||[]){
    const match=record.sensory.aromas.includes(aroma);
    parts.push({key:`aroma:${aroma}`,label:`Arôme ${aroma}`,points:match?8:0,max:8,match});
  }
  const raw=parts.reduce((sum,part)=>sum+part.points,0);
  const max=parts.reduce((sum,part)=>sum+part.max,0)||1;
  const fit=Math.round(raw/max*100);
  const confidence=Math.round(record.evidence.confidence*100);
  const score=Math.round(fit*(.78+record.evidence.confidence*.22));
  const positives=parts.filter(part=>part.points/part.max>=.72).sort((a,b)=>b.points/b.max-a.points/a.max).slice(0,3);
  const cautions=parts.filter(part=>part.points/part.max<.38).sort((a,b)=>a.points/a.max-b.points/b.max).slice(0,2);
  return {score,fit,confidence,parts,positives,cautions};
}

function explanation(record,assessment){
  const reasons=assessment.positives.map(part=>part.label.toLowerCase());
  const caution=assessment.cautions[0]?.label.toLowerCase();
  return {
    headline:reasons.length?`Retenue pour ${reasons.join(', ')}.`:'Profil globalement proche de votre demande.',
    caution:caution?`À noter : le profil s’éloigne davantage sur ${caution}.`:record.editorial.avoid,
    confidence:`Niveau de connaissance : ${assessment.confidence} %.`
  };
}

export function recommend(knowledgeBase,request={},options={}){
  const limit=options.limit||3;
  return knowledgeBase.records
    .filter(record=>hardFilter(record,request))
    .map(record=>{
      const assessment=scoreRecord(record,request);
      return {record,assessment,explanation:explanation(record,assessment)};
    })
    .sort((a,b)=>b.assessment.score-a.assessment.score || b.record.evidence.confidence-a.record.evidence.confidence || a.record.commerce.price-b.record.commerce.price)
    .slice(0,limit);
}

export function sensoryDistance(first,second,axes=Object.keys(AXES)){
  const squares=axes.map(axis=>Math.pow((first.sensory.axes[axis]||3)-(second.sensory.axes[axis]||3),2));
  return Math.sqrt(squares.reduce((sum,value)=>sum+value,0)/Math.max(1,squares.length));
}

export function similarity(first,second){
  return Math.round(Math.max(0,1-sensoryDistance(first,second)/4)*100);
}

export function compare(knowledgeBase,ids){
  const records=ids.map(id=>knowledgeBase.records.find(record=>record.id===id)).filter(Boolean);
  return records.map(record=>({
    record,
    distances:records.filter(other=>other.id!==record.id).map(other=>({id:other.id,similarity:similarity(record,other)}))
  }));
}

export function findSimilar(knowledgeBase,id,options={}){
  const source=knowledgeBase.records.find(record=>record.id===id);
  if(!source) return [];
  return knowledgeBase.records
    .filter(record=>record.id!==id && (!options.availableOnly || record.commerce.available) && (!options.maxPrice || record.commerce.price<=options.maxPrice))
    .map(record=>({record,similarity:similarity(source,record),distance:sensoryDistance(source,record)}))
    .sort((a,b)=>b.similarity-a.similarity || a.record.commerce.price-b.record.commerce.price)
    .slice(0,options.limit||5);
}

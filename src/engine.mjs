import {AXES,confidence} from './model.mjs';

export const PRESETS={
  balanced:{freshness:3.5,roundness:3.5,power:3,complexity:3,accessibility:4},
  fresh:{freshness:5,acidity:4.5,minerality:4.5,roundness:2.2,power:2.5},
  fruity:{fruitiness:5,roundness:4.5,freshness:3,power:3},
  gastronomic:{power:4.5,complexity:4.5,persistence:4.5,gastronomic:5},
  complex:{complexity:5,brioche:4.5,persistence:5,roundness:3.5},
  delicate:{freshness:4,power:1.8,roundness:2.5,accessibility:4,fruitiness:3.5}
};

function signatureMatch(record,signature){
  const tags=(record.identity.tags||[]).join(' ').toLowerCase();
  if(!signature||signature==='any') return true;
  if(signature==='low_dosage') return /extra-brut|nature|zéro|zero/.test(tags)||(record.sensory.axes.sweetness||3)<=1.8;
  if(signature==='rose') return /rosé|rose/.test(tags);
  if(signature==='blanc_de_blancs') return /blanc de blancs/.test(tags);
  if(signature==='vintage') return Boolean(record.identity.vintage);
  if(signature==='grand_cru') return /grand cru/.test(tags);
  return true;
}

function eligible(record,request){
  if(request.availableOnly!==false&&!record.commerce?.available) return false;
  if(Number.isFinite(request.budgetMin)&&(record.commerce?.priceEur??Infinity)<request.budgetMin) return false;
  if(Number.isFinite(request.budgetMax)&&(record.commerce?.priceEur??Infinity)>request.budgetMax) return false;
  if(request.producerType&&request.producerType!=='any'&&record.identity.producerType!==request.producerType) return false;
  return signatureMatch(record,request.signature);
}

function assess(record,request){
  const targets={...(PRESETS[request.preset]||PRESETS.balanced),...(request.axes||{})};
  const parts=[];
  for(const [axis,target] of Object.entries(targets)){
    if(!(axis in AXES)||!Number.isFinite(target)) continue;
    const value=record.sensory.axes[axis]||3;
    const ratio=Math.max(0,1-Math.abs(value-target)/4);
    parts.push({criterion:axis,label:AXES[axis],ratio,value,target,weight:10});
  }
  if(request.occasion){const match=record.uses.occasions.includes(request.occasion);parts.push({criterion:'occasion',label:'Moment choisi',ratio:match?1:.08,weight:24,match});}
  if(request.pairing&&request.pairing!=='accord_any'){const match=record.uses.pairings.includes(request.pairing);parts.push({criterion:'pairing',label:'Accord recherché',ratio:match?1:0,weight:28,match});}
  const fit=Math.round(parts.reduce((sum,p)=>sum+p.ratio*p.weight,0)/Math.max(1,parts.reduce((sum,p)=>sum+p.weight,0))*100);
  const evidenceConfidence=confidence(record);
  const score=Math.round(fit*(.78+evidenceConfidence/100*.22));
  const strengths=parts.filter(p=>p.ratio>=.72).sort((a,b)=>b.ratio-a.ratio).slice(0,3).map(p=>p.label);
  const tradeoffs=parts.filter(p=>p.ratio<.38).sort((a,b)=>a.ratio-b.ratio).slice(0,2).map(p=>p.label);
  return {score,fit,evidenceConfidence,strengths,tradeoffs};
}

export function recommend(store,request={},limit=3){
  return store.all().filter(record=>eligible(record,request)).map(record=>({record,assessment:assess(record,request)}))
    .sort((a,b)=>b.assessment.score-a.assessment.score||b.assessment.evidenceConfidence-a.assessment.evidenceConfidence||(a.record.commerce?.priceEur||Infinity)-(b.record.commerce?.priceEur||Infinity))
    .slice(0,Math.min(25,Math.max(1,limit)));
}

export function distance(a,b,axes=Object.keys(AXES)){
  return Math.sqrt(axes.reduce((sum,axis)=>sum+Math.pow((a.sensory.axes[axis]||3)-(b.sensory.axes[axis]||3),2),0)/axes.length);
}
export function similarity(a,b){return Math.round(Math.max(0,1-distance(a,b)/4)*100);}
export function similar(store,id,{limit=5,availableOnly=true,maxPrice}={}){
  const source=store.get(id);if(!source)return [];
  return store.all().filter(r=>r.id!==id&&(!availableOnly||r.commerce?.available)&&(!maxPrice||(r.commerce?.priceEur||Infinity)<=maxPrice))
    .map(record=>({record,similarity:similarity(source,record)})).sort((a,b)=>b.similarity-a.similarity).slice(0,limit);
}
export function compare(store,ids){
  const records=ids.map(id=>store.get(id)).filter(Boolean);
  return records.map(record=>({record,similarities:records.filter(other=>other.id!==record.id).map(other=>({id:other.id,value:similarity(record,other)}))}));
}

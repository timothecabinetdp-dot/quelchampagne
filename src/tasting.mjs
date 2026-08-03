import {AXES} from './model.mjs';

const clamp=value=>Math.max(1,Math.min(5,Math.round(value*100)/100));
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
const deviation=values=>{if(values.length<2)return 0;const avg=mean(values);return Math.sqrt(mean(values.map(value=>(value-avg)**2)));};

export function validateTasting(tasting){
  const errors=[];
  if(!tasting.id)errors.push('identifiant de dégustation absent');
  if(!tasting.productId)errors.push('cuvée absente');
  if(!tasting.taster?.id)errors.push('dégustateur absent');
  if(!['consumer','enthusiast','sommelier','winemaker','critic'].includes(tasting.taster?.level))errors.push('niveau du dégustateur invalide');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tasting.tastedAt||''))errors.push('date invalide');
  for(const [axis,value] of Object.entries(tasting.axes||{})){
    if(!(axis in AXES))errors.push(`axe inconnu : ${axis}`);
    if(!Number.isFinite(value)||value<1||value>5)errors.push(`note invalide : ${axis}`);
  }
  if(Object.keys(tasting.axes||{}).length<4)errors.push('au moins quatre axes sont requis');
  return errors;
}

function tasterWeight(level){return {consumer:.7,enthusiast:.9,sommelier:1.15,winemaker:1.15,critic:1.1}[level]||.7;}

export function aggregateTastings(tastings,{minimumPanel=3}={}){
  const valid=tastings.filter(tasting=>!validateTasting(tasting).length);
  const byProduct=new Map();for(const tasting of valid){const list=byProduct.get(tasting.productId)||[];list.push(tasting);byProduct.set(tasting.productId,list);}
  return [...byProduct].map(([productId,panel])=>{
    const axes={};const agreement={};
    for(const axis of Object.keys(AXES)){
      const observations=panel.filter(t=>Number.isFinite(t.axes[axis]));
      if(!observations.length)continue;
      const expanded=observations.flatMap(t=>Array(Math.max(1,Math.round(tasterWeight(t.taster.level)*4))).fill(t.axes[axis]));
      axes[axis]=clamp(median(expanded));
      agreement[axis]=Math.round(Math.max(0,1-deviation(observations.map(t=>t.axes[axis]))/2)*100);
    }
    const aromaCounts={};for(const tasting of panel)for(const aroma of tasting.aromas||[])aromaCounts[aroma]=(aromaCounts[aroma]||0)+1;
    const aromas=Object.entries(aromaCounts).filter(([,count])=>count/panel.length>=.34).sort((a,b)=>b[1]-a[1]).map(([aroma])=>aroma);
    return {productId,panelSize:panel.length,blindCount:panel.filter(t=>t.blind===true).length,qualifiedCount:panel.filter(t=>['sommelier','winemaker','critic'].includes(t.taster.level)).length,axes,agreement,aromas,status:panel.length>=minimumPanel?'publishable':'insufficient_panel'};
  });
}

export function mergeTastingConsensus(record,consensus){
  if(!consensus||consensus.status!=='publishable')return record;
  const sourceId=`panel:${record.id}:${consensus.panelSize}`;
  return {...record,sensory:{...record.sensory,axes:{...record.sensory.axes,...consensus.axes},aromas:consensus.aromas.length?consensus.aromas:record.sensory.aromas},sources:[...record.sources,{id:sourceId,type:'community',url:`urn:quelchampagne:${sourceId}`,checkedAt:new Date().toISOString().slice(0,10),usage:'structured_tasting_panel'}],evidence:[...record.evidence,{field:'sensory.axes',sourceId,level:'primary'}],lifecycle:{...record.lifecycle,updatedAt:new Date().toISOString(),revision:(record.lifecycle.revision||0)+1}};
}

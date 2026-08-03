import {recommend} from './engine.mjs';

export function evaluateEngine(store,scenarios){
  const winners=new Map(),violations=[],empty=[];let totalRecommendations=0;
  for(const scenario of scenarios){const results=recommend(store,scenario.request,scenario.limit||3);if(!results.length)empty.push(scenario.id);for(const {record} of results){totalRecommendations++;winners.set(record.id,(winners.get(record.id)||0)+1);if(Number.isFinite(scenario.request.budgetMax)&&record.commerce.priceEur>scenario.request.budgetMax)violations.push({scenario:scenario.id,id:record.id,rule:'budgetMax'});if(scenario.request.availableOnly!==false&&!record.commerce.available)violations.push({scenario:scenario.id,id:record.id,rule:'availability'});}}
  const distinct=winners.size;const concentration=totalRecommendations?Math.max(...winners.values())/totalRecommendations:0;
  return {scenarioCount:scenarios.length,totalRecommendations,distinctRecommendations:distinct,coveragePercent:Math.round(distinct/store.size*1000)/10,topResultConcentrationPercent:Math.round(concentration*1000)/10,constraintViolations:violations,emptyScenarios:empty,status:violations.length||empty.length?'failed':'passed'};
}

export function generateScenarioMatrix(){
  const occasions=['occ_apero','occ_diner','occ_cadeau','occ_fete'];const pairings=['accord_any','accord_mer','accord_volaille','accord_fromage'];const presets=['balanced','fresh','fruity','gastronomic','complex','delicate'];const budgets=[40,60,80,120,250];const producerTypes=['any','maison','vigneron'];const scenarios=[];
  for(const occasion of occasions)for(const pairing of pairings)for(const preset of presets)for(const budgetMax of budgets)for(const producerType of producerTypes)scenarios.push({id:`${occasion}:${pairing}:${preset}:${budgetMax}:${producerType}`,request:{occasion,pairing,preset,budgetMax,producerType,availableOnly:true},limit:3});
  return scenarios;
}

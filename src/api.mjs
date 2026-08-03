import {recommend,similar,compare} from './engine.mjs';
import {ENGINE_VERSION,confidence} from './model.mjs';
import {buildTasteProfile,personalizeRequest} from './preferences.mjs';
import {aggregateTastings} from './tasting.mjs';
import {qualityReport} from './quality.mjs';

const json=(body,status=200)=>({status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'},body:JSON.stringify(body)});
const publicRecord=record=>({...record,quality:{evidenceConfidence:confidence(record)}});

export async function handleRequest(store,{method='GET',url='/',body=null}={}){
  const parsed=new URL(url,'http://engine.local');const path=parsed.pathname;
  if(method==='OPTIONS') return json({},204);
  if(method==='GET'&&path==='/health') return json({status:'ok',engineVersion:ENGINE_VERSION,records:store.size});
  if(method==='GET'&&path==='/v1/quality') return json(qualityReport(store));
  if(method==='GET'&&path==='/v1/champagnes') return json({records:store.search({q:parsed.searchParams.get('q'),producer:parsed.searchParams.get('producer'),available:parsed.searchParams.has('available')?parsed.searchParams.get('available')==='true':undefined,limit:Number(parsed.searchParams.get('limit'))||25}).map(publicRecord)});
  const productMatch=path.match(/^\/v1\/champagnes\/([^/]+)$/);
  if(method==='GET'&&productMatch){const record=store.get(decodeURIComponent(productMatch[1]));return record?json(publicRecord(record)):json({error:'not_found'},404);}
  const similarMatch=path.match(/^\/v1\/similar\/([^/]+)$/);
  if(method==='GET'&&similarMatch) return json({results:similar(store,decodeURIComponent(similarMatch[1]),{limit:Number(parsed.searchParams.get('limit'))||5,maxPrice:Number(parsed.searchParams.get('maxPrice'))||undefined}).map(item=>({...item,record:publicRecord(item.record)}))});
  if(method==='POST'&&path==='/v1/recommendations'){const input=typeof body==='string'?JSON.parse(body||'{}'):(body||{});return json({engineVersion:ENGINE_VERSION,results:recommend(store,input.request||input,input.limit||3).map(item=>({...item,record:publicRecord(item.record)}))});}
  if(method==='POST'&&path==='/v1/personalized-recommendations'){const input=typeof body==='string'?JSON.parse(body||'{}'):(body||{});const profile=buildTasteProfile(input.events||[],store);const request=personalizeRequest(input.request||{},profile);return json({engineVersion:ENGINE_VERSION,profile,request,results:recommend(store,request,input.limit||3).map(item=>({...item,record:publicRecord(item.record)}))});}
  if(method==='POST'&&path==='/v1/compare'){const input=typeof body==='string'?JSON.parse(body||'{}'):(body||{});return json({results:compare(store,input.ids||[]).map(item=>({...item,record:publicRecord(item.record)}))});}
  if(method==='POST'&&path==='/v1/tastings/aggregate'){const input=typeof body==='string'?JSON.parse(body||'{}'):(body||{});return json({panels:aggregateTastings(input.tastings||[])});}
  return json({error:'not_found'},404);
}

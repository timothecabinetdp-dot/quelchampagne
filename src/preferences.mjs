import {AXES} from './model.mjs';

const clamp=value=>Math.max(1,Math.min(5,Math.round(value*10)/10));
export function buildTasteProfile(events,store){
  const totals=Object.fromEntries(Object.keys(AXES).map(axis=>[axis,{sum:0,weight:0}]));
  const signalWeight={love:2,like:1,dislike:-1,avoid:-2,chosen:1.25,rejected:-.6};
  for(const event of events){
    const record=store.get(event.productId);const signal=signalWeight[event.signal]||0;if(!record||!signal)continue;
    for(const axis of Object.keys(AXES)){const value=record.sensory.axes[axis];if(!Number.isFinite(value))continue;totals[axis].sum+=value*signal;totals[axis].weight+=Math.abs(signal);}
  }
  const axes={};for(const [axis,total] of Object.entries(totals))if(total.weight){const raw=total.sum/total.weight;axes[axis]=clamp(raw<0?6-Math.abs(raw):raw);}
  return {axes,eventCount:events.length,confidence:Math.min(100,Math.round(events.length/12*100)),status:events.length>=5?'usable':'learning'};
}

export function personalizeRequest(request,profile,{strength=.55}={}){
  if(!profile||profile.status!=='usable')return request;
  const axes={...(request.axes||{})};for(const [axis,preference] of Object.entries(profile.axes)){const explicit=axes[axis];axes[axis]=Number.isFinite(explicit)?Math.round((explicit*(1-strength)+preference*strength)*10)/10:preference;}
  return {...request,axes,personalization:{eventCount:profile.eventCount,confidence:profile.confidence}};
}

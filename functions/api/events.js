const ALLOWED_EVENTS = new Set([
  'quiz_started',
  'quiz_answered',
  'quiz_completed',
  'recommendation_viewed',
  'product_analysis_viewed',
  'comparison_started',
  'merchant_click'
]);

function safe(value, maxLength=140){
  return String(value || '').replace(/[^a-zA-Z0-9À-ÿ_./:-]/g,'-').slice(0,maxLength);
}

export async function onRequestPost(context){
  let data;
  try{
    const text=await context.request.text();
    if(text.length>1600) return new Response(null,{status:413});
    data=JSON.parse(text);
  }catch(error){
    return new Response(null,{status:400});
  }

  const event=safe(data.event,60);
  if(!ALLOWED_EVENTS.has(event)) return new Response(null,{status:400});

  const path=safe(data.path,180);
  const product=safe(data.product,140);
  const source=safe(data.source,100);
  const step=Math.max(0,Math.min(10,Number(data.step)||0));

  if(context.env.QC_ANALYTICS){
    context.env.QC_ANALYTICS.writeDataPoint({
      indexes:[event],
      blobs:[event,path,product,source],
      doubles:[1,step]
    });
  }

  return new Response(null,{
    status:204,
    headers:{
      'cache-control':'no-store',
      'x-content-type-options':'nosniff'
    }
  });
}

export function onRequest(){
  return new Response(null,{status:405,headers:{allow:'POST'}});
}

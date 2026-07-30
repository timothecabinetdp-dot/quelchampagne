import assert from 'node:assert/strict';
import { onRequest, onRequestPost } from './functions/api/events.js';

function context(body, binding=true){
  const writes=[];
  return {
    writes,
    value:{
      request:new Request('https://quelchampagne.fr/api/events',{
        method:'POST',
        body
      }),
      env:binding ? {
        QC_ANALYTICS:{
          writeDataPoint(point){ writes.push(point); }
        }
      } : {}
    }
  };
}

{
  const mock=context(JSON.stringify({
    event:'merchant_click',
    path:'/champagne/cattier-brut-premier-cru/',
    product:'cattier-brut-premier-cru',
    source:'product-page',
    step:4
  }));
  const response=await onRequestPost(mock.value);
  assert.equal(response.status,204);
  assert.equal(mock.writes.length,1);
  assert.deepEqual(mock.writes[0].indexes,['merchant_click']);
  assert.deepEqual(mock.writes[0].doubles,[1,4]);
}

{
  const mock=context(JSON.stringify({event:'email_captured',email:'client@example.com'}));
  const response=await onRequestPost(mock.value);
  assert.equal(response.status,400);
  assert.equal(mock.writes.length,0);
}

{
  const mock=context('{malformed');
  assert.equal((await onRequestPost(mock.value)).status,400);
}

{
  const mock=context(JSON.stringify({event:'quiz_completed',path:'/selecteur/'}),false);
  assert.equal((await onRequestPost(mock.value)).status,204);
}

assert.equal(onRequest().status,405);
console.log('Analytics : événements autorisés, refus et absence de binding vérifiés.');

(function(){
  'use strict';

  var allowed = new Set([
    'quiz_started',
    'quiz_answered',
    'quiz_completed',
    'recommendation_viewed',
    'product_analysis_viewed',
    'comparison_started',
    'merchant_click'
  ]);

  function clean(value, max){
    return String(value || '').replace(/[^a-zA-Z0-9À-ÿ_./:-]/g, '-').slice(0, max || 120);
  }

  function send(event, details){
    if(!allowed.has(event)) return;
    var payload = {
      event:event,
      path:location.pathname,
      product:clean(details && details.product, 140),
      source:clean(details && details.source, 80),
      step:Number(details && details.step) || 0
    };
    var body=JSON.stringify(payload);
    try{
      if(navigator.sendBeacon){
        navigator.sendBeacon('/api/events', new Blob([body], {type:'text/plain;charset=UTF-8'}));
        return;
      }
      fetch('/api/events',{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:body,keepalive:true,credentials:'omit'}).catch(function(){});
    }catch(error){ /* la mesure ne doit jamais bloquer le parcours */ }
  }

  window.qcTrack=send;

  var match=location.pathname.match(/^\/champagne\/([^/]+)\/$/);
  var landingIds=new Set(['aperitif','cadeau','repas','rose','blanc-de-blancs','moins-de-50-euros','fruits-de-mer']);
  if(match && !landingIds.has(match[1])){
    send('product_analysis_viewed',{product:match[1],source:document.referrer ? 'referrer' : 'direct'});
  }

  document.addEventListener('click',function(event){
    var link=event.target.closest && event.target.closest('a');
    if(link){
      var href=link.getAttribute('href') || '';
      if(href==='/selecteur/' && location.pathname!=='/selecteur/'){
        send('quiz_started',{source:location.pathname});
      }
      if(/assets\.ikhnaie\.link/.test(href)){
        send('merchant_click',{
          product:link.getAttribute('data-product-id') || location.pathname.split('/').filter(Boolean).pop(),
          source:location.pathname
        });
      }
    }
    var compare=event.target.closest && event.target.closest('[data-compare]');
    if(compare) send('comparison_started',{product:compare.getAttribute('data-compare'),source:location.pathname});
  },true);
})();

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

  var affiliateChoiceKey='qc_affiliate_choice';
  var affiliateDialog=null;
  var previousFocus=null;

  function getAffiliateChoice(){
    try{return localStorage.getItem(affiliateChoiceKey)||'';}catch(error){return '';}
  }

  function setAffiliateChoice(value){
    try{localStorage.setItem(affiliateChoiceKey,value);}catch(error){}
  }

  function closeAffiliateDialog(){
    if(affiliateDialog) affiliateDialog.remove();
    affiliateDialog=null;
    document.body.style.overflow='';
    if(previousFocus && previousFocus.focus) previousFocus.focus();
  }

  function openExternal(url){
    if(!url) return;
    var opened=window.open(url,'_blank','noopener,noreferrer');
    if(opened) opened.opener=null;
  }

  function showAffiliateDialog(link){
    if(affiliateDialog) affiliateDialog.remove();
    previousFocus=document.activeElement;
    var trackedUrl=link ? link.getAttribute('href')||'' : '';
    var directUrl=link ? link.getAttribute('data-direct-url')||'' : '';
    var product=link ? link.getAttribute('data-product-id')||location.pathname.split('/').filter(Boolean).pop() : '';
    var navigating=Boolean(link);
    var overlay=document.createElement('div');
    overlay.className='affiliate-consent';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','affiliate-consent-title');
    overlay.innerHTML='<div class="affiliate-consent-box">'+
      '<button class="affiliate-close" type="button" aria-label="Fermer">×</button>'+
      '<div class="affiliate-kicker">Lien partenaire</div>'+
      '<h2 id="affiliate-consent-title">'+(navigating?'Avant de consulter l’offre':'Préférence pour les liens partenaires')+'</h2>'+
      '<p>Le lien suivi par Webgains permet d’attribuer une éventuelle commande à QuelChampagne. La commission ne change pas votre prix ni le classement des bouteilles.</p>'+
      '<div class="affiliate-actions">'+
        '<button class="affiliate-accept" type="button">'+(navigating?'Accepter le suivi et continuer':'Accepter le suivi')+'</button>'+
        '<button class="affiliate-direct" type="button">'+(navigating?'Continuer sans suivi':'Refuser le suivi')+'</button>'+
      '</div>'+
      '<small>Votre choix est conservé dans ce navigateur et peut être modifié depuis le pied de page.</small>'+
    '</div>';
    if(!document.getElementById('affiliate-consent-style')){
      var style=document.createElement('style');
      style.id='affiliate-consent-style';
      style.textContent='.affiliate-consent{position:fixed;inset:0;z-index:400;background:rgba(13,11,7,.72);display:grid;place-items:center;padding:20px}.affiliate-consent-box{position:relative;width:min(620px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#fff;color:#14110c;padding:clamp(28px,5vw,52px);border:1px solid #cfc8ba;box-shadow:0 30px 90px rgba(0,0,0,.35)}.affiliate-close{position:absolute;right:14px;top:10px;border:0;background:transparent;font-size:28px;line-height:1;color:#5f5a51}.affiliate-kicker{color:#806020;text-transform:uppercase;letter-spacing:.12em;font-size:12px;font-weight:800}.affiliate-consent h2{font-family:Archivo,Arial,sans-serif;font-size:clamp(30px,5vw,48px);line-height:.96;text-transform:uppercase;margin:12px 0 18px}.affiliate-consent p{color:#5f5a51;line-height:1.65;max-width:58ch}.affiliate-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.affiliate-actions button{min-height:48px;padding:0 20px;border:1px solid #14110c;font:600 13px Archivo,Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em}.affiliate-accept{background:#14110c;color:#fff}.affiliate-direct{background:#fff;color:#14110c}.affiliate-consent small{display:block;color:#777067;line-height:1.5;margin-top:18px}@media(max-width:520px){.affiliate-consent{padding:12px}.affiliate-consent-box{max-height:calc(100dvh - 24px);padding:28px 20px}.affiliate-consent h2{font-size:30px}.affiliate-actions{display:grid;grid-template-columns:1fr}.affiliate-actions button{width:100%;padding:0 14px}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
    document.body.style.overflow='hidden';
    affiliateDialog=overlay;
    overlay.querySelector('.affiliate-close').addEventListener('click',closeAffiliateDialog);
    overlay.addEventListener('click',function(event){if(event.target===overlay) closeAffiliateDialog();});
    overlay.querySelector('.affiliate-accept').addEventListener('click',function(){
      setAffiliateChoice('tracked');
      closeAffiliateDialog();
      if(navigating){
        send('merchant_click',{product:product,source:location.pathname});
        openExternal(trackedUrl);
      }
    });
    overlay.querySelector('.affiliate-direct').addEventListener('click',function(){
      setAffiliateChoice('direct');
      closeAffiliateDialog();
      if(navigating) openExternal(directUrl);
    });
    overlay.querySelector('.affiliate-close').focus();
  }

  window.qcAffiliatePreferences=function(){
    showAffiliateDialog(null);
  };

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
        var choice=getAffiliateChoice();
        if(choice==='tracked'){
          send('merchant_click',{
            product:link.getAttribute('data-product-id') || location.pathname.split('/').filter(Boolean).pop(),
            source:location.pathname
          });
        }else{
          event.preventDefault();
          event.stopImmediatePropagation();
          if(choice==='direct') openExternal(link.getAttribute('data-direct-url')||'');
          else showAffiliateDialog(link);
          return;
        }
      }
    }
    var compare=event.target.closest && event.target.closest('[data-compare]');
    if(compare) send('comparison_started',{product:compare.getAttribute('data-compare'),source:location.pathname});
  },true);
})();

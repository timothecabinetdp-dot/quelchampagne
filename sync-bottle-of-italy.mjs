/**
 * Synchronise les données publiques utiles des 48 fiches Bottle of Italy.
 *
 * Le fichier généré reste un instantané contrôlable et versionnable. Le build
 * du site n'effectue aucun appel réseau : il consomme uniquement cet instantané.
 *
 * Usage : node sync-bottle-of-italy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAMPAGNES } from './boutique.mjs';

const OUTPUT = new URL('data/bottle-of-italy-products.json', import.meta.url);
const CONCURRENCY = 6;
const checkedAt = new Date().toISOString();
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));

const TECHNICAL_LABELS = [
  'Producteur','Nom','Variété','Gradation','Format','Profil aromatique',
  'Méthode de vinification','Sucres résiduels','Région','Pays','Taper',
  'Vieillissement','Type de fût','Couleur','Température de service',
  'Consommation recommandée','Accompagnement'
];

function plainText(html=''){
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function affiliateUrl(url){
  const parsed = new URL(url);
  if(parsed.searchParams.get('country') === 'FRutm_source=webgains'){
    parsed.searchParams.set('country','FR');
    parsed.searchParams.set('utm_source','webgains');
  }
  return parsed.toString();
}

async function fetchWithRetry(url, options, required=true){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,options);
      if(response.ok) return response;
      lastError=new Error(`${response.status} ${url}`);
      if(response.status!==429 && response.status<500) break;
    }catch(error){ lastError=error; }
    await wait(600*(2**attempt));
  }
  if(required) throw lastError || new Error(`Échec de lecture : ${url}`);
  return null;
}

export function parseTechnicalData(html=''){
  const text=plainText(html);
  const marker=text.toLowerCase().indexOf('informations techniques');
  if(marker<0) return {};
  const endCandidates=['afficher plus','demandez au sommelier','descrizione','description']
    .map(label=>text.toLowerCase().indexOf(label,marker+20)).filter(index=>index>marker);
  const section=text.slice(marker, endCandidates.length?Math.min(...endCandidates):marker+5000);
  const positions=TECHNICAL_LABELS.map(label=>({label,index:section.toLowerCase().indexOf(label.toLowerCase())}))
    .filter(item=>item.index>=0).sort((a,b)=>a.index-b.index);
  const result={};
  for(let index=0;index<positions.length;index++){
    const current=positions[index];
    const next=positions[index+1];
    const value=section.slice(current.index+current.label.length,next?.index ?? section.length)
      .replace(/^[\s:–-]+|[\s:–-]+$/g,'').trim();
    if(value && value.length<=240) result[current.label]=value;
  }
  return result;
}

async function fetchProduct(product){
  const headers={'user-agent':'QuelChampagne catalogue sync'};
  const [response,pageResponse] = await Promise.all([
    fetchWithRetry(`${product.productUrl}.js`, {headers:{...headers,accept:'application/json'}}, true),
    fetchWithRetry(product.productUrl, {headers:{...headers,accept:'text/html'}}, false)
  ]);
  const live = await response.json();
  const pageHtml=pageResponse ? await pageResponse.text() : '';
  return {
    id:product.id,
    brand:product.brand,
    name:product.name,
    liveTitle:live.title,
    vendor:live.vendor,
    tags:product.tags,
    merchantTags:live.tags || [],
    price:Number((live.price/100).toFixed(2)),
    oldPrice:live.compare_at_price ? Number((live.compare_at_price/100).toFixed(2)) : null,
    available:Boolean(live.available),
    image:(live.featured_image || product.image).replace(/^\/\//,'https://'),
    buyUrl:affiliateUrl(product.buyUrl),
    productUrl:product.productUrl,
    merchantDescription:plainText(live.description),
    technicalData:parseTechnicalData(pageHtml),
    checkedAt
  };
}

// Tolérance aux pannes : on conserve le dernier relevé d'un produit
// temporairement inaccessible plutôt que de faire échouer toute la synchro.
let previousById=new Map();
try{
  const prev=JSON.parse(readFileSync(OUTPUT,'utf8'));
  for(const record of (prev.records||[])) previousById.set(record.id, record);
}catch(error){ /* premier passage ou fichier absent */ }

async function fetchProductSafe(product){
  try{ return await fetchProduct(product); }
  catch(error){
    const previous=previousById.get(product.id);
    console.warn(`Produit inaccessible (${product.id}) : ${previous?'dernier relevé conservé':'ignoré faute d’historique'}.`);
    return previous || null;
  }
}

const records=[];
for(let index=0; index<CHAMPAGNES.length; index+=CONCURRENCY){
  const batch=await Promise.all(CHAMPAGNES.slice(index,index+CONCURRENCY).map(fetchProductSafe));
  records.push(...batch.filter(Boolean));
}

writeFileSync(OUTPUT, `${JSON.stringify({
  version:1,
  merchant:'Bottle of Italy',
  network:'Webgains',
  checkedAt,
  count:records.length,
  records
}, null, 2)}\n`);

console.log(`Synchronisation Bottle of Italy réussie : ${records.length} produits (${checkedAt}).`);

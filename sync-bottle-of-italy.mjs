/**
 * Synchronise les données publiques utiles des 48 fiches Bottle of Italy.
 *
 * Le fichier généré reste un instantané contrôlable et versionnable. Le build
 * du site n'effectue aucun appel réseau : il consomme uniquement cet instantané.
 *
 * Usage : node sync-bottle-of-italy.mjs
 */
import { writeFileSync } from 'node:fs';
import { CHAMPAGNES } from './boutique.mjs';

const OUTPUT = new URL('data/bottle-of-italy-products.json', import.meta.url);
const CONCURRENCY = 6;
const checkedAt = new Date().toISOString();

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

async function fetchProduct(product){
  const response = await fetch(`${product.productUrl}.js`, {
    headers:{'accept':'application/json','user-agent':'QuelChampagne catalogue sync'}
  });
  if(!response.ok) throw new Error(`${response.status} ${product.productUrl}`);
  const live = await response.json();
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
    checkedAt
  };
}

const records=[];
for(let index=0; index<CHAMPAGNES.length; index+=CONCURRENCY){
  records.push(...await Promise.all(CHAMPAGNES.slice(index,index+CONCURRENCY).map(fetchProduct)));
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

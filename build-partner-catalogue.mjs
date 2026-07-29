/**
 * Construit le catalogue canonique utilisé par le quiz et le comparateur.
 *
 * Les faits commerciaux viennent de l'instantané Bottle of Italy. Les champs
 * de recommandation sont dérivés de la dénomination, des tags et de la
 * description marchand, avec des corrections explicites pour éviter les
 * rapprochements par simple sous-chaîne.
 */
import { readFileSync } from 'node:fs';
import { boutiqueSlug } from './boutique.mjs';

const snapshot = JSON.parse(readFileSync(new URL('data/bottle-of-italy-products.json', import.meta.url), 'utf8'));

const HOUSE_BRANDS = new Set([
  'EPC Champagne','Maison Burtin','Nicolas Feuillatte','Cattier',
  'Veuve Clicquot','Jacquart','Drappier','Billecart-Salmon','Perrier-Jouët'
]);

const WELL_KNOWN = new Set([
  'Nicolas Feuillatte','Veuve Clicquot','Jacquart','Drappier',
  'Billecart-Salmon','Perrier-Jouët','Cattier'
]);

const YEAR_UNCONFIRMED_ON_MERCHANT_PAGE = new Set([
  'Domaine Augustin','Lamiable','Mouzon Leroux','Laherte Frères',
  'Billecart-Salmon','Perrier-Jouët'
]);

const GRAPES = [
  ['Chardonnay',/\b(chardonnay)\b/i],
  ['Pinot Noir',/\b(pinot noir|pinot nero)\b/i],
  ['Meunier',/\b(pinot meunier|meunier)\b/i],
  ['Pinot Blanc',/\b(pinot blanc|pinot bianco|blanc vrai)\b/i],
  ['Arbane',/\b(arbane|arbanne)\b/i],
  ['Petit Meslier',/\bpetit meslier\b/i]
];

const AROMAS = [
  ['agrumes',/\b(agrumes?|agrumi|citron|limone|pamplemousse)\b/i],
  ['pomme',/\b(pomme|mela)\b/i],
  ['poire',/\b(poire|pera)\b/i],
  ['pêche',/\b(pêche|pesca)\b/i],
  ['fruits rouges',/\b(fruits? rouges?|frutti rossi|framboise|lampone|fraise|fragola|cerise|ciliegia)\b/i],
  ['fruits mûrs',/\b(fruits? mûrs?|frutta matura)\b/i],
  ['fleurs blanches',/\b(fleurs? blanches?|fiori bianchi|floral)\b/i],
  ['brioche',/\b(brioche|pain grillé|pane tostato|croûte de pain)\b/i],
  ['miel',/\b(miel|miele)\b/i],
  ['noisette',/\b(noisette|nocciola)\b/i],
  ['amande',/\b(amande|mandorla)\b/i],
  ['épices',/\b(épices?|spezie|épicé)\b/i],
  ['minéralité',/\b(minéral|minérale|mineralità|crayeux|craie)\b/i],
  ['salinité',/\b(salin|saline|salinité|sapide)\b/i]
];

const PAIRINGS = [
  ['huîtres',/\b(huîtres?|ostriche)\b/i,'accord_mer'],
  ['crustacés',/\b(crustacés?|crostacei|homard|langouste)\b/i,'accord_mer'],
  ['sushis',/\b(sushis?|sashimi)\b/i,'accord_mer'],
  ['poisson',/\b(poissons?|pesce|carpaccio)\b/i,'accord_mer'],
  ['volaille',/\b(volaille|poulet|pollo|canard)\b/i,'accord_volaille'],
  ['fromages',/\b(fromages?|formaggi)\b/i,'accord_fromage'],
  ['fruits rouges',/\b(fruits? rouges?|frutti rossi|fraise|fragola)\b/i,'accord_dessert'],
  ['dessert',/\b(desserts?|dolci|gâteau|tarte)\b/i,'accord_dessert'],
  ['apéritif',/\b(apéritif|aperitivo|happy-hour)\b/i,'accord_aperitif']
];

function unique(values){ return [...new Set(values.filter(Boolean))]; }
function has(text, expression){ return expression.test(text); }
function checkedDate(){ return snapshot.checkedAt.slice(0,10); }
function normalizeBrand(brand){
  if(brand==='Champagne Simplexité Rosé Brut') return 'Simplexité';
  if(brand==='Jean De La Fontaine') return 'Jean de La Fontaine';
  if(brand==='Beaumont des Crayeres') return 'Beaumont des Crayères';
  if(brand==='J.Charpentier') return 'J. Charpentier';
  if(brand==='J-M Seleque') return 'J-M Sélèque';
  return brand;
}

function correctedTags(product){
  const tags=[...product.tags];
  const text=`${product.name} ${product.liveTitle}`.toLowerCase();
  if(product.brand==='Jacquart'){
    const index=tags.indexOf('Extra-brut / nature');
    if(index>=0) tags.splice(index,1);
    if(!tags.includes('Brut')) tags.unshift('Brut');
  }
  if(product.brand==='Drappier' && !tags.includes('Extra-brut / nature')) tags.push('Extra-brut / nature');
  if(/\bzero\b/i.test(text) && !tags.includes('Extra-brut / nature')) tags.push('Extra-brut / nature');
  if(tags.includes('Extra-brut / nature')){
    const brutIndex=tags.indexOf('Brut');
    if(brutIndex>=0) tags.splice(brutIndex,1);
  }
  if(/grand cru/i.test(text) && !tags.includes('Grand Cru')) tags.push('Grand Cru');
  if(/(?:premier cru|1er cru)/i.test(text) && !tags.includes('Premier Cru')) tags.push('Premier Cru');
  return unique(tags);
}

function findValues(text, definitions){
  return definitions.filter(([,expression])=>has(text,expression)).map(([label])=>label);
}

function profileScores(product, tags, aromas){
  const text=`${product.name} ${product.merchantDescription}`.toLowerCase();
  let freshness=3, roundness=3, power=3, complexity=3;
  if(tags.includes('Extra-brut / nature')){ freshness+=2; roundness-=1; }
  if(tags.includes('Blanc de blancs')){ freshness+=1; power-=1; }
  if(tags.includes('Blanc de noirs')){ roundness+=1; power+=1; }
  if(tags.includes('Rosé')){ roundness+=1; }
  if(tags.includes('Demi-sec')){ roundness+=2; freshness-=1; }
  if(tags.includes('Millésimé')) complexity+=1;
  if(/\b(frais|fraîche|vivace|acidité|tendu|net|salin|minéral)\b/i.test(text)) freshness+=1;
  if(/\b(rond|ronde|crémeux|crémeuse|généreux|généreuse|souple|miel|brioch)\b/i.test(text)) roundness+=1;
  if(/\b(structuré|structurée|puissant|puissante|intense|vineux|charpenté)\b/i.test(text)) power+=1;
  if(/\b(complexe|complexité|persistant|persistante|longue|élevage|lies|fût)\b/i.test(text)) complexity+=1;
  if(aromas.includes('salinité')||aromas.includes('minéralité')) freshness+=1;
  const clamp=value=>Math.max(1,Math.min(5,value));
  return {freshness:clamp(freshness),roundness:clamp(roundness),power:clamp(power),complexity:clamp(complexity)};
}

function level(value, axis){
  const labels={
    freshness:['Très douce','Douce','Équilibrée','Fraîche','Très fraîche'],
    roundness:['Très droite','Droite','Équilibrée','Ronde','Très ronde'],
    power:['Très légère','Légère','Équilibrée','Puissante','Très puissante'],
    complexity:['Directe','Accessible','Nuancée','Complexe','Très complexe']
  };
  return labels[axis][value-1];
}

function styleLabel(tags){
  const descriptors=[];
  const colour=tags.includes('Rosé')
    ? 'rosé'
    : tags.includes('Blanc de blancs')
      ? 'blanc de blancs'
      : tags.includes('Blanc de noirs')
        ? 'blanc de noirs'
        : '';
  const dosage=tags.includes('Extra-brut / nature')
    ? 'extra-brut ou non dosé'
    : tags.includes('Demi-sec')
      ? 'demi-sec'
      : 'brut';
  descriptors.push([colour,dosage].filter(Boolean).join(' '));
  if(tags.includes('Grand Cru')) descriptors.push('Grand Cru');
  else if(tags.includes('Premier Cru')) descriptors.push('Premier Cru');
  if(tags.includes('Millésimé')) descriptors.push('millésimé');
  return descriptors.join(', ');
}

function recommendationFields(product, tags, scores, pairings){
  const profil=[];
  if(scores.freshness>=4) profil.push('profil_frais_vif');
  if(scores.roundness>=4 || tags.includes('Rosé')) profil.push('profil_fruite');
  if(scores.power>=4 || scores.complexity>=4) profil.push('profil_riche_ample');
  if(scores.power<=2 || tags.includes('Blanc de blancs')) profil.push('profil_delicat');
  if(!profil.length) profil.push('profil_fruite');

  const occ=['occ_fete'];
  if(pairings.some(item=>item.token==='accord_aperitif') || product.price<60) occ.push('occ_apero');
  if(pairings.some(item=>['accord_mer','accord_volaille','accord_fromage'].includes(item.token))) occ.push('occ_diner');
  if(product.price>=45 || WELL_KNOWN.has(product.brand) || tags.includes('Millésimé')) occ.push('occ_cadeau');
  if(tags.includes('Rosé') || scores.power<=2) occ.push('occ_romantique');

  return {profil:unique(profil),occ:unique(occ)};
}

function specificText(product, tags, grapes, aromas, pairings, scores){
  const style=styleLabel(tags);
  const aromaText=aromas.length ? aromas.slice(0,4).join(', ') : 'fruit, fraîcheur et notes de vieillissement';
  const grapeText=grapes.length ? ` Les cépages mentionnés sont ${grapes.join(', ')}.` : '';
  const pairingText=pairings.length ? pairings.slice(0,3).map(item=>item.label).join(', ') : 'l’apéritif et un repas léger';
  const structure = scores.power>=4
    ? 'Sa structure la destine davantage à la table qu’à un simple toast.'
    : scores.freshness>=4
      ? 'Sa fraîcheur attendue en fait une option particulièrement lisible à l’apéritif.'
      : 'Son équilibre la rend polyvalente entre apéritif et début de repas.';
  const note=`Un champagne ${style} dont la fiche du marchand fait ressortir ${aromaText}.${grapeText} ${structure}`;
  const freshness=scores.freshness>=4?'une fraîcheur marquée':scores.freshness<=2?'une fraîcheur mesurée':'une fraîcheur équilibrée';
  const structureLabel=scores.power>=4?'une structure affirmée':scores.power<=2?'une structure légère':'une structure équilibrée';
  const advice=`Choisissez cette cuvée pour ${freshness}, ${structureLabel} et des accords particulièrement cohérents avec ${pairingText}.`;
  const avoid=scores.freshness>=4
    ? `À éviter si vous recherchez avant tout une sensation très ronde et douce : son registre met davantage en avant ${aromas.slice(0,2).join(' et ')||'la tension et la fraîcheur'}.`
    : scores.power>=4
      ? `À éviter si vous souhaitez un champagne très léger et exclusivement apéritif : sa matière vise plutôt ${pairingText}.`
      : tags.includes('Demi-sec')
        ? 'À éviter avec des huîtres ou si vous recherchez une finale très sèche : la douceur annoncée appelle plutôt le dessert.'
        : `À éviter si vous recherchez un style volontairement extrême, très tendu ou très puissant : cette cuvée privilégie la polyvalence autour de ${pairingText}.`;
  return {note,advice,avoid};
}

export function buildPartnerCatalogue(){
  return snapshot.records.map(source=>{
    const brand=normalizeBrand(source.brand);
    const normalized={...source,brand};
    const tags=correctedTags(source);
    const searchText=`${source.name} ${source.liveTitle} ${source.merchantTags.join(' ')} ${source.merchantDescription}`;
    const grapes=findValues(searchText,GRAPES);
    const aromas=findValues(searchText,AROMAS);
    const pairings=PAIRINGS.filter(([,expression])=>has(searchText,expression)).map(([label,,token])=>({label,token}));
    const scores=profileScores(source,tags,aromas);
    const rec=recommendationFields(source,tags,scores,pairings);
    const text=specificText(source,tags,grapes,aromas,pairings,scores);
    const id=boutiqueSlug({brand,name:source.name});
    const price=source.price;
    const year=source.name.match(/\b(19|20)\d{2}\b/)?.[0] || null;
    const identityStatus=year && YEAR_UNCONFIRMED_ON_MERCHANT_PAGE.has(source.brand) ? 'merchant_feed_year_to_verify' : 'merchant_page_checked';
    const publicName=identityStatus==='merchant_feed_year_to_verify'
      ? source.name.replace(new RegExp(`\\s*${year}\\b`),'').trim()
      : source.name;
    const producerType=HOUSE_BRANDS.has(source.brand) ? 'maison' : 'vigneron';
    const accords=unique(pairings.map(item=>item.token));
    const pair=pairings.slice(0,3).map(item=>item.label).join(', ') || 'apéritif, poisson';
    const tier=price<30?1:price<=60?2:price<=100?3:4;
    const popularity=(WELL_KNOWN.has(source.brand)?84:68) + (tags.includes('Grand Cru')?4:0) + (tags.includes('Millésimé')?3:0);
    const facts=[
      `Catégorie communiquée : ${styleLabel(tags)}.`,
      grapes.length?`Cépages mentionnés : ${grapes.join(', ')}.`:null,
      year?`Année indiquée dans le flux partenaire : ${year}${identityStatus==='merchant_feed_year_to_verify'?' — à confirmer sur la bouteille ou auprès du producteur.':'.'}`:null
    ].filter(Boolean).join(' ');

    return {
      id, merchantId:source.id, name:publicName, short:publicName, house:brand, brand,
      region:'Champagne', price, priceMin:price, priceMax:price, oldPrice:source.oldPrice,
      tier, producerType, occ:rec.occ, profil:rec.profil, accords,
      bulles:'bulles_fines', tags, pair, note:text.note,
      sourceUrl:source.productUrl, verifiedAt:checkedDate(), editorialReady:true,
      commerceReady:source.available, popularity, aff:source.buyUrl, image:source.image,
      availability:source.available?'in_stock':'out_of_stock',
      priceStatus:'merchant_snapshot', offerCheckedAt:source.checkedAt,
      identityStatus, merchantDescription:source.merchantDescription,
      imageRights:{sourceUrl:source.image,rightsBasis:'Flux du programme partenaire Bottle of Italy / Webgains',verifiedAt:checkedDate()},
      details:{
        facts, sourceQuality:'Données produit et disponibilité du marchand, avec interprétation éditoriale QuelChampagne',
        advice:text.advice, avoid:text.avoid,
        profil:{
          fraicheur:level(scores.freshness,'freshness'),
          rondeur:level(scores.roundness,'roundness'),
          puissance:level(scores.power,'power'),
          longueur:level(scores.complexity,'complexity')
        },
        scores,
        aromas,
        grapes,
        accords:pairings.slice(0,3).map((item,index)=>({
          t:index===0?'Accord prioritaire':index===1?'Autre possibilité':'Pour varier',
          d:item.label.charAt(0).toUpperCase()+item.label.slice(1)
        })),
        merchant:'Bottle of Italy',
        merchantTitle:source.liveTitle
      }
    };
  });
}

export const PARTNER_CATALOGUE = buildPartnerCatalogue();

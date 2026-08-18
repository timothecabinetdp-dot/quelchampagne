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
import { enrichProduct } from './product-enrichment.mjs';

const snapshot = JSON.parse(readFileSync(new URL('data/bottle-of-italy-products.json', import.meta.url), 'utf8'));
const evidenceRegistry = JSON.parse(readFileSync(new URL('data/product-evidence-overrides.json', import.meta.url), 'utf8'));

/* Statut du producteur — classification VÉRIFIABLE (règle de l'audit).
 * Principe impératif : « inconnu » reste « inconnu ». On ne transforme JAMAIS une
 * absence d'information en « vigneron ». Deux listes éditoriales, curées et à valider
 * (idéalement via la mention NM/RM/CM… de l'étiquette), et tout le reste = 'inconnu'.
 * La comparaison se fait sur une forme normalisée (accents, « Champagne/Maison »,
 * « & Fils »… neutralisés) pour absorber les variantes d'orthographe du flux marchand. */
function normBrand(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\b(champagne|maison|domaine|vignobles?|cie|co)\b/g,' ')
    .replace(/&|\bet\b|\bfils\b|\bpere\b|\bfreres?\b|\bsoeurs?\b|\bfilles?\b/g,' ')
    .replace(/[^a-z]+/g,' ').trim();
}
// Grandes maisons de négoce (vérifiées).
const HOUSE_BRANDS = new Set([
  'epc','burtin','nicolas feuillatte','cattier','veuve clicquot','jacquart','drappier',
  'billecart salmon','perrier jouet','mumm','g h mumm','pernod ricard','moet chandon','moet',
  'bollinger','taittinger','pol roger','laurent perrier','ruinart','krug','dom perignon',
  'piper heidsieck','charles heidsieck','lanson','mercier','deutz','pommery','canard duchene',
  'henriot','duval leroy','ayala','gosset','palmer','besserat de bellefon','castelnau',
  'vranken','de venoge','venoge','bligny','collet','nicolas feuillatte'
].map(normBrand));
// Vignerons récoltants-manipulants (RM) documentés — liste éditoriale à valider.
const KNOWN_GROWERS = new Set([
  'egly ouriet','paul bara','vilmart','guy charlemagne','bereche','gatinois','jean vesselle',
  'lamiable','mouzon leroux','lancelot pienne','corbon','benard pitois','maurice grumier',
  'thevenet delouvin','eric taillet','vincent brochet','pierre legras','pierre baillette',
  'larmandier bernier','pierre peters','gimonnet','chartogne taillet','de sousa','agrapart',
  'selosse','ulysse collin','savart','marguet','r pouillon','pouillon','georges laval',
  'pierre paillard','roger coulon','francoise bedel','geoffroy','laherte','francis boulard',
  'coessens','vazart coquart','waris larmandier','stephane regnault','sadi malot','petit camusat',
  'beltrand brigandat','vouette sorbee','marie courtin','benoit lahaye','lassaigne','tarlant',
  'brisson lahaye','thierry massin','thomas perseval','daniel deheurles','erick schreiber',
  'm g heucq','heucq','alain mercier','labbe','tornay hutasse','bardiau','louis constant','solemme','domaine augustin'
].map(normBrand));
function producerStatus(brand){
  const b=normBrand(brand);
  if(HOUSE_BRANDS.has(b)) return 'maison';
  if(KNOWN_GROWERS.has(b)) return 'vigneron';
  return 'inconnu';               // jamais 'vigneron' par défaut
}
/* Nettoyage des artefacts d'encodage du flux marchand : apostrophe utilisée comme
 * accent (« Rose' » → « Rosé »), accents manquants ou fautifs (« Millesimè », « Cuvee »). */
function cleanName(s){
  return (s||'').normalize('NFC')
    .replace(/Rose['’`´]/g,'Rosé').replace(/\bRose\b/g,'Rosé')
    .replace(/Millesim[eè]['’`´]?/g,'Millésimé').replace(/\bMillesim[eé]\b/g,'Millésimé')
    .replace(/\bCuvee\b/g,'Cuvée').replace(/\bReserve\b/g,'Réserve')
    .replace(/\bGrand Cuvée\b/g,'Grande Cuvée')
    .replace(/['’`´]\s/g,'’ ').replace(/\s{2,}/g,' ').trim();
}
/* Producteurs identiques écrits de plusieurs façons → une forme canonique (clé = normBrand). */
const PRODUCER_CANON = new Map([
  ['benard pitois','Bénard-Pitois'],
  ['labbe','Champagne Labbé & Fils'],
  ['alain mercier','Alain Mercier & Fils'],
  ['bereche','Bérêche et Fils'],
  ['bardiau','Champagne Bardiau'],
  ['daubanton','Daubanton & Fils'],
]);
function canonHouse(s){
  return PRODUCER_CANON.get(normBrand(s)) || cleanName(s);
}

const WELL_KNOWN = new Set([
  'Nicolas Feuillatte','Veuve Clicquot','Jacquart','Drappier','Billecart-Salmon',
  'Perrier-Jouët','Cattier','Mumm','Pol Roger','Bollinger','Taittinger','Laurent-Perrier',
  'Ruinart','Moët & Chandon','Krug','Deutz','Lanson','Pommery'
]);

const YEAR_UNCONFIRMED_ON_MERCHANT_PAGE = new Set([
  'Domaine Augustin','Lamiable','Mouzon Leroux','Laherte Frères',
  'Billecart-Salmon','Perrier-Jouët'
]);
const OFFER_WARNING_DAYS = 3;
const OFFER_EXPIRY_DAYS = 7;

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
  ['fruits blancs',/\b(fruits? blancs?|frutta bianca|frutti bianchi|chair blanche)\b/i],
  ['fruits jaunes',/\b(fruits? jaunes?|ananas|litchi|albicocca|abricot)\b/i],
  ['pomme',/\b(pomme|mela)\b/i],
  ['poire',/\b(poire|pera)\b/i],
  ['pêche',/\b(pêche|pesca)\b/i],
  ['fruits rouges',/\b(fruits? rouges?|frutti rossi|framboise|lampone|fraise|fragola|cerise|ciliegia)\b/i],
  ['fruits mûrs',/\b(fruits? mûrs?|frutta matura)\b/i],
  ['fleurs blanches',/\b(fleurs? blanches?|fiori bianchi|floral)\b/i],
  ['brioche',/\b(brioche|pain grillé|pane tostato|croûte de pain)\b/i],
  ['pâtisserie',/\b(pâtisserie|pasticceria|mie de pain|levure|lievito)\b/i],
  ['miel',/\b(miel|miele)\b/i],
  ['noisette',/\b(noisette|nocciola)\b/i],
  ['amande',/\b(amande|mandorla)\b/i],
  ['fruits secs',/\b(fruits? secs?|frutta secca)\b/i],
  ['vanille',/\b(vanille|vaniglia)\b/i],
  ['rose',/\b(rose|rosa|petali di rosa)\b/i],
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
function offerAgeDays(checkedAt){
  const timestamp=Date.parse(checkedAt);
  if(!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0,(Date.now()-timestamp)/86400000);
}
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
  // On tranche clairement entre extra-brut et brut nature d'après le libellé réel de la cuvée,
  // au lieu de l'étiquette floue « Extra-brut / nature » qui donnait une impression d'hésitation.
  const slashIndex=tags.indexOf('Extra-brut / nature');
  if(slashIndex>=0) tags.splice(slashIndex,1);
  const wasLowDosage=slashIndex>=0;
  const isExtraBrut=/extra[ -]?brut/i.test(text);
  const isNature=/\bbrut nature\b|dosage z[ée]ro|z[ée]ro dosage|non dos[ée]|pas dos[ée]|sans dosage|\bbrut z[ée]ro\b|\bnature\b|\bzero\b/i.test(text);
  if(isExtraBrut || isNature || wasLowDosage){
    const label=isExtraBrut ? 'Extra-brut' : isNature ? 'Brut nature' : 'Extra-brut';
    if(!tags.includes(label)) tags.push(label);
    const brutIndex=tags.indexOf('Brut');
    if(brutIndex>=0) tags.splice(brutIndex,1);
  }
  if(/grand cru/i.test(text) && !tags.includes('Grand Cru')) tags.push('Grand Cru');
  if(/(?:premier cru|1er cru)/i.test(text) && !tags.includes('Premier Cru')) tags.push('Premier Cru');
  return unique(tags);
}
function isLowDosageTags(tags){ return tags.includes('Extra-brut') || tags.includes('Brut nature'); }
// Filet de sécurité : quelle que soit la source des tags (overrides inclus), on ne laisse jamais
// passer le libellé flou « Extra-brut / nature » ; on tranche d'après le nom réel de la cuvée.
function normalizeDosageTags(tags, product){
  if(!tags.includes('Extra-brut / nature')) return tags;
  const out=tags.filter(t=>t!=='Extra-brut / nature');
  const text=`${product.name} ${product.liveTitle||''}`.toLowerCase();
  const label=/extra[ -]?brut/i.test(text) ? 'Extra-brut' : /nature|z[ée]ro/i.test(text) ? 'Brut nature' : 'Extra-brut';
  if(!out.includes(label)) out.push(label);
  return out;
}

function findValues(text, definitions){
  return definitions.filter(([,expression])=>has(text,expression)).map(([label])=>label);
}

function profileScores(product, tags, aromas){
  const text=`${product.name} ${product.merchantDescription}`.toLowerCase();
  let freshness=3, roundness=3, power=3, complexity=3;
  if(isLowDosageTags(tags)){ freshness+=2; roundness-=1; }
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

function styleLabel(tags, productName=''){
  const descriptors=[];
  const colour=tags.includes('Rosé')
    ? 'rosé'
    : tags.includes('Blanc de blancs')
      ? 'blanc de blancs'
      : tags.includes('Blanc de noirs')
        ? 'blanc de noirs'
        : '';
  const dosage=tags.includes('Brut nature')
    ? 'brut nature'
    : tags.includes('Extra-brut')
      ? 'extra-brut'
      : tags.includes('Demi-sec')
        ? 'demi-sec'
        : 'brut';
  descriptors.push([colour,dosage].filter(Boolean).join(' '));
  if(tags.includes('Grand Cru')) descriptors.push('Grand Cru');
  else if(tags.includes('Premier Cru')) descriptors.push('Premier Cru');
  if(tags.includes('Millésimé')) descriptors.push('millésimé');
  return descriptors.join(' ');
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
  occ.push('occ_cadeau'); // tout champagne peut être offert : le budget et le registre du cadeau affinent ensuite
  if(tags.includes('Rosé') || tags.includes('Blanc de blancs') || scores.power<=3 || scores.freshness>=3) occ.push('occ_romantique');

  return {profil:unique(profil),occ:unique(occ)};
}

function specificText(product, tags, grapes, aromas, pairings, scores){
  const style=styleLabel(tags,product.name);
  const aromaText=aromas.slice(0,4);
  const pairingText=pairings.length ? pairings.slice(0,3).map(item=>item.label).join(', ') : 'l’apéritif et un repas léger';
  const character=scores.power>=4 && scores.freshness>=4
    ? 'vif et structuré'
    : scores.roundness>=4
      ? 'rond et généreux'
      : scores.complexity>=4
        ? 'nuancé et persistant'
        : scores.power<=2
          ? 'léger et délicat'
          : scores.freshness>=4
            ? 'frais et précis'
            : 'équilibré et polyvalent';
  const sentences=[`Un ${style} au caractère ${character}.`];
  if(aromaText.length) sentences.push(`Au premier plan : ${aromaText.join(', ')}.`);
  if(grapes.length) sentences.push(`L’assemblage réunit ${grapes.join(', ')}.`);
  sentences.push(`À privilégier avec ${pairingText}.`);
  const note=sentences.join(' ');
  const advice=scores.power>=4
    ? `Sa matière affirmée trouve sa place à table, notamment avec ${pairingText}.`
    : scores.roundness>=4
      ? `Sa texture ample accompagne volontiers ${pairingText}.`
      : scores.freshness>=4
        ? `Sa fraîcheur nette convient particulièrement à ${pairingText}.`
        : `Son équilibre permet de l’accorder avec ${pairingText}.`;
  const avoid=tags.includes('Demi-sec')
    ? 'Écartez-la avec des huîtres ou si vous recherchez une finale très sèche : sa douceur convient davantage au dessert.'
    : scores.roundness>=4
      ? 'Écartez-la si vous recherchez une expression austère et tranchante : son profil privilégie l’ampleur.'
      : scores.power>=4
        ? `Écartez-la pour un apéritif très léger : sa matière appelle plutôt ${pairingText}.`
        : scores.freshness>=4
          ? `Écartez-la si vous recherchez surtout douceur et volume : son profil privilégie ${aromas.slice(0,2).join(' et ')||'la tension et la fraîcheur'}.`
          : scores.complexity>=4
            ? 'Écartez-la si vous recherchez une bouteille très simple et immédiatement consensuelle : son profil demande davantage d’attention.'
            : 'Écartez-la si vous recherchez un style très tendu ou très puissant : elle mise avant tout sur l’équilibre.';
  return {note,advice,avoid};
}

export function buildPartnerCatalogue(){
  return snapshot.records.map(source=>{
    const initialBrand=normalizeBrand(source.brand);
    const initialId=boutiqueSlug({brand:initialBrand,name:source.name});
    const evidence=evidenceRegistry.records[initialId] || {};
    const brand=evidence.publicBrand || initialBrand;
    const normalized={...source,brand};
    const tags=normalizeDosageTags(evidence.tags || correctedTags(source), source);
    const technicalText=Object.values(source.technicalData || {}).join(' ');
    const searchText=`${source.name} ${source.liveTitle} ${source.merchantTags.join(' ')} ${source.merchantDescription} ${technicalText}`;
    const grapes=evidence.grapes || findValues(searchText,GRAPES);
    // Règle de l'audit : un assemblage n'est publié comme FAIT que s'il est sourcé
    // (documenté dans le registre de preuves). Sinon on ne l'affiche pas — on ne comble
    // pas une donnée absente par une inférence présentée comme spécifique au produit.
    const grapesSourced=Boolean(evidence.grapes);
    const grapesShown=grapesSourced?grapes:[];
    const aromas=findValues(searchText,AROMAS);
    const pairings=PAIRINGS.filter(([,expression])=>has(searchText,expression)).map(([label,,token])=>({label,token}));
    const scores=profileScores(source,tags,aromas);
    // Accords dérivés du style (fiables), en complément du texte marchand souvent lacunaire.
    // Un champagne se marie selon sa structure, pas seulement selon ce que le vendeur a écrit.
    const styleAccords=[];
    if((scores.freshness||3)>=3 || tags.includes('Blanc de blancs') || isLowDosageTags(tags)) styleAccords.push(['poisson et fruits de mer','accord_mer']);
    if((scores.power||3)>=3 || (scores.roundness||3)>=3 || tags.includes('Blanc de noirs') || tags.includes('Rosé')) styleAccords.push(['volaille et viandes blanches','accord_volaille']);
    if((scores.complexity||3)>=4 || (scores.power||3)>=4) styleAccords.push(['fromages affinés','accord_fromage']);
    if(tags.includes('Rosé') || tags.includes('Demi-sec')) styleAccords.push(['desserts fruités','accord_dessert']);
    styleAccords.push(['apéritif','accord_aperitif']);
    for(const [label,token] of styleAccords){ if(!pairings.some(item=>item.token===token)) pairings.push({label,token}); }
    const rec=recommendationFields(source,tags,scores,pairings);
    const text=specificText(source,tags,grapesShown,aromas,pairings,scores);
    const id=initialId;
    const price=source.price;
    const offerAge=offerAgeDays(source.checkedAt);
    const offerStatus=offerAge>OFFER_EXPIRY_DAYS ? 'stale' : offerAge>OFFER_WARNING_DAYS ? 'aging' : 'fresh';
    const offerUsable=source.available && offerStatus!=='stale';
    const year=source.name.match(/\b(19|20)\d{2}\b/)?.[0] || null;
    const identityStatus=evidence.status || (year && YEAR_UNCONFIRMED_ON_MERCHANT_PAGE.has(source.brand) ? 'merchant_feed_year_to_verify' : 'merchant_page_checked');
    const publicName=evidence.publicName || (identityStatus.includes('vintage_unconfirmed') || identityStatus==='merchant_feed_year_to_verify'
      ? source.name.replace(new RegExp(`\\s*${year}\\b`),'').trim()
      : source.name);
    const producerType=producerStatus(source.brand);
    const accords=unique(pairings.map(item=>item.token));
    const pair=pairings.slice(0,3).map(item=>item.label).join(', ') || 'apéritif, poisson';
    const tier=price<30?1:price<=60?2:price<=100?3:4;
    const popularity=(WELL_KNOWN.has(source.brand)?84:68) + (tags.includes('Grand Cru')?4:0) + (tags.includes('Millésimé')?3:0);
    const officialConfirmed=Boolean(evidence.officialSourceUrl) && !identityStatus.includes('product_to_document');
    const enrichment=enrichProduct({product:source,tags,grapes:grapesShown,aromas,pairings,scores,evidence,publicName,price,producerType});

    return {
      id, merchantId:source.id, name:cleanName(publicName), short:cleanName(publicName), house:canonHouse(brand), brand:canonHouse(brand),
      region:'Champagne', price, priceMin:price, priceMax:price,
      // Le flux fournit parfois un ancien prix sans documenter sa période de
      // référence. QuelChampagne publie uniquement le prix actuel contrôlé.
      oldPrice:null,
      tier, producerType, occ:rec.occ, profil:rec.profil, accords,
      bulles:'bulles_fines', tags, pair, note:text.note,
      sourceUrl:evidence.officialSourceUrl || source.productUrl,
      merchantSourceUrl:source.productUrl,
      officialSourceUrl:evidence.officialSourceUrl || null,
      technicalSourceUrl:evidence.technicalSourceUrl || null,
      sourceKind:officialConfirmed?'producer':'merchant',
      verifiedAt:evidence.officialSourceUrl || evidence.technicalSourceUrl ? evidenceRegistry.reviewedAt : checkedDate(), editorialReady:true,
      commerceReady:offerUsable, popularity, aff:source.buyUrl, image:source.image,
      availability:offerStatus==='stale'?'unknown_stale':source.available?'in_stock':'out_of_stock',
      priceStatus:offerStatus, offerCheckedAt:source.checkedAt,
      identityStatus,
      imageRights:{sourceUrl:source.image,rightsBasis:'Flux du programme partenaire Bottle of Italy / Webgains',verifiedAt:checkedDate()},
      details:{
        dosage:evidence.dosage || null,
        verifiedFacts:evidence.facts || null,
        evidenceStatus:identityStatus,
        advice:text.advice, avoid:text.avoid,
        profil:{
          fraicheur:level(scores.freshness,'freshness'),
          rondeur:level(scores.roundness,'roundness'),
          puissance:level(scores.power,'power'),
          longueur:level(scores.complexity,'complexity')
        },
        scores,
        aromas,
        grapes:grapesShown,
        grapesSourced,
        enrichment,
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
export const AVAILABLE_PARTNER_CATALOGUE = PARTNER_CATALOGUE.filter(product=>
  product.commerceReady === true && product.availability === 'in_stock'
);

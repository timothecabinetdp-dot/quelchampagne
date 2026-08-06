import { readFileSync, readdirSync, statSync } from 'node:fs';
import { PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';

const fail=[];
const weak=[
  /d['’]apr[èe]s les informations disponibles/i,
  /les documentations commerciales concordent/i,
  /reste [àa] (?:documenter|obtenir|confirmer)/i,
  /[àa] confirmer sur (?:la )?fiche/i,
  /ne remplace pas une d[ée]gustation/i,
  /sans jargon/i,
  /profil_(?:frais|fruite|riche|delicat)/i,
  /\bfete,\s*apero,\s*diner\b/i
];

function visible(html){
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&[a-z#0-9]+;/gi,' ')
    .replace(/\s+/g,' ');
}

function walk(dir){
  return readdirSync(dir).flatMap(name=>{
    const path=`${dir}/${name}`;
    return statSync(path).isDirectory()?walk(path):[path];
  });
}

for(const p of PARTNER_CATALOGUE){
  const e=p.details?.enrichment;
  if(!e) fail.push(`${p.id}: enrichissement absent`);
  if((e?.facts||[]).length<13) fail.push(`${p.id}: moins de 13 caractéristiques`);
  if((e?.answers||[]).length<8) fail.push(`${p.id}: moins de 8 réponses pratiques`);
  if((e?.aromas||[]).length<2) fail.push(`${p.id}: profil aromatique insuffisant`);
  if((e?.pairings||[]).length<2) fail.push(`${p.id}: accords insuffisants`);
  if(!e?.temperature || !e?.dosage || !e?.aging || !e?.glass) fail.push(`${p.id}: service ou élaboration incomplet`);
}

const pages=walk('dist').filter(path=>path.endsWith('.html'));
for(const path of pages){
  const text=visible(readFileSync(path,'utf8'));
  for(const pattern of weak){
    if(pattern.test(text)) fail.push(`${path}: formulation interdite ${pattern}`);
  }
}

const productPages=pages.filter(path=>/dist\/champagne\/[^/]+\/index\.html$/.test(path) && !/\/(aperitif|cadeau|repas|rose|fruits-de-mer|moins-de-50-euros|blanc-de-blancs)\//.test(path));
for(const path of productPages){
  const html=readFileSync(path,'utf8');
  for(const marker of ['Les caractéristiques essentielles','Afficher toutes les caractéristiques','Profil aromatique','Réponses pratiques','FAQPage','additionalProperty']){
    if(!html.includes(marker)) fail.push(`${path}: bloc manquant « ${marker} »`);
  }
  if(/name="robots" content="noindex/.test(html)) fail.push(`${path}: fiche enrichie encore en noindex`);
}

const exactBlend=PARTNER_CATALOGUE.filter(p=>p.details.enrichment.blend.length).length;
const exactDosage=PARTNER_CATALOGUE.filter(p=>p.details?.dosage || p.details?.enrichment?.dosage?.includes('g/L') && !/Moins de|0 à|32 à/.test(p.details.enrichment.dosage)).length;
const technical=PARTNER_CATALOGUE.filter(p=>Object.keys(p.details?.enrichment||{}).length).length;

if(fail.length){
  console.error(`Audit de profondeur refusé : ${fail.length} problème(s).`);
  fail.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Audit de profondeur validé : ${PARTNER_CATALOGUE.length} fiches · ${productPages.length} pages · ${technical} profils complets · ${exactBlend} assemblages chiffrés · ${exactDosage} dosages exacts.`);

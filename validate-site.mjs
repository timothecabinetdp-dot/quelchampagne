import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVATED_COMMERCE_IDS } from './build-catalogue.mjs';
import { PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';

const ROOT = new URL('.', import.meta.url);
const DIST = new URL('dist/', ROOT);

function read(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function localTarget(href) {
  const path = href.split(/[?#]/)[0];
  if (!path.startsWith('/')) return null;
  if (path === '/') return new URL('dist/index.html', ROOT);
  if (path.endsWith('/')) return new URL(`dist${path}index.html`, ROOT);
  return new URL(`dist${path}`, ROOT);
}

const errors = [];
const catalogue = JSON.parse(read('catalogue.json'));
const editorial = JSON.parse(read('data/editorial-wave-1-2.json'));
const wave5 = JSON.parse(read('data/catalogue-wave-5.json'));
const wave6 = JSON.parse(read('data/catalogue-wave-6.json'));
const offers = JSON.parse(read('data/purchase-offers-research.json'));
const imageRights = JSON.parse(read('data/image-rights-register.json'));
const registeredPhotos = new Set(imageRights.filter(r => r.source === 'Unsplash').map(r => r.asset));
const registeredPartnerImages = new Set(PARTNER_CATALOGUE.map(product => product.image));
const imageRegistry = JSON.parse(read('data/product-images.json'));
const merchantFeedConfig = JSON.parse(read('data/merchant-feed-config.json'));
const productIdentityIndex = JSON.parse(read('data/product-identity-index.json'));
const productEvidence = JSON.parse(read('data/product-evidence.json'));
const pricePolicy = JSON.parse(read('data/price-policy.json'));
const priceIndex = JSON.parse(read('data/price-index.json'));
const htmlFiles = walk(DIST.pathname).filter(path => path.endsWith('.html'));
const ids = new Set(catalogue.map(product => product.id));
const seenTitles = new Map();
const seenCanonicals = new Map();
const seenDescriptions = new Map();

if (productEvidence.productCount !== PARTNER_CATALOGUE.length || productEvidence.records.length !== PARTNER_CATALOGUE.length) {
  errors.push(`Base de preuves incomplète : ${productEvidence.records.length} sur ${PARTNER_CATALOGUE.length}.`);
}
for (const evidence of productEvidence.records) {
  if (!evidence.merchantSourceUrl || !evidence.merchantCheckedAt || !evidence.status) {
    errors.push(`Traçabilité marchande incomplète : ${evidence.productId}.`);
  }
  if (evidence.status.startsWith('official_') && !evidence.officialSourceUrl) {
    errors.push(`Statut officiel sans source primaire : ${evidence.productId}.`);
  }
}
const whitePearl=PARTNER_CATALOGUE.find(product=>product.id==='deheurles-white-pearl-blanc-de-blancs-extra-brut');
if (!whitePearl || whitePearl.brand!=='Daniel Deheurles & Filles' || !whitePearl.details.grapes.includes('Pinot Blanc')) {
  errors.push('La correction officielle de White Pearl (producteur et Pinot Blanc) est absente.');
}

if (catalogue.length !== 75) errors.push(`Catalogue attendu : 75, obtenu : ${catalogue.length}.`);
if (ids.size !== catalogue.length) errors.push('Des identifiants produit sont dupliqués.');
if (catalogue.some(product => product.region !== 'Champagne')) errors.push('Le catalogue contient un produit hors Champagne.');
if (catalogue.some(product => product.commerceReady === true && !ACTIVATED_COMMERCE_IDS.has(product.id))) errors.push('Une offre marchande est active sur une cuvée hors liste vérifiée.');
if (catalogue.some(product => ACTIVATED_COMMERCE_IDS.has(product.id) && product.commerceReady !== true)) errors.push('Une cuvée de la liste vérifiée n’a pas son offre activée.');
if (catalogue.some(product => !product.sourceUrl || !product.editorialReady)) errors.push('Une fiche publiée manque de source ou de validation éditoriale.');
if (catalogue.filter(product => product.producerType === 'vigneron').length !== 20) {
  errors.push(`Champagnes de vigneron attendus : 20, obtenus : ${catalogue.filter(product => product.producerType === 'vigneron').length}.`);
}
const roses = catalogue.filter(product => {
  const text = `${product.name} ${product.tags.join(' ')}`.toLowerCase();
  return text.includes('rosé');
});
if (roses.length !== 16) errors.push(`Champagnes rosés attendus : 16, obtenus : ${roses.length}.`);
if (catalogue.filter(product => product.priceMin >= 30 && product.priceMax <= 70).length < 30) {
  errors.push('Le catalogue ne contient pas au moins 30 références entièrement positionnées entre 30 et 70 €.');
}

if (wave5.length !== 11) errors.push(`Références de la vague 5 attendues : 11, obtenues : ${wave5.length}.`);
for (const product of wave5) {
  const words = product.note.trim().split(/\s+/).length;
  if (words < 40 || words > 70) errors.push(`Conseil vague 5 hors plage 40–70 mots (${words}) : ${product.id}.`);
  if (product.verifiedAt !== '2026-07-27') errors.push(`Date de vérification vague 5 incorrecte : ${product.id}.`);
  if (!/^https:\/\//.test(product.sourceUrl)) errors.push(`Source officielle vague 5 invalide : ${product.id}.`);
  if (!product.details?.facts || !product.details?.sourceQuality) errors.push(`Traçabilité vague 5 incomplète : ${product.id}.`);
}
if (wave6.length !== 25) errors.push(`Références de la vague 6 attendues : 25, obtenues : ${wave6.length}.`);
for (const product of wave6) {
  const words = product.note.trim().split(/\s+/).length;
  if (words < 40 || words > 70) errors.push(`Conseil vague 6 hors plage 40–70 mots (${words}) : ${product.id}.`);
  if (!/^https:\/\//.test(product.sourceUrl)) errors.push(`Source officielle vague 6 invalide : ${product.id}.`);
  if (!product.facts || !product.sourceQuality || !product.profile) errors.push(`Traçabilité vague 6 incomplète : ${product.id}.`);
  const built = catalogue.find(item => item.id === product.id);
  if (!built || built.verifiedAt !== '2026-07-27') errors.push(`Fiche vague 6 absente ou date de vérification incorrecte : ${product.id}.`);
  if (built?.priceStatus !== 'editorial_range' || built?.commerceReady !== false) errors.push(`Fourchette vague 6 confondue avec une offre marchande : ${product.id}.`);
}

const commerceTargets = [
  'moet',
  'clicquot',
  'taittinger-brut-reserve',
  'pol-roger-brut-reserve',
  'feuillatte',
  'laurent-perrier-la-cuvee',
  'pommery-brut-royal',
  'ruinart'
];
if (offers.length !== 16) errors.push(`Relevés commerce attendus : 16, obtenus : ${offers.length}.`);
for (const productId of commerceTargets) {
  const productOffers = offers.filter(offer => offer.productId === productId);
  if (productOffers.length !== 2) errors.push(`Deux relevés commerce attendus pour ${productId}, obtenus : ${productOffers.length}.`);
  if (new Set(productOffers.map(offer => offer.merchant)).size !== productOffers.length) errors.push(`Marchand dupliqué pour ${productId}.`);
}
for (const offer of offers) {
  if (!ids.has(offer.productId)) errors.push(`Relevé commerce sans produit catalogue : ${offer.productId}.`);
  if (offer.formatMl !== 750) errors.push(`Format commerce différent de 75 cl : ${offer.productId} chez ${offer.merchant}.`);
  if (!(offer.priceEur > 0)) errors.push(`Prix commerce invalide : ${offer.productId} chez ${offer.merchant}.`);
  if (!/^https:\/\//.test(offer.merchantUrl)) errors.push(`URL marchande invalide : ${offer.productId} chez ${offer.merchant}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(offer.observedAt)) errors.push(`Date de relevé invalide : ${offer.productId} chez ${offer.merchant}.`);
  if (offer.affiliateStatus !== 'not_configured' || offer.publicationStatus !== 'research_only') {
    errors.push(`Relevé commerce publiable trop tôt : ${offer.productId} chez ${offer.merchant}.`);
  }
}
if (pricePolicy.priceFreshnessHours !== 72 || pricePolicy.availabilityFreshnessHours !== 24) {
  errors.push('La politique de fraîcheur prix/stock ne correspond pas aux seuils attendus.');
}
if (priceIndex.observations.length !== offers.length) errors.push('L’index prix ne reprend pas tous les relevés de recherche.');
if (priceIndex.publicationMode !== 'blocked_until_review') errors.push('Le verrou de publication de l’index prix est absent.');
for (const observation of priceIndex.observations) {
  if (!observation.observationId || observation.currency !== 'EUR') errors.push(`Observation prix incomplète : ${observation.productId}.`);
  if (!observation.priceFreshUntil || !observation.availabilityFreshUntil) errors.push(`Expiration prix/stock absente : ${observation.observationId}.`);
  if (!observation.exactProductMatch || !observation.exactReleaseMatch || !observation.exactFormatMatch) {
    errors.push(`Correspondance produit incomplète : ${observation.observationId}.`);
  }
  if (observation.publicationEligible) errors.push(`Observation marchande publiée avant validation : ${observation.observationId}.`);
}

if (merchantFeedConfig.publicationMode !== 'research_only') {
  errors.push('L’import marchand n’est pas verrouillé en mode recherche.');
}
if (merchantFeedConfig.defaultFormatMl !== pricePolicy.defaultFormatMl) {
  errors.push('Le format par défaut des flux marchands diffère de la politique prix.');
}
if (productIdentityIndex.productCount !== catalogue.length) {
  errors.push(`Index d’identité incomplet : ${productIdentityIndex.productCount} sur ${catalogue.length}.`);
}
if (new Set(productIdentityIndex.products.map(product => product.productId)).size !== catalogue.length) {
  errors.push('L’index d’identité contient des identifiants absents ou dupliqués.');
}
for (const identity of productIdentityIndex.products) {
  if (!ids.has(identity.productId)) errors.push(`Identité marchande sans produit catalogue : ${identity.productId}.`);
  if (!identity.aliases.length || !identity.baseAliases.length) errors.push(`Alias marchand absent : ${identity.productId}.`);
  if (identity.formatMl !== pricePolicy.defaultFormatMl) errors.push(`Format d’identité inattendu : ${identity.productId}.`);
}
const merchantImportsUrl = new URL('data/merchant-imports/', ROOT);
if (existsSync(merchantImportsUrl)) {
  for (const name of readdirSync(merchantImportsUrl).filter(file => file.endsWith('.json'))) {
    const imported = JSON.parse(read(`data/merchant-imports/${name}`));
    if (imported.publicationMode !== 'research_only') errors.push(`Import marchand publiable : ${name}.`);
    for (const observation of imported.observations || []) {
      if (!ids.has(observation.productId)) errors.push(`Import marchand sans produit catalogue : ${observation.productId}.`);
      if (observation.publicationStatus !== 'research_only' || observation.publicationEligible !== false) {
        errors.push(`Observation importée publiable trop tôt : ${observation.observationId}.`);
      }
    }
    for (const image of imported.imageCandidates || []) {
      if (image.status !== 'candidate_only' || image.rightsBasis || image.verifiedAt) {
        errors.push(`Image marchande approuvée automatiquement : ${image.productId}.`);
      }
    }
  }
}

const forbidden = [
  'charles-heidsieck-rose-reserve',
  'lanson-le-black-creation',
  'perrier-jouet-belle-epoque-2015',
  'salon-2015'
];
for (const id of forbidden) {
  if (ids.has(id)) errors.push(`Référence encore exclue présente : ${id}.`);
}

if (editorial.length !== 17) errors.push(`Profils vagues 1–2 attendus : 17, obtenus : ${editorial.length}.`);
for (const profile of editorial) {
  const words = profile.description.trim().split(/\s+/).length;
  if (words < 30) errors.push(`Description trop courte (${words} mots) : ${profile.id}.`);
}

const source = read('index.html');
if (!source.includes("id:'repere', label:\"04 · Votre repère\"")) errors.push('La quatrième question de départage est absente.');
if (!source.includes('function signalFit')) errors.push('Le critère de départage du sélecteur est absent du scoring.');
if (source.includes('function bottleSVG') || source.includes('M62,98 C62,110')) {
  errors.push('Une ancienne bouteille SVG générique subsiste dans le code source.');
}
if (!source.includes('function editorialVisual')) errors.push('Le visuel éditorial de remplacement est absent.');
for (const image of imageRegistry.records) {
  if (!ids.has(image.productId)) errors.push(`Image rattachée à un produit inconnu : ${image.productId}.`);
  if (image.status === 'approved') {
    if (!image.localPath?.startsWith('/assets/products/')) errors.push(`Chemin local d’image invalide : ${image.productId}.`);
    if (!image.sourceUrl || !image.rightsBasis || !image.verifiedAt) errors.push(`Droits d’image incomplets : ${image.productId}.`);
    if (!existsSync(new URL(`dist${image.localPath}`, ROOT))) errors.push(`Fichier image approuvé absent du build : ${image.productId}.`);
  }
}
for (const product of catalogue.filter(item => item.image)) {
  if (!product.imageRights?.sourceUrl || !product.imageRights?.rightsBasis || !product.imageRights?.verifiedAt) {
    errors.push(`Packshot publié sans traçabilité complète : ${product.id}.`);
  }
}
const cataloguePage = read('dist/champagnes/index.html');
for (const control of ['bqGrid', 'bqSort']) {
  if (!cataloguePage.includes(`id="${control}"`)) errors.push(`Contrôle de sélection absent : ${control}.`);
}
if (!cataloguePage.includes('class="bq-chip') || !cataloguePage.includes("card.getAttribute('data-style')")) {
  errors.push('Le filtrage par style de la sélection partenaire n’est pas embarqué.');
}
if (cataloguePage.includes('target="_blank" rel="sponsored') || cataloguePage.includes('>Acheter</a>')) {
  errors.push('La sélection redirige encore directement vers le partenaire au lieu des fiches internes.');
}

const jacquesson = catalogue.find(product => product.id === 'jacquesson-cuvee-748');
if (!jacquesson || jacquesson.releaseLabel !== '748' || jacquesson.editionNumber !== 748) {
  errors.push('La Cuvée Jacquesson n° 748 n’est pas enregistrée comme sortie numérotée exacte.');
}
const leclerc = catalogue.find(product => product.id === 'leclerc-briant-brut-reserve-base-2020');
if (!leclerc || leclerc.releaseLabel !== 'base-2020' || leclerc.vintageYear !== null) {
  errors.push('Leclerc Briant Brut Réserve doit conserver sa base 2020 sans être présenté comme un millésime.');
}
const geoffroy = catalogue.find(product => product.id === 'rene-geoffroy-expression-base-2020');
if (!geoffroy || geoffroy.releaseLabel !== 'base-2020' || geoffroy.vintageYear !== null) {
  errors.push('René Geoffroy Expression doit conserver sa base 2020 sans être présenté comme un millésime.');
}
const mandois = catalogue.find(product => product.id === 'mandois-rose-origine-base-2022');
if (!mandois || mandois.releaseLabel !== 'base-2022' || mandois.vintageYear !== null) {
  errors.push('Mandois Rosé Origine doit conserver sa base 2022 sans être présenté comme un millésime.');
}

const script = source.split('<script>')[1].split('</script>')[0];
const quiz = {};
global.document = {
  getElementById: () => ({ set innerHTML(value) {}, get innerHTML() { return ''; } }),
  querySelector: () => null,
  createElement: () => ({
    set innerHTML(value) {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    addEventListener() {},
    focus() {},
    querySelector() { return { set innerHTML(value) {} }; },
    querySelectorAll() { return []; },
    style: {}
  }),
  body: { appendChild() {}, style: {} },
  documentElement: { lang: '', style: { setProperty() {} } }
};
global.window = { scrollTo() {}, open() {} };
global.localStorage = { getItem() { return null; }, setItem() {} };
global.fetch = () => Promise.reject(new Error('Réseau désactivé pendant la validation.'));
eval(`${script}; Object.assign(quiz, { questions, score, signalFit, setCatalogue });`);
quiz.setCatalogue(PARTNER_CATALOGUE);
if (quiz.questions().length !== 4) errors.push(`Questions attendues : 4, obtenues : ${quiz.questions().length}.`);
const lowDosage = PARTNER_CATALOGUE.find(product => quiz.signalFit(product,'low_dosage'));
if (!lowDosage) {
  errors.push('Aucun champagne peu dosé ne permet de tester le quatrième critère.');
} else {
  const answers = { occasion: lowDosage.occ, gout: lowDosage.profil, budget: [`b${lowDosage.tier}`], repere: ['low_dosage'] };
  const preferredScore = quiz.score(lowDosage, answers);
  const mismatchedScore = quiz.score({ ...lowDosage, tags:lowDosage.tags.filter(tag=>tag!=='Extra-brut / nature'), details:{...lowDosage.details,dosage:null} }, answers);
  if (Math.round(preferredScore - mismatchedScore) !== 24) errors.push('Le critère faible dosage ne produit pas le bonus attendu.');
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const relative = file.replace(DIST.pathname, '');
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (!title) errors.push(`Titre absent dans ${relative}.`);
  else if (seenTitles.has(title)) errors.push(`Titre dupliqué dans ${relative} et ${seenTitles.get(title)} : ${title}.`);
  else seenTitles.set(title, relative);
  if (!canonical) errors.push(`Canonical absente dans ${relative}.`);
  else if (seenCanonicals.has(canonical)) errors.push(`Canonical dupliquée dans ${relative} et ${seenCanonicals.get(canonical)} : ${canonical}.`);
  else seenCanonicals.set(canonical, relative);
  if (!description) errors.push(`Meta description absente dans ${relative}.`);
  else if (seenDescriptions.has(description)) errors.push(`Meta description dupliquée dans ${relative} et ${seenDescriptions.get(description)}.`);
  else seenDescriptions.set(description, relative);
  if (!html.includes('<html lang="fr">')) errors.push(`Langue française absente dans ${relative}.`);
  if (!html.includes('class="skip-link" href="#main-content"')) errors.push(`Lien d’évitement absent dans ${relative}.`);
  if (!html.includes('id="main-content"')) errors.push(`Contenu principal non identifié dans ${relative}.`);
  if (/<button[^>]+href=/i.test(html)) errors.push(`Bouton avec attribut href invalide dans ${relative}.`);
  if (/(?:fonts\.googleapis|fonts\.gstatic)/.test(html)) errors.push(`Dépendance visuelle tierce non autorisée dans ${relative}.`);
  // Images distantes : uniquement des photos Unsplash explicitement enregistrées dans le registre de droits.
  for (const m of html.matchAll(/https:\/\/images\.unsplash\.com\/photo-[0-9]+-[a-z0-9]+/g)) {
    if (!registeredPhotos.has(m[0])) errors.push(`Image Unsplash non enregistrée dans ${relative} : ${m[0]}.`);
  }
  for (const match of html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)) {
    if (!match[1].startsWith('https://images.unsplash.com/') && !registeredPartnerImages.has(match[1].replaceAll('&amp;','&'))) {
      errors.push(`Image distante non enregistrée dans ${relative} : ${match[1]}.`);
    }
  }
  const hasDialogRole = html.includes('role="dialog"') || html.includes("setAttribute('role','dialog')");
  const hasModalState = html.includes('aria-modal="true"') || html.includes("setAttribute('aria-modal','true')");
  if (!hasDialogRole || !hasModalState) errors.push(`Porte d’âge sans sémantique de dialogue dans ${relative}.`);
  if (relative !== 'selecteur/index.html') {
    const h1Count = [...html.matchAll(/<h1(?:\s|>)/g)].length;
    if (h1Count !== 1) errors.push(`Un seul H1 attendu dans ${relative}, obtenu : ${h1Count}.`);
  }
  for (const m of html.matchAll(/href="(https:[^"]+)"\s+target="_blank"\s+rel="[^"]*sponsored[^"]*"/g)) {
    if (!/awin1\.com|tradedoubler|ikhnaie\.link|clk\.|effiliation|kwanko/i.test(m[1])) {
      errors.push(`Lien sponsorisé non conforme (hors réseau caviste affilié) dans ${relative} : ${m[1]}.`);
    }
  }
  for (const offer of offers) {
    if (html.includes(offer.merchantUrl)) errors.push(`Relevé commerce interne exposé dans ${relative}.`);
  }
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (href.includes('${') || /^(https?:|mailto:|tel:|#)/.test(href)) continue;
    const target = localTarget(href);
    if (target && !existsSync(target)) {
      errors.push(`Lien interne cassé dans ${relative} : ${href}.`);
    }
  }
}

const sitemap = read('dist/sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/quelchampagne\.fr([^<]*)<\/loc>/g)];
const expectedSitemapUrls = 22 + PARTNER_CATALOGUE.length;
if (sitemapUrls.length !== expectedSitemapUrls) errors.push(`URL sitemap attendues : ${expectedSitemapUrls}, obtenues : ${sitemapUrls.length}.`);
for (const [, path] of sitemapUrls) {
  const target = localTarget(path || '/');
  if (!target || !existsSync(target)) errors.push(`URL du sitemap sans page : ${path || '/'}.`);
}

for (const file of htmlFiles.filter(path=>path.includes('/blog/') && path.endsWith('/index.html') && !path.endsWith('/blog/index.html'))) {
  const html=readFileSync(file,'utf8');
  const prose=html.match(/<div class="prose">([\s\S]*?)<\/div>/)?.[1] || '';
  const wordCount=prose.replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').trim().split(/\s+/).filter(Boolean).length;
  const headingCount=(prose.match(/<h3>/g)||[]).length;
  if(wordCount<320) errors.push(`Article trop court (${wordCount} mots) : ${file.replace(DIST.pathname,'')}.`);
  if(headingCount<4) errors.push(`Article insuffisamment structuré : ${file.replace(DIST.pathname,'')}.`);
}

for (const slug of ['aperitif', 'cadeau', 'repas', 'rose', 'blanc-de-blancs', 'moins-de-50-euros', 'fruits-de-mer']) {
  const page = new URL(`dist/champagne/${slug}/index.html`, ROOT);
  if (!existsSync(page)) errors.push(`Page SEO manquante : /champagne/${slug}/.`);
}
for (const product of PARTNER_CATALOGUE) {
  const page = new URL(`dist/champagne/${product.id}/index.html`, ROOT);
  if (!existsSync(page)) {
    errors.push(`Fiche partenaire manquante : /champagne/${product.id}/.`);
    continue;
  }
  const html=readFileSync(page,'utf8');
  const sponsoredLinks=[...html.matchAll(/<a[^>]+href="([^"]*)"[^>]+rel="[^"]*sponsored[^"]*"[^>]*>/gi)].map(match=>match[1]);
  if (sponsoredLinks.length<2) errors.push(`Deux boutons d’achat affiliés attendus : /champagne/${product.id}/.`);
  if (sponsoredLinks.some(href=>!/^https:\/\/assets\.ikhnaie\.link\//.test(href))) {
    errors.push(`Bouton d’achat vide ou non affilié : /champagne/${product.id}/.`);
  }
  if (html.includes('FRutm_source') || /href="(?:undefined|null)?"/.test(html)) {
    errors.push(`Lien d’achat mal formé : /champagne/${product.id}/.`);
  }
}
const partnerIds = new Set(PARTNER_CATALOGUE.map(product=>product.id));
for (const product of catalogue.filter(product=>!partnerIds.has(product.id))) {
  const page = new URL(`dist/champagne/${product.id}/index.html`, ROOT);
  if (existsSync(page)) errors.push(`Ancienne fiche encore publiée : /champagne/${product.id}/.`);
}
if (existsSync(new URL('dist/comparatifs/', ROOT))) errors.push('Les anciens comparatifs fondés sur les 75 fiches sont encore publiés.');
const publicCatalogue=JSON.parse(read('dist/catalogue.json'));
if (publicCatalogue.length!==PARTNER_CATALOGUE.length || publicCatalogue.some(product=>!partnerIds.has(product.id))) {
  errors.push('Le catalogue JSON public expose encore des références historiques.');
}
const redirects=read('dist/_redirects');
if (!redirects.includes('/comparatifs/ /comparateur/ 301')) errors.push('La redirection Cloudflare des anciens comparatifs est absente.');
if (catalogue.filter(product=>!partnerIds.has(product.id) && product.region==='Champagne').some(product=>!redirects.includes(`/champagne/${product.id}/ /champagnes/ 301`))) {
  errors.push('Une ancienne fiche Champagne ne possède pas de redirection Cloudflare.');
}
if (catalogue.filter(product=>!partnerIds.has(product.id) && product.region!=='Champagne').some(product=>redirects.includes(`/champagne/${product.id}/`))) {
  errors.push('Une ancienne fiche hors Champagne possède encore une redirection publique.');
}

for (const path of ['notre-methode', 'a-propos']) {
  const trustPage = new URL(`dist/${path}/index.html`, ROOT);
  if (!existsSync(trustPage)) errors.push(`Page de confiance manquante : /${path}/.`);
}
const selector = read('dist/selecteur/index.html');
if (!selector.includes('Pourquoi cette recommandation')) errors.push('Le sélecteur n’explique pas sa recommandation.');
if (!selector.includes('let CATALOGUE = [')) errors.push('Le sélecteur n’embarque pas le catalogue vérifié et risque d’afficher les anciennes données de repli.');
if (!selector.includes('assets.ikhnaie.link')) errors.push('Le sélecteur n’embarque pas les offres Bottle of Italy.');
if (/render\(\);\s*loadCatalogue\(\);/.test(selector)) errors.push('Le sélecteur remplace encore le catalogue partenaire par l’ancien catalogue au chargement.');
if (selector.includes('${productAction(tp)}')) errors.push('Le résultat principal du quiz contourne encore la fiche d’analyse.');
if (!selector.includes('href="/champagne/${tp.id}/">Voir l’analyse</a>')) errors.push('Le résultat principal du quiz ne mène pas à la fiche d’analyse.');
if (selector.includes('% de correspondance') || selector.includes('class="mm"')) errors.push('Un pourcentage de correspondance est encore affiché dans le résultat du quiz.');
if (/\d+(?:[.,]\d+)?\s*€\s*[–-]\s*\d+(?:[.,]\d+)?\s*€/.test(selector)) errors.push('Le quiz affiche encore une fourchette au lieu du prix marchand exact.');
if (!selector.includes("new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'")) errors.push('Le formatage précis des prix du quiz est absent.');
if (!selector.includes("--sans:'Archivo'") || selector.includes("font-family:'InterV'")) errors.push('La typographie du contenu n’utilise pas exclusivement Archivo.');
if (selector.includes('cuvée juste') || selector.includes('fait le tri pour vous')) errors.push('Une formulation artificielle subsiste dans le sélecteur.');
if (selector.includes('background:radial-gradient(120% 120% at 50% 12%,#ffffff 0%,#f4f2ed 100%)') || selector.includes('background:#F3F0E9')) {
  errors.push('Un ancien fond crème subsiste derrière les bouteilles du sélecteur.');
}
if (!selector.includes("const state = { view:'quiz'")) errors.push('Le sélecteur ne démarre pas directement sur le questionnaire.');
if (!selector.includes('<h1 class="qtitle">${q.q}</h1>')) errors.push('La question active du sélecteur n’est pas exposée comme titre principal.');
if (!existsSync(new URL('dist/assets/hero-quelchampagne.svg', ROOT))) errors.push('Illustration originale principale absente du build.');
if (!existsSync(new URL('dist/assets/og-quelchampagne.png', ROOT))) errors.push('Image de partage sociale absente du build.');
if (!existsSync(new URL('dist/assets/archivo-latin-wght-normal.woff2', ROOT))) errors.push('Police Archivo auto-hébergée absente du build.');
if (!existsSync(new URL('dist/assets/analytics.js', ROOT))) errors.push('Client de mesure d’audience absent du build.');
if (!existsSync(new URL('functions/api/events.js', ROOT))) errors.push('Fonction Cloudflare de mesure d’audience absente.');
if (!read('wrangler.toml').includes('binding = "QC_ANALYTICS"')) errors.push('Binding Analytics Engine absent de la configuration Cloudflare.');
if (source.includes('cdn.jsdelivr.net/npm/@fontsource')) errors.push('La police dépend encore de jsDelivr.');
if (!source.includes("window.qcTrack('quiz_completed'")) errors.push('La fin du sélecteur n’est pas mesurée.');
for (const stale of ['Perle d’Aurore', 'Sancerre « Les Baronnes »', 'Whispering Angel']) {
  if (selector.includes(stale)) errors.push(`Ancienne donnée de démonstration encore exposée dans le sélecteur : ${stale}.`);
}
if (source.includes('Un clic vous mène directement sur le site de la maison pour commander.')) errors.push('L’accueil promet encore une commande non disponible.');
if (PARTNER_CATALOGUE.length !== 48) errors.push(`Catalogue partenaire attendu : 48, obtenu : ${PARTNER_CATALOGUE.length}.`);
if (new Set(PARTNER_CATALOGUE.map(product=>product.id)).size !== PARTNER_CATALOGUE.length) errors.push('Identifiants du catalogue partenaire dupliqués.');
if (PARTNER_CATALOGUE.some(product=>!product.commerceReady || product.availability!=='in_stock')) errors.push('Une cuvée partenaire publiée n’est pas disponible.');
if (PARTNER_CATALOGUE.some(product=>product.priceStatus==='stale' && (product.commerceReady || product.oldPrice))) errors.push('Une offre périmée reste achetable ou conserve une promotion.');
if (PARTNER_CATALOGUE.some(product=>product.priceStatus!=='fresh' && product.oldPrice)) errors.push('Un ancien prix est affiché au-delà de la période de fraîcheur autorisée.');
if (!existsSync(new URL('.github/workflows/refresh-catalogue.yml', ROOT))) errors.push('Le workflow quotidien d’actualisation du catalogue est absent.');
if (PARTNER_CATALOGUE.some(product=>!/ikhnaie\.link/.test(product.aff||'') || /FRutm_source/.test(product.aff))) errors.push('Un lien affilié partenaire est absent ou mal formé.');
if (PARTNER_CATALOGUE.some(product=>!product.details?.facts || !product.details?.advice || !product.details?.avoid || !product.details?.scores)) errors.push('Une analyse partenaire est incomplète.');
if (new Set(PARTNER_CATALOGUE.map(product=>product.note)).size < 40) errors.push('Les analyses partenaires restent trop répétitives.');
if (PARTNER_CATALOGUE.some(product=>product.identityStatus==='merchant_feed_year_to_verify' && /\b(19|20)\d{2}\b/.test(product.name))) errors.push('Un millésime non confirmé est encore présenté comme faisant partie du nom public.');
for (const file of htmlFiles.filter(path => path.includes('/champagne/') && !path.match(/\/champagne\/(aperitif|cadeau|repas|rose|blanc-de-blancs|moins-de-50-euros|fruits-de-mer)\//))) {
  const html = readFileSync(file, 'utf8');
  if (!html.includes('À choisir si…') || !html.includes('À éviter si…')) errors.push(`Aide à la décision absente de ${file.replace(DIST.pathname, '')}.`);
  if (partnerIds.has(file.split('/champagne/')[1]?.split('/')[0]) && !html.includes('class="bqp-scene"')) {
    errors.push(`Visuel éditorial contextuel absent de ${file.replace(DIST.pathname, '')}.`);
  }
}
const publishedCopy = htmlFiles.map(file=>readFileSync(file,'utf8')).join('\n');
for (const phrase of [
  'ne remplacent pas une dégustation',
  'ne prétendons pas avoir dégusté',
  'Cette cuvée est présentée comme',
  'D’après les informations disponibles',
  'interprétation éditoriale QuelChampagne'
]) {
  if (publishedCopy.includes(phrase)) errors.push(`Formulation éditoriale à supprimer encore publiée : « ${phrase} ».`);
}
if (!source.includes('object-fit:contain!important')) errors.push('La règle prioritaire anti-recadrage des packshots est absente.');
if (!source.includes('.page-hero::before{display:block!important}')) errors.push('Les visuels des pages de sélection sont encore masqués.');
if (errors.length) {
  console.error(`Validation échouée (${errors.length} erreur${errors.length > 1 ? 's' : ''}) :`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validation réussie : ${PARTNER_CATALOGUE.length} champagnes publiés, ${htmlFiles.length} pages HTML, ${sitemapUrls.length} URL, aucun lien interne cassé.`);

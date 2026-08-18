/*
 * test-selecteur.mjs — garde-fou du sélecteur et du moteur « plat → champagne ».
 *
 * Extrait la logique embarquée dans dist/selecteur/index.html et vérifie les
 * invariants qui ne doivent JAMAIS régresser :
 *   1. tout le JS inline compile ;
 *   2. la couleur est une contrainte absolue (aucune fuite blanc↔rosé) ;
 *   3. les paliers de prix sont étanches (chaque bouteille dans un seul) ;
 *   4. couverture : une liste de plats courants est reconnue ;
 *   5. pas de faux positifs connus (ex. « poulet à la crème » n'est pas un dessert) ;
 *   6. registre de prix : sans budget, un plat « casual » ne sort pas une cuvée hors de prix.
 *
 * Usage :  node build-site.mjs && node test-selecteur.mjs
 * Sortie non nulle en cas d'échec (utilisable en CI / npm test).
 */
import { readFileSync } from 'fs';
import vm from 'vm';

const DIST = 'dist/selecteur/index.html';
let failures = 0;
const fail = (m) => { console.log('  ❌ ' + m); failures++; };
const ok = (m) => console.log('  ✅ ' + m);

let html;
try { html = readFileSync(DIST, 'utf8'); }
catch { console.error('Fichier introuvable : ' + DIST + '  (lance d\'abord `node build-site.mjs`)'); process.exit(2); }

// 1) Compilation de tout le JS inline
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let compileErr = 0;
for (const c of scripts) {
  if (c.includes('application/ld+json') || c.trim().startsWith('{')) continue;
  try { new vm.Script(c); } catch (e) { compileErr++; console.log('    SYNTAX: ' + e.message); }
}
compileErr ? fail('compilation JS (' + compileErr + ' erreurs)') : ok('compilation JS');

// Sandbox : on exécute le script applicatif avec un DOM minimal
const code = scripts.find(c => c.includes('function ranked'));
const noop = () => {};
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, addEventListener: noop, appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [], focus: noop, getContext: () => ({}), dataset: {}, set innerHTML(v){}, get innerHTML(){ return ''; } });
const s = { console };
Object.assign(s, {
  document: { getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: { style: { setProperty: noop }, lang: '' }, addEventListener: noop, cookie: '' },
  location: { href: '', pathname: '/selecteur/', search: '' }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  IntersectionObserver: function () { return { observe: noop, unobserve: noop, disconnect: noop }; },
  matchMedia: () => ({ matches: false, addEventListener: noop }), requestAnimationFrame: noop, setTimeout: noop, clearTimeout: noop,
  fetch: () => Promise.reject(), navigator: {}, history: { replaceState: noop, pushState: noop }, scrollTo: noop,
});
s.window = s; s.globalThis = s; s.self = s;
vm.createContext(s);
try { vm.runInContext(code, s, { timeout: 5000 }); } catch (e) { /* bruit d'init DOM ignoré */ }
const call = (name) => vm.runInContext(name, s);
const det = call('detectDishes'), one = call('dishRecommendOne'), inBudget = call('inBudget');
const TIERS = call('BUDGET_TIERS');
const stock = call('products().filter(p=>p.commerceReady===true && p.availability==="in_stock")');
const isRose = (p) => (p.tags || []).includes('Rosé');

// 2) Couleur inviolable
let leaks = 0, combos = 0;
for (const c of ['couleur_blanc', 'couleur_rose', 'couleur_any', undefined])
  for (const d of ['dos_brut', 'dos_sec', 'dos_doux', 'dos_any', undefined])
    for (const b of TIERS.map(t => t.id).concat([undefined])) {
      const a = {}; if (c) a.couleur = [c]; if (d) a.dosage = [d]; if (b) a.budget = [b];
      vm.runInContext('state.answers=' + JSON.stringify(a) + ';', s);
      const set = call('eligibleSet()'); combos++;
      if (!set.length) { leaks++; continue; }
      if (c === 'couleur_blanc' && set.some(isRose)) leaks++;
      if (c === 'couleur_rose' && set.some(p => !isRose(p))) leaks++;
    }
leaks ? fail('couleur inviolable (' + leaks + '/' + combos + ' fuites)') : ok('couleur inviolable (' + combos + ' combinaisons)');

// 3) Paliers de prix étanches
let overlap = 0;
for (const p of stock) { const n = TIERS.filter(t => inBudget(p, t.id)).length; if (n !== 1) overlap++; }
overlap ? fail('paliers de prix (' + overlap + ' bouteilles hors palier unique)') : ok('paliers de prix étanches');

// 4) Couverture de plats courants (échantillon large, toutes familles)
const CORPUS = ['huîtres', 'saumon fumé', 'sushi', 'saint-jacques', 'homard', 'caviar', 'plateau de fruits de mer',
  'crevettes', 'moules marinières', 'cabillaud', 'sole meunière', 'tartare de thon', 'bouillabaisse', 'calamars', 'escargots',
  'foie gras', 'charcuterie', 'jambon de parme', 'salade césar', 'soupe à l\'oignon', 'ratatouille', 'quiche lorraine', 'oeuf cocotte',
  'poulet rôti', 'coq au vin', 'magret de canard', 'boeuf bourguignon', 'côte de boeuf', 'entrecôte', 'gigot d\'agneau', 'gibier', 'chevreuil',
  'côte de porc', 'andouillette', 'ris de veau', 'blanquette de veau', 'choucroute', 'cassoulet', 'tripes',
  'risotto', 'pâtes bolognaise', 'lasagnes', 'gnocchis', 'pizza', 'burger', 'raclette', 'tartiflette', 'fondue savoyarde',
  'curry de crevettes', 'couscous', 'poulet tikka massala', 'pad thaï',
  'plateau de fromages', 'roquefort', 'comté', 'chèvre chaud',
  'mousse au chocolat', 'tarte au citron', 'tarte tatin', 'crème brûlée', 'tiramisu', 'macarons', 'glace vanille',
  'profiteroles', 'baba au rhum', 'paris-brest', 'crumble', 'pêche melba'];
const unknown = CORPUS.filter(q => !det(q).length);
unknown.length ? fail('couverture (' + unknown.length + ' non reconnus : ' + unknown.join(', ') + ')') : ok('couverture (' + CORPUS.length + ' plats)');

// 4bis) Pièges : des phrases sans plat ne doivent RIEN déclencher
const TRAPS = ['mariage', 'anniversaire', 'cadeau', 'budget serré', 'sucré salé', 'vin rouge', 'un grand succès', 'quelque chose de chic', 'ambiance festive', 'je ne sais pas'];
const trapHits = TRAPS.filter(q => det(q).length);
trapHits.length ? fail('pièges (déclenchements indus : ' + trapHits.join(', ') + ')') : ok('pièges (aucun faux déclenchement)');

// 4bis-2) Famille correcte : de la viande ne doit JAMAIS être classée « mer », et inversement.
const prim = (q) => { const c = det(q); return c.length ? c[0].acc : null; };
const FAMILLE = [
  ['tartare de boeuf', 'accord_volaille'],   // le boeuf reste une viande, pas un tartare de poisson
  ['carpaccio de boeuf', 'accord_volaille'],
  ['tartare de saumon', 'accord_mer'],
  ['brochettes', 'accord_volaille'],         // « brochet » (poisson) ne doit pas capturer « brochettes »
  ['vichyssoise', 'accord_aperitif'],        // soupe froide, pas une volaille
  ['blanquette de la mer', 'accord_mer'],
  ['blanquette de veau', 'accord_volaille'],
];
let famErr = 0;
for (const [q, want] of FAMILLE) { const g = prim(q); if (g !== want) { famErr++; console.log('    ' + q + ' → ' + g + ' (attendu ' + want + ')'); } }
// Un même plat ne doit jamais sortir sous deux familles contradictoires,
// et « pâtes » (plat) ne doit pas déclencher « pâté » (charcuterie/apéritif).
const accsOf = (q) => det(q).map(c => c.acc);
if (accsOf('on mange une raclette ce soir').filter(a => a === 'accord_fromage' || a === 'accord_aperitif').length > 1) { famErr++; console.log('    raclette sort en double famille'); }
if (accsOf('des pâtes carbonara').includes('accord_aperitif')) { famErr++; console.log('    « pâtes » déclenche « pâté » (apéritif)'); }
if (!accsOf('un pâté en croûte').includes('accord_aperitif')) { famErr++; console.log('    « pâté en croûte » non reconnu'); }
famErr ? fail('famille correcte (' + famErr + ' erreurs)') : ok('famille correcte (viande ≠ mer, pas de double)');

// 4ter) Base mondiale en repli : longue traîne reconnue et routée sans erreur grossière
const DB = call('DISH_BASE');
let dbErr = 0;
if (!DB || DB.length < 1000) { dbErr++; console.log('    base mondiale non chargée (' + (DB ? DB.length : 0) + ')'); }
else {
  const dbCase = (dish, acc) => { const c = det(dish); if (!c.length || c[0].acc !== acc) { dbErr++; console.log('    « ' + dish + ' » → ' + (c[0] ? c[0].acc : '✗') + ' (attendu ' + acc + ')'); } };
  dbCase('churrasco', 'accord_volaille');   // viande grillée, JAMAIS « mer »
  dbCase('feijoada', 'accord_volaille');
  dbCase('sorpotel', 'accord_volaille');    // curry de porc, pas « mer » malgré sa famille
}
dbErr ? fail('base mondiale (repli) (' + dbErr + ' anomalies)') : ok('base mondiale (repli, ' + (DB ? DB.length : 0) + ' termes)');

// 4quater) Statut producteur vérifiable : 3 états, « inconnu » jamais revendiqué
const prods = call('products()');
const signalFit = call('signalFit');
let prodErr = 0;
const badState = prods.filter(p => !['maison', 'vigneron', 'inconnu'].includes(p.producerType));
if (badState.length) { prodErr++; console.log('    ' + badState.length + ' produits hors {maison,vigneron,inconnu}'); }
const claimed = prods.filter(p => p.producerType === 'inconnu' && (signalFit(p, 'vigneron') || signalFit(p, 'maison')));
if (claimed.length) { prodErr++; console.log('    ' + claimed.length + ' « inconnu » revendiqués comme vigneron/maison'); }
// garde-fous de l'audit : de grandes maisons ne doivent plus être « vigneron »
for (const house of ['Mumm', 'Pernod']) {
  const p = prods.find(x => (x.house || '').includes(house));
  if (p && p.producerType === 'vigneron') { prodErr++; console.log('    ' + p.house + ' classé vigneron (grande maison)'); }
}
prodErr ? fail('statut producteur (' + prodErr + ' anomalies)') : ok('statut producteur (3 états, inconnu respecté)');

// 4quinquies) Vérité métier (audit) : pas de fait fabriqué, noms propres, pas de doublons
let truthErr = 0;
// a) aucun assemblage présenté sans source
const grapesNoSrc = prods.filter(p => p.details && p.details.grapes && p.details.grapes.length && !p.details.grapesSourced);
if (grapesNoSrc.length) { truthErr++; console.log('    ' + grapesNoSrc.length + ' assemblages présentés sans source'); }
// b) aucun artefact d'encodage dans les noms
const nameArtefacts = prods.filter(p => /Rose['’`´]|Millesim[eè]|Grand Cuvee|\bCuvee\b|\bReserve\b|=|̀|́|̂|̃/.test((p.name || '') + ' ' + (p.house || '')));
if (nameArtefacts.length) { truthErr++; console.log('    ' + nameArtefacts.length + ' noms avec artefact d\'encodage : ' + nameArtefacts.slice(0, 4).map(p => p.name).join(' | ')); }
// c) aucun producteur en double (même entité normalisée, orthographes différentes)
const nb = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&|\bet\b|\bfils\b|champagne|maison|[^a-z]+/g, ' ').trim();
const byN = {}; prods.forEach(p => { const n = nb(p.house); (byN[n] = byN[n] || new Set()).add(p.house); });
const dups = Object.values(byN).filter(s => s.size > 1);
if (dups.length) { truthErr++; console.log('    ' + dups.length + ' producteurs en double : ' + dups.map(s => [...s].join('/')).join(', ')); }
truthErr ? fail('vérité métier (' + truthErr + ' anomalies)') : ok('vérité métier (assemblage sourcé, noms propres, pas de doublon)');

// 5) Faux positifs / classements attendus
const expect = [
  ['poulet à la crème', 'accord_volaille'], ['salade de fruits', 'accord_dessert'],
  ['tarte flambée', 'accord_volaille'], ['foie gras', 'accord_aperitif'],
  ['daube provençale', 'accord_volaille'], ['mousse au chocolat', 'accord_dessert'],
  ['fondue bourguignonne', 'accord_volaille'], ['fondue savoyarde', 'accord_fromage'],
];
let clsErr = 0;
for (const [dish, acc] of expect) {
  const cs = det(dish);
  const primary = cs[0] && cs[0].acc;
  const hasDessertWrong = dish === 'poulet à la crème' && cs.some(c => c.acc === 'accord_dessert');
  const fondueWrong = dish === 'fondue bourguignonne' && cs.some(c => c.acc === 'accord_fromage');
  if (primary !== acc || hasDessertWrong || fondueWrong) { clsErr++; console.log('    « ' + dish + ' » → ' + cs.map(c => c.acc).join('+') + ' (attendu ' + acc + ')'); }
}
// foie gras ne doit jamais être un dessert
if (det('foie gras').some(c => c.acc === 'accord_dessert')) { clsErr++; console.log('    foie gras classé en dessert'); }
clsErr ? fail('classements attendus (' + clsErr + ' erreurs)') : ok('classements attendus');

// 6bis) Tolérance aux fautes de frappe (passe floue)
const typos = [['uitres','accord_mer'],['choclat','accord_dessert'],['cavier','accord_mer'],['frmage','accord_fromage'],['risoto','accord_volaille'],['poilet','accord_volaille']];
let typoErr = 0;
for (const [t, acc] of typos) { const c = det(t); if (!c.length || c[0].acc !== acc) { typoErr++; console.log('    « ' + t + ' » → ' + (c[0] ? c[0].acc : '✗') + ' (attendu ' + acc + ')'); } }
typoErr ? fail('tolérance fautes de frappe (' + typoErr + ' échecs)') : ok('tolérance fautes de frappe');

// 6ter) Préférence de style exprimée dans la phrase
let styleErr = 0;
const styleCase = (txt, want) => {
  const c = det(txt); if (!c.length) { styleErr++; console.log('    « ' + txt +' » non reconnu'); return; }
  const top = one(c, '', 1, txt)[0].p; const tg = top.tags || [];
  const isSec = tg.includes('Extra-brut') || tg.includes('Brut nature');
  const isDoux = tg.includes('Demi-sec');
  if ((want === 'sec' && !isSec) || (want === 'doux' && !isDoux)) { styleErr++; console.log('    « ' + txt + ' » → ' + tg.join(',') + ' (attendu ' + want + ')'); }
};
styleCase('un aperitif entre amis brut nature', 'sec');
styleCase('un dessert plutot demi-sec', 'doux');
styleErr ? fail('préférence de style (' + styleErr + ' échecs)') : ok('préférence de style dans la phrase');

// 6sexies) Préparation (grillé/cru/en sauce) et négation
let prepErr = 0;
const detectPrep = call('detectPrep');
if (!detectPrep('poulet rôti').labels.includes('grillé / rôti')) { prepErr++; console.log('    préparation « rôti » non détectée'); }
if (!detectPrep('saumon à la crème').labels.includes('en sauce / crémeux')) { prepErr++; console.log('    préparation « crème » non détectée'); }
// la préparation doit pouvoir changer la reco (huîtres vs huîtres gratinées)
const topOf = (q) => { const c = det(q); return c.length ? one(c, '', 1, q)[0].p.id : null; };
if (topOf('huîtres') === topOf('huîtres gratinées')) { prepErr++; console.log('    la préparation ne modifie pas la reco (huîtres vs gratinées)'); }
// négation : un plat écarté ne doit pas être détecté
const neg = det('je ne veux pas de fruits de mer, plutôt une volaille');
if (neg.some(c => c.acc === 'accord_mer')) { prepErr++; console.log('    négation ignorée (« pas de fruits de mer »)'); }
if (!neg.some(c => c.acc === 'accord_volaille')) { prepErr++; console.log('    volaille non détectée dans la phrase avec négation'); }
// la négation ne doit pas déborder sur le plat suivant (« sans homard, un magret » garde le magret)
const neg2 = det('sans homard, un magret');
if (neg2.some(c => c.acc === 'accord_mer')) { prepErr++; console.log('    négation « sans » déborde (homard gardé)'); }
if (!neg2.some(c => c.acc === 'accord_volaille')) { prepErr++; console.log('    magret écarté à tort par la négation antérieure'); }
const neg3 = det('sauf le poisson, une côte de boeuf');
if (neg3.some(c => c.acc === 'accord_mer')) { prepErr++; console.log('    négation « sauf » ignorée (poisson gardé)'); }
if (!neg3.some(c => c.acc === 'accord_volaille')) { prepErr++; console.log('    côte de boeuf écartée à tort'); }
// « et » n'est pas une négation : les deux plats restent
const both = det('des huîtres et un magret');
if (!both.some(c => c.acc === 'accord_mer') || !both.some(c => c.acc === 'accord_volaille')) { prepErr++; console.log('    « et » traité comme une exclusion'); }
prepErr ? fail('préparation & négation (' + prepErr + ' anomalies)') : ok('préparation & négation');

// 7) Registre de prix (sans budget)
const priceOf = (q) => { const c = det(q); return c.length ? one(c, '', 1)[0].p.price : null; };
let regErr = 0;
const pPizza = priceOf('pizza'), pPoulet = priceOf('poulet rôti'), pCaviar = priceOf('caviar');
if (pPizza > 60) { regErr++; console.log('    pizza (casual) trop chère : ' + pPizza + '€'); }
if (pPoulet > 95) { regErr++; console.log('    poulet rôti (standard) trop cher : ' + pPoulet + '€'); }
// caviar (luxe) : on vérifie juste qu'il n'est pas artificiellement plafonné bas
if (pCaviar !== null && pCaviar < 45) { regErr++; console.log('    caviar (luxe) plafonné trop bas : ' + pCaviar + '€'); }
regErr ? fail('registre de prix (' + regErr + ' anomalies)') : ok('registre de prix (pizza ' + pPizza + '€, poulet ' + pPoulet + '€, caviar ' + pCaviar + '€)');

// 8) Transparence des compromis : quand aucune bouteille ne satisfait le dosage
// ou le budget demandé, le résultat DOIT le signaler ; quand tout est satisfait,
// aucune note parasite ne doit s'afficher.
const stateRef = call('state'), rankedFn = call('ranked'), relaxNote = call('relaxNote');
const inDosageFn = call('inDosage'), inBudgetFn = call('inBudget');
let relErr = 0;
// Invariant robuste au catalogue : la note de compromis apparaît EXACTEMENT quand
// le résultat ne respecte pas le dosage ou le budget demandé (jamais sinon).
const COMBOS = [
  { couleur: ['couleur_rose'], dosage: ['dos_sec'] },
  { couleur: ['couleur_rose'], dosage: ['dos_doux'], budget: ['b1'] },
  { couleur: ['couleur_blanc'], dosage: ['dos_brut'], budget: ['b3'] },
  { couleur: ['couleur_blanc'], dosage: ['dos_doux'], budget: ['b6'] },
  { couleur: ['couleur_rose'], dosage: ['dos_brut'], budget: ['b2'] },
];
for (const ans of COMBOS) {
  stateRef.answers = Object.assign({ occasion: ['occ_diner'], couleur: ['couleur_blanc'], dosage: ['dos_any'], accord: ['accord_any'], gout: ['profil_any'], budget: [], repere: ['any'] }, ans);
  const top = rankedFn()[0].p;
  const dosage = (ans.dosage || [])[0], budget = (ans.budget || [])[0];
  const violates = (dosage && dosage !== 'dos_any' && !inDosageFn(top, dosage)) || (budget && !inBudgetFn(top, budget));
  const noted = !!relaxNote(top);
  if (violates !== noted) { relErr++; console.log('    incohérence note/réalité : ' + JSON.stringify(ans) + ' → note=' + noted + ', viole=' + violates); }
}
stateRef.answers = {};
relErr ? fail('transparence des compromis (' + relErr + ' anomalies)') : ok('transparence des compromis');

// 9) Équilibre couleur : le rosé ne doit pas « fuir » sur un plat non épicé et non
// dessert en mode par plat, et une bouteille unique sur un repas de fruits de mer
// reste un blanc. Couvre aussi quelques plats bistrot ajoutés à l'audit.
const perC = call('dishRecommendPerCourse'), oneB = call('dishRecommendOne');
const cc = (p) => isRose(p) ? 'rosé' : ((p.tags || []).includes('Demi-sec') ? 'demi-sec' : 'blanc');
let colErr = 0;
for (const r of perC(det('tapas, curry épicé, glace'), '', 'tapas, curry épicé, glace')) {
  const d = r.course;
  if (cc(r.p) === 'rosé' && d.need !== 'spicy' && d.acc !== 'accord_dessert') { colErr++; console.log('    rosé parasite sur ' + d.frag); }
}
const sea = oneB(det('huîtres, homard, tarte au citron'), '', 1, 'huîtres, homard, tarte au citron')[0].p;
if (isRose(sea)) { colErr++; console.log('    bouteille unique rosé sur un repas de fruits de mer'); }
for (const q of ['frisée aux lardons', 'betteraves', 'meurette', 'banana bread', 'glace', 'salade lyonnaise']) if (!det(q).length) { colErr++; console.log('    non reconnu : ' + q); }
colErr ? fail('équilibre couleur & couverture bistrot (' + colErr + ')') : ok('équilibre couleur & couverture bistrot');

// 10) Qualité des phrases d'accord : taillées par sous-type, sans écho ni faute d'accord.
const cExplain = call('courseExplain');
const phrase = (q) => { const c = det(q); return c.length ? cExplain(oneB(c, '', 1, q)[0].p, c[0]) : ''; };
let phErr = 0;
if (phrase('roquefort') === phrase('comté')) { phErr++; console.log('    phrase fromage non différenciée (bleu vs pâte pressée)'); }
if (phrase('mousse au chocolat') === phrase('tarte au citron')) { phErr++; console.log('    phrase dessert non différenciée (chocolat vs fruits)'); }
if (phrase('huîtres') === phrase('homard grillé')) { phErr++; console.log('    phrase mer non différenciée (iodé vs crustacé)'); }
for (const q of ['poulet rôti', 'blanquette de veau', 'pintade']) if (/\ble dominer\b/.test(phrase(q))) { phErr++; console.log('    faute d\'accord « le dominer » : ' + q); }
const echo = (s) => /Saint-Jacques[\s\S]*Saint-Jacques|dessert crémeux[\s\S]*dessert crémeux|soupe[\s\S]*soupe onctueuse/i.test(s);
for (const q of ['saint-jacques', 'crème brûlée', 'velouté de potiron']) if (echo(phrase(q))) { phErr++; console.log('    écho du nom de plat : ' + q); }
phErr ? fail('qualité des phrases d\'accord (' + phErr + ')') : ok('qualité des phrases d\'accord');

// 11) Plats composés : dans une même proposition, une épice ou un féculent ne crée
// pas un second plat contradictoire ; les séparateurs préservent les plats distincts.
const primC = (q) => { const c = det(q); return c.length ? c[0].acc : null; };
const nFam = (q) => new Set(det(q).map(c => c.acc)).size;
let compErr = 0;
if (primC('curry de crevettes') !== 'accord_volaille' || det('curry de crevettes').some(c => c.acc === 'accord_mer')) { compErr++; console.log('    « curry de crevettes » : la mer n\'a pas été absorbée par l\'épicé'); }
if (primC('risotto au homard') !== 'accord_mer') { compErr++; console.log('    « risotto au homard » non porté par le homard'); }
if (primC('salade de gésiers') !== 'accord_volaille') { compErr++; console.log('    « salade de gésiers » non portée par les gésiers'); }
if (primC('salade de chèvre chaud') !== 'accord_fromage') { compErr++; console.log('    « salade de chèvre » non portée par le fromage'); }
if (nFam('huîtres et un magret') !== 2) { compErr++; console.log('    « et » fusionne à tort deux plats distincts'); }
if (nFam('foie gras, chapon, bûche') !== 3) { compErr++; console.log('    repas séparé par virgules mal segmenté'); }
compErr ? fail('plats composés (' + compErr + ')') : ok('plats composés (épice/féculent résolus)');

console.log('\n' + (failures ? '❌ ' + failures + ' test(s) en échec' : '✅ Tous les tests passent'));
process.exit(failures ? 1 : 0);

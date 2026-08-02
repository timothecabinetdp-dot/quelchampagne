import { readFileSync } from 'node:fs';
import { AVAILABLE_PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';

const source = readFileSync(new URL('index.html', import.meta.url), 'utf8');
const script = source.split('<script>')[1].split('</script>')[0];
const catalogue = AVAILABLE_PARTNER_CATALOGUE;
const errors = [];

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
global.fetch = () => Promise.reject(new Error('Réseau désactivé pendant les tests.'));

const engine = {};
eval(`${script}; Object.assign(engine, { questions, score, scoreBreakdown, budgetFitScore, signalFit, accordFit, setCatalogue });`);
engine.setCatalogue(catalogue);

function rank(answers) {
  return catalogue
    .filter(product => product.commerceReady === true && product.availability === 'in_stock')
    .map(product => ({ product, score: engine.score(product, answers), breakdown: engine.scoreBreakdown(product, answers) }))
    .sort((a, b) =>
      b.score - a.score ||
      (b.product.popularity || 0) - (a.product.popularity || 0) ||
      a.product.id.localeCompare(b.product.id, 'fr')
    );
}

function answer(occasion, accord, style, budget, signal) {
  return {
    occasion: [occasion],
    accord: [accord],
    gout: [style],
    budget: [budget],
    repere: [signal]
  };
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const questions = engine.questions();
assert(questions.length === 5, `Le sélecteur doit contenir cinq questions, obtenu : ${questions.length}.`);
assert(questions.map(question => question.id).join('|') === 'occasion|accord|gout|budget|repere', 'L’ordre des cinq critères est incorrect.');

const occasions = questions[0].opts.map(option => option.tags[0]);
const accords = questions[1].opts.map(option => option.tags[0]);
const styles = questions[2].opts.map(option => option.tags[0]);
const budgets = questions[3].opts.map(option => option.tags[0]);
const signals = questions[4].opts.map(option => option.tags[0]);
const topCounts = new Map();
let scenarioCount = 0;

for (const occasion of occasions) {
  for (const accord of accords) {
    for (const style of styles) {
      for (const budget of budgets) {
        for (const signal of signals) {
          scenarioCount += 1;
          const answers = answer(occasion, accord, style, budget, signal);
          const first = rank(answers);
          const second = rank(answers);
          const top = first[0].product;
          const topFour = first.slice(0, 4).map(item => item.product.id);
          topCounts.set(top.id, (topCounts.get(top.id) || 0) + 1);

          assert(top.region === 'Champagne' && top.editorialReady, `Produit non publiable recommandé : ${top.id}.`);
          assert(top.commerceReady === true && top.availability === 'in_stock', `Produit indisponible recommandé : ${top.id}.`);
          assert(/^https:\/\/assets\.ikhnaie\.link\//.test(top.aff || ''), `Lien affilié absent ou invalide : ${top.id}.`);
          assert(/^https:\/\//.test(top.merchantSourceUrl || ''), `Lien direct marchand absent : ${top.id}.`);
          assert(/^https:\/\//.test(top.image || ''), `Photo partenaire absente : ${top.id}.`);
          assert(new Set(topFour).size === topFour.length, `Alternatives dupliquées pour ${occasion}/${accord}/${style}/${budget}/${signal}.`);
          assert(topFour.join('|') === second.slice(0, 4).map(item => item.product.id).join('|'), `Classement instable pour ${occasion}/${accord}/${style}/${budget}/${signal}.`);

          const eligible = catalogue.filter(product =>
            (style === 'profil_any' || product.profil.includes(style)) &&
            product.occ.includes(occasion) &&
            (accord === 'accord_any' || engine.accordFit(product, accord)) &&
            (signal === 'any' || engine.signalFit(product, signal)) &&
            engine.budgetFitScore(product, budget) >= 29 &&
            product.commerceReady === true &&
            product.availability === 'in_stock'
          );
          if (eligible.length) {
            if (style !== 'profil_any') assert(top.profil.includes(style), `Style ignoré malgré ${eligible.length} candidats : ${occasion}/${accord}/${style}/${budget}/${signal}.`);
            assert(top.occ.includes(occasion), `Moment ignoré malgré ${eligible.length} candidats : ${occasion}/${accord}/${style}/${budget}/${signal}.`);
            if (accord !== 'accord_any') assert(engine.accordFit(top, accord), `Accord ignoré malgré ${eligible.length} candidats : ${occasion}/${accord}/${style}/${budget}/${signal}.`);
            assert(engine.budgetFitScore(top, budget) >= 29, `Budget ignoré malgré ${eligible.length} candidats : ${occasion}/${accord}/${style}/${budget}/${signal}.`);
            if (signal !== 'any') assert(engine.signalFit(top, signal), `Signature ignorée malgré ${eligible.length} candidats : ${occasion}/${accord}/${style}/${budget}/${signal}.`);
          }
        }
      }
    }
  }
}

const curated = [
  { name: 'apéritif marin, frais, vigneron', answers: answer('occ_apero', 'accord_mer', 'profil_frais_vif', 'b2', 'vigneron') },
  { name: 'repas de volaille, ample, maison', answers: answer('occ_diner', 'accord_volaille', 'profil_riche_ample', 'b3', 'maison') },
  { name: 'cadeau floral sans préférence', answers: answer('occ_cadeau', 'accord_any', 'profil_delicat', 'b3', 'any') },
  { name: 'moment à deux, dessert fruité', answers: answer('occ_romantique', 'accord_dessert', 'profil_fruite', 'b2', 'any') },
  { name: 'célébration, fruits de mer, très sec', answers: answer('occ_fete', 'accord_mer', 'profil_frais_vif', 'b2', 'low_dosage') },
  { name: 'apéritif sans préférence de style', answers: answer('occ_apero', 'accord_aperitif', 'profil_any', 'b1', 'any') }
];

for (const scenario of curated) {
  const rankedScenario = rank(scenario.answers);
  assert(rankedScenario.length >= 4, `Scénario "${scenario.name}" : moins de quatre résultats.`);
  const top = rankedScenario[0].product;
  assert(top.commerceReady && top.availability === 'in_stock', `Scénario "${scenario.name}" : résultat non achetable.`);
}

const mostFrequent = Math.max(...topCounts.values());
assert(topCounts.size >= 18, `Diversité des recommandations insuffisante : ${topCounts.size} cuvées arrivent premières.`);
assert(mostFrequent / scenarioCount <= 0.24, `Une cuvée monopolise trop de scénarios : ${mostFrequent}/${scenarioCount}.`);

if (errors.length) {
  console.error(`Tests de recommandation échoués (${errors.length}) :`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Tests de recommandation réussis : ${scenarioCount} profils, ${curated.length} scénarios métier, ${topCounts.size} recommandations principales distinctes.`);

import { readFileSync } from 'node:fs';
import { PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';

const ROOT = new URL('.', import.meta.url);
const source = readFileSync(new URL('index.html', ROOT), 'utf8');
const script = source.split('<script>')[1].split('</script>')[0];
const catalogue = PARTNER_CATALOGUE;
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
eval(`${script}; Object.assign(engine, { questions, score, budgetFitScore, setCatalogue });`);
engine.setCatalogue(catalogue);

function rank(answers) {
  return catalogue
    .map(product => ({ product, score: engine.score(product, answers) }))
    .sort((a, b) =>
      b.score - a.score ||
      (b.product.popularity || 0) - (a.product.popularity || 0) ||
      a.product.id.localeCompare(b.product.id, 'fr')
    );
}

function answer(occasion, style, budget, producer) {
  return {
    occasion: [occasion],
    gout: [style],
    budget: [budget],
    maison: [producer]
  };
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const questions = engine.questions();
const occasions = questions[0].opts.map(option => option.tags[0]);
const styles = questions[1].opts.map(option => option.tags[0]);
const budgets = questions[2].opts.map(option => option.tags[0]);
const producers = questions[3].opts.map(option => option.tags[0]);
const topCounts = new Map();
let scenarioCount = 0;

for (const occasion of occasions) {
  for (const style of styles) {
    for (const budget of budgets) {
      for (const producer of producers) {
        scenarioCount += 1;
        const answers = answer(occasion, style, budget, producer);
        const first = rank(answers);
        const second = rank(answers);
        const top = first[0].product;
        const topFour = first.slice(0, 4).map(item => item.product.id);
        topCounts.set(top.id, (topCounts.get(top.id) || 0) + 1);

        assert(top.region === 'Champagne' && top.editorialReady, `Produit non publiable recommandé : ${top.id}.`);
        assert(top.commerceReady === true && top.availability === 'in_stock', `Produit indisponible recommandé : ${top.id}.`);
        assert(/^https:\/\/assets\.ikhnaie\.link\//.test(top.aff||''), `Lien affilié absent ou invalide : ${top.id}.`);
        assert(/^https:\/\//.test(top.image||''), `Photo partenaire absente : ${top.id}.`);
        assert(new Set(topFour).size === topFour.length, `Alternatives dupliquées pour ${occasion}/${style}/${budget}/${producer}.`);
        assert(topFour.join('|') === second.slice(0, 4).map(item => item.product.id).join('|'), `Classement instable pour ${occasion}/${style}/${budget}/${producer}.`);
        if (producer !== 'any') {
          assert(top.producerType === producer, `Préférence producteur non respectée pour ${occasion}/${style}/${budget}/${producer} : ${top.id}.`);
        }

        const eligible = catalogue.filter(product =>
          product.profil.includes(style) &&
          product.occ.includes(occasion) &&
          (producer === 'any' || product.producerType === producer) &&
          engine.budgetFitScore(product, budget) >= 30
        );
        if (eligible.length) {
          assert(top.profil.includes(style), `Style ignoré malgré ${eligible.length} candidats : ${occasion}/${style}/${budget}/${producer}.`);
          assert(top.occ.includes(occasion), `Occasion ignorée malgré ${eligible.length} candidats : ${occasion}/${style}/${budget}/${producer}.`);
          assert(engine.budgetFitScore(top, budget) >= 30, `Budget ignoré malgré ${eligible.length} candidats : ${occasion}/${style}/${budget}/${producer}.`);
        }
      }
    }
  }
}

const curated = [
  { name: 'apéritif frais maison', answers: answer('occ_apero', 'profil_frais_vif', 'b2', 'maison') },
  { name: 'dîner riche vigneron', answers: answer('occ_diner', 'profil_riche_ample', 'b3', 'vigneron') },
  { name: 'cadeau délicat maison', answers: answer('occ_cadeau', 'profil_delicat', 'b3', 'maison') },
  { name: 'romantique fruité libre', answers: answer('occ_romantique', 'profil_fruite', 'b3', 'any') },
  { name: 'célébration fraîche vigneron', answers: answer('occ_fete', 'profil_frais_vif', 'b2', 'vigneron') }
];

for (const scenario of curated) {
  const top = rank(scenario.answers)[0].product;
  const occasion = scenario.answers.occasion[0];
  const style = scenario.answers.gout[0];
  const producer = scenario.answers.maison[0];
  const exactCandidates=catalogue.filter(product=>
    product.occ.includes(occasion) &&
    product.profil.includes(style) &&
    (producer==='any'||product.producerType===producer) &&
    engine.budgetFitScore(product,scenario.answers.budget[0])>=30
  );
  if(exactCandidates.length){
    assert(top.occ.includes(occasion), `Scénario "${scenario.name}" : occasion non respectée (${top.id}).`);
    assert(top.profil.includes(style), `Scénario "${scenario.name}" : style non respecté (${top.id}).`);
    if (producer !== 'any') assert(top.producerType === producer, `Scénario "${scenario.name}" : producteur non respecté (${top.id}).`);
  }
}

const romanticCount = catalogue.filter(product => product.occ.includes('occ_romantique')).length;
const mostFrequent = Math.max(...topCounts.values());
assert(romanticCount >= 12, `Couverture romantique insuffisante : ${romanticCount} cuvées.`);
assert(topCounts.size >= 14, `Diversité des recommandations insuffisante : ${topCounts.size} cuvées arrivent premières.`);
assert(mostFrequent / scenarioCount <= 0.20, `Une cuvée monopolise trop de scénarios : ${mostFrequent}/${scenarioCount}.`);

if (errors.length) {
  console.error(`Tests de recommandation échoués (${errors.length}) :`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Tests de recommandation réussis : ${scenarioCount} profils, ${curated.length} scénarios métier, ${topCounts.size} recommandations principales distinctes, ${romanticCount} cuvées adaptées au tête-à-tête.`);

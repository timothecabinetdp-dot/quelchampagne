import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);

// Cuvées dont la fiche produit Amazon (ASIN) a été vérifiée une à une et pour
// lesquelles le lien d'affiliation direct est activé. Toute autre cuvée reste en
// repli éditorial (« Voir la fiche officielle ») tant que son ASIN n'est pas mappé.
export const ACTIVATED_COMMERCE_IDS = new Set([
  'feuillatte', 'moet', 'clicquot', 'bollinger', 'ruinart', 'laurentperrier'
]);

function read(name) {
  return readFileSync(new URL(name, ROOT), 'utf8');
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...data] = rows;
  return data.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function splitList(value) {
  return value.split('|').map(item => item.trim()).filter(Boolean);
}

function occasionTags(value) {
  const text = value.toLowerCase();
  const tags = [];
  if (text.includes('apéritif') || text.includes('découverte')) tags.push('occ_apero');
  if (text.includes('cadeau') || text.includes('collection')) tags.push('occ_cadeau');
  if (text.includes('repas')) tags.push('occ_diner');
  if (text.includes('célébration')) tags.push('occ_fete');
  return [...new Set(tags.length ? tags : ['occ_diner'])];
}

function pairingTags(value) {
  const text = value.toLowerCase();
  const tags = [];
  if (/huître|coquillage|poisson|homard|langoustine|sole|thon/.test(text)) tags.push('accord_mer');
  if (/volaille|canard|gibier|veau/.test(text)) tags.push('accord_volaille');
  if (/fromage|comté|parmesan/.test(text)) tags.push('accord_fromage');
  if (/fruit|dessert/.test(text)) tags.push('accord_dessert');
  if (/gougère|apéritif|charcuterie/.test(text)) tags.push('accord_aperitif');
  return [...new Set(tags.length ? tags : ['accord_aperitif'])];
}

function profileTags(row) {
  const tags = [];
  if (+row.freshness >= 4 || +row.minerality >= 4) tags.push('profil_frais_vif');
  if (+row.fruitiness >= 4 || +row.roundness >= 4) tags.push('profil_fruite');
  if (+row.power >= 4 || +row.complexity >= 5) tags.push('profil_riche_ample');
  if (+row.minerality >= 4 && +row.power <= 3) tags.push('profil_delicat');
  return [...new Set(tags.length ? tags : ['profil_fruite'])];
}

function axisLabel(key, value) {
  const labels = {
    freshness: ['Très douce', 'Douce', 'Équilibrée', 'Fraîche', 'Très fraîche'],
    roundness: ['Très droite', 'Droite', 'Équilibrée', 'Ronde', 'Très ronde'],
    power: ['Très légère', 'Légère', 'Équilibrée', 'Puissante', 'Très puissante'],
    complexity: ['Directe', 'Accessible', 'Nuancée', 'Complexe', 'Très complexe']
  };
  return labels[key][Math.max(1, Math.min(5, +value)) - 1];
}

function tier(min, max) {
  if (max <= 35) return 1;
  if (min < 60) return 2;
  if (min < 100) return 3;
  return 4;
}

function visualFor(row) {
  const rose = row.type.toLowerCase().includes('rosé');
  return rose
    ? { glass: ['#9f514b', '#d98a86'], foil: '#c98f88', accent: '#C07A72' }
    : { glass: ['#243c2e', '#4a6a54'], foil: '#c9a85e', accent: '#9C7A34' };
}

function verifiedFacts(row) {
  return [
    row.assemblage_ou_cépages && !row.assemblage_ou_cépages.toLowerCase().includes('à confirmer')
      ? `Assemblage : ${row.assemblage_ou_cépages}.`
      : '',
    row.dosage ? `Dosage : ${row.dosage}.` : '',
    row.service ? `Service : ${row.service}.` : '',
    row.repere_maison ? `${row.repere_maison}.` : ''
  ].filter(Boolean).join(' ');
}

export function buildCatalogue({ write = true } = {}) {
  const core = JSON.parse(read('data/core-products.json'));
  const catalogue = parseCSV(read('data/catalogue-mvp-50.csv'));
  const waveEditorial = JSON.parse(read('data/editorial-wave-1-2.json'));
  const waveChecks = [
    ...parseCSV(read('data/vague-1-fiches-verifiees.csv')),
    ...parseCSV(read('data/vague-2-roses-verifies.csv'))
  ];
  const structured = parseCSV(read('data/fiches-structurees-vagues-3-4.csv'));
  const wave5 = JSON.parse(read('data/catalogue-wave-5.json'));
  const wave6 = JSON.parse(read('data/catalogue-wave-6.json'));
  const checks = [
    ...parseCSV(read('data/vague-3-maisons-vignerons.csv')),
    ...parseCSV(read('data/vague-4-prestige.csv'))
  ];
  const catalogueById = new Map(catalogue.map(row => [row.id, row]));
  const checksById = new Map(checks.map(row => [row.catalogue_id, row]));
  const waveChecksById = new Map(waveChecks.map(row => [row.catalogue_id, row]));
  const coreCatalogueIds = new Set(['1', '2', '3', '4', '5', '34']);

  const waveAdditions = waveEditorial
    .filter(editorial => {
      const check = waveChecksById.get(editorial.catalogueId);
      return check?.statut === 'contrôlée' && !coreCatalogueIds.has(editorial.catalogueId);
    })
    .map(editorial => {
      const source = catalogueById.get(editorial.catalogueId);
      const check = waveChecksById.get(editorial.catalogueId);
      const min = +source.budget_min_eur;
      const max = +source.budget_max_eur;
      const visual = visualFor(check);
      const priority = +source.priority || 3;
      const accords = splitList(editorial.accords);
      const cuvee = check.cuvée_publiable.toLowerCase().startsWith(`${check.maison.toLowerCase()} `)
        ? check.cuvée_publiable.slice(check.maison.length + 1)
        : check.cuvée_publiable;
      return {
        id: editorial.id,
        name: cuvee,
        short: cuvee,
        house: check.maison,
        region: 'Champagne',
        price: Math.round((min + max) / 2),
        priceMin: min,
        priceMax: max,
        tier: tier(min, max),
        producerType: 'maison',
        ...visual,
        cork: '#7c5c3a',
        occ: occasionTags(editorial.occasions),
        profil: profileTags(editorial),
        bulles: 'bulles_fines',
        accords: pairingTags(editorial.accords),
        note: editorial.description,
        pair: accords.slice(0, 3).join(', '),
        tags: editorial.tags,
        sourceUrl: check.source_officielle,
        verifiedAt: check.date_controle,
        editorialReady: true,
        commerceReady: false,
        popularity: priority === 1 ? 94 : priority === 2 ? 86 : 78,
        releaseLabel: editorial.catalogueId === '16' ? '246' : '',
        vintageYear: null,
        editionNumber: editorial.catalogueId === '16' ? 246 : null,
        details: {
          facts: verifiedFacts(check),
          sourceQuality: 'fiche produit officielle',
          advice: editorial.description,
          profil: {
            fraicheur: axisLabel('freshness', editorial.freshness),
            rondeur: axisLabel('roundness', editorial.roundness),
            puissance: axisLabel('power', editorial.power),
            longueur: axisLabel('complexity', editorial.complexity)
          },
          accords: accords.slice(0, 3).map((item, index) => ({
            t: ['Premier accord', 'Autre possibilité', 'Pour aller plus loin'][index],
            d: item.charAt(0).toUpperCase() + item.slice(1)
          }))
        }
      };
    });

  const additions = structured.map(row => {
    const source = catalogueById.get(row.catalogue_id);
    const check = checksById.get(row.catalogue_id);
    const min = +source.budget_min_eur;
    const max = +source.budget_max_eur;
    const occasions = splitList(row.occasions);
    const accords = splitList(row.accords);
    const visual = visualFor(row);
    const priority = +source.priority || 3;
    return {
      id: row.slug,
      name: row.name,
      short: row.name,
      house: row.producer,
      region: 'Champagne',
      price: Math.round((min + max) / 2),
      priceMin: min,
      priceMax: max,
      tier: tier(min, max),
      producerType: ['Laherte Frères', 'Chartogne-Taillet'].includes(row.producer) ? 'vigneron' : 'maison',
      ...visual,
      cork: '#7c5c3a',
      occ: occasionTags(row.occasions),
      profil: profileTags(row),
      bulles: 'bulles_fines',
      accords: pairingTags(row.accords),
      note: row.description_editoriale,
      pair: accords.slice(0, 3).join(', '),
      tags: [
        row.type,
        ...occasions.slice(0, 2)
      ],
      sourceUrl: row.source_url,
      verifiedAt: row.facts_verified_at,
      editorialReady: row.editorial_ready === 'true',
      commerceReady: row.commerce_ready === 'true',
      popularity: priority === 1 ? 94 : priority === 2 ? 86 : 78,
      releaseLabel: row.release_label,
      vintageYear: row.vintage_year ? +row.vintage_year : null,
      editionNumber: row.edition_number ? +row.edition_number : null,
      details: {
        facts: check?.fait_structurant || '',
        sourceQuality: check?.qualité_source || 'source officielle',
        advice: row.description_editoriale,
        profil: {
          fraicheur: axisLabel('freshness', row.freshness),
          rondeur: axisLabel('roundness', row.roundness),
          puissance: axisLabel('power', row.power),
          longueur: axisLabel('complexity', row.complexity)
        },
        accords: accords.slice(0, 3).map((item, index) => ({
          t: ['Premier accord', 'Autre possibilité', 'Pour aller plus loin'][index],
          d: item.charAt(0).toUpperCase() + item.slice(1)
        }))
      }
    };
  });

  const wave6Additions = wave6.map((product, index) => {
    const rose = `${product.name} ${product.tags.join(' ')}`.toLowerCase().includes('rosé');
    return {
      id: product.id,
      name: product.name,
      short: product.name,
      house: product.house,
      region: 'Champagne',
      price: Math.round((product.priceMin + product.priceMax) / 2),
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      priceStatus: 'editorial_range',
      priceRangeVerifiedAt: '2026-07-27',
      tier: tier(product.priceMin, product.priceMax),
      producerType: product.producerType,
      glass: rose ? ['#9f514b', '#d98a86'] : ['#243c2e', '#4a6a54'],
      foil: rose ? '#c98f88' : '#c9a85e',
      accent: rose ? '#C07A72' : '#9C7A34',
      cork: '#7c5c3a',
      occ: product.occ,
      profil: product.profil,
      bulles: 'bulles_fines',
      accords: product.accords,
      note: product.note,
      pair: product.pair,
      tags: product.tags,
      sourceUrl: product.sourceUrl,
      verifiedAt: '2026-07-27',
      editorialReady: true,
      commerceReady: false,
      popularity: Math.max(72, 86 - index),
      releaseLabel: product.releaseLabel || 'standard',
      vintageYear: product.vintageYear ?? null,
      editionNumber: product.editionNumber ?? null,
      details: {
        facts: product.facts,
        sourceQuality: product.sourceQuality,
        advice: product.note,
        profil: product.profile,
        accords: product.pair.split(',').slice(0, 3).map((item, accordIndex) => ({
          t: ['Premier accord', 'Autre possibilité', 'Pour aller plus loin'][accordIndex],
          d: item.trim().charAt(0).toUpperCase() + item.trim().slice(1)
        }))
      }
    };
  });

  const result = [...core, ...waveAdditions, ...additions, ...wave5, ...wave6Additions]
    .filter(product => product.editorialReady)
    .map(product => {
      const typeText = `${product.name} ${(product.tags || []).join(' ')}`.toLowerCase();
      const romanticEligible =
        product.occ.includes('occ_cadeau') &&
        (product.profil.includes('profil_delicat') || typeText.includes('rosé'));
      return romanticEligible && !product.occ.includes('occ_romantique')
        ? { ...product, occ: [...product.occ, 'occ_romantique'] }
        : product;
    });
  // Activation marchande sélective : uniquement les cuvées à ASIN Amazon vérifié.
  // Les fourchettes de prix (vague 6) et l'index prix restent en repli éditorial.
  for (const product of result) {
    product.commerceReady = ACTIVATED_COMMERCE_IDS.has(product.id);
  }
  if (write) {
    writeFileSync(new URL('catalogue.json', ROOT), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  return result;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const catalogue = buildCatalogue();
  console.log(`Catalogue généré : ${catalogue.length} champagnes éditorialement prêts.`);
}

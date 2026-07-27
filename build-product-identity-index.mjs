import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);

function read(path) {
  return JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));
}

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/&/g, ' et ')
    .replace(/\bchampagne\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function withoutRelease(value, product) {
  let result = normalizeText(value);
  const releaseTokens = [
    product.releaseLabel,
    product.vintageYear,
    product.editionNumber,
    product.editionNumber ? `${product.editionNumber}eme edition` : null
  ].filter(Boolean);
  for (const token of releaseTokens) {
    const normalized = normalizeText(token);
    if (normalized) result = result.replace(new RegExp(`\\b${normalized.replaceAll(' ', '\\s+')}\\b`, 'g'), ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function buildProductIdentityIndex({ write = true } = {}) {
  const catalogue = read('catalogue.json');
  const overrides = read('data/product-matching-overrides.json');
  const products = catalogue.map(product => {
    const manual = overrides.products[product.id] || {};
    const aliases = [
      `${product.house} ${product.name}`,
      `${product.house} ${product.short || ''}`,
      ...(manual.aliases || [])
    ]
      .map(normalizeText)
      .filter((value, index, values) => value && values.indexOf(value) === index);

    const baseAliases = [
      withoutRelease(`${product.house} ${product.name}`, product),
      ...(manual.aliases || []).map(value => withoutRelease(value, product))
    ].filter((value, index, values) => value && values.indexOf(value) === index);

    return {
      productId: product.id,
      house: product.house,
      name: product.name,
      aliases,
      baseAliases,
      gtins: (manual.gtins || []).map(String),
      formatMl: manual.formatMl || 750,
      releaseLabel: product.releaseLabel || 'standard',
      vintageYear: product.vintageYear ?? null,
      editionNumber: product.editionNumber ?? null
    };
  });

  const result = {
    version: 1,
    generatedFrom: 'catalogue.json',
    productCount: products.length,
    products
  };
  if (write) {
    writeFileSync(new URL('data/product-identity-index.json', ROOT), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  return result;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const result = buildProductIdentityIndex();
  console.log(`Index d’identité généré : ${result.productCount} cuvées.`);
}

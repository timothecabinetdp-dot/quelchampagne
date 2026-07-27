import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { normalizeText } from './build-product-identity-index.mjs';

const ROOT = new URL('.', import.meta.url);

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));
}

function decodeXml(value = '') {
  return value
    .replaceAll('<![CDATA[', '')
    .replaceAll(']]>', '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function parseXml(xml) {
  const blocks = [...xml.matchAll(/<(?:product|item)\b[^>]*>([\s\S]*?)<\/(?:product|item)>/gi)];
  return blocks.map(([, block]) => {
    const record = {};
    for (const match of block.matchAll(/<([A-Za-z][\w:-]*)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const key = match[1].split(':').at(-1);
      record[key] = decodeXml(match[2]).replace(/<[^>]+>/g, '').trim();
    }
    return record;
  });
}

function parseCsvLine(line, separator) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === separator && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

function parseCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = parseCsvLine(lines[0], separator).map(value => value.trim());
  return lines.slice(1).map(line => Object.fromEntries(
    parseCsvLine(line, separator).map((value, index) => [headers[index], value.trim()])
  ));
}

export function parseFeed(content, format) {
  if (format === 'json') {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    for (const key of ['products', 'items', 'records']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    throw new Error('Le flux JSON ne contient aucun tableau products, items ou records.');
  }
  if (format === 'csv') return parseCsv(content);
  if (format === 'xml') return parseXml(content);
  throw new Error(`Format de flux non pris en charge : ${format}.`);
}

function firstValue(record, aliases) {
  const keyMap = new Map(Object.keys(record).map(key => [key.toLowerCase(), key]));
  for (const alias of aliases) {
    const actual = keyMap.get(alias.toLowerCase());
    if (actual && record[actual] !== '' && record[actual] != null) return String(record[actual]).trim();
  }
  return '';
}

function parsePrice(value) {
  const normalized = String(value || '')
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function detectFormatMl(text) {
  const normalized = normalizeText(text);
  if (/\bmagnum\b/.test(normalized)) return 1500;
  if (/\bjeroboam\b/.test(normalized)) return 3000;
  if (/\bdemi bouteille\b|\bhalf bottle\b/.test(normalized)) return 375;
  const matches = [...String(text).matchAll(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/gi)];
  for (const [, rawNumber, rawUnit] of matches) {
    const number = Number.parseFloat(rawNumber.replace(',', '.'));
    const unit = rawUnit.toLowerCase();
    const ml = unit === 'l' ? number * 1000 : unit === 'cl' ? number * 10 : number;
    if ([200, 375, 500, 750, 1500, 3000, 6000].includes(Math.round(ml))) return Math.round(ml);
  }
  return null;
}

function detectPackaging(text) {
  const normalized = normalizeText(text);
  if (/\b(coffret|etui|gift box|case|caisse bois|avec verres?)\b/.test(normalized)) return 'special_packaging';
  return 'bottle';
}

function normalizeAvailability(value) {
  const normalized = normalizeText(value);
  if (/^(1|true|yes|oui)$/.test(normalized) || /\b(in stock|en stock|available|disponible)\b/.test(normalized)) return 'in_stock';
  if (/^(0|false|no|non)$/.test(normalized) || /\b(out of stock|rupture|indisponible)\b/.test(normalized)) return 'out_of_stock';
  return 'unknown';
}

function releaseCheck(identity, text) {
  const normalized = normalizeText(text);
  const years = [...normalized.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(match => Number(match[1]));
  if (identity.vintageYear) {
    if (years.includes(identity.vintageYear)) return { exact: true, reason: 'vintage_exact' };
    if (years.length) return { exact: false, reason: `vintage_mismatch:${years.join(',')}` };
    return { exact: false, reason: 'vintage_missing' };
  }
  if (identity.editionNumber) {
    const editionPattern = new RegExp(`\\b${identity.editionNumber}\\b`);
    if (editionPattern.test(normalized)) return { exact: true, reason: 'edition_exact' };
    if (/\b(cuvee|collection|creation|edition)\s+(?:n|no|numero)?\s*\d{2,3}\b/.test(normalized)) {
      return { exact: false, reason: 'edition_mismatch' };
    }
    return { exact: false, reason: 'edition_missing' };
  }
  if (identity.releaseLabel.startsWith('base-')) {
    const baseYear = Number(identity.releaseLabel.slice(5));
    if (years.includes(baseYear)) return { exact: true, reason: 'base_exact' };
    if (years.length) return { exact: false, reason: `base_mismatch:${years.join(',')}` };
    return { exact: false, reason: 'base_missing' };
  }
  if (years.length && /\b(millesime|vintage)\b/.test(normalized)) {
    return { exact: false, reason: `unexpected_vintage:${years.join(',')}` };
  }
  return { exact: true, reason: 'standard_release' };
}

function findCandidates(productText, gtin, identities) {
  const normalized = normalizeText(productText);
  const gtinMatches = gtin ? identities.filter(item => item.gtins.includes(gtin)) : [];
  if (gtinMatches.length) return gtinMatches.map(identity => ({ identity, basis: 'gtin' }));

  const direct = identities.filter(identity => identity.aliases.some(alias =>
    normalized === alias || normalized.includes(alias) || alias.includes(normalized)
  ));
  if (direct.length) return direct.map(identity => ({ identity, basis: 'alias' }));

  return identities
    .filter(identity => identity.baseAliases.some(alias => normalized.includes(alias)))
    .map(identity => ({ identity, basis: 'base_alias' }));
}

export function normalizeMerchantRecord(raw, merchant) {
  const fields = merchant.fieldAliases;
  const name = firstValue(raw, fields.name);
  const brand = firstValue(raw, fields.brand);
  const description = firstValue(raw, fields.description);
  const formatSource = `${name} ${description}`;
  return {
    externalId: firstValue(raw, fields.externalId),
    name,
    brand,
    description,
    productUrl: firstValue(raw, fields.productUrl),
    imageUrl: firstValue(raw, fields.imageUrl),
    priceEur: parsePrice(firstValue(raw, fields.price)),
    currency: firstValue(raw, fields.currency) || 'EUR',
    availability: normalizeAvailability(firstValue(raw, fields.availability)),
    gtin: firstValue(raw, fields.gtin).replace(/\D/g, ''),
    formatMl: detectFormatMl(formatSource),
    packaging: detectPackaging(formatSource),
    matchText: `${brand} ${name}`.trim()
  };
}

export function classifyRecord(record, identities, defaultFormatMl = 750) {
  if (!record.name || !record.productUrl || !record.priceEur) {
    return { status: 'invalid_record', productId: null, reasons: ['required_field_missing'] };
  }
  const candidates = findCandidates(record.matchText, record.gtin, identities);
  if (!candidates.length) return { status: 'unmatched', productId: null, reasons: ['identity_not_found'] };
  if (candidates.length > 1) {
    return {
      status: 'review_required',
      productId: null,
      candidateProductIds: candidates.map(item => item.identity.productId),
      reasons: ['multiple_identity_candidates']
    };
  }

  const { identity, basis } = candidates[0];
  if (record.formatMl && record.formatMl !== identity.formatMl) {
    return { status: 'rejected_format', productId: identity.productId, reasons: [`format_${record.formatMl}_instead_of_${identity.formatMl}`] };
  }
  if (record.packaging !== 'bottle') {
    return { status: 'rejected_packaging', productId: identity.productId, reasons: ['special_packaging'] };
  }
  const release = releaseCheck(identity, `${record.matchText} ${record.description}`);
  if (!release.exact) {
    const mismatch = /mismatch|unexpected/.test(release.reason);
    return {
      status: mismatch ? 'rejected_release' : 'review_required',
      productId: identity.productId,
      reasons: [release.reason]
    };
  }
  if (!record.formatMl) {
    return { status: 'review_required', productId: identity.productId, reasons: ['format_missing'] };
  }
  if (record.formatMl !== defaultFormatMl) {
    return { status: 'rejected_format', productId: identity.productId, reasons: [`unsupported_default_format_${record.formatMl}`] };
  }
  return { status: 'matched_exact', productId: identity.productId, reasons: [`matched_by_${basis}`, release.reason] };
}

export function importMerchantFeed({
  inputPath,
  merchantId,
  format,
  observedAt = new Date().toISOString().slice(0, 10),
  write = true
}) {
  const config = readJson('data/merchant-feed-config.json');
  const identityIndex = readJson('data/product-identity-index.json');
  const merchant = config.merchants[merchantId];
  if (!merchant) throw new Error(`Marchand inconnu : ${merchantId}.`);
  const inputName = inputPath instanceof URL ? inputPath.pathname : inputPath;
  const detectedFormat = format || extname(inputName).slice(1).toLowerCase();
  const rows = parseFeed(readFileSync(inputPath, 'utf8'), detectedFormat);

  const results = rows.map(raw => {
    const normalized = normalizeMerchantRecord(raw, merchant);
    const classification = classifyRecord(normalized, identityIndex.products, config.defaultFormatMl);
    return { rawExternalId: normalized.externalId, normalized, classification };
  });

  const exact = results.filter(item => item.classification.status === 'matched_exact');
  const observations = exact.map((item, index) => ({
    observationId: `${merchantId}-${observedAt.replaceAll('-', '')}-${String(index + 1).padStart(4, '0')}`,
    productId: item.classification.productId,
    merchant: merchant.name,
    merchantId,
    network: merchant.network,
    merchantProductId: item.normalized.externalId,
    merchantUrl: item.normalized.productUrl,
    formatMl: item.normalized.formatMl,
    packaging: item.normalized.packaging,
    priceEur: item.normalized.priceEur,
    currency: item.normalized.currency,
    availability: item.normalized.availability,
    observedAt,
    exactProductMatch: true,
    exactReleaseMatch: true,
    exactFormatMatch: true,
    affiliateStatus: merchant.affiliateStatus,
    publicationStatus: 'research_only',
    publicationEligible: false
  }));
  const imageCandidates = exact
    .filter(item => item.normalized.imageUrl)
    .map(item => ({
      productId: item.classification.productId,
      merchantId,
      sourceUrl: item.normalized.imageUrl,
      productUrl: item.normalized.productUrl,
      status: 'candidate_only',
      rightsBasis: null,
      verifiedAt: null
    }));
  const counts = Object.fromEntries(
    [...new Set(results.map(item => item.classification.status))]
      .sort()
      .map(status => [status, results.filter(item => item.classification.status === status).length])
  );
  const report = {
    version: 1,
    importedAt: new Date().toISOString(),
    observedAt,
    sourceFile: basename(inputName),
    format: detectedFormat,
    merchantId,
    merchant: merchant.name,
    publicationMode: config.publicationMode,
    sourceRightsStatus: merchant.sourceRightsStatus,
    totalRecords: rows.length,
    counts,
    observations,
    imageCandidates,
    results
  };

  if (write) {
    mkdirSync(new URL('data/merchant-imports/', ROOT), { recursive: true });
    mkdirSync(new URL('reports/', ROOT), { recursive: true });
    const stem = `${merchantId}-${observedAt}`;
    writeFileSync(new URL(`data/merchant-imports/${stem}.json`, ROOT), `${JSON.stringify({
      version: 1,
      merchantId,
      observedAt,
      publicationMode: 'research_only',
      observations,
      imageCandidates
    }, null, 2)}\n`, 'utf8');
    writeFileSync(new URL(`reports/merchant-import-report-${stem}.json`, ROOT), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return args;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.merchant) {
    console.error('Usage : node import-merchant-feed.mjs --input flux.xml --merchant vinatis-tradedoubler [--format xml] [--observed-at AAAA-MM-JJ] [--dry-run]');
    process.exit(1);
  }
  const report = importMerchantFeed({
    inputPath: args.input,
    merchantId: args.merchant,
    format: args.format,
    observedAt: args['observed-at'],
    write: !args['dry-run']
  });
  console.log(`Flux analysé : ${report.totalRecords} lignes. Correspondances exactes : ${report.counts.matched_exact || 0}. Publication : bloquée.`);
  console.log(JSON.stringify(report.counts, null, 2));
}

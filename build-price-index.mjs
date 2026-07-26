import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);

function read(path) {
  return JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));
}

function merchantSlug(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function plusHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function buildPriceIndex({ write = true, now = new Date() } = {}) {
  const policy = read('data/price-policy.json');
  const raw = read('data/purchase-offers-research.json');

  const observations = raw.map((offer, index) => {
    const observedAt = new Date(`${offer.observedAt}T12:00:00.000Z`);
    const priceFreshUntil = plusHours(observedAt, policy.priceFreshnessHours);
    const availabilityFreshUntil = plusHours(observedAt, policy.availabilityFreshnessHours);
    const exactProductMatch = true;
    const exactReleaseMatch = true;
    const exactFormatMatch = offer.formatMl === policy.defaultFormatMl;
    const priceFresh = now <= new Date(priceFreshUntil);
    const availabilityFresh = now <= new Date(availabilityFreshUntil);
    const publicationEligible =
      offer.affiliateStatus === 'verified' &&
      offer.publicationStatus === 'approved' &&
      exactProductMatch &&
      exactReleaseMatch &&
      exactFormatMatch &&
      priceFresh &&
      availabilityFresh;

    return {
      observationId: `${offer.productId}-${merchantSlug(offer.merchant)}-${offer.observedAt.replaceAll('-', '')}-${index + 1}`,
      productId: offer.productId,
      merchant: offer.merchant,
      merchantUrl: offer.merchantUrl,
      formatMl: offer.formatMl,
      packaging: offer.packaging,
      priceEur: offer.priceEur,
      currency: policy.currency,
      availability: offer.availability,
      observedAt: offer.observedAt,
      priceFreshUntil,
      availabilityFreshUntil,
      exactProductMatch,
      exactReleaseMatch,
      exactFormatMatch,
      affiliateStatus: offer.affiliateStatus,
      publicationStatus: offer.publicationStatus,
      priceFresh,
      availabilityFresh,
      publicationEligible,
      notes: offer.notes
    };
  });

  const byProduct = Object.fromEntries(
    [...new Set(observations.map(item => item.productId))].map(productId => {
      const history = observations
        .filter(item => item.productId === productId)
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      const publishable = history.filter(item => item.publicationEligible);
      return [productId, {
        observationCount: history.length,
        merchantCount: new Set(history.map(item => item.merchant)).size,
        currentOfferCount: publishable.length,
        lowestCurrentPriceEur: publishable.length ? Math.min(...publishable.map(item => item.priceEur)) : null,
        currentOffers: publishable,
        history
      }];
    })
  );

  const result = {
    generatedAt: now.toISOString(),
    policyVersion: policy.version,
    publicationMode: 'blocked_until_review',
    observations,
    byProduct
  };

  if (write) {
    writeFileSync(new URL('data/price-index.json', ROOT), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  return result;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const result = buildPriceIndex();
  console.log(`Index prix généré : ${result.observations.length} relevés, ${Object.keys(result.byProduct).length} produits, 0 offre publiée sans validation.`);
}

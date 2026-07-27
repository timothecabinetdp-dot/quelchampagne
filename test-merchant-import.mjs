import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProductIdentityIndex } from './build-product-identity-index.mjs';
import { importMerchantFeed, parseFeed } from './import-merchant-feed.mjs';

const ROOT = new URL('.', import.meta.url);

const identity = buildProductIdentityIndex({ write: true });
assert.equal(identity.productCount, 75);

const xml = readFileSync(new URL('test/fixtures/tradedoubler-vinatis-sample.xml', ROOT), 'utf8');
assert.equal(parseFeed(xml, 'xml').length, 5);

const report = importMerchantFeed({
  inputPath: new URL('test/fixtures/tradedoubler-vinatis-sample.xml', ROOT),
  merchantId: 'vinatis-tradedoubler',
  format: 'xml',
  observedAt: '2026-07-27',
  write: false
});

assert.equal(report.totalRecords, 5);
assert.equal(report.counts.matched_exact, 1);
assert.equal(report.counts.rejected_packaging, 1);
assert.equal(report.counts.rejected_format, 1);
assert.equal(report.counts.rejected_release, 1);
assert.equal(report.counts.unmatched, 1);
assert.equal(report.observations.length, 1);
assert.equal(report.observations[0].productId, 'moet');
assert.equal(report.observations[0].publicationStatus, 'research_only');
assert.equal(report.observations[0].publicationEligible, false);
assert.equal(report.imageCandidates.length, 1);
assert.equal(report.imageCandidates[0].status, 'candidate_only');
assert.equal(report.imageCandidates[0].rightsBasis, null);

console.log('Import marchand testé : 5 cas, 1 exact, 4 mis en quarantaine, 0 publication.');

import { mkdirSync, writeFileSync } from 'node:fs';
import { PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';
import overrides from './data/product-evidence-overrides.json' with { type:'json' };

const records=PARTNER_CATALOGUE.map(product=>{
  const override=overrides.records[product.id] || {};
  return {
    productId:product.id,
    brand:override.publicBrand || product.brand,
    name:override.publicName || product.name,
    status:override.status || 'merchant_only',
    merchantSourceUrl:product.sourceUrl,
    merchantCheckedAt:product.offerCheckedAt,
    officialSourceUrl:override.officialSourceUrl || null,
    officialCheckedAt:override.officialSourceUrl ? overrides.reviewedAt : null,
    technicalSourceUrl:override.technicalSourceUrl || null,
    facts:{
      grapes:override.grapes || product.details.grapes || [],
      dosage:override.dosage || null,
      summary:override.facts || null
    },
    notes:override.notes || 'Identité, prix, disponibilité et description contrôlés sur la fiche du partenaire ; source primaire à compléter.'
  };
});

const summary=records.reduce((result,record)=>{
  const group=record.status.startsWith('official_confirmed')
    ? 'officialConfirmed'
    : record.status.startsWith('official_')
      ? 'officialPartial'
      : 'merchantOnly';
  result[group]+=1;
  return result;
},{officialConfirmed:0,officialPartial:0,merchantOnly:0});

writeFileSync(new URL('data/product-evidence.json',import.meta.url),`${JSON.stringify({
  version:1,
  reviewedAt:overrides.reviewedAt,
  productCount:records.length,
  summary,
  records
},null,2)}\n`);

mkdirSync(new URL('reports/',import.meta.url),{recursive:true});
writeFileSync(new URL('reports/product-evidence-review.json',import.meta.url),`${JSON.stringify({
  reviewedAt:overrides.reviewedAt,
  productCount:records.length,
  summary,
  unresolved:records
    .filter(record=>!record.status.startsWith('official_confirmed'))
    .map(record=>({
      productId:record.productId,
      product:`${record.brand} · ${record.name}`,
      status:record.status,
      officialSourceUrl:record.officialSourceUrl,
      technicalSourceUrl:record.technicalSourceUrl,
      nextAction:record.officialSourceUrl
        ? 'Archiver la fiche technique primaire exacte de la cuvée.'
        : 'Obtenir une source producteur ou une fiche technique primaire.'
    }))
},null,2)}\n`);

console.log(`Base de preuves : ${records.length} produits · ${summary.officialConfirmed} confirmés · ${summary.officialPartial} partiels · ${summary.merchantOnly} marchands seuls.`);

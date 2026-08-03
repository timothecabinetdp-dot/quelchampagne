import { writeFileSync } from 'node:fs';
import { PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';
import { buildKnowledgeBase } from './expert-engine.mjs';

const knowledgeBase=buildKnowledgeBase(PARTNER_CATALOGUE);
writeFileSync(new URL('data/champagne-knowledge-base.json',import.meta.url),`${JSON.stringify(knowledgeBase,null,2)}\n`);
console.log(`Base experte générée : ${knowledgeBase.count} cuvées · ${Object.keys(knowledgeBase.axes).length} axes sensoriels.`);

import test from 'node:test';import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/store.mjs';import {identityScore,resolveIdentity,ingestCandidates} from '../src/ingestion.mjs';
const store=await KnowledgeStore.fromFile();const first=store.all()[0];
test('identité exacte reconnue',()=>{const candidate={producer:first.identity.producer,cuvee:first.identity.cuvee,vintage:first.identity.vintage,formatMl:750};assert.equal(identityScore(candidate,first),100);assert.equal(resolveIdentity(candidate,store.all()).status,'matched');});
test('identité ambiguë mise en revue',()=>{const resolution=resolveIdentity({producer:'Veuve',cuvee:'Brut',formatMl:750},store.all(),{exactThreshold:99,reviewThreshold:20});assert.equal(resolution.status,'review');});
test('nouvelle cuvée préparée sans publication',()=>{const source={id:'producer:test',type:'producer',url:'https://example.test',checkedAt:'2026-08-02',usage:'facts',evidenceLevel:'primary'};const result=ingestCandidates(store,[{producer:'Producteur Test',cuvee:'Cuvée Test',technical:{grapes:['Chardonnay'],dosage:null,classification:null}}],source);assert.equal(result.accepted.length,1);assert.equal(result.accepted[0].lifecycle.status,'candidate');});
test('identité incomplète rejetée',()=>{const result=ingestCandidates(store,[{producer:'Maison seule'}],{id:'x'});assert.equal(result.rejected.length,1);});

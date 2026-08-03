import test from 'node:test';import assert from 'node:assert/strict';import {KnowledgeStore} from '../src/store.mjs';import {qualityReport} from '../src/quality.mjs';
const store=await KnowledgeStore.fromFile();
test('rapport de couverture cohérent',()=>{const report=qualityReport(store);assert.equal(report.total,store.size);assert.equal(report.readiness.targetRecords,200);assert.ok(report.coverage.fullSensoryAxes>=99);assert.equal(report.readiness.siteIntegrationReady,false);});

#!/usr/bin/env tsx
/**
 * Full Repertoire Enrichment (Ecosystem + Live Logs + Pruning)
 */

import { execSync } from 'node:child_process';

console.log('=== Full Repertoire Enrichment ===\n');

const steps = [
  { name: 'ecosystem ingestion', cmd: 'npx tsx deploy/ingest-ecosystem-to-repertoire.ts' },
  { name: 'Groover logs ingestion', cmd: 'npx tsx deploy/ingest-groover-logs-to-repertoire.ts' },
  { name: 'general enrichment', cmd: 'npx tsx deploy/enrich-repertoire.ts' },
  { name: 'pruning', cmd: 'npx tsx deploy/repertoire-prune.ts' },
];

for (const step of steps) {
  try {
    console.log(`→ Running ${step.name}...`);
    execSync(step.cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error(`${step.name} failed:`, e);
  }
}

console.log('\n=== Enrichment Complete ===');
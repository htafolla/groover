#!/usr/bin/env tsx
/**
 * Full Repertoire Enrichment (Ecosystem + Live Logs)
 * 
 * Runs both ingestion pipelines in sequence.
 * Intended to be run daily or after batches of inference.
 */

import { execSync } from 'node:child_process';

console.log('=== Full Repertoire Enrichment ===\n');

try {
  console.log('→ Running ecosystem ingestion...');
  execSync('npx tsx deploy/ingest-ecosystem-to-repertoire.ts', { stdio: 'inherit' });
} catch (e) {
  console.error('Ecosystem ingestion failed:', e);
}

try {
  console.log('\n→ Running Groover logs ingestion...');
  execSync('npx tsx deploy/ingest-groover-logs-to-repertoire.ts', { stdio: 'inherit' });
} catch (e) {
  console.error('Logs ingestion failed:', e);
}

try {
  console.log('\n→ Running general enrichment...');
  execSync('npx tsx deploy/enrich-repertoire.ts', { stdio: 'inherit' });
  execSync('npx tsx deploy/repertoire-prune.ts', { stdio: 'inherit' });', { stdio: 'inherit' });
} catch (e) {
  console.error('General enrichment failed:', e);
}

console.log('\n=== Enrichment Complete ===');

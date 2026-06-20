import type { Signal } from "./repertoire-utils";
#!/usr/bin/env tsx
/**
 * Full Ecosystem Ingestion → Repertoire
 * 
 * Recursively reads all .md files from verifiable-agent-ecosystem
 * and converts high-signal research into curated Repertoire signals.
 * 
 * Much stronger than the previous manual 4-signal extraction.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ECOSYSTEM_ROOT = '/tmp/verifiable-agent-ecosystem';
const REPERTOIRE_SIGNALS = 'research/repertoire-brain/curated_signals.json';

interface Signal {
  name: string;
  definition: string;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  evaluation_criteria: string;
  validation_experiment: string;
  master_index_integration: string;
  implementation_notes: string;
  source?: string;
}

function getAllMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (extname(entry) === '.md') {
      files.push(fullPath);
    }
  }
  return files;
}

function extractSignalsFromMarkdown(content: string, sourceFile: string): Signal[] {
  const signals: Signal[] = [];
  const lines = content.split('\n');

  // Simple but effective heuristic extraction
  let currentHeading = '';
  let currentSection: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect headings
    if (line.startsWith('#')) {
      // Process previous section before moving on
      if (currentHeading && currentSection.length > 3) {
        const signal = createSignalFromSection(currentHeading, currentSection.join('\n'), sourceFile);
        if (signal) signals.push(signal);
      }
      currentHeading = line.replace(/^#+\s*/, '');
      currentSection = [];
    } else if (line.length > 20) {
      currentSection.push(line);
    }
  }

  // Process last section
  if (currentHeading && currentSection.length > 3) {
    const signal = createSignalFromSection(currentHeading, currentSection.join('\n'), sourceFile);
    if (signal) signals.push(signal);
  }

  return signals;
}

function createSignalFromSection(heading: string, content: string, sourceFile: string): Signal | null {
  const lower = (heading + ' ' + content).toLowerCase();

  // Skip weak / meta sections
  if (lower.includes('table of contents') || lower.includes('executive summary')) return null;
  if (content.length < 120) return null;

  // Determine priority
  let priority: 'critical' | 'high' | 'medium' = 'medium';
  if (lower.includes('critical') || lower.includes('mandatory') || lower.includes('core')) priority = 'critical';
  else if (lower.includes('important') || lower.includes('key') || lower.includes('principle')) priority = 'high';

  // Generate clean name
  const name = heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);

  if (name.length < 5) return null;

  return {
    name,
    definition: content.slice(0, 600).replace(/\n/g, ' ').trim() + (content.length > 600 ? '...' : ''),
    tags: inferTags(heading, content),
    priority,
    evaluation_criteria: `The inference or proposal references concepts related to "${heading}".`,
    validation_experiment: `Test with content that contradicts or ignores the principle described in "${heading}".`,
    master_index_integration: `Register "${heading}" as a first-class concept in the Master Index.`,
    implementation_notes: `Extracted from ${sourceFile}. Consider expanding with more context from the original document.`,
    source: sourceFile.replace(ECOSYSTEM_ROOT, 'verifiable-agent-ecosystem'),
  };
}

function inferTags(heading: string, content: string): string[] {
  const text = (heading + ' ' + content).toLowerCase();
  const tags = new Set<string>();

  if (text.includes('governance')) tags.add('governance');
  if (text.includes('ontological')) tags.add('ontological-trap');
  if (text.includes('attestation')) tags.add('attestation');
  if (text.includes('consumer') || text.includes('boundary')) tags.add('consumer-boundary');
  if (text.includes('inference')) tags.add('inference');
  if (text.includes('three-subsystem') || text.includes('three subsystem')) tags.add('architecture');
  if (text.includes('mandatory') || text.includes('required')) tags.add('mandatory');
  if (text.includes('external')) tags.add('external-governance');

  if (tags.size === 0) tags.add('research-finding');

  return Array.from(tags);
}

function mergeSignals(existing: any, newSignals: Signal[]): { added: number; updated: number } {
  const byName = new Map(existing.signals.map((s: any) => [s.name, s]));
  let added = 0;
  let updated = 0;

  for (const sig of newSignals) {
    if (byName.has(sig.name)) {
      const current = byName.get(sig.name) as any;
      // Merge tags
      current.tags = [...new Set([...current.tags, ...sig.tags])];
      current.implementation_notes = (current.implementation_notes || '') + ' | ' + sig.implementation_notes;
      updated++;
    } else {
      byName.set(sig.name, {
        ...sig,
        first_seen: new Date().toISOString().split('T')[0],
        status: 'proposed',
        observation_stats: {
          observation_count: 0,
          avg_confidence: 0,
          max_confidence: 0,
          last_seen: new Date().toISOString(),
        },
        feedback_stats: {
          outcome_count: 0,
          success_count: 0,
          failure_count: 0,
        },
      });
      added++;
    }
  }

  existing.signals = Array.from(byName.values());
  existing.last_updated = new Date().toISOString();
  return { added, updated };
}

function main() {
  console.log('=== Full Ecosystem Ingestion into Repertoire ===\n');

  if (!existsSync(ECOSYSTEM_ROOT)) {
    console.error('Ecosystem repo not found at', ECOSYSTEM_ROOT);
    process.exit(1);
  }

  const mdFiles = getAllMarkdownFiles(ECOSYSTEM_ROOT);
  console.log(`Found ${mdFiles.length} markdown files.\n`);

  let allSignals: Signal[] = [];

  for (const file of mdFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      const signals = extractSignalsFromMarkdown(content, file);
      allSignals.push(...signals);
    } catch (e) {
      console.warn(`  Skipping ${file}: ${e}`);
    }
  }

  console.log(`Extracted ${allSignals.length} candidate signals.\n`);

  const existing = JSON.parse(readFileSync(REPERTOIRE_SIGNALS, 'utf8'));
  const result = mergeSignals(existing, allSignals);

  writeFileSync(REPERTOIRE_SIGNALS, JSON.stringify(existing, null, 2));

  console.log('Ingestion complete.');
  console.log(`  New signals added:     ${result.added}`);
  console.log(`  Existing signals updated: ${result.updated}`);
  console.log(`  Total signals now:     ${existing.signals.length}`);
}

main();
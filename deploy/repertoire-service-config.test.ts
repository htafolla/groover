import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { repertoireServicePaths } from './repertoire-service-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROOVER_ROOT = join(__dirname, '..');

describe('repertoireServicePaths', () => {
  it('defaults signals to research/repertoire-brain SSOT', () => {
    const paths = repertoireServicePaths(GROOVER_ROOT);
    expect(paths.signalsPath).toContain('research/repertoire-brain/curated_signals.json');
    expect(paths.dataDir).toContain('research/repertoire-brain');
  });
});
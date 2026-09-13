import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIVE_AGENT_DOC_BASES, parseAgentDocBases } from './check-agent-docs.js';

describe('check-agent-docs CLI (Task C2)', () => {
  it('parses repeated --base and defaults live hosts when omitted', () => {
    expect(parseAgentDocBases(['--base', 'http://127.0.0.1:3456/'])).toEqual([
      'http://127.0.0.1:3456',
    ]);
    expect(
      parseAgentDocBases([
        '--base',
        'https://registry-production-e2c4.up.railway.app',
        '--base',
        'https://website-production-c0da.up.railway.app',
      ]),
    ).toEqual([...LIVE_AGENT_DOC_BASES]);
    expect(LIVE_AGENT_DOC_BASES).toEqual([
      'https://registry-production-e2c4.up.railway.app',
      'https://website-production-c0da.up.railway.app',
    ]);
  });

  it('CI must curl the Railway-shaped registry, not only vitest', () => {
    const ci = readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('deploy/check-agent-docs.ts');
    expect(ci).toContain('packages/marketplace/src/mcp-server.ts');
    expect(ci).toContain('--base http://127.0.0.1:3456');
  });
});

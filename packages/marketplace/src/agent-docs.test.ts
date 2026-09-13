import { createServer, type AddressInfo } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AGENT_DOC_FILES, loadAgentDoc } from './agent-docs.js';
import {
  AGENT_DOC_HEADINGS,
  AGENT_DOC_KEYWORDS,
  evaluateAgentDocResponse,
  fetchAndEvaluateAgentDocs,
} from './agent-docs-gate.js';
import { handleRegistryRequest } from './mcp-server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const marketplaceDocs = path.join(here, '../agent-docs');
const websiteStatic = path.join(repoRoot, 'website/static');

describe('registry agent-doc HTTP routes', () => {
  let baseUrl = '';
  const server = createServer((req, res) => {
    void handleRegistryRequest(req, res);
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it.each(Object.entries(AGENT_DOC_FILES))(
    'GET %s returns 200 and is not the MCP banner',
    async (route, spec) => {
      const res = await fetch(`${baseUrl}${route}`);
      const text = await res.text();
      expect(res.headers.get('content-type')).toBe(spec.contentType);
      expect(
        evaluateAgentDocResponse({
          path: route,
          status: res.status,
          contentType: res.headers.get('content-type'),
          body: text,
        }),
      ).toEqual({ ok: true });
      if (route === '/AGENTS.md' || route === '/SKILLS.md' || route === '/llms.txt') {
        expect(text).toContain('shop-pin');
      }
      expect(text).toMatch(/Core docs \(every project\)|# Changelog/);
    },
  );

  it('gate fails the three paths if the registry still serves the MCP banner', async () => {
    const reasons = await fetchAndEvaluateAgentDocs(baseUrl);
    expect(reasons).toEqual([]);
  });

  it('query strings still resolve the markdown file', async () => {
    const res = await fetch(`${baseUrl}/AGENTS.md?src=agent`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('# AGENTS.md');
  });

  it('unknown GET still returns the MCP banner', async () => {
    const res = await fetch(`${baseUrl}/not-a-doc`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Groover MCP Registry active');
  });
});

describe('website static agent docs', () => {
  it('gitignores mill AGENTS/SKILLS but keep factory copies trackable', () => {
    const gitignore = readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toContain('!packages/marketplace/agent-docs/AGENTS.md');
    expect(gitignore).toContain('!packages/marketplace/agent-docs/SKILLS.md');
    expect(gitignore).toContain('!website/static/AGENTS.md');
    expect(gitignore).toContain('!website/static/SKILLS.md');
  });

  it('ships matching core docs at static root (general first)', () => {
    const names = ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'SKILLS.md', 'llms.txt'] as const;
    for (const name of names) {
      const marketplace = path.join(marketplaceDocs, name);
      const website = path.join(websiteStatic, name);
      expect(existsSync(marketplace)).toBe(true);
      expect(existsSync(website)).toBe(true);
      const body = readFileSync(website, 'utf8');
      expect(body).toBe(readFileSync(marketplace, 'utf8'));
      expect(body).toBe(loadAgentDoc(`/${name}`)?.body);
      expect(body).toContain(AGENT_DOC_HEADINGS[name]);
    }
    for (const name of ['AGENTS.md', 'SKILLS.md', 'llms.txt'] as const) {
      const bodyLower = readFileSync(path.join(websiteStatic, name), 'utf8').toLowerCase();
      for (const keyword of AGENT_DOC_KEYWORDS) {
        expect(bodyLower).toContain(keyword.toLowerCase());
      }
    }
    const rootReadme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
    const rootChangelog = readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
    expect(rootReadme).toBe(readFileSync(path.join(marketplaceDocs, 'README.md'), 'utf8'));
    expect(rootChangelog).toBe(readFileSync(path.join(marketplaceDocs, 'CHANGELOG.md'), 'utf8'));
  });
});

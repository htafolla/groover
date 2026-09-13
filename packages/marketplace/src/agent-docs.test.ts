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
    'GET %s returns 200 with factory headings/keywords',
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
      expect(text).toContain('shop-pin');
    },
  );

  it('gate fails the three paths if the registry still serves the MCP banner', async () => {
    const reasons = await fetchAndEvaluateAgentDocs(baseUrl);
    expect(reasons).toEqual([]);
  });

  it('query strings still resolve the markdown file', async () => {
    const res = await fetch(`${baseUrl}/AGENTS.md?src=agent`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('# Groover — factory (agents)');
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

  it('ships matching AGENTS.md, SKILLS.md, llms.txt at static root', () => {
    for (const name of ['AGENTS.md', 'SKILLS.md', 'llms.txt'] as const) {
      const marketplace = path.join(marketplaceDocs, name);
      const website = path.join(websiteStatic, name);
      expect(existsSync(marketplace)).toBe(true);
      expect(existsSync(website)).toBe(true);
      const body = readFileSync(website, 'utf8');
      expect(body).toBe(readFileSync(marketplace, 'utf8'));
      expect(body).toBe(loadAgentDoc(`/${name}`)?.body);
      expect(body).toContain(AGENT_DOC_HEADINGS[name]);
      for (const keyword of AGENT_DOC_KEYWORDS) {
        expect(body).toContain(keyword);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { AGENT_DOC_FILES } from './agent-docs.js';
import {
  AGENT_DOC_HEADINGS,
  AGENT_DOC_KEYWORDS,
  MCP_REGISTRY_BANNER,
  evaluateAgentDocResponse,
} from './agent-docs-gate.js';

const goodBody = [
  '# AGENTS.md',
  'Factory E2E',
  'mint_suit',
  '0x045B35480F289F8f83F53345A0f367875958957a',
  'govern_with_solar',
  'register_plugin',
  'Dynamo is not required for register',
  'solar hammer',
  'Retry until approved',
].join('\n');

describe('agent-docs HTTP gate', () => {
  it('fails the 2026-09-13 production miss (200 + MCP banner)', () => {
    const result = evaluateAgentDocResponse({
      path: '/AGENTS.md',
      status: 200,
      contentType: 'text/plain',
      body: `${MCP_REGISTRY_BANNER}. GET /sse, POST /messages, POST /mcp.`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/banner/i);
    }
  });

  it('fails missing routes (404 / non-200)', () => {
    const result = evaluateAgentDocResponse({
      path: '/SKILLS.md',
      status: 404,
      contentType: 'text/html',
      body: '<!doctype html><html><title>Page Not Found</title></html>',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/HTTP 404 \(missing\)/);
    }
  });

  it('fails Docusaurus HTML 404 masquerading as a page', () => {
    const result = evaluateAgentDocResponse({
      path: '/AGENTS.md',
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="en">not markdown</html>',
    });
    expect(result.ok).toBe(false);
  });

  it('passes factory markdown', () => {
    const result = evaluateAgentDocResponse({
      path: '/AGENTS.md',
      status: 200,
      contentType: 'text/markdown; charset=utf-8',
      body: goodBody,
    });
    expect(result).toEqual({ ok: true });
  });

  it('covers the general core set then factory trio', () => {
    expect(Object.keys(AGENT_DOC_FILES)).toEqual([
      '/README.md',
      '/CHANGELOG.md',
      '/AGENTS.md',
      '/SKILLS.md',
      '/llms.txt',
    ]);
    expect(AGENT_DOC_HEADINGS['llms.txt']).toBe('# llms.txt');
    expect(AGENT_DOC_HEADINGS['README.md']).toBe('# Groover');
    expect(AGENT_DOC_KEYWORDS).toContain('mint_suit');
  });

  it('README/CHANGELOG pass without factory keywords', () => {
    expect(
      evaluateAgentDocResponse({
        path: '/README.md',
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Groover\n\n## Core docs (every project)\n',
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateAgentDocResponse({
        path: '/CHANGELOG.md',
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Changelog\n\n## 2026-09-13\n',
      }),
    ).toEqual({ ok: true });
  });
});

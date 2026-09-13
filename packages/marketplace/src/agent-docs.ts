/**
 * Core docs (every project) then Groover-specific, served as GET
 * /README.md /CHANGELOG.md /package.json /AGENTS.md /SKILLS.md /llms.txt.
 * Files live in packages/marketplace/agent-docs (copied to website/static).
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT_DOC_FILES = {
  '/README.md': { file: 'README.md', contentType: 'text/markdown; charset=utf-8' },
  '/CHANGELOG.md': { file: 'CHANGELOG.md', contentType: 'text/markdown; charset=utf-8' },
  '/package.json': { file: 'package.json', contentType: 'application/json; charset=utf-8' },
  '/AGENTS.md': { file: 'AGENTS.md', contentType: 'text/markdown; charset=utf-8' },
  '/SKILLS.md': { file: 'SKILLS.md', contentType: 'text/markdown; charset=utf-8' },
  '/llms.txt': { file: 'llms.txt', contentType: 'text/plain; charset=utf-8' },
} as const;

export type AgentDocPath = keyof typeof AGENT_DOC_FILES;

/** Task C2 live acceptance: these three must be 200 factory markdown. */
export const FACTORY_DOC_PATHS = ['/AGENTS.md', '/SKILLS.md', '/llms.txt'] as const;

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../agent-docs');

const cache = new Map<string, string>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function agentDocPathname(url: string | undefined): string {
  const raw = url ?? '/';
  const pathOnly = raw.split('?')[0]?.split('#')[0] ?? '/';
  return pathOnly;
}

export function loadAgentDoc(pathname: string): { contentType: string; body: string } | null {
  if (!(pathname in AGENT_DOC_FILES)) {
    return null;
  }
  const spec = AGENT_DOC_FILES[pathname as AgentDocPath];
  let body = cache.get(spec.file);
  if (body === undefined) {
    body = readFileSync(join(DOCS_DIR, spec.file), 'utf8');
    cache.set(spec.file, body);
  }
  return { contentType: spec.contentType, body };
}

export function tryServeAgentDoc(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  const doc = loadAgentDoc(agentDocPathname(req.url));
  if (!doc) {
    return false;
  }
  res.writeHead(200, {
    'Content-Type': doc.contentType,
    'Cache-Control': 'public, max-age=60',
    ...CORS_HEADERS,
  });
  res.end(req.method === 'HEAD' ? undefined : doc.body);
  return true;
}

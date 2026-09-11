/**
 * What an agent actually runs. Env only:
 *   GROOVER_DID  GROOVER_API_KEY
 * Optional:
 *   GROOVER_MCP  default https://groover.rippel.ai/mcp
 *   HOLDER       0x to dry-run mint toward
 *
 * Does not print the API key. Exit 0 if the agent can: search, list, dry-run mint.
 */
const MCP = process.env.GROOVER_MCP || 'https://groover.rippel.ai/mcp';
const DID = process.env.GROOVER_DID || '';
const KEY = process.env.GROOVER_API_KEY || '';
const HOLDER = process.env.HOLDER || '0xd45CcF98D6db5A36E7CdD10ffae0b685BF27CE43';
const FILE_8004 =
  'https://website-production-c0da.up.railway.app/identity/registration/grvr-2-v2.json';

async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const body = (await res.json()) as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message?: string };
  };
  if (body.error) throw new Error(body.error.message ?? 'mcp error');
  const text = body.result?.content?.[0]?.text;
  if (!text) throw new Error(`empty result from ${name}`);
  return JSON.parse(text) as unknown;
}

async function main(): Promise<void> {
  if (!DID || !KEY) {
    process.stderr.write('Set GROOVER_DID and GROOVER_API_KEY\n');
    process.exit(2);
  }
  const health = await fetch(new URL(MCP).origin).then((r) => r.json()) as { status?: string };
  process.stdout.write(`health ${health.status}\n`);

  const listed = (await call('list_mcp_servers')) as { count?: number };
  process.stdout.write(`list_mcp_servers ${listed.count}\n`);

  const found = (await call('search_plugins', { query: DID.slice(-12) })) as {
    count?: number;
    success?: boolean;
  };
  process.stdout.write(`search ${found.success} count=${found.count}\n`);

  const minted = (await call('mint_suit', {
    did: DID,
    apiKey: KEY,
    pack: 'groover-identity',
    to: HOLDER,
    dryRun: true,
  })) as { success?: boolean; dryRun?: boolean; dna?: string };
  process.stdout.write(`mint_suit dryRun=${minted.dryRun} success=${minted.success} dna=${minted.dna?.slice(0, 18)}\n`);

  const file = (await fetch(FILE_8004).then((r) => r.json())) as {
    active?: boolean;
    registrations?: Array<{ agentId?: string }>;
  };
  process.stdout.write(`erc8004 active=${file.active} agentId=${file.registrations?.[0]?.agentId}\n`);

  const clearing = (await fetch('https://clearing-production-9968.up.railway.app/health').then((r) => r.json())) as {
    status?: string;
  };
  process.stdout.write(`clearing ${clearing.status}\n`);

  const ok =
    health.status === 'healthy' &&
    minted.success === true &&
    minted.dryRun === true &&
    clearing.status === 'healthy';
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

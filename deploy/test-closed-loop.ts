/**
 * Closed cyclical loop (read-only):
 * Groover registry → GRVR on Base → 8004 registration file → factory page → back to DID.
 * Exit 0 only if every required hop agrees. On-chain ERC-8004 register is OPEN_GATE.
 */
const DID = 'did:groover:f60a3753b5ef6dd3';
const TOKEN_ID = 2n;
const CONTRACT = '0xD892D6836ab138a5aE4365dcb05Adb296607d6f9' as const;
const HOLDER = '0xd45CcF98D6db5A36E7CdD10ffae0b685BF27CE43';
const TX = '0x91aad4366860a38ae83282b386c03acc5f6217a1eedcf1a9e8c77a1317e450ab';
const REGISTRY = 'https://groover.rippel.ai';
const FACTORY = 'https://website-production-c0da.up.railway.app';
const FILE_8004 = `${FACTORY}/identity/registration/grvr-2-v1.json`;
const RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base-rpc.publicnode.com',
];

type Hop = { name: string; ok: boolean; detail: string; required: boolean };

const hops: Hop[] = [];

function note(name: string, ok: boolean, detail: string, required = true): void {
  hops.push({ name, ok, detail, required });
  const mark = ok ? 'PASS' : required ? 'FAIL' : 'OPEN';
  process.stdout.write(`[${mark}] ${name} — ${detail}\n`);
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = 'no rpc';
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (!res.ok) {
        last = `${url} http ${res.status}`;
        continue;
      }
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) {
        last = body.error.message ?? 'rpc error';
        continue;
      }
      return body.result;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
}

function encodeOwnerOf(tokenId: bigint): `0x${string}` {
  const sel = '6352211e';
  const id = tokenId.toString(16).padStart(64, '0');
  return `0x${sel}${id}`;
}

function encodeTokenUri(tokenId: bigint): `0x${string}` {
  const sel = 'c87b56dd';
  const id = tokenId.toString(16).padStart(64, '0');
  return `0x${sel}${id}`;
}

function decodeAddress(data: string): string {
  return `0x${data.slice(-40)}`;
}

function decodeAbiString(data: string): string {
  const hex = data.startsWith('0x') ? data.slice(2) : data;
  const strOff = parseInt(hex.slice(0, 64), 16) * 2;
  const strLen = parseInt(hex.slice(strOff, strOff + 64), 16);
  const strHex = hex.slice(strOff + 64, strOff + 64 + strLen * 2);
  return Buffer.from(strHex, 'hex').toString('utf8');
}

async function grooverCall(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${REGISTRY}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const rpcBody = (await res.json()) as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message?: string };
  };
  if (rpcBody.error) throw new Error(rpcBody.error.message ?? 'mcp error');
  const text = rpcBody.result?.content?.[0]?.text;
  if (!text) throw new Error('empty mcp result');
  return JSON.parse(text) as unknown;
}

async function main(): Promise<void> {
  const healthRes = await fetch(REGISTRY);
  const health = (await healthRes.json()) as { status?: string; server?: string };
  note('groover-health', health.status === 'healthy', JSON.stringify(health));

  const search = (await grooverCall('search_plugins', { query: 'grok-build' })) as {
    success?: boolean;
    count?: number;
    results?: Array<{ fingerprint?: string }>;
  };
  note(
    'groover-search-did',
    Boolean(search.success && (search.count ?? 0) >= 1),
    `count=${search.count} fp=${search.results?.[0]?.fingerprint ?? ''}`,
  );

  const ownerData = (await rpc('eth_call', [
    { to: CONTRACT, data: encodeOwnerOf(TOKEN_ID) },
    'latest',
  ])) as string;
  const owner = decodeAddress(ownerData);
  note('grvr-owner', owner.toLowerCase() === HOLDER.toLowerCase(), `owner=${owner}`);

  const uriData = (await rpc('eth_call', [
    { to: CONTRACT, data: encodeTokenUri(TOKEN_ID) },
    'latest',
  ])) as string;
  const tokenUri = decodeAbiString(uriData);
  let metaDid = '';
  if (tokenUri.startsWith('data:application/json;base64,')) {
    const json = Buffer.from(tokenUri.split(',')[1] ?? '', 'base64').toString('utf8');
    const meta = JSON.parse(json) as { name?: string; description?: string };
    metaDid = meta.description?.includes(DID) || meta.name?.includes(DID) ? DID : '';
    note(
      'grvr-tokenuri-did',
      json.includes(DID),
      `name=${meta.name ?? ''} hasDid=${json.includes(DID)}`,
    );
  } else {
    note('grvr-tokenuri-did', tokenUri.includes(DID), tokenUri.slice(0, 80));
  }

  const receipt = (await rpc('eth_getTransactionReceipt', [TX])) as {
    status?: string;
    to?: string;
  } | null;
  note(
    'grvr-tx',
    receipt?.status === '0x1' && receipt.to?.toLowerCase() === CONTRACT.toLowerCase(),
    `status=${receipt?.status} to=${receipt?.to ?? ''}`,
  );

  const fileRes = await fetch(FILE_8004);
  const file = (await fileRes.json()) as {
    type?: string;
    groover?: { did?: string; grvrTokenId?: string; grvrContract?: string };
    services?: Array<{ name: string; endpoint: string }>;
    active?: boolean;
    registrations?: unknown;
  };
  const didSvc = file.services?.find((s) => s.name === 'DID');
  const grvrSvc = file.services?.find((s) => s.name === 'GRVR');
  const fileOk =
    file.groover?.did === DID &&
    file.groover?.grvrTokenId === '2' &&
    didSvc?.endpoint === DID &&
    (grvrSvc?.endpoint ?? '').includes('/2');
  note('8004-file-binds-grvr', fileOk && fileRes.ok, `active=${file.active} type=${file.type}`);

  const factoryRes = await fetch(`${FACTORY}/suit`);
  const factoryHtml = await factoryRes.text();
  note(
    'factory-shows-did-and-token',
    factoryHtml.includes(DID) && (factoryHtml.includes('#2') || factoryHtml.includes(TX)),
    `bytes=${factoryHtml.length}`,
  );

  const pngRes = await fetch(`${FACTORY}/img/base-agentic-ecosystem.png`);
  note('factory-diagram-png', pngRes.ok && Number(pngRes.headers.get('content-length') || 0) > 10000, `http=${pngRes.status}`);

  const clearingHealth = (await fetch('https://clearing-production-9968.up.railway.app/health').then((r) => r.json())) as {
    status?: string;
    server?: string;
    tools?: number;
  };
  note(
    'clearing-mcp',
    clearingHealth.status === 'healthy' && clearingHealth.server === 'clearing',
    `tools=${clearingHealth.tools ?? 0} status=${clearingHealth.status}`,
  );

  // Cycle back: chain DID == file DID == factory DID
  const cycle =
    metaDid === DID && file.groover?.did === DID && factoryHtml.includes(DID) && owner.toLowerCase() === HOLDER.toLowerCase();
  note('cycle-did-registry-chain-file-factory', cycle, `did=${DID} token=2`);

  const v2Res = await fetch(`${FACTORY}/identity/registration/grvr-2-v2.json`);
  let v2Ok = false;
  let v2Detail = `http=${v2Res.status}`;
  if (v2Res.ok) {
    const v2 = (await v2Res.json()) as {
      active?: boolean;
      registrations?: Array<{ agentId?: string; agentRegistry?: string }>;
      groover?: { did?: string };
    };
    v2Ok =
      v2.active === true &&
      v2.registrations?.[0]?.agentId === '86025' &&
      v2.groover?.did === DID;
    v2Detail = `agentId=${v2.registrations?.[0]?.agentId ?? ''} active=${v2.active}`;
  }
  note('8004-onchain-register', v2Ok, v2Detail);

  const requiredFail = hops.filter((h) => h.required && !h.ok);
  const open = hops.filter((h) => !h.required && !h.ok);
  process.stdout.write(
    `\nrequired ${hops.filter((h) => h.required).length - requiredFail.length}/${hops.filter((h) => h.required).length}  open-gates ${open.length}\n`,
  );
  if (requiredFail.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`FATAL ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

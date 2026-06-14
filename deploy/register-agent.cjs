#!/usr/bin/env node
/**
 * register-agent.cjs — Register an AI agent with the Groover marketplace.
 *
 * Usage (legacy HMAC — no crypto proof):
 *   node deploy/register-agent.cjs \
 *     --pubkey <hex> --payload <str> --metadata '{"name":"my-agent"}'
 *
 * Usage (Proof-of-Possession — recommended, uses ed25519):
 *   node deploy/register-agent.cjs \
 *     --pubkey "<pem>" --payload <str> --metadata '{"name":"my-agent"}' \
 *     --secret-key "<pem>"   # ed25519 private key (PKCS#8 PEM) to sign PoP challenge
 *
 * Generate a keypair:
 *   npx tsx -e "import{g from'./packages/identity/src/index.ts'};const k=g.generateKeyPair();console.log(JSON.stringify(k))"
 *
 * Environment variables:
 *   REGISTRY_URL   — MCP endpoint (default: from Railway live deploy)
 *
 * Output: JSON with { success, did, apiKey, pop }
 */

const https = require('https');
const crypto = require('crypto');

const REGISTRY_URL = process.env.REGISTRY_URL || 'https://registry-production-e2c4.up.railway.app';

function postMcp(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
    const url = new URL(REGISTRY_URL + '/mcp');
    const req = https.request({
      hostname: url.hostname, port: url.port || 443, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseMcpResult(rpc) {
  try {
    const content = rpc.result?.content?.[0];
    if (!content) return null;
    return JSON.parse(content.text);
  } catch { return null; }
}

function isHex(s) {
  return /^[0-9a-fA-F]+$/.test(s);
}

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '');
    args[key] = process.argv[i + 1];
  }

  if (!args.pubkey || !args.payload) {
    console.error('Usage: node deploy/register-agent.cjs --pubkey <hex|pem> --payload <str> [--metadata <json>] [--secret-key <pem>]');
    process.exit(1);
  }

  let metadata = {};
  try { metadata = args.metadata ? JSON.parse(args.metadata) : {}; } catch { metadata = { name: args.metadata }; }

  let signature = undefined;
  let challengeNonce = undefined;

  if (args['secret-key']) {
    // Step 1: Get challenge nonce from server
    const chalRpc = await postMcp('tools/call', {
      name: 'get_registration_challenge',
      arguments: { pubkey: args.pubkey },
    });
    const chal = parseMcpResult(chalRpc);
    if (!chal || !chal.success) {
      throw new Error('Failed to get registration challenge: ' + JSON.stringify(chal));
    }
    challengeNonce = chal.nonce;
    console.error('[register-agent] Got challenge nonce:', challengeNonce.slice(0, 16) + '...');

    // Step 2: Sign { nonce + payload } with agent's ed25519 private key
    // Accept PKCS#8 PEM string or raw 32-byte hex seed
    const msg = Buffer.from(challengeNonce + args.payload, 'utf-8');
    let privateKey;
    if (args['secret-key'].includes('PRIVATE KEY')) {
      privateKey = crypto.createPrivateKey(args['secret-key']);
    } else {
      const raw = Buffer.from(args['secret-key'], 'hex');
      if (raw.length === 32) {
        // Wrap raw 32-byte seed into PKCS#8 DER for crypto.sign
        const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
        privateKey = crypto.createPrivateKey({ key: Buffer.concat([prefix, raw]), format: 'der', type: 'pkcs8' });
      } else {
        privateKey = crypto.createPrivateKey({ key: args['secret-key'], format: 'der', type: 'pkcs8' });
      }
    }
    const sig = crypto.sign(null, msg, privateKey);
    signature = sig.toString('hex');
    console.error('[register-agent] Generated PoP signature:', signature.slice(0, 16) + '...');
  }

  // Step 3: Register plugin
  const regRpc = await postMcp('tools/call', {
    name: 'register_plugin',
    arguments: {
      pubkey: args.pubkey,
      payload: args.payload,
      metadata,
      signature,
      challengeNonce,
    },
  });
  const result = parseMcpResult(regRpc);
  if (!result) {
    console.error('Unexpected MCP response:', JSON.stringify(regRpc, null, 2));
    process.exit(1);
  }
  if (!result.success) {
    console.error('Registration failed:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    did: result.did || result.record?.did,
    apiKey: result.record?.apiKey,
    pubkey: args.pubkey,
    pop: !!signature,
  }, null, 2));
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

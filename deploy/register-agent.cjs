#!/usr/bin/env node
/**
 * register-agent.cjs — Register an AI agent with the Groover marketplace.
 *
 * Uses ed25519 Proof-of-Possession: agent signs a server-issued nonce to prove
 * it controls the private key corresponding to its public key.
 *
 * Usage:
 *   node deploy/register-agent.cjs \
 *     --pubkey "<pem>" --payload <str> --secret-key "<pem>" \
 *     --metadata '{"name":"my-agent"}'
 *
 * Generate a keypair:
 *   npx tsx -e "
 *     import {generateKeyPair} from './packages/identity/src/index.ts';
 *     const k = generateKeyPair();
 *     console.log(JSON.stringify(k));
 *   "
 *
 * Environment:
 *   REGISTRY_URL — MCP endpoint (default: Railway live deploy)
 *
 * Output: JSON with { success, did, apiKey }
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

function loadPrivateKey(keyStr) {
  if (keyStr.includes('PRIVATE KEY')) {
    return crypto.createPrivateKey(keyStr);
  }
  const raw = Buffer.from(keyStr, 'hex');
  if (raw.length === 32) {
    const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    return crypto.createPrivateKey({ key: Buffer.concat([prefix, raw]), format: 'der', type: 'pkcs8' });
  }
  return crypto.createPrivateKey({ key: keyStr, format: 'der', type: 'pkcs8' });
}

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  }

  if (!args.pubkey || !args.payload || !args['secret-key']) {
    console.error('Usage: node deploy/register-agent.cjs --pubkey "<pem>" --payload <str> --secret-key "<pem>" [--metadata <json>]');
    process.exit(1);
  }

  let metadata = {};
  try { metadata = args.metadata ? JSON.parse(args.metadata) : {}; } catch { metadata = { name: args.metadata }; }

  // Step 1: Get challenge nonce from server
  const chalRpc = await postMcp('tools/call', {
    name: 'get_registration_challenge',
    arguments: { pubkey: args.pubkey },
  });
  const chal = parseMcpResult(chalRpc);
  if (!chal || !chal.success) {
    throw new Error('Failed to get registration challenge: ' + JSON.stringify(chal));
  }
  const challengeNonce = chal.nonce;
  console.error('[register-agent] Got challenge nonce:', challengeNonce.slice(0, 16) + '...');

  // Step 2: Sign { nonce + payload } with ed25519 private key
  const msg = Buffer.from(challengeNonce + args.payload, 'utf-8');
  const privateKey = loadPrivateKey(args['secret-key']);
  const signature = crypto.sign(null, msg, privateKey).toString('hex');
  console.error('[register-agent] Generated PoP signature:', signature.slice(0, 16) + '...');

  // Step 3: Register
  const regRpc = await postMcp('tools/call', {
    name: 'register_plugin',
    arguments: { pubkey: args.pubkey, payload: args.payload, metadata, signature, challengeNonce },
  });
  const result = parseMcpResult(regRpc);
  if (!result || !result.success) {
    console.error('Registration failed:', JSON.stringify(result || regRpc, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    did: result.did || result.record?.did,
    apiKey: result.record?.apiKey,
    pubkey: args.pubkey,
  }, null, 2));
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

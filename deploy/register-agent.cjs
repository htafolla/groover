#!/usr/bin/env node
/**
 * register-agent.cjs — Register an AI agent with the Groover marketplace.
 *
 * Auto-generates an ed25519 keypair on first run. No manual key setup needed.
 * Uses Proof-of-Possession: agent signs a server-issued nonce to prove
 * it controls the private key corresponding to its public key.
 * Also solves the server's behavioral challenge puzzle (AI-ness verification).
 *
 * Usage:
 *   node deploy/register-agent.cjs --payload <str> [--metadata '{"name":"my-agent"}']
 *   node deploy/register-agent.cjs --pubkey "<pem>" --secret-key "<pem>" --payload <str>
 *
 * Environment:
 *   REGISTRY_URL — MCP endpoint (default: Railway live deploy)
 *
 * Output: JSON to stdout { success, did, apiKey, pubkey }
 * Progress messages go to stderr (not application logs).
 */

const https = require('https');
const crypto = require('crypto');

function log(msg) {
  process.stderr.write('[register-agent] ' + msg + '\n');
}

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

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  }

  if (!args.payload) {
    log('Usage: node deploy/register-agent.cjs --payload <str> [--metadata <json>]');
    log('');
    log('A fresh ed25519 keypair is auto-generated on each run. To reuse a keypair:');
    log('  node deploy/register-agent.cjs --pubkey "<pem>" --secret-key "<pem>" --payload <str>');
    process.exit(1);
  }

  let metadata = {};
  try { metadata = args.metadata ? JSON.parse(args.metadata) : {}; } catch { metadata = { name: args.metadata }; }

  // Generate or use provided ed25519 keypair (PEM format required by verifyWithPublic)
  let pubkey, secretKey;
  if (args.pubkey && args['secret-key']) {
    pubkey = args.pubkey;
    secretKey = args['secret-key'];
    log('Using provided keypair');
  } else {
    const kp = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    pubkey = kp.publicKey;
    secretKey = kp.privateKey;
    log('Generated fresh ed25519 keypair (PEM)');
  }

  // Step 1: Get challenge nonce + puzzle from server
  const chalRpc = await postMcp('tools/call', {
    name: 'get_registration_challenge',
    arguments: { pubkey },
  });
  const chal = parseMcpResult(chalRpc);
  if (!chal || !chal.success) {
    log('Failed to get registration challenge');
    throw new Error('Challenge failed: ' + JSON.stringify(chal));
  }
  const challengeNonce = chal.nonce;
  log('Got challenge nonce: ' + challengeNonce.slice(0, 16) + '...');

  // Step 2: Solve the deterministic behavioral puzzle
  let challengeSolution = '';
  if (chal.challenge) {
    const puzzle = chal.challenge;
    log('Solving puzzle type: ' + puzzle.type);
    if (puzzle.type === 'char-code') {
      challengeSolution = puzzle.input.split('').map(function(c) { return c.charCodeAt(0).toString(); }).join('-');
    } else if (puzzle.type === 'alternating-case') {
      challengeSolution = puzzle.input.split('').map(function(c, i) {
        return i % 2 === 0 ? c.toUpperCase() : c.toLowerCase();
      }).join('');
    } else if (puzzle.type === 'reverse-words') {
      challengeSolution = puzzle.input.split(' ').reverse().join(' ');
    }
    log('Solved puzzle, length ' + challengeSolution.length);
  }

  // Step 3: Sign { nonce + payload } with ed25519 private key
  const msg = Buffer.from(challengeNonce + '|' + args.payload, 'utf-8');
  const privateKeyObj = crypto.createPrivateKey(secretKey);
  const signature = crypto.sign(null, msg, privateKeyObj).toString('hex');
  log('Generated PoP signature: ' + signature.slice(0, 16) + '...');

  // Step 4: Register with signature + puzzle solution
  const regRpc = await postMcp('tools/call', {
    name: 'register_plugin',
    arguments: { pubkey, payload: args.payload, metadata, signature, challengeNonce, challengeSolution },
  });
  const result = parseMcpResult(regRpc);
  if (!result || !result.success) {
    log('Registration failed');
    process.stderr.write(JSON.stringify(result || regRpc, null, 2) + '\n');
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({
    success: true,
    did: result.did || result.record?.did,
    apiKey: result.record?.apiKey,
    pubkey: pubkey,
  }, null, 2));
}

main().catch(err => {
  log('Fatal: ' + err.message);
  process.exit(1);
});

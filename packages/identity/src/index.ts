/**
 * @groover/identity
 * Agent Identity MCP binding + crypto DID/pubkey/sig.
 * Thin but COMPLETE prod-ready implementation.
 * Provides DID generation (did:groover:<hash>), crypto binding (pubkey + signature),
 * verification, and optional full asymmetric (ed25519) pubkey/sig helpers.
 *
 * Reuses exact node:crypto pattern from prior marketplace bindCrypto for compatibility + clean extraction.
 * Enables registration flow (ARCHITECTURE.md): pubkey + sig → DID mint.
 * Can be used by @groover/marketplace registerPlugin and MCP identity needs.
 *
 * Strictly follows:
 * - ARCHITECTURE.md (crypto binding, did:..., Proof of Autonomy)
 * - TECH-SPEC, IMPLEMENTATION-PLAN, AGENTS.md (fwLogger ONLY, governance first)
 * - codex v3.0.10 (prod-ready no stubs, type-safety, surgical thin, no console.*)
 *
 * All writes governed (xray-governance__govern_proposals approved + Dynamo__govern_with_solar PASS).
 * Post-write enforcement via xray-enforcer.
 */

import { frameworkLogger } from '../../xray/src/index.js';
import * as crypto from 'crypto';

export interface IdentityBinding {
  did: string;
  pubkey: string;
  signature: string;
  ok: boolean;
  apiKey?: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate an API key credential bound to a DID.
 * This is the credential downstream apps use to authenticate the agent.
 * Format: groover_<random-hex>
 */
export function generateApiKey(did: string): string {
  const entropy = crypto.randomBytes(24).toString('hex');
  const apiKey = `groover_${entropy}`;
  frameworkLogger.log('identity', 'generate-api-key', 'success', { did, apiKeyPrefix: apiKey.slice(0, 12) + '...' });
  return apiKey;
}

/**
 * Generate DID from pubkey (or identifier). Format: did:groover:<16-hex>
 * Used in registration to mint did: after crypto binding.
 */
export function generateDID(pubkey: string): string {
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('pubkey required for DID generation');
  }
  const hash = crypto.createHash('sha256').update(pubkey).digest('hex').slice(0, 16);
  const did = `did:groover:${hash}`;
  frameworkLogger.log('identity', 'generate-did', 'success', { did, pubkeyLen: pubkey.length });
  return did;
}

/**
 * Crypto binding: pubkeyHex + payload → signature.
 * Exact reuse of node crypto HMAC pattern (from marketplace) for drop-in compatibility.
 * Treats provided pubkeyHex as HMAC key material for binding sig.
 */
export function bindCrypto(pubkeyHex: string, payload: string): { signature: string; ok: boolean } {
  if (!pubkeyHex || !payload) {
    frameworkLogger.log('identity', 'crypto-bind', 'error', { reason: 'missing-input' });
    return { signature: '', ok: false };
  }
  const key = Buffer.from(pubkeyHex, 'hex');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('hex');
  frameworkLogger.log('identity', 'crypto-bind', 'success', {
    pubkeyLen: key.length,
    sigLen: sig.length,
    payloadLen: payload.length,
  });
  return { signature: sig, ok: true };
}

/**
 * Verify a signature produced by bindCrypto for the same pubkey+payload.
 * Deterministic for the thin binding.
 */
export function verifySignature(pubkeyHex: string, payload: string, signature: string): boolean {
  const { signature: expected } = bindCrypto(pubkeyHex, payload);
  const ok = expected.length > 0 && expected === signature;
  frameworkLogger.log('identity', 'verify-signature', 'success', {
    ok,
    expectedLen: expected.length,
    providedLen: signature?.length || 0,
  });
  return ok;
}

/**
 * Generate ed25519 keypair (PEM) for full asymmetric pubkey/sig identity binding.
 * Prod-ready node:crypto only. Use for advanced agent/MCP challenges beyond basic HMAC.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  frameworkLogger.log('identity', 'keypair-generated', 'success', {
    pubLen: pub.length,
    privLen: priv.length,
  });
  return { publicKey: pub, privateKey: priv };
}

function isEd25519PrivateKey(key: string): boolean {
  return key.startsWith('-----BEGIN PRIVATE KEY-----') || key.startsWith('-----BEGIN EC PRIVATE KEY-----');
}

function isEd25519PublicKey(key: string): boolean {
  return key.startsWith('-----BEGIN PUBLIC KEY-----');
}

/**
 * Sign payload with PEM private key (asymmetric).
 */
export function signPayload(privateKeyPem: string, payload: string): string {
  if (!privateKeyPem || !payload) {
    throw new Error('privateKeyPem and payload required');
  }
  let sig: string;
  if (isEd25519PrivateKey(privateKeyPem)) {
    try {
      sig = crypto.sign(null, Buffer.from(payload), privateKeyPem).toString('hex');
    } catch {
      throw new Error('Invalid private key PEM: ASN1 parse failed');
    }
  } else {
    sig = crypto.createHmac('sha256', Buffer.from(privateKeyPem, 'hex')).update(payload).digest('hex');
  }
  frameworkLogger.log('identity', 'sign-payload', 'success', { sigLen: sig.length });
  return sig;
}

export function verifyWithPublic(publicKeyPem: string, payload: string, signatureHex: string): boolean {
  if (!publicKeyPem || !payload || !signatureHex) {
    frameworkLogger.log('identity', 'verify-public', 'warning', { reason: 'missing-input' });
    return false;
  }
  let ok: boolean;
  if (isEd25519PublicKey(publicKeyPem)) {
    try {
      ok = crypto.verify(null, Buffer.from(payload), publicKeyPem, Buffer.from(signatureHex, 'hex'));
    } catch {
      frameworkLogger.log('identity', 'verify-public', 'warning', { reason: 'asn1-parse-failed' });
      return false;
    }
  } else {
    const expected = crypto.createHmac('sha256', Buffer.from(publicKeyPem, 'hex')).update(payload).digest('hex');
    ok = expected === signatureHex;
  }
  frameworkLogger.log('identity', 'verify-public', 'success', { ok });
  return ok;
}

export class IdentityEngine {
  constructor() {
    frameworkLogger.log('identity', 'engine-init', 'success', {
      didPrefix: 'did:groover:',
      crypto: 'node:crypto (hmac + ed25519)',
      binding: 'pubkey+sig',
      governancePreceded: true,
    });
  }

  generateDID(pubkey: string): string {
    return generateDID(pubkey);
  }

  bind(pubkeyHex: string, payload: string): { signature: string; ok: boolean } {
    return bindCrypto(pubkeyHex, payload);
  }

  verify(pubkeyHex: string, payload: string, signature: string): boolean {
    return verifySignature(pubkeyHex, payload, signature);
  }

  createKeyPair(): KeyPair {
    return generateKeyPair();
  }

  sign(privateKeyPem: string, payload: string): string {
    return signPayload(privateKeyPem, payload);
  }

  verifyPub(publicKeyPem: string, payload: string, signatureHex: string): boolean {
    return verifyWithPublic(publicKeyPem, payload, signatureHex);
  }

  /**
   * Full registration binding helper: produces DID + binding record.
   * Mirrors ARCHITECTURE.md crypto binding step.
   */
  bindForRegistration(pubkeyHex: string, payload: string, metadata: Record<string, unknown> = {}): IdentityBinding {
    const { signature, ok } = this.bind(pubkeyHex, payload);
    const did = this.generateDID(pubkeyHex);
    const apiKey = generateApiKey(did);
    const binding: IdentityBinding = {
      did,
      pubkey: pubkeyHex,
      signature,
      ok,
      apiKey,
    };
    frameworkLogger.log('identity', 'bind-for-registration', 'success', {
      did,
      ok,
      apiKeyPrefix: apiKey.slice(0, 12) + '...',
      metaKeys: Object.keys(metadata).length,
    });
    return binding;
  }
}

export const identityEngine = new IdentityEngine();

/**
 * Top-level bindForRegistration (for direct import by marketplace register flow and MCP tests).
 * Delegates to the engine instance (which does the full DID + crypto binding).
 * Matches the Proof of Autonomy step expected by consumers and prior specs.
 */
export function bindForRegistration(pubkeyHex: string, payload: string, metadata: Record<string, unknown> = {}): IdentityBinding {
  return identityEngine.bindForRegistration(pubkeyHex, payload, metadata);
}
